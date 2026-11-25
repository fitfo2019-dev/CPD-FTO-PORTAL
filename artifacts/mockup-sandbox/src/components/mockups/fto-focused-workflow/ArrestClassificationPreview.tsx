import { useState } from 'react';
import './_group.css';

type ClassificationField = 'severity' | 'arrestType';

const shortcuts: Record<ClassificationField, Record<string, string>> = {
  severity: { f: 'Felony', m: 'Misdemeanor' },
  arrestType: { w: 'Warrant', o: 'On-view' },
};

function expandShortcut(field: ClassificationField, input: string): string {
  const trimmed = input.trim();
  const options = shortcuts[field];
  const match = Object.entries(options).find(([key, value]) =>
    key.toLowerCase() === trimmed.toLowerCase() || value.toLowerCase() === trimmed.toLowerCase(),
  );
  return match?.[1] ?? input;
}

export function ArrestClassificationPreview() {
  const [severity, setSeverity] = useState('');
  const [arrestType, setArrestType] = useState('');

  return (
    <main className="fto-preview min-h-screen bg-background p-6">
      <section className="mx-auto max-w-2xl rounded border border-border bg-card p-5">
        <p className="label-caps mb-2">Input preview · local interaction only</p>
        <h1 className="mb-2 text-2xl">Arrest classification</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Record one arrest event. Actual charge names are not requested.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="label-caps">Arrest severity</span>
            <input
              type="text"
              autoComplete="off"
              className="h-10 w-full rounded border bg-card px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              value={severity}
              placeholder="Felony/Misdemeanor"
              maxLength={32}
              onChange={event => setSeverity(expandShortcut('severity', event.target.value))}
              aria-label="Arrest severity"
              data-testid="input-arrest-severity-preview"
            />
          </label>

          <label className="block space-y-1">
            <span className="label-caps">Arrest type</span>
            <input
              type="text"
              autoComplete="off"
              className="h-10 w-full rounded border bg-card px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              value={arrestType}
              placeholder="Warrant/On-view"
              maxLength={32}
              onChange={event => setArrestType(expandShortcut('arrestType', event.target.value))}
              aria-label="Arrest type"
              data-testid="input-arrest-type-preview"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Shortcuts: F → Felony · M → Misdemeanor · W → Warrant · O → On-view
        </p>
      </section>
    </main>
  );
}
