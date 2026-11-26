import { useEffect, useId, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, FileText, Gavel, Search } from 'lucide-react';
import { apiEndpoint } from '@workspace/api-client-react';
import {
  OFFICIAL_STATUTE_URL, canCopyWording, citationPath, clausesFromStatuteHtml, elementsComplete,
  elementsForCitation, normalizeComplaintCodes, penaltySentences, searchCharges,
  type ChargeCode, type ComplaintEntry, type ElementGroup, type StatuteClauses,
} from '@/lib/charging-lookup.js';
import './geography-map-panel.css';
import './charging-lookup.css';

const DATA_ROOT = `${import.meta.env.BASE_URL}law-handbook/data/`;
export const COMPLAINT_MANUAL_RESOURCE_ID = 'columbus-criminal-complaint-manual';
const manualPageHref = (page: number) =>
  `${apiEndpoint(`/v1/resources/${COMPLAINT_MANUAL_RESOURCE_ID}/download`)}#page=${page}`;

let codesPromise: Promise<ChargeCode[]> | undefined;
function loadCodes(): Promise<ChargeCode[]> {
  codesPromise ??= fetch(`${DATA_ROOT}complaints.json`)
    .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
    .then((data: { codes: Record<string, ComplaintEntry[]> }) => normalizeComplaintCodes(data.codes))
    .catch(error => { codesPromise = undefined; throw error; });
  return codesPromise;
}

const chapterCache = new Map<string, Promise<Record<string, unknown>>>();
function loadChapter(kind: ChargeCode['kind'], chapter: string) {
  const path = kind === 'ORC' ? `statutes/${chapter}.json` : `city/${chapter}.json`;
  let pending = chapterCache.get(path);
  if (!pending) {
    pending = fetch(`${DATA_ROOT}${path}`).then(response => (response.ok ? response.json() : {}));
    chapterCache.set(path, pending);
  }
  return pending;
}

async function loadStatute(code: ChargeCode): Promise<StatuteClauses | null> {
  const chapter = await loadChapter(code.kind, code.section.split('.')[0]);
  const record = chapter[code.section] as
    | { html?: string; clauses?: string[]; penalties?: number[] }
    | undefined;
  if (!record) return null;
  if (code.kind === 'CCC' && Array.isArray(record.clauses)) {
    return { clauses: record.clauses, penaltyIndexes: record.penalties ?? [] };
  }
  const statute = clausesFromStatuteHtml(record.html ?? '');
  return statute.clauses.length ? statute : null;
}

export function ChargingLookup({ compact = false }: { compact?: boolean }) {
  const inputId = useId();
  const [codes, setCodes] = useState<ChargeCode[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ChargeCode | null>(null);

  useEffect(() => {
    let live = true;
    loadCodes().then(list => { if (live) setCodes(list); }).catch(() => { if (live) setLoadFailed(true); });
    return () => { live = false; };
  }, []);

  const results = useMemo(() => (codes ? searchCharges(codes, query) : []), [codes, query]);

  return (
    <section
      className={`geography-map-panel charging-lookup${compact ? ' is-compact' : ''}`}
      aria-labelledby={`${inputId}-title`}
      data-testid="section-charging-lookup"
    >
      {!compact && (
        <header className="geography-map-head">
          <div className="geography-map-title-wrap">
            <span className="geography-map-icon" aria-hidden="true"><Gavel size={22} /></span>
            <div>
              <p className="geography-map-eyebrow">Charging</p>
              <h2 id={`${inputId}-title`}>Charging Lookup</h2>
            </div>
          </div>
        </header>
      )}
      <div className="charging-body">
        <label className="charging-search" htmlFor={inputId}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Section number or offense</span>
          <input
            id={inputId}
            type="search"
            value={query}
            placeholder="Section number or offense"
            autoComplete="off"
            onChange={event => { setQuery(event.target.value); setSelected(null); }}
            data-testid="input-charging-search"
          />
        </label>
        {loadFailed && <p className="charging-empty" role="alert">Charging data is unavailable. Reload the page to try again.</p>}
        {selected ? (
          <ChargeDetail code={selected} onBack={() => setSelected(null)} />
        ) : query.trim() && codes ? (
          results.length ? (
            <ul className="charging-results" data-testid="list-charging-results">
              {results.map(code => (
                <li key={code.key}>
                  <button type="button" onClick={() => setSelected(code)} data-testid={`button-charge-${code.key}`}>
                    <span className="charging-code">{code.kind} {code.section}</span>
                    <span className="charging-offense">{code.offense}</span>
                    <span className="charging-count">{code.entries.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="charging-empty">No matching charge.</p>
        ) : null}
      </div>
    </section>
  );
}

function ChargeDetail({ code, onBack }: { code: ChargeCode; onBack: () => void }) {
  const [entryIndex, setEntryIndex] = useState(0);
  const [statute, setStatute] = useState<StatuteClauses | null | undefined>(undefined);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [officialReviewed, setOfficialReviewed] = useState(false);
  const [copied, setCopied] = useState(false);
  const entry = code.entries[entryIndex];

  useEffect(() => {
    let live = true;
    setStatute(undefined);
    loadStatute(code).then(value => { if (live) setStatute(value); }).catch(() => { if (live) setStatute(null); });
    return () => { live = false; };
  }, [code]);

  useEffect(() => { setChecked(new Set()); setOfficialReviewed(false); setCopied(false); }, [entryIndex, code]);

  const group: ElementGroup | null = useMemo(() => {
    if (!statute || !entry) return null;
    const citation = entry.citations.find(item => item.includes(code.section)) ?? '';
    return elementsForCitation(statute, citationPath(citation, code.section));
  }, [statute, entry, code.section]);

  const levels = statute ? penaltySentences(statute) : [];
  const elementsDone = group && (group.lead.length || group.alternatives.length)
    ? elementsComplete(group, checked)
    : officialReviewed;
  const copyAllowed = Boolean(entry && canCopyWording(entry) && elementsDone);
  const officialUrl = OFFICIAL_STATUTE_URL(code.kind, code.section);

  const toggle = (index: number) => setChecked(previous => {
    const next = new Set(previous);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  const copy = async () => {
    if (!entry || !copyAllowed) return;
    await navigator.clipboard.writeText(entry.text);
    setCopied(true);
  };

  if (!entry) return null;
  return (
    <div className="charging-detail" data-testid="panel-charge-detail">
      <button type="button" className="charging-back" onClick={onBack} data-testid="button-charging-back">Back to results</button>

      <section className="charging-step" aria-labelledby="charging-offense">
        <h3 id="charging-offense">Offense</h3>
        <p className="charging-title" data-testid="text-charge-title">{code.offense} <span>{code.kind} {code.section}</span></p>
        {code.entries.length > 1 && (
          <label className="charging-variant">
            <span className="sr-only">Complaint variant</span>
            <select value={entryIndex} onChange={event => setEntryIndex(Number(event.target.value))} data-testid="select-charge-variant">
              {code.entries.map((item, index) => (
                <option key={`${item.page}-${index}`} value={index}>{item.heading} · {item.variant}</option>
              ))}
            </select>
          </label>
        )}
        {code.entries.length === 1 && <p className="charging-variant-text">{entry.heading} · {entry.variant}</p>}
        <a className="geography-map-link" href={officialUrl} target="_blank" rel="noreferrer" data-testid="link-official-statute">
          <ExternalLink size={15} aria-hidden="true" /> Official statute
        </a>
      </section>

      <section className="charging-step" aria-labelledby="charging-level">
        <h3 id="charging-level">Level</h3>
        {statute === undefined ? <p className="charging-empty">Loading…</p> : levels.length ? (
          <div className="charging-quotes" data-testid="list-charge-level">
            {levels.map(text => <blockquote key={text}>{text}</blockquote>)}
          </div>
        ) : <p className="charging-empty">See the official statute.</p>}
        {entry.notes && <p className="charging-notes" data-testid="text-charge-notes">{entry.notes}</p>}
      </section>

      <section className="charging-step" aria-labelledby="charging-elements">
        <h3 id="charging-elements">Statute text</h3>
        {statute === undefined ? <p className="charging-empty">Loading…</p> : group && (group.lead.length || group.alternatives.length) ? (
          <div className="charging-elements" data-testid="list-charge-elements">
            {group.lead.map(line => (
              <ElementCheck key={line.index} line={line} checked={checked.has(line.index)} onToggle={toggle} />
            ))}
            {group.requiresOne && (
              <div className="charging-alternatives" role="group" aria-label="Alternatives">
                {group.alternatives.map(line => (
                  <ElementCheck key={line.index} line={line} checked={checked.has(line.index)} onToggle={toggle} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <label className="charging-element" data-testid="check-official-reviewed">
            <input type="checkbox" checked={officialReviewed} onChange={event => setOfficialReviewed(event.target.checked)} />
            <span>Official statute text reviewed</span>
          </label>
        )}
      </section>

      <section className="charging-step" aria-labelledby="charging-wording">
        <h3 id="charging-wording">Complaint wording</h3>
        {(entry.conflict || entry.ambiguous || entry.example) && (
          <p className="charging-flag" data-testid="text-charge-flag">
            {entry.conflict ? 'Manual conflict' : entry.ambiguous ? 'Ambiguous manual entry' : 'Manual example'}
          </p>
        )}
        <p className="charging-wording" data-testid="text-complaint-wording">{entry.text}</p>
        <div className="charging-actions">
          <button type="button" className="charging-copy" disabled={!copyAllowed} onClick={() => { void copy(); }} data-testid="button-copy-wording">
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied ? 'Copied' : 'Copy wording'}
          </button>
          <a className="geography-map-link" href={manualPageHref(entry.page)} target="_blank" rel="noreferrer" data-testid="link-manual-page">
            <FileText size={15} aria-hidden="true" /> Manual page {entry.page}
          </a>
        </div>
      </section>
    </div>
  );
}

function ElementCheck({ line, checked, onToggle }: {
  line: { index: number; text: string; depth: number };
  checked: boolean;
  onToggle: (index: number) => void;
}) {
  return (
    <label className="charging-element" style={{ paddingLeft: `${Math.min(line.depth, 4) * 18}px` }} data-testid={`check-element-${line.index}`}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(line.index)} />
      <span>{line.text}</span>
    </label>
  );
}
