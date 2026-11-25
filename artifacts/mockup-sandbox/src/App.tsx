import { useEffect, useState, type ComponentType } from "react";

import { modules as discoveredModules } from "./.generated/mockup-components.js";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function _resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const fns = Object.values(mod).filter(
    (v) => typeof v === "function",
  ) as ComponentType[];
  return (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    fns[fns.length - 1]
  );
}

function PreviewRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setComponent(null);
    setError(null);

    async function loadComponent(): Promise<void> {
      const key = `./components/mockups/${componentPath}.tsx`;
      const loader = modules[key];
      if (!loader) {
        setError("This preview could not be found.");
        return;
      }

      try {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Preview load timed out.")),
            15_000,
          );
        });
        let mod: Record<string, unknown>;
        try {
          mod = await Promise.race([loader(), timeout]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
        if (cancelled) {
          return;
        }
        const name = componentPath.split("/").pop()!;
        const comp = _resolveComponent(mod, name);
        if (!comp) {
          setError("This preview is not available right now.");
          return;
        }
        setComponent(() => comp);
      } catch (e) {
        if (cancelled) {
          return;
        }

        setError("The preview could not be loaded. Check your connection and try again.");
      }
    }

    void loadComponent();

    return () => {
      cancelled = true;
    };
  }, [componentPath, modules, attempt]);

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900">
        <section role="alert" className="mx-auto mt-16 max-w-lg rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Preview unavailable</div>
          <h1 className="text-2xl font-semibold">We couldn’t open this view</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => { setError(null); setComponent(null); setAttempt((value) => value + 1); }}
            className="mt-5 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!Component) {
    return (
      <main className="min-h-screen bg-gray-50 p-6" aria-busy="true" aria-label="Loading preview">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-8 w-2/5 rounded bg-gray-200" />
          <div className="h-4 w-3/5 rounded bg-gray-200" />
          <div className="mt-8 h-64 rounded-xl border border-gray-200 bg-white" />
        </div>
      </main>
    );
  }

  return <Component />;
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function getPreviewExamplePath(): string {
  const basePath = getBasePath();
  return `${basePath}/preview/ComponentName`;
}

function Gallery() {
  const basePath = getBasePath();
  const previews = Object.keys(discoveredModules).map(path =>
    path.replace("./components/mockups/", "").replace(/\.tsx$/, ""),
  ).sort();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Approval previews
        </h1>
        <p className="text-gray-500 mb-4">
          Fictional data only. These previews do not require portal sign-in or provide access to training records.
        </p>
        <nav aria-label="Available approval previews" className="mt-6 flex flex-col gap-3">
          {previews.map(name => <a key={name}
            href={`${basePath}/preview/${name.split("/").map(encodeURIComponent).join("/")}`}
            className="rounded border border-gray-300 bg-white px-4 py-3 font-semibold text-blue-900 underline">
            {name.replaceAll("/", " · ").replace(/([a-z])([A-Z])/g, "$1 $2")}
          </a>)}
        </nav>
        <p className="text-sm text-gray-400">
          Access component previews at{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {getPreviewExamplePath()}
          </code>
        </p>
      </div>
    </div>
  );
}

function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const explicitComponent = new URLSearchParams(window.location.search).get("component");
  if (explicitComponent && /^[A-Za-z0-9/_-]+$/.test(explicitComponent)) return explicitComponent;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;
}

function App() {
  const previewPath = getPreviewPath();

  if (previewPath) {
    return (
      <PreviewRenderer
        componentPath={previewPath}
        modules={discoveredModules}
      />
    );
  }

  return <Gallery />;
}

export default App;
