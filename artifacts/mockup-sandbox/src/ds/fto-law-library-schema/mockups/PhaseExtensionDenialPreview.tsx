import { useState } from 'react';

type Decision = 'pending' | 'approved' | 'denied';
type PreviewMode = 'coordinator' | 'fto';

export function PhaseExtensionDenialPreview() {
  const [mode, setMode] = useState<PreviewMode>('coordinator');
  const [decision, setDecision] = useState<Decision>('pending');
  const [explanation, setExplanation] = useState('');

  const statusLabel = decision === 'pending'
    ? 'Awaiting review'
    : decision === 'approved'
      ? 'Approved'
      : 'Denied';

  return (
    <main className="min-h-screen bg-background p-5 text-foreground sm:p-7">
      <section className="mx-auto grid w-full max-w-2xl gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Field Training</p>
            <h1 className="mt-1 text-2xl font-bold uppercase">Phase extension requests</h1>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            Sample request
          </span>
        </header>

        <nav aria-label="Preview role" className="flex gap-2 rounded-md border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setMode('coordinator')}
            aria-pressed={mode === 'coordinator'}
            className={`min-h-10 flex-1 rounded-md px-3 text-sm font-semibold uppercase ${mode === 'coordinator' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Coordinator review
          </button>
          <button
            type="button"
            onClick={() => setMode('fto')}
            aria-pressed={mode === 'fto'}
            className={`min-h-10 flex-1 rounded-md px-3 text-sm font-semibold uppercase ${mode === 'fto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            FTO request status
          </button>
        </nav>

        {mode === 'coordinator' ? (
          <article className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Class 2026-A · PO 517284</h2>
                <p className="mt-1 text-sm text-muted-foreground">Phase 3 · 2 additional training weeks</p>
                <p className="text-sm text-muted-foreground">Requested by Officer Jordan Lee</p>
              </div>
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold">{statusLabel}</span>
            </div>

            <div className="grid gap-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Request justification</h3>
              <p className="rounded-md bg-muted p-3 text-sm leading-6">
                Additional time is requested to complete supervised report-writing practice and demonstrate consistent call documentation.
              </p>
            </div>

            {decision === 'pending' ? (
              <>
                <label className="grid gap-1.5 text-sm font-semibold uppercase">
                  Denial explanation <span className="font-normal text-muted-foreground">Optional · 500 characters maximum</span>
                  <textarea
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value.slice(0, 500))}
                    maxLength={500}
                    rows={3}
                    placeholder="Add context for the requesting FTO"
                    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-describedby="denial-character-count"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span id="denial-character-count" className="text-xs text-muted-foreground">
                    {explanation.length}/500
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision('approved')}
                      className="min-h-10 rounded-md bg-primary px-4 text-sm font-bold uppercase text-primary-foreground"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('denied')}
                      className="min-h-10 rounded-md border border-border bg-background px-4 text-sm font-bold uppercase text-foreground"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div role="status" className="rounded-md bg-muted p-3 text-sm">
                Decision recorded: <strong>{statusLabel}</strong>
              </div>
            )}
          </article>
        ) : (
          <article className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Your request</p>
              <h2 className="mt-1 text-lg font-bold">Class 2026-A · PO 517284</h2>
              <p className="text-sm text-muted-foreground">Phase 3 · 2 additional training weeks</p>
            </div>
            <p className="text-sm font-semibold">Status: {statusLabel}</p>
            {decision === 'denied' && explanation.trim() && (
              <div className="rounded-md border border-border bg-muted p-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Coordinator explanation</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{explanation.trim()}</p>
              </div>
            )}
            {decision === 'denied' && !explanation.trim() && (
              <p className="text-sm text-muted-foreground">No explanation was provided.</p>
            )}
          </article>
        )}
        <p className="text-center text-xs text-muted-foreground">Preview only · no request or decision is sent</p>
      </section>
    </main>
  );
}
