"""Reusable isolated Playwright coverage; call run(context, base_url, subject).

context must already have a fictional, verified Clerk session (example.com).
Uses sync Playwright, asserts actual provider/editor/hook behavior, never a DB.
No stored cookies, test credentials, or auth bypass are part of this runner.
"""
import json
import time
from urllib.parse import urlparse
from playwright.sync_api import expect


CONTROLS = r"""mode => {
  window.__fallbackControls = { blockedPolls: 0, channels: 0, posts: 0, deliveries: 0 };
  const controls = window.__fallbackControls;
  const interval = window.setInterval.bind(window);
  let fakeTimer = -1;
  window.setInterval = (callback, delay, ...args) => {
    if (delay === 30000) { controls.blockedPolls++; return fakeTimer--; }
    return interval(callback, delay, ...args);
  };
  if (mode === 'absent') {
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true });
  } else {
    // Counters cover only the operational-profile channel; Clerk's own channels
    // (clerk, clerk:session_token) are silenced too but not counted here.
    window.BroadcastChannel = class extends EventTarget {
      constructor(name) {
        super(); this.name = String(name);
        if (this.name.startsWith('operational-profile:')) controls.channels++;
      }
      postMessage() {
        if (this.name.startsWith('operational-profile:')) controls.posts++;
      } // Deliberately no delivery.
      close() {}
    };
  }
}"""

DOCUMENT = """<!doctype html><html><head><title>Isolated assignment test</title>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
window.__harnessModule = await import('/tests/browser/assignment-fallback-harness.tsx');
</script></head><body></body></html>"""


def profile(subject, token, version):
    identity = {
        "assignmentToken": token, "districtToken": token[:4],
        "cadUnit": token, "company": token[4],
    }
    if len(token) == 7:
        identity["side"] = token[6]
    return {"subject": subject, "role": "FTO", "badge": "FICTIONAL-FTO",
            "version": version, "identity": identity}


def run(context, base_url, subject):
    """Four cases: absent/silent channel crossed with focus/online transitions.

    base_url is the running portal development origin, not production.
    Returns JSON-serializable evidence; assertion failures propagate.
    """
    results = []
    for channel in ("absent", "silent"):
        for transition in ("focus", "online"):
            page = context.new_page()
            saved = profile(subject, "9150E-1", 1)
            requests, dispatches, held, denied = [], [], [], []
            abort_profile = False

            def route_api(route):
                nonlocal saved
                request = route.request
                path = urlparse(request.url).path
                if path == "/api/v1/account/operational-profile":
                    requests.append({"method": request.method, "version": saved["version"],
                                     "aborted": abort_profile})
                    if abort_profile:
                        route.abort("failed")
                    elif request.method == "GET":
                        route.fulfill(json=saved)
                    else:
                        # Any unexpected write is a hard failure, not a real API call.
                        denied.append(path + ":" + request.method)
                        route.fulfill(status=405, json={"error": "Fixture is read-only"})
                elif path == "/api/v1/account/operational-profile/history":
                    route.fulfill(json={"subject": subject, "entries": [], "nextBeforeVersion": None})
                elif path == "/api/v1/dispatch/event-ingress":
                    body = request.post_data_json
                    assert body == {"eventId": "FICTIONAL-FALLBACK-EVENT",
                                    "cadUnit": saved["identity"]["cadUnit"]}
                    dispatches.append(body)
                    if body["cadUnit"] == "9150E-1":
                        held.append(route)
                    else:
                        route.fulfill(json={"status": "success", "metadata": {"total_records": 1},
                                            "data": [{"location": "Fictional current location",
                                                      "cadIdentity": saved["identity"]}]})
                else:
                    denied.append(path)
                    route.fulfill(status=503, json={"error": "Unconfigured test API"})

            try:
                page.route("**/api/**", route_api)
                page.route("**/__assignment-fallback-test", lambda route: route.fulfill(
                    content_type="text/html", body=DOCUMENT))
                page.add_init_script("(" + CONTROLS + ")(" + json.dumps(channel) + ")")
                page.goto(base_url.rstrip("/") + "/__assignment-fallback-test")
                page.wait_for_function("window.__harnessModule")
                page.evaluate("window.__fallbackHarness = window.__harnessModule.mount()")
                field = page.get_by_test_id("input-operational-assignment")
                expect(field).to_have_value("9150E-1")
                page.wait_for_function("window.__fallbackHarness.snapshot()?.ingress === 'loading'")
                assert len(held) == 1
                # Verify the real session, not a mocked useUser/context.
                account = page.evaluate("""() => ({
                    id: window.Clerk.user.id,
                    email: window.Clerk.user.primaryEmailAddress.emailAddress,
                    verified: window.Clerk.user.primaryEmailAddress.verification.status
                })""")
                assert account["id"] == subject
                assert account["email"].endswith("@example.com")
                assert account["verified"] == "verified"
                field.fill("9150E-2")

                def event(name):
                    page.evaluate("(name) => window.dispatchEvent(new Event(name))", name)

                def blur():
                    # TanStack Query v5's default focus source is visibilitychange,
                    # not window.focus. Control only the browser signal, not its manager.
                    page.evaluate("""() => {
                        Object.defineProperty(document, 'visibilityState', {
                          configurable: true, get: () => 'hidden'
                        });
                        document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
                        window.dispatchEvent(new Event('blur'));
                    }""")
                    assert not page.evaluate("window.__fallbackHarness.managers().focused")

                def focus():
                    page.evaluate("""() => {
                        Object.defineProperty(document, 'visibilityState', {
                          configurable: true, get: () => 'visible'
                        });
                        document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
                        window.dispatchEvent(new Event('focus'));
                    }""")
                    assert page.evaluate("window.__fallbackHarness.managers().focused")

                if transition == "focus":
                    blur()
                else:
                    event("offline")
                    assert not page.evaluate("window.__fallbackHarness.managers().online")
                before = len(requests)
                saved = profile(subject, "9150E", 2)
                if channel == "silent":
                    page.evaluate("""subject => {
                        const channel = new BroadcastChannel(`operational-profile:${subject}`);
                        channel.postMessage({ type: 'changed' });
                        channel.close();
                    }""", subject)
                # Server fixture changes alone must not refresh a client.
                page.wait_for_timeout(400)
                assert len(requests) == before
                assert page.evaluate("window.__fallbackHarness.snapshot().profile.version") == 1
                if transition == "focus":
                    focus()
                else:
                    event("online")
                    assert page.evaluate("window.__fallbackHarness.managers().online")
                page.wait_for_function("window.__fallbackHarness.snapshot()?.profile?.version === 2", timeout=4000)
                assert len(requests) == before + 1
                expect(field).to_have_value("9150E-2")
                expect(page.get_by_text("A newer saved assignment is available.", exact=False)).to_be_visible()
                expect(page.get_by_test_id("button-save-operational-profile")).to_be_disabled()
                page.wait_for_function("window.__fallbackHarness.snapshot()?.prefills.length === 1")
                # Release the former-unit response after the fresh one. Browser
                # fetch aborts may abandon this route; either way it must not apply.
                for stale in held:
                    try:
                        stale.fulfill(json={"status": "success", "metadata": {"total_records": 1},
                                            "data": [{"location": "STALE FORMER UNIT",
                                                      "cadIdentity": profile(subject, "9150E-1", 1)["identity"]}]})
                    except Exception as error:
                        # A closed route is acceptable only if the fetch was cancelled.
                        if "closed" not in str(error).lower() and "invalid" not in str(error).lower():
                            raise
                page.wait_for_timeout(250)
                snapshot = page.evaluate("window.__fallbackHarness.snapshot()")
                assert snapshot["profile"]["identity"]["cadUnit"] == "9150E"
                assert "side" not in snapshot["profile"]["identity"]
                assert snapshot["draft"]["runLocation"] == "Fictional current location"
                assert len(snapshot["prefills"]) == 1
                assert [d["cadUnit"] for d in dispatches] == ["9150E-1", "9150E"]

                # Separately simulate a service failure by aborting fixtures.
                # This is deliberately NOT CDP/network-offline emulation.
                abort_profile = True
                if transition == "focus":
                    blur()
                    focus()
                else:
                    event("offline")
                    event("online")
                page.wait_for_function("!!window.__fallbackHarness.snapshot()?.error", timeout=4000)
                expect(field).to_have_value("9150E-2")
                expect(page.get_by_test_id("button-save-operational-profile")).to_be_disabled()
                assert page.evaluate("window.__fallbackHarness.snapshot().profile") is None
                assert len(dispatches) == 2, "unavailable profile must not issue stale CAD requests"
                abort_profile = False
                before = len(requests)
                if transition == "focus":
                    blur()
                    focus()
                else:
                    event("offline")
                    event("online")
                page.wait_for_function("""() => {
                    const s = window.__fallbackHarness.snapshot();
                    return s?.profile?.version === 2 && !s.error;
                }""", timeout=4000)
                assert len(requests) == before + 1
                expect(field).to_have_value("9150E-2")
                expect(page.get_by_test_id("button-save-operational-profile")).to_be_disabled()
                # Only this explicit discard may replace dirty editor text.
                page.get_by_test_id("button-reload-operational-profile").click()
                expect(field).to_have_value("9150E")
                expect(page.get_by_test_id("text-profile-cad")).to_have_text("9150E")
                controls = page.evaluate("window.__fallbackControls")
                assert controls["blockedPolls"] > 0
                assert controls["deliveries"] == 0
                assert controls["channels"] == (0 if channel == "absent" else 2)
                assert controls["posts"] == (0 if channel == "absent" else 1)
                assert not denied, denied
                results.append({"channel": channel, "transition": transition,
                                "profileRequests": requests, "dispatchUnits": [d["cadUnit"] for d in dispatches],
                                "controls": controls, "passed": True})
            finally:
                if not page.is_closed():
                    page.evaluate("window.__fallbackHarness?.dispose()")
                    page.close()

    # Real browser connectivity and fixture-held responses are intentionally
    # separate: CDP changes navigator.onLine, while routes only delay responses.
    page = context.new_page()
    saved = profile(subject, "9150E-1", 1)
    latest_profile = profile(subject, "9150E", 2)
    held_profiles, held_dispatches, requests, dispatches, fixture_errors = [], [], [], [], []
    hold_profile_gets = False

    def route_rapid_transitions(route):
        nonlocal hold_profile_gets
        request = route.request
        path = urlparse(request.url).path
        if path == "/api/v1/account/operational-profile":
            if request.method == "GET":
                requests.append({"method": "GET", "version": saved["version"],
                                 "held": hold_profile_gets})
                if hold_profile_gets:
                    held_profiles.append(route)
                    return
                route.fulfill(json=saved)
            else:
                fixture_errors.append(f"Unexpected profile write: {request.method}")
                route.fulfill(status=405, json={"error": "Unexpected profile write"})
        elif path == "/api/v1/account/operational-profile/history":
            route.fulfill(json={"subject": subject, "entries": [], "nextBeforeVersion": None})
        elif path == "/api/v1/dispatch/event-ingress":
            body = request.post_data_json
            expected = saved["identity"]["cadUnit"]
            assert body == {"eventId": "FICTIONAL-FALLBACK-EVENT", "cadUnit": expected}
            dispatches.append(body)
            if body["cadUnit"] == "9150E-1":
                held_dispatches.append(route)
                return
            route.fulfill(json={"status": "success", "metadata": {"total_records": 1},
                                "data": [{"location": "Latest current location",
                                          "cadIdentity": saved["identity"]}]})
        else:
            fixture_errors.append(f"Unconfigured API route: {path}")
            route.fulfill(status=503, json={"error": "Unconfigured test API"})

    cdp = None
    try:
        page.route("**/api/**", route_rapid_transitions)
        page.route("**/__assignment-fallback-test", lambda route: route.fulfill(
            content_type="text/html", body=DOCUMENT))
        page.add_init_script("(" + CONTROLS + ")('silent')")
        page.goto(base_url.rstrip("/") + "/__assignment-fallback-test")
        page.wait_for_function("window.__harnessModule")
        page.evaluate("window.__fallbackHarness = window.__harnessModule.mount()")
        field = page.get_by_test_id("input-operational-assignment")
        expect(field).to_have_value("9150E-1")
        page.wait_for_function("""() => {
            const s = window.__fallbackHarness.snapshot();
            return s?.profile?.version === 1 && s?.ingress === 'loading';
        }""")
        assert len(held_dispatches) == 1
        account = page.evaluate("""() => ({
            id: window.Clerk.user.id,
            email: window.Clerk.user.primaryEmailAddress.emailAddress,
            verified: window.Clerk.user.primaryEmailAddress.verification.status
        })""")
        assert account["id"] == subject
        assert account["email"].endswith("@example.com")
        assert account["verified"] == "verified"
        field.fill("9150E-2")

        def visibility(state):
            page.evaluate("""state => {
                Object.defineProperty(document, 'visibilityState', {
                  configurable: true, get: () => state
                });
                document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
                window.dispatchEvent(new Event(state === 'visible' ? 'focus' : 'blur'));
            }""", state)
            assert page.evaluate("window.__fallbackHarness.managers().focused") == (state == "visible")

        async_cdp = page.context.new_cdp_session(page)
        cdp = async_cdp
        cdp.send("Network.enable")

        def emulate_offline(offline):
            cdp.send("Network.emulateNetworkConditions", {
                "offline": offline, "latency": 0,
                "downloadThroughput": 0 if offline else -1,
                "uploadThroughput": 0 if offline else -1,
                "connectionType": "none" if offline else "wifi",
            })
            page.wait_for_function(
                "window.__fallbackHarness.managers().online === " + ("false" if offline else "true"))
            assert page.evaluate("navigator.onLine") is (not offline)

        # Reconnect initiates a refresh that remains pending while the actual
        # browser network is rapidly toggled alongside focus/visibility events.
        saved = latest_profile
        hold_profile_gets = True
        emulate_offline(True)
        visibility("hidden")
        emulate_offline(False)
        page.wait_for_function("window.__fallbackControls.blockedPolls > 0")
        page.wait_for_function("window.__fallbackHarness.snapshot()?.profile?.version === 1")
        page.wait_for_function("window.__fallbackControls && navigator.onLine")
        deadline = time.monotonic() + 4
        while not held_profiles and time.monotonic() < deadline:
            page.wait_for_timeout(20)
        assert held_profiles, "Reconnect did not request the operational profile"

        # Overlap repeated hidden/visible and offline/online changes before any
        # held response is released. In-flight responses all use the final server shape.
        for offline in (True, False, True, False):
            visibility("hidden" if offline else "visible")
            emulate_offline(offline)
        visibility("hidden")
        visibility("visible")
        page.wait_for_timeout(250)
        assert page.evaluate("window.__fallbackHarness.snapshot().profile.version") == 1
        query_state = page.evaluate(
            "subject => window.__fallbackHarness.profileQueryState(subject)", subject)
        assert query_state == {"status": "success", "fetchStatus": "fetching"}, query_state
        expect(field).to_have_value("9150E-2")
        assert len(held_profiles) >= 1
        assert all(request["held"] for request in requests[1:]), requests

        for pending_route in held_profiles:
            try:
                pending_route.fulfill(json=latest_profile)
            except Exception as error:
                if "closed" not in str(error).lower() and "invalid" not in str(error).lower():
                    raise
        page.wait_for_function("""subject => {
            const s = window.__fallbackHarness.snapshot();
            const cached = window.__fallbackHarness.cachedProfile(subject);
            return s?.profile?.version === 2 && cached?.version === 2 &&
              s?.profile?.identity?.cadUnit === '9150E' &&
              cached?.identity?.cadUnit === '9150E' && !s.error;
        }""", subject, timeout=5000)
        page.wait_for_function("window.__fallbackHarness.snapshot()?.prefills.length === 1")
        assert page.evaluate(
            "subject => window.__fallbackHarness.cachedProfile(subject)", subject) == latest_profile
        snapshot = page.evaluate("window.__fallbackHarness.snapshot()")
        assert snapshot["profile"] == latest_profile
        assert snapshot["successfulRead"] >= 2
        assert snapshot["pending"] is False
        assert snapshot["error"] is None
        query_state = page.evaluate(
            "subject => window.__fallbackHarness.profileQueryState(subject)", subject)
        assert query_state == {"status": "success", "fetchStatus": "idle"}, query_state
        assert page.evaluate("window.__fallbackHarness.managers()") == {
            "focused": True, "online": True}
        expect(field).to_have_value("9150E-2")
        expect(page.get_by_test_id("text-profile-cad")).to_have_text("9150E")
        expect(page.get_by_text("A newer saved assignment is available.", exact=False)).to_be_visible()
        expect(page.get_by_test_id("button-reload-operational-profile")).to_be_enabled()
        assert page.locator('[data-testid="text-profile-error"]').count() == 0

        # Resolve the formerly active unit only after the new unit has loaded;
        # cancellation is acceptable, application of its payload is not.
        for stale in held_dispatches:
            try:
                stale.fulfill(json={"status": "success", "metadata": {"total_records": 1},
                                    "data": [{"location": "STALE FORMER UNIT",
                                              "cadIdentity": profile(
                                                  subject, "9150E-1", 1)["identity"]}]})
            except Exception as error:
                if "closed" not in str(error).lower() and "invalid" not in str(error).lower():
                    raise
        page.wait_for_timeout(250)
        snapshot = page.evaluate("window.__fallbackHarness.snapshot()")
        assert snapshot["draft"]["runLocation"] == "Latest current location"
        assert field.input_value() == "9150E-2"
        assert len(snapshot["prefills"]) == 1
        assert "STALE FORMER UNIT" not in json.dumps(snapshot)
        assert [entry["cadUnit"] for entry in dispatches] == ["9150E-1", "9150E"]
        controls = page.evaluate("window.__fallbackControls")
        assert controls["blockedPolls"] > 0
        assert controls["deliveries"] == 0
        assert controls["posts"] == 0
        assert controls["channels"] >= 1
        assert not fixture_errors, fixture_errors
        results.append({
            "case": "overlapping-focus-reconnect-during-held-refresh",
            "profileRequests": requests,
            "dispatchUnits": [entry["cadUnit"] for entry in dispatches],
            "profileAndCacheMatchedServer": True,
            "dirtyEditorPreserved": field.input_value() == "9150E-2",
            "connectivityRecovered": page.evaluate(
                "window.__fallbackHarness.managers().online"),
            "controls": controls,
            "passed": True,
        })
    finally:
        if cdp is not None:
            try:
                cdp.send("Network.emulateNetworkConditions", {
                    "offline": False, "latency": 0, "downloadThroughput": -1,
                    "uploadThroughput": -1, "connectionType": "wifi",
                })
                cdp.detach()
            except Exception:
                pass
        if not page.is_closed():
            page.evaluate("window.__fallbackHarness?.dispose()")
            page.close()

    # Same-account save race: an older refetch must not replace a confirmed PUT.
    page = context.new_page()
    saved = profile(subject, "9150E-1", 1)
    held, profile_get_responses, profile_get_failures = [], [], []
    put_bodies, dispatches, fixture_errors = [], [], []
    hold_next_profile_get = False

    def route_save_race(route):
        nonlocal saved, hold_next_profile_get
        request = route.request
        path = urlparse(request.url).path
        if path == "/api/v1/account/operational-profile":
            if request.method == "GET":
                if hold_next_profile_get:
                    hold_next_profile_get = False
                    held.append(route)
                    return
                route.fulfill(json=saved)
            elif request.method == "PUT":
                body = request.post_data_json
                put_bodies.append(body)
                if body != {"assignmentToken": "9150E", "expectedVersion": 1}:
                    fixture_errors.append(f"Unexpected assignment PUT: {body!r}")
                    route.fulfill(status=400, json={"error": "Unexpected fixture body"})
                    return
                saved = profile(subject, body["assignmentToken"], 2)
                route.fulfill(json=saved)
            else:
                fixture_errors.append(f"Unexpected profile method: {request.method}")
                route.fulfill(status=405, json={"error": "Unexpected profile method"})
        elif path == "/api/v1/account/operational-profile/history":
            route.fulfill(json={"subject": subject, "entries": [], "nextBeforeVersion": None})
        elif path == "/api/v1/dispatch/event-ingress":
            body = request.post_data_json
            dispatches.append(body)
            route.fulfill(json={"status": "success", "metadata": {"total_records": 1},
                                "data": [{"location": "Fictional current location",
                                          "cadIdentity": saved["identity"]}]})
        else:
            fixture_errors.append(f"Unconfigured API route: {path}")
            route.fulfill(status=503, json={"error": "Unconfigured test API"})

    def record_profile_response(response):
        request = response.request
        if (request.method == "GET"
                and urlparse(request.url).path == "/api/v1/account/operational-profile"):
            profile_get_responses.append(response)

    def record_profile_failure(request):
        if (request.method == "GET"
                and urlparse(request.url).path == "/api/v1/account/operational-profile"):
            profile_get_failures.append(request.failure or "")

    try:
        page.route("**/api/**", route_save_race)
        page.route("**/__assignment-fallback-test", lambda route: route.fulfill(
            content_type="text/html", body=DOCUMENT))
        page.add_init_script("(" + CONTROLS + ")('absent')")
        page.on("response", record_profile_response)
        page.on("requestfailed", record_profile_failure)
        page.goto(base_url.rstrip("/") + "/__assignment-fallback-test")
        page.wait_for_function("window.__harnessModule")
        page.evaluate("window.__fallbackHarness = window.__harnessModule.mount()")
        field = page.get_by_test_id("input-operational-assignment")
        expect(field).to_have_value("9150E-1")
        page.wait_for_function("""() => {
            const snapshot = window.__fallbackHarness.snapshot();
            return snapshot?.profile?.version === 1 &&
              snapshot?.prefills.length === 1 &&
              snapshot?.ingress !== 'loading';
        }""")
        assert len(profile_get_responses) == 1
        account_id = page.evaluate("window.Clerk.user.id")
        assert account_id == subject, "The race must remain within the authenticated account"

        def blur():
            page.evaluate("""() => {
                Object.defineProperty(document, 'visibilityState', {
                  configurable: true, get: () => 'hidden'
                });
                document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
                window.dispatchEvent(new Event('blur'));
            }""")

        def focus():
            page.evaluate("""() => {
                Object.defineProperty(document, 'visibilityState', {
                  configurable: true, get: () => 'visible'
                });
                document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
                window.dispatchEvent(new Event('focus'));
            }""")

        hold_next_profile_get = True
        blur()
        focus()
        deadline = time.monotonic() + 5
        while not held and time.monotonic() < deadline:
            page.wait_for_timeout(25)
        assert len(held) == 1, "Expected one held same-account profile refresh"
        assert len(profile_get_responses) == 1, "The old GET must remain unresolved before saving"

        field.fill("9150E")
        page.get_by_test_id("button-save-operational-profile").click()
        expect(page.get_by_test_id("text-profile-saved")).to_have_text(
            "Assignment saved. It will apply to future packets only.")
        expect(field).to_have_value("9150E")
        expect(page.get_by_test_id("text-profile-cad")).to_have_text("9150E")
        expect(page.get_by_test_id("button-save-operational-profile")).to_be_disabled()
        page.wait_for_function("""subject => {
            const snapshot = window.__fallbackHarness.snapshot();
            const cached = window.__fallbackHarness.cachedProfile(subject);
            return snapshot?.profile?.version === 2 &&
              cached?.version === 2 &&
              cached?.identity?.assignmentToken === '9150E' &&
              cached?.identity?.cadUnit === '9150E';
        }""", subject)
        assert put_bodies == [{"assignmentToken": "9150E", "expectedVersion": 1}]
        page.wait_for_function(
            "window.__fallbackHarness.snapshot()?.prefills.length >= 2")
        assert any(body.get("cadUnit") == "9150E" for body in dispatches), dispatches

        old_profile = profile(subject, "9150E-1", 1)
        release_error = None
        try:
            held[0].fulfill(json=old_profile)
        except Exception as error:
            # Classify from the browser's request/response events below rather
            # than treating every failed route fulfillment as cancellation.
            release_error = str(error)
        page.wait_for_timeout(250)

        if len(profile_get_responses) > 1:
            stale_outcome = "late-response-ignored"
        else:
            assert profile_get_failures, "The held GET was neither delivered nor reported canceled"
            assert any("abort" in failure.lower() or "cancel" in failure.lower()
                       for failure in profile_get_failures), {
                           "failures": profile_get_failures, "releaseError": release_error,
                       }
            stale_outcome = "browser-fetch-cancelled"

        snapshot = page.evaluate("window.__fallbackHarness.snapshot()")
        cached = page.evaluate(
            "subject => window.__fallbackHarness.cachedProfile(subject)", subject)
        assert snapshot["profile"]["version"] == 2
        assert snapshot["profile"]["identity"]["assignmentToken"] == "9150E"
        assert snapshot["profile"]["identity"]["cadUnit"] == "9150E"
        assert cached["version"] == 2
        assert cached["identity"]["cadUnit"] == "9150E"
        expect(field).to_have_value("9150E")
        expect(page.get_by_test_id("text-profile-cad")).to_have_text("9150E")
        expect(page.get_by_test_id("text-profile-saved")).to_be_visible()
        expect(page.get_by_test_id("button-save-operational-profile")).to_be_disabled()
        assert len(dispatches) >= 1
        assert not fixture_errors, fixture_errors
        results.append({
            "case": "same-account-save-beats-held-profile-refresh",
            "putBodies": put_bodies,
            "savedVersion": snapshot["profile"]["version"],
            "savedCadUnit": snapshot["profile"]["identity"]["cadUnit"],
            "staleGetOutcome": stale_outcome,
            "passed": True,
        })
    finally:
        if not page.is_closed():
            page.evaluate("window.__fallbackHarness?.dispose()")
            page.close()
    return results
