import { Suspense, lazy, type ComponentProps } from 'react';

const ChargingLookup = lazy(() => import('@/components/charging-lookup.js').then(m => ({ default: m.ChargingLookup })));

export function LazyChargingLookup(props: ComponentProps<typeof ChargingLookup>) {
  return <Suspense fallback={null}><ChargingLookup {...props} /></Suspense>;
}
