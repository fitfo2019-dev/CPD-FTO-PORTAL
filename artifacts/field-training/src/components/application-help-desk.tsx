import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  getApplicationHelpTopicForRole,
  getApplicationHelpTopicsForRole,
} from '@/lib/application-help.js';
import type { Role } from '@/lib/model.js';

function requestedTopic(role: Role) {
  const topicId = new URLSearchParams(window.location.search).get('topic');
  return getApplicationHelpTopicForRole(role, topicId).id;
}

export function ApplicationHelpDesk({ role }: { role: Role }) {
  const [search, setSearch] = useState<{ role: Role; query: string }>(() => ({ role, query: '' }));
  const query = search.role === role ? search.query : '';
  const [selectedId, setSelectedId] = useState(() => requestedTopic(role));
  const availableTopics = useMemo(() => getApplicationHelpTopicsForRole(role), [role]);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return availableTopics.filter(topic => !needle
      || `${topic.title} ${topic.keywords} ${topic.steps.join(' ')} ${topic.expectedResult} ${topic.recovery}`
        .toLocaleLowerCase()
        .includes(needle));
  }, [availableTopics, query]);
  const selected = matches.find(topic => topic.id === selectedId) ?? matches[0];

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('topic')) {
      document.getElementById('application-help')?.scrollIntoView({ block: 'start' });
    }
  }, []);

  useEffect(() => {
    setSelectedId(requestedTopic(role));
  }, [role]);

  return (
    <section
      id="application-help"
      aria-labelledby="application-help-title"
      className="mb-6 scroll-mt-24 border border-border bg-card"
      data-testid="section-application-help"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/60 px-4 py-3">
        <div>
          <h2
            id="application-help-title"
            className="text-xl font-semibold text-primary"
            style={{ fontFamily: 'var(--app-font-display)' }}
          >
            Application-use help
          </h2>
          <p className="text-sm text-muted-foreground">Short portal steps · not policy</p>
        </div>
        <label className="w-full sm:min-w-[14rem] sm:flex-1 sm:max-w-md">
          <span className="sr-only">Search Help Desk topics</span>
          <input
            type="search"
            value={query}
            onChange={event => setSearch({ role, query: event.target.value })}
            placeholder="Search saving, access, packets…"
            className="h-10 w-full rounded-sm border border-input bg-background px-3 text-sm"
            aria-label="Search Help Desk topics"
            data-testid="input-application-help-search"
          />
        </label>
      </header>

      <div className="grid md:grid-cols-[minmax(14rem,.72fr)_minmax(0,1.7fr)]">
        <nav
          aria-label="Help Desk topics"
          className="border-b bg-muted/20 p-2 md:border-b-0 md:border-r"
        >
          <p className="label-caps px-2 py-1 text-muted-foreground">Common tasks</p>
          <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
            {matches.map(topic => (
              <button
                type="button"
                key={topic.id}
                onClick={() => setSelectedId(topic.id)}
                aria-pressed={selected?.id === topic.id}
                className={`min-h-10 rounded-sm border-l-4 px-2 text-left text-sm ${
                  selected?.id === topic.id
                    ? 'border-accent bg-primary/10 font-semibold text-primary'
                    : 'border-transparent hover:bg-muted'
                }`}
                data-testid={`button-help-topic-${topic.id}`}
              >
                {topic.title}
              </button>
            ))}
          </div>
        </nav>

        <article className="min-w-0 p-4 sm:p-5" aria-live="polite">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                <h3
                  className="text-xl font-semibold text-primary"
                  style={{ fontFamily: 'var(--app-font-display)' }}
                >
                  {selected.title}
                </h3>
                <span className="rounded-sm border bg-muted px-2 py-1 text-[.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                  Application use · not policy
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <section className="border bg-muted/20 p-3">
                  <h4 className="label-caps mb-2">Steps</h4>
                  <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
                    {selected.steps.map(step => <li key={step}>{step}</li>)}
                  </ol>
                </section>
                <section className="border bg-muted/20 p-3">
                  <h4 className="label-caps mb-2">Expected result</h4>
                  <p className="text-sm leading-relaxed">{selected.expectedResult}</p>
                </section>
                <section className="border bg-muted/20 p-3 sm:col-span-2">
                  <h4 className="label-caps mb-2">Recovery</h4>
                  <p className="text-sm leading-relaxed">{selected.recovery}</p>
                </section>
              </div>
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Operational requirements belong to official agency sources. Browse the available references in{' '}
                <Link href="/resources#resources-library" className="font-semibold text-primary underline">
                  Resources
                </Link>.
              </p>
            </>
          ) : (
            <div className="grid min-h-40 place-content-center justify-items-start gap-2 py-6 text-sm text-muted-foreground" role="status">
              <p>No matching topics. Try another search or clear the field.</p>
              <button type="button" onClick={() => setSearch({ role, query: '' })} className="font-semibold text-primary underline underline-offset-2">
                Clear search
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
