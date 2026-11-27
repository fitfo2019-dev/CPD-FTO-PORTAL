import { Gavel } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.js';
import { LazyChargingLookup as ChargingLookup } from '@/components/lazy-charging-lookup.js';

export function ChargingLookupSheet({ testId }: { testId: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" className="min-h-11 rounded border bg-card px-4 text-sm font-bold uppercase tracking-wide inline-flex items-center gap-2" data-testid={testId}>
          <Gavel className="h-4 w-4" aria-hidden="true" />Charging lookup
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle className="uppercase tracking-wide">Charging lookup</SheetTitle>
        </SheetHeader>
        <div className="mt-4"><ChargingLookup compact /></div>
      </SheetContent>
    </Sheet>
  );
}
