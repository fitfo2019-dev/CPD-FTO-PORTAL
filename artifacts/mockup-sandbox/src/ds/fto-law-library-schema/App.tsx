import { useEffect, useState, type ComponentType } from 'react';

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;
const modules = import.meta.glob('./mockups/**/*.tsx') as ModuleMap;

function resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const fns = Object.values(mod).filter(
    (value) => typeof value === 'function',
  ) as ComponentType[];
  return (mod[name] as ComponentType) ?? (mod.default as ComponentType) ?? fns.at(-1);
}

function PreviewRenderer({ path }: { path: string }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = modules[`./mockups/${path}.tsx`];
    if (!loader) {
      setError('Preview unavailable.');
      return;
    }

    void loader().then((mod) => {
      if (cancelled) return;
      const component = resolveComponent(mod, path.split('/').at(-1) ?? path);
      if (component) setComponent(() => component);
      else setError('Preview unavailable.');
    }).catch(() => {
      if (!cancelled) setError('Preview unavailable.');
    });

    return () => { cancelled = true; };
  }, [path]);

  if (error) return <p className="p-6 text-destructive">{error}</p>;
  return Component ? <Component /> : null;
}

function readPreviewPath() {
  return window.location.hash.replace(/^#\/?/, '') || 'SuccessorAssignmentPreview';
}

export default function App() {
  const [path, setPath] = useState(readPreviewPath);

  useEffect(() => {
    const updatePath = () => setPath(readPreviewPath());
    window.addEventListener('hashchange', updatePath);
    return () => window.removeEventListener('hashchange', updatePath);
  }, []);

  return <PreviewRenderer path={path} />;
}
