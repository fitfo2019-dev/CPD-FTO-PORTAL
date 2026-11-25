"""Reusable isolated Playwright coverage; call run(context, base_url, subject).

context must already have a fictional, verified Clerk session (example.com).
Uses sync Playwright, asserts actual provider/editor/hook behavior, never a DB.
No stored cookies, test credentials, or auth bypass are part of this runner.
"""
import json
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
    return results
