import { registerHooks, type LoadHookSync } from 'node:module';

const mockedSvgModule = `export default ${JSON.stringify('<svg xmlns="http://www.w3.org/2000/svg"></svg>')};`;

const printAssetLoadHook: LoadHookSync = function load(url, context, next) {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/columbus-logo.svg') && parsed.searchParams.has('raw')) {
    return { format: 'module', shortCircuit: true, source: mockedSvgModule };
  }
  const loaded = next(url, context);
  if (
    !parsed.pathname.endsWith('/printable-columbus-header.tsx') &&
    !parsed.pathname.endsWith('/printable-columbus-header.js')
  ) return loaded;
  if (loaded.source === undefined) return loaded;
  const source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
  const withBase = source.replaceAll('import.meta.env.BASE_URL', JSON.stringify('/'));
  const withReact = /\bReact\.createElement\b/.test(withBase) && !/import\s+React\b/.test(withBase)
    ? `import React from 'react';\n${withBase}`
    : withBase;
  return { ...loaded, source: withReact };
};

let registered = false;

/** Lets Node tests load print components that import Vite-only assets. Register before importing them. */
export function registerPrintAssetHooks(): void {
  if (registered) return;
  registerHooks({ load: printAssetLoadHook });
  registered = true;
}
