// Division equipment may clear saved browser data, so pieces that load later
// are fetched right after sign-in while a connection is available.
const loaders = [
  () => import('@/components/charging-lookup.js'),
  () => import('@/components/run-ua-box-panel.js'),
  () => import('@/lib/daily-row-export.js'),
  () => import('@/lib/fto-incentive-workbook.js'),
  () => import('@/lib/exportWorkbook.js'),
  () => import('@/lib/monthly-export.js'),
];

let loaded = false;
let pending: Promise<void> | null = null;

export function preloadFieldScreens(): Promise<void> {
  if (loaded) return Promise.resolve();
  pending ??= Promise.all(loaders.map(load => load()))
    .then(() => { loaded = true; })
    .catch(() => {
      pending = null;
      if (typeof window !== 'undefined') window.addEventListener('online', () => { void preloadFieldScreens(); }, { once: true });
    });
  return pending;
}
