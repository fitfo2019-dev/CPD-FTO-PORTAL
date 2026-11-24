import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/react';
import { Link } from 'wouter';
import {
  ArrowDownRight, ArrowUpRight, BookMarked, BookOpen, Check, ClipboardCheck, Download, FileText, ExternalLink,
  LibraryBig, Search, ShieldCheck, UserRound, X,
} from 'lucide-react';
import { useListResources, apiEndpoint, type ResourceCatalogItem } from '@workspace/api-client-react';
import { PageHead } from '@/components/bits.js';
import { GeographyMapPanel } from '@/components/geography-map-panel.js';
import {
  FTO_HELP, MANUAL_SOURCE, UPLOADED_FORM_SOURCES,
} from '@/lib/fto-help.js';
import { DIVISION_DIRECTIVES, DIVISION_DIRECTIVE_SOURCE_URL } from '@/lib/division-directives.js';
import {
  DIRECTIVE_PDF_INDEX_SOURCE, DIRECTIVE_PDF_INDEX_VERIFIED_ON, DIRECTIVE_PDF_LINKS,
} from '@/lib/directive-pdf-index.js';
import { LAW_LIBRARY_ENTRIES, LAW_LIBRARY_SOURCES } from '@/lib/law-library.js';
import { sortCatalogRecords } from '@/lib/library-catalog.js';
import { assignmentsForLawReview, lawReviewId } from '@/lib/law-review.js';
import { loadOrcCorpus, type OfficialOrcSection } from '@/lib/orc-law-data.js';
import { useWorkspace } from '@/state/workspace.js';
import type { LawReviewRecord } from '@/lib/model.js';
import manualIndexText from '@/assets/fto-manual-index.json?raw';

import { ApplicationHelpDesk } from '@/components/application-help-desk.js';

type Group =
  | 'Columbus City Code'
  | 'Division Directives'
  | 'FTO Manual'
  | 'Forms & guidance'
  | 'Ohio Public Defender Casebook'
  | 'Ohio Public Defender Glossary'
  | 'Ohio Revised Code'
  | 'Oyez Supreme Court Cases';
type OrcCategoryFilter = 'All categories' | 'Criminal' | 'Traffic' | 'Parking' | 'Sentencing';
type ManualPassage = { section: string; text: string; heading: boolean };
type LibraryRecord = {
  id: string;
  group: Group;
  title: string;
  label: string;
  searchText: string;
  description: string;
  source: string;
  url?: string;
  pdfUrl?: string;
  readerUrl?: string;
  section?: string;
  index?: number;
  indexOnly?: boolean;
  meta?: string;
  category?: string;
  statutoryText?: string;
  effectiveDate?: string;
  latestLegislation?: string;
  retrievedAt?: string;
};

function isResourceCatalogItem(value: unknown): value is ResourceCatalogItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ResourceCatalogItem>;
  return typeof item.id === 'string'
    && typeof item.title === 'string'
    && typeof item.file_type === 'string'
    && typeof item.description === 'string'
    && typeof item.handling_note === 'string';
}

const MANUAL_PASSAGES = JSON.parse(manualIndexText) as ManualPassage[];
const PDF_BY_NUMBER = new Map<string, (typeof DIRECTIVE_PDF_LINKS)[number]>(
  DIRECTIVE_PDF_LINKS.map((directive) => [directive.number, directive]),
);
const GROUPS: Array<'All sources' | Group> = [
  'All sources', 'Columbus City Code', 'Division Directives', 'Forms & guidance',
  'FTO Manual', 'Ohio Public Defender Casebook', 'Ohio Public Defender Glossary',
  'Ohio Revised Code', 'Oyez Supreme Court Cases',
];
const ORC_CATEGORY_FILTERS: OrcCategoryFilter[] = ['All categories', 'Criminal', 'Traffic', 'Parking', 'Sentencing'];

const DIRECTIVE_RECORDS: LibraryRecord[] = DIVISION_DIRECTIVES.map((directive) => {
  const pdf = PDF_BY_NUMBER.get(directive.number);
  const pdfUrl = pdf?.url;
  return {
    id: `directive-${directive.number}`,
    group: 'Division Directives',
    title: pdf?.title ?? directive.title,
    label: `Division Directive ${directive.number}`,
    searchText: `${directive.number} ${directive.title} ${pdf?.title ?? ''} directive division policy`,
    description: pdfUrl
      ? 'Official Columbus Division of Police directive PDF.'
      : 'This title appears in the Division Directive table of contents. No individual public PDF is listed for this directive.',
    source: pdfUrl ? 'Columbus Division of Police · public directive PDF' : 'Columbus Division of Police · official table of contents',
    url: pdfUrl,
    pdfUrl,
    indexOnly: !pdfUrl,
  };
});

function lawGroup(kind: (typeof LAW_LIBRARY_ENTRIES)[number]['kind']): Group {
  if (kind === 'Ohio Revised Code') return 'Ohio Revised Code';
  if (kind === 'Columbus City Code') return 'Columbus City Code';
  return 'Oyez Supreme Court Cases';
}

const LAW_RECORDS: LibraryRecord[] = LAW_LIBRARY_ENTRIES.map((entry) => ({
  id: entry.id,
  group: lawGroup(entry.kind),
  title: entry.title,
  label: `${entry.citation}${entry.category ? ` · ${entry.category}` : ''} · ${entry.kind}`,
  searchText: `${entry.kind} ${entry.citation} ${entry.title} ${entry.summary} ${entry.keywords.join(' ')}`,
  description: entry.summary,
  source: entry.source,
  url: entry.url,
  category: entry.category,
}));

const LEGAL_SOURCE_RECORDS: LibraryRecord[] = LAW_LIBRARY_SOURCES.map((source) => ({
  id: `source-${testSlug(source.label)}`,
  group: source.label === 'Ohio Revised Code'
    ? 'Ohio Revised Code'
    : source.label === 'Columbus City Code'
      ? 'Columbus City Code'
      : source.label === 'Ohio Public Defender Criminal Law Casebook'
        ? 'Ohio Public Defender Casebook'
        : source.label === 'Ohio Public Defender Legal Glossary'
          ? 'Ohio Public Defender Glossary'
          : 'Oyez Supreme Court Cases',
  title: source.label,
  label: 'Official searchable source',
  searchText: `${source.label} official full text code cases glossary legal reference`,
  description: source.label === 'Ohio Public Defender Criminal Law Casebook'
    ? 'Open the official casebook directly in a new tab. Its publisher states that the contents may not be duplicated without express permission.'
    : 'Use the official source reader to search current sections, topics, or terms.',
  source: 'Official source · shown in this page',
  url: source.url,
}));

const MANUAL_RECORDS: LibraryRecord[] = MANUAL_PASSAGES.map((passage, index) => ({
  id: `manual-${index + 1}`,
  group: 'FTO Manual',
  title: passage.heading ? passage.text : passage.text.slice(0, 105).trim(),
  label: `${passage.section || 'Manual passage'} · passage ${index + 1}`,
  searchText: `${passage.section} ${passage.text}`,
  description: passage.text,
  source: `${MANUAL_SOURCE} · passage ${index + 1}`,
  section: passage.section,
  index,
}));

const GUIDANCE_RECORDS: LibraryRecord[] = [
  ...FTO_HELP.map((entry) => ({
    id: `guide-${entry.id}`,
    group: 'Forms & guidance' as const,
    title: entry.title,
    label: 'FTO guidance',
    searchText: `${entry.title} ${entry.text} ${entry.source}`,
    description: entry.text,
    source: entry.source,
  })),
  ...UPLOADED_FORM_SOURCES.map((form, index) => ({
    id: `form-${index + 1}`,
    group: 'Forms & guidance' as const,
    title: form.title,
    label: 'Uploaded form reference',
    searchText: `${form.title} ${form.scope} ${form.pages} pages ${form.fields} fillable fields`,
    description: `${form.scope}. The supplied reference lists ${form.pages} ${form.pages === 1 ? 'page' : 'pages'} and ${form.fields} fillable fields.`,
    source: 'Uploaded FTO form reference set',
    meta: `${form.pages} ${form.pages === 1 ? 'page' : 'pages'} · ${form.fields} fillable fields`,
  })),
];

const BASE_LIBRARY_RECORDS = [...LAW_RECORDS, ...LEGAL_SOURCE_RECORDS, ...DIRECTIVE_RECORDS, ...MANUAL_RECORDS, ...GUIDANCE_RECORDS];
const SORTED_LIBRARY_SOURCES = [...LAW_LIBRARY_SOURCES].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
const SOURCE_HINTS: Record<string, string> = {
  'Ohio Revised Code': 'Browse all state statutes and sections.',
  'Columbus City Code': 'Browse the complete Columbus ordinance code.',
  'Ohio Public Defender Criminal Law Casebook': 'Open the casebook index and its built-in search.',
  'Ohio Public Defender Legal Glossary': 'Search legal terms and definitions.',
  'Oyez Supreme Court cases': 'Search U.S. Supreme Court cases and opinions.',
};
const SOURCE_MARKS: Record<string, string> = {
  'Ohio Revised Code': 'ORC',
  'Columbus City Code': 'CCC',
  'Ohio Public Defender Criminal Law Casebook': 'CASES',
  'Ohio Public Defender Legal Glossary': 'TERMS',
  'Oyez Supreme Court cases': 'OYEZ',
};
function testSlug(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function HelpPage() {
  const { ws, upsertLawReviewRecord, deleteLawReviewRecord, vault, dirty } = useWorkspace();
  const { user } = useUser();
  const {
    data: resourceResponse,
    isLoading: resourcesLoading,
    isError: resourcesError,
    refetch: refetchResources,
  } = useListResources();
  const resources = Array.isArray(resourceResponse?.data)
    ? resourceResponse.data.filter(isResourceCatalogItem)
    : [];
  const [orcCorpus, setOrcCorpus] = useState<OfficialOrcSection[]>([]);
  const [orcCorpusState, setOrcCorpusState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<'All sources' | Group>('All sources');
  const [activeOrcCategory, setActiveOrcCategory] = useState<OrcCategoryFilter>('All categories');
  const [selectedId, setSelectedId] = useState('orc-2903-13');
  const [groupLimits, setGroupLimits] = useState<Partial<Record<Group, number>>>({});
  const [reviewAssignmentId, setReviewAssignmentId] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const libraryRecords = useMemo(() => {
    const fullTextIds = new Set(orcCorpus.map((section) => section.id));
    const officialOrcRecords: LibraryRecord[] = orcCorpus.map((section) => ({
      id: section.id,
      group: 'Ohio Revised Code',
      title: section.title,
      label: `${section.citation} · ${section.category}`,
      searchText: `${section.citation} ${section.chapterTitle} ${section.title} ${section.category} ${section.effectiveDate} ${section.latestLegislation} ${section.text}`,
      description: `Chapter ${section.chapter} · ${section.chapterTitle}. Effective ${section.effectiveDate}. Latest legislation: ${section.latestLegislation}. Official text captured ${section.retrievedAt}; check the official source for later changes.`,
      source: `Ohio Laws · ${section.category} · captured ${section.retrievedAt}`,
      url: section.sourceUrl,
      statutoryText: section.text,
      category: section.category,
      effectiveDate: section.effectiveDate,
      latestLegislation: section.latestLegislation,
      retrievedAt: section.retrievedAt,
    }));
    const nonDuplicateBaseRecords = BASE_LIBRARY_RECORDS.filter(
      (record) => record.group !== 'Ohio Revised Code' || !fullTextIds.has(record.id),
    );
    return [...nonDuplicateBaseRecords, ...officialOrcRecords];
  }, [orcCorpus]);
  const recordCounts = useMemo(
    () => Object.fromEntries(
      GROUPS.filter((group): group is Group => group !== 'All sources')
        .map((group) => [group, libraryRecords.filter((record) => record.group === group).length]),
    ) as Record<Group, number>,
    [libraryRecords],
  );
  const orcCategoryCounts = useMemo(
    () => Object.fromEntries(ORC_CATEGORY_FILTERS.map((category) => [
      category,
      category === 'All categories'
        ? libraryRecords.filter((record) => record.group === 'Ohio Revised Code').length
        : libraryRecords.filter((record) => record.group === 'Ohio Revised Code' && record.category === category).length,
    ])) as Record<OrcCategoryFilter, number>,
    [libraryRecords],
  );
  const signedInEmail = user?.primaryEmailAddress?.emailAddress.trim().toLocaleLowerCase();
  const signedInFto = signedInEmail
    ? ws.ftoDirectory.find((entry) => entry.email?.trim().toLocaleLowerCase() === signedInEmail)
    : undefined;
  const reviewAssignments = useMemo(
    () => assignmentsForLawReview(ws.role, ws.assignments, signedInEmail, signedInFto?.badge),
    [ws.role, ws.assignments, signedInEmail, signedInFto?.badge],
  );
  const canAssignReview = ws.role === 'fto_coordinator' || (ws.role === 'fto' && !!signedInFto);
  const canAcknowledgeReview = ws.role === 'po' && reviewAssignments.length > 0;

  useEffect(() => {
    let cancelled = false;
    loadOrcCorpus(import.meta.env.BASE_URL)
      .then((sections) => {
        if (cancelled) return;
        setOrcCorpus(sections);
        setOrcCorpusState('ready');
      })
      .catch(() => {
        if (!cancelled) setOrcCorpusState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matchingRecords = useMemo(() => {
    const matches = libraryRecords.filter((record) => {
      const groupMatches = activeGroup === 'All sources' || record.group === activeGroup;
      const categoryMatches = activeGroup !== 'Ohio Revised Code'
        || activeOrcCategory === 'All categories'
        || record.category === activeOrcCategory;
      return groupMatches && categoryMatches && (!normalizedQuery || record.searchText.toLowerCase().includes(normalizedQuery));
    });
    return sortCatalogRecords(matches, GROUPS.filter((group) => group !== 'All sources'));
  }, [activeGroup, activeOrcCategory, libraryRecords, normalizedQuery]);
  const catalogGroups = useMemo(() => {
    const recordsByGroup = new Map<Group, LibraryRecord[]>();
    matchingRecords.forEach((record) => {
      const records = recordsByGroup.get(record.group) ?? [];
      records.push(record);
      recordsByGroup.set(record.group, records);
    });
    return GROUPS.filter((group): group is Group => group !== 'All sources')
      .map((group) => ({ group, records: recordsByGroup.get(group) ?? [] }))
      .filter((group) => group.records.length > 0);
  }, [matchingRecords]);
  const selectedRecord = libraryRecords.find((record) => record.id === selectedId) ?? null;
  const isReviewableRecord = !!selectedRecord && ['Ohio Revised Code', 'Columbus City Code', 'Division Directives', 'Ohio Public Defender Casebook', 'Ohio Public Defender Glossary', 'Oyez Supreme Court Cases'].includes(selectedRecord.group);
  const selectedReviewAssignment = reviewAssignments.find((item) => item.id === reviewAssignmentId);
  const selectedReviewId = selectedReviewAssignment ? lawReviewId(selectedReviewAssignment.id, selectedId) : '';
  const selectedLawReview = ws.lawReviewRecords.find((item) => item.id === selectedReviewId);
  const assignmentReviews = selectedReviewAssignment
    ? ws.lawReviewRecords.filter((item) => item.assignmentId === selectedReviewAssignment.id)
    : [];
  const reviewCount = assignmentReviews.filter((item) => item.state === 'reviewed').length;
  const reviewStateBySourceId = new Map(assignmentReviews.map((item) => [item.sourceId, item.state]));

  useEffect(() => {
    if (!matchingRecords.some((record) => record.id === selectedId)) {
      setSelectedId(matchingRecords[0]?.id ?? '');
    }
  }, [matchingRecords, selectedId]);

  useEffect(() => {
    const preferred = ws.role === 'po' ? reviewAssignments[0]?.id : ws.caseFolder?.assignmentId;
    if (reviewAssignments.some((assignment) => assignment.id === reviewAssignmentId)) return;
    setReviewAssignmentId(
      preferred && reviewAssignments.some((assignment) => assignment.id === preferred)
        ? preferred
        : reviewAssignments[0]?.id ?? '',
    );
  }, [reviewAssignments, reviewAssignmentId, ws.role, ws.caseFolder?.assignmentId]);

  function assignSelectedRecordForReview() {
    if (!canAssignReview || !selectedReviewAssignment || !selectedRecord || !isReviewableRecord || selectedLawReview) return;
    const assignedAt = new Date().toISOString();
    upsertLawReviewRecord({
      id: selectedReviewId,
      assignmentId: selectedReviewAssignment.id,
      className: selectedReviewAssignment.className,
      phase: selectedReviewAssignment.phase,
      recruitName: selectedReviewAssignment.recruitName,
      recruitBadge: selectedReviewAssignment.recruitBadge,
      sourceId: selectedRecord.id,
      sourceLabel: `${selectedRecord.label} · ${selectedRecord.title}`,
      sourceUrl: selectedRecord.readerUrl ?? selectedRecord.pdfUrl ?? selectedRecord.url,
      state: 'assigned',
      assignedAt,
      assignedByFtoBadge: signedInFto?.badge,
    });
  }

  function setSelectedRecordReviewed(reviewed: boolean) {
    if (!canAcknowledgeReview || !selectedReviewAssignment || !selectedRecord || !isReviewableRecord) return;
    if (!reviewed && selectedLawReview?.state === 'assigned') {
      upsertLawReviewRecord({ ...selectedLawReview, state: 'assigned', reviewedAt: undefined });
      return;
    }
    if (!reviewed && selectedLawReview) {
      deleteLawReviewRecord(selectedLawReview.id);
      return;
    }
    if (reviewed) {
      const record: LawReviewRecord = {
        id: selectedReviewId,
        assignmentId: selectedReviewAssignment.id,
        className: selectedReviewAssignment.className,
        phase: selectedReviewAssignment.phase,
        recruitName: selectedReviewAssignment.recruitName,
        recruitBadge: selectedReviewAssignment.recruitBadge,
        sourceId: selectedRecord.id,
        sourceLabel: `${selectedRecord.label} · ${selectedRecord.title}`,
        sourceUrl: selectedRecord.readerUrl ?? selectedRecord.pdfUrl ?? selectedRecord.url,
        state: 'reviewed',
        assignedAt: selectedLawReview?.assignedAt,
        assignedByFtoBadge: selectedLawReview?.assignedByFtoBadge,
        reviewedAt: new Date().toISOString(),
      };
      upsertLawReviewRecord(record);
    }
  }

  function openRecord(id: string) {
    setQuery('');
    setActiveGroup('All sources');
    setGroupLimits({});
    selectRecord(id);
  }

  function selectRecord(id: string) {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 760px)').matches) {
      window.setTimeout(() => document.querySelector('.library-reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }

  function changeGroup(group: 'All sources' | Group) {
    setActiveGroup(group);
    setActiveOrcCategory('All categories');
    setGroupLimits({});
  }

  function changeQuery(value: string) {
    setQuery(value);
    setGroupLimits({});
  }

  return (
    <div className="law-library-page mx-auto max-w-[1440px]">
      <PageHead kicker="Field Training Officer Portal · Columbus" title="Help Desk">
        <a
          href={DIRECTIVE_PDF_INDEX_SOURCE}
          target="_blank"
          rel="noreferrer"
          className="library-source-button"
          data-testid="link-official-directives"
        >
          <ExternalLink aria-hidden="true" size={16} /> Official directives
        </a>
      </PageHead>

      <ApplicationHelpDesk />
      <GeographyMapPanel />
      <section className="uploaded-resources" aria-labelledby="uploaded-resources-title" data-testid="section-uploaded-resources">
        <div className="uploaded-resources-heading">
          <div>
            <p className="library-eyebrow"><ShieldCheck size={15} aria-hidden="true" /> Signed-in downloads</p>
            <h2 id="uploaded-resources-title">Uploaded reference documents</h2>
          </div>
          <span className="uploaded-resources-count" data-testid="text-resource-count">
            {resourcesLoading ? 'Loading' : `${resources.length} ${resources.length === 1 ? 'file' : 'files'}`}
          </span>
        </div>
        <p className="uploaded-resources-note">
          Downloads may contain personal or internal information. Handle them under agency rules; verify current law and policy in official sources.
        </p>
        {resourcesLoading ? (
          <div className="uploaded-resources-grid" aria-busy="true" aria-label="Loading reference documents">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="uploaded-resource-skeleton" key={index} data-testid={`skeleton-resource-${index}`} />
            ))}
          </div>
        ) : resourcesError ? (
          <div className="uploaded-resources-state" role="alert" data-testid="error-resource-catalog">
            <p>The reference document list could not be loaded. Try again; downloads require an active sign-in.</p>
            <button type="button" onClick={() => { void refetchResources(); }} data-testid="button-retry-resource-catalog">
              Try again
            </button>
          </div>
        ) : resources.length === 0 ? (
          <p className="uploaded-resources-state" data-testid="empty-resource-catalog">
            No uploaded reference documents are available.
          </p>
        ) : (
          <div className="uploaded-resources-grid" data-testid="grid-uploaded-resources">
            {resources.map((resource) => (
              <article className="uploaded-resource-card" key={resource.id} data-testid={`card-resource-${resource.id}`}>
                <div className="uploaded-resource-card-top">
                  <span className="uploaded-resource-type"><FileText size={15} aria-hidden="true" />{resource.file_type}</span>
                  <ShieldCheck size={16} aria-label="Sign-in required" className="uploaded-resource-protected" />
                </div>
                <div className="uploaded-resource-copy">
                  <h3>{resource.title}</h3>
                  <p>{resource.description}</p>
                  {resource.handling_note && (
                    <p className="uploaded-resource-handling">{resource.handling_note}</p>
                  )}
                </div>
                <a
                  className="uploaded-resource-download"
                  href={apiEndpoint(`/v1/resources/${encodeURIComponent(resource.id)}/download`)}
                  download
                  data-testid={`link-download-resource-${resource.id}`}
                >
                  <Download size={15} aria-hidden="true" /> Download
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <header className="library-intro">
        <div className="library-intro-copy">
          <p className="library-eyebrow"><LibraryBig size={15} aria-hidden="true" /> Existing sources</p>
          <h2>Resources / Law Library</h2>
          <p className="library-intro-text">Search the manual, directives, forms, and official legal references.</p>
        </div>
        <div className="library-count-strip" aria-label="Catalog contents">
          <div><strong>{DIVISION_DIRECTIVES.length}</strong><span>directive titles</span></div>
          <div><strong>{DIRECTIVE_PDF_LINKS.length}</strong><span>public PDFs</span></div>
          <div><strong>{MANUAL_PASSAGES.length}</strong><span>manual passages</span></div>
        </div>
        <p className="library-source-date">Directive PDFs checked {DIRECTIVE_PDF_INDEX_VERIFIED_ON}</p>
      </header>

      <section className="library-search-area" aria-label="Search the library">
        <div className="library-search-box">
          <Search size={21} aria-hidden="true" />
          <label className="sr-only" htmlFor="library-search">Search all library sources</label>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Search code, directive, form, or manual"
            data-testid="input-help-search"
          />
          {query && (
            <button type="button" onClick={() => changeQuery('')} aria-label="Clear search" data-testid="button-clear-search">
              <X size={17} />
            </button>
          )}
          <kbd>SEARCH</kbd>
        </div>
        <p className="library-search-note">Search official Ohio criminal, traffic, and parking sections, plus Columbus code chapters, directives, and manual passages.</p>
        <p className="library-search-note" role="status" data-testid="status-orc-corpus">
          {orcCorpusState === 'loading' && 'Loading the local Ohio Revised Code text…'}
          {orcCorpusState === 'ready' && `Local ORC text is available for ${orcCorpus.length.toLocaleString()} sections. This copy was captured November 19, 2026; use the linked official section to check for later changes.`}
          {orcCorpusState === 'error' && 'The local ORC text could not be loaded. Reload the library; the official links remain available.'}
        </p>
        <div className="library-filter-row" role="group" aria-label="Filter catalog by source">
          {GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => changeGroup(group)}
              className={activeGroup === group ? 'library-filter is-active' : 'library-filter'}
              aria-pressed={activeGroup === group}
              data-testid={`filter-library-${testSlug(group)}`}
            >
              {group}
              {group !== 'All sources' && <span>{recordCounts[group]}</span>}
            </button>
          ))}
        </div>
        {activeGroup === 'Ohio Revised Code' && (
          <div className="library-filter-row library-category-filters" role="group" aria-label="Filter Ohio Revised Code by category">
            {ORC_CATEGORY_FILTERS.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => { setActiveOrcCategory(category); setGroupLimits({}); }}
                className={activeOrcCategory === category ? 'library-filter is-active' : 'library-filter'}
                aria-pressed={activeOrcCategory === category}
                data-testid={`filter-orc-${testSlug(category)}`}
              >
                {category}<span>{orcCategoryCounts[category]}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="library-code-paths" aria-label="Official source collections">
        <div className="library-code-intro">
          <span className="library-section-mark">01</span>
          <div><p className="library-eyebrow">Full source collections</p><h3>Browse official sources</h3></div>
        </div>
        {SORTED_LIBRARY_SOURCES.map((source) => {
          const sourceId = `source-${testSlug(source.label)}`;
          return (
            <button
              key={sourceId}
              type="button"
              className={selectedId === sourceId ? 'library-source-card is-selected' : 'library-source-card'}
              onClick={() => openRecord(sourceId)}
              data-testid={`button-source-${testSlug(source.label)}`}
            >
              <span className="library-code-monogram">{SOURCE_MARKS[source.label] ?? 'LAW'}</span>
              <span><strong>{source.label}</strong><small>{SOURCE_HINTS[source.label] ?? 'Open the official source reader.'}</small></span>
              <ArrowDownRight size={18} aria-hidden="true" />
            </button>
          );
        })}
      </section>

      <div className="library-workspace">
        <section className="library-catalog" aria-label="Search results">
          <div className="library-results-head">
            <div><p className="library-eyebrow">Catalog</p><h3>{normalizedQuery ? 'Matching sources' : 'Browse sources'}</h3></div>
            <span className="library-result-count" role="status" data-testid="status-library-result-count">
              {matchingRecords.length} {matchingRecords.length === 1 ? 'result' : 'results'}
            </span>
          </div>
          <div className="library-result-list">
            {catalogGroups.map(({ group, records }) => {
              const limit = groupLimits[group] ?? 8;
              const visibleGroupRecords = records.slice(0, limit);
              return (
                <section className="library-result-group-section" key={group} aria-label={`${group} entries`}>
                  <div className="library-result-group" data-testid={`heading-library-${testSlug(group)}`}>
                    <strong>{group}</strong>
                    <span>{records.length} {records.length === 1 ? 'entry' : 'entries'}</span>
                  </div>
                  {visibleGroupRecords.map((record) => (
                    <button
                      type="button"
                      className={`library-result ${selectedId === record.id ? 'is-selected' : ''}`}
                      key={record.id}
                      onClick={() => selectRecord(record.id)}
                      aria-pressed={selectedId === record.id}
                      data-testid={`result-library-${testSlug(record.id)}`}
                    >
                      <span className={`library-result-icon library-icon-${testSlug(record.group)}`}>
                        {record.group === 'Division Directives' ? <FileText size={17} /> : record.group === 'FTO Manual' ? <BookOpen size={17} /> : record.group === 'Forms & guidance' ? <ShieldCheck size={17} /> : <BookMarked size={17} />}
                      </span>
                      <span className="library-result-main">
                        <span className="library-result-label">{record.label}</span>
                        <strong>{record.title}</strong>
                        <span className="library-result-source">{record.source}</span>
                      </span>
                      <span className={`library-source-status ${record.pdfUrl || record.url ? 'has-source' : 'no-source'}`}>
                        {record.pdfUrl ? 'PDF' : record.url ? 'Source' : record.indexOnly ? 'Index only' : 'Text'}
                      </span>
                      {reviewStateBySourceId.get(record.id) === 'reviewed' && <span className="library-review-result-chip"><Check size={12} aria-hidden="true" />Reviewed</span>}
                      {reviewStateBySourceId.get(record.id) === 'assigned' && <span className="library-review-result-chip is-assigned">To review</span>}
                    </button>
                  ))}
                  {records.length > visibleGroupRecords.length && (
                    <button
                      type="button"
                      className="library-show-more"
                      onClick={() => setGroupLimits((limits) => ({ ...limits, [group]: limit + 12 }))}
                      data-testid={`button-show-more-${testSlug(group)}`}
                    >
                      Show more {group} <span>{visibleGroupRecords.length} of {records.length}</span>
                    </button>
                  )}
                </section>
              );
            })}
            {matchingRecords.length === 0 && (
              <div className="library-empty-state" data-testid="empty-library-results">
                <Search size={22} aria-hidden="true" />
                <strong>No matching records</strong>
                <p>Try a shorter phrase or choose another source group.</p>
                <button type="button" onClick={() => { changeQuery(''); changeGroup('All sources'); }} data-testid="button-reset-library-search">Reset search</button>
              </div>
            )}
          </div>
        </section>

        <aside className="library-reader" aria-label="Source reader">
          {selectedRecord ? (
            <>
              <div className="library-reader-topline">
                <span>Source reader</span>
                <span className="library-reader-index">{selectedRecord.label}</span>
              </div>
              <div className="library-reader-heading">
                <p className="library-eyebrow">{selectedRecord.group}</p>
                <h3>{selectedRecord.title}</h3>
                {selectedRecord.section && <p className="library-reader-section">{selectedRecord.section}</p>}
              </div>
              {isReviewableRecord && ['fto', 'fto_coordinator', 'po'].includes(ws.role) && (
                <section className="library-review-panel" aria-label="Probationary officer review tracking" data-testid="panel-law-review">
                  <div className="library-review-heading">
                    <span><ClipboardCheck size={17} aria-hidden="true" /></span>
                    <div>
                      <p className="library-eyebrow">Training material review</p>
                      <h4>Track this source for a PO</h4>
                    </div>
                  </div>
                  {reviewAssignments.length > 0 && (
                    <div className="library-review-assignment">
                      <label>
                        <span className="library-review-label"><UserRound size={14} aria-hidden="true" /> Training assignment</span>
                        <select
                          value={selectedReviewAssignment?.id ?? ''}
                          onChange={(event) => setReviewAssignmentId(event.target.value)}
                          data-testid="select-law-review-assignment"
                        >
                          {reviewAssignments.map((assignment) => (
                            <option key={assignment.id} value={assignment.id}>
                              {assignment.recruitName} #{assignment.recruitBadge} · {assignment.className} · Phase {assignment.phase}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="library-review-progress">{reviewCount} reviewed</span>
                    </div>
                  )}
                  {canAssignReview && selectedReviewAssignment && (
                    <div className="library-review-action">
                      {selectedLawReview?.state === 'reviewed' ? (
                        <p className="library-review-state is-reviewed"><Check size={15} aria-hidden="true" /> PO reviewed this source{selectedLawReview.reviewedAt ? ` · ${new Date(selectedLawReview.reviewedAt).toLocaleDateString()}` : ''}</p>
                      ) : selectedLawReview?.state === 'assigned' ? (
                        <>
                          <p className="library-review-state"><span className="library-review-dot" /> Assigned · waiting for PO</p>
                          <button type="button" className="library-review-secondary" onClick={() => deleteLawReviewRecord(selectedLawReview.id)} data-testid="button-cancel-law-review">Cancel assignment</button>
                        </>
                      ) : (
                        <button type="button" className="library-review-primary" onClick={assignSelectedRecordForReview} data-testid="button-assign-law-review">
                          <ClipboardCheck size={15} /> Assign this source for PO review
                        </button>
                      )}
                    </div>
                  )}
                  {canAcknowledgeReview && selectedReviewAssignment && (
                    <label className="library-review-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedLawReview?.state === 'reviewed'}
                        onChange={(event) => setSelectedRecordReviewed(event.target.checked)}
                        data-testid="checkbox-law-reviewed"
                      />
                      <span>
                        <strong>I reviewed this source</strong>
                        <small>{selectedLawReview?.state === 'assigned' ? 'Your FTO asked you to review this material.' : 'Check after you have read the source above.'}</small>
                      </span>
                    </label>
                  )}
                  {ws.role === 'po' && !canAcknowledgeReview && (
                    <p className="library-review-unavailable" role="status">
                      No class assignment is available for this account, so a PO review cannot be recorded.
                    </p>
                  )}
                  {ws.role === 'fto' && !signedInFto && (
                    <p className="library-review-unavailable" role="status">
                      FTO access is not confirmed in this preview. Use an approved account to open assigned PO sources.
                    </p>
                  )}
                  {canAssignReview && !selectedReviewAssignment && (
                    <p className="library-review-unavailable" role="status">
                      No assigned class is available for this account.
                    </p>
                  )}
                  <p className="library-review-local" data-testid="status-law-review-storage">
                    {vault === 'unlocked' ? (dirty ? 'Changes are waiting to save in the local vault.' : 'Saved in this device’s encrypted vault.') : 'Not saved yet. Use Save locally to keep this review on this device.'}
                    {' '}Review records are not uploaded or shared with other accounts.
                  </p>
                </section>
              )}
              {selectedRecord.pdfUrl ? (
                <div className="library-pdf-wrap">
                  <iframe
                    title={`${selectedRecord.label} official PDF`}
                    src={`${selectedRecord.pdfUrl}#view=FitH`}
                    data-testid={`frame-directive-${testSlug(selectedRecord.id)}`}
                  />
                  <div className="library-pdf-fallback">
                    <span>PDF not displaying?</span>
                    <a href={selectedRecord.pdfUrl} target="_blank" rel="noreferrer" data-testid={`link-open-pdf-${testSlug(selectedRecord.id)}`}>
                      Open official PDF <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              ) : selectedRecord.statutoryText ? (
                <>
                  <div className="library-reader-copy library-source-summary" data-testid={`reader-content-${testSlug(selectedRecord.id)}`}>
                    <p className="library-summary-label">Official statutory text · captured {selectedRecord.retrievedAt}</p>
                    <p className="library-reader-description">{selectedRecord.description}</p>
                  </div>
                  <section className="library-statute-panel" aria-label="Ohio Revised Code statutory text">
                    <div className="library-statute-heading">
                      <div>
                        <p className="library-summary-label">Elements, definitions, exceptions, and penalties</p>
                        <h4>{selectedRecord.label}</h4>
                      </div>
                      <span>{selectedRecord.category}</span>
                    </div>
                    <pre className="library-statute-text" data-testid="text-orc-statute">{selectedRecord.statutoryText}</pre>
                  </section>
                </>
              ) : selectedRecord.url ? (
                <div className="library-reader-copy library-source-summary library-casebook-open" data-testid={`reader-content-${testSlug(selectedRecord.id)}`}>
                  <p className="library-summary-label">
                    {selectedRecord.group === 'Ohio Public Defender Casebook' ? 'Official Ohio Public Defender casebook' : 'Official source'}
                  </p>
                  <p className="library-reader-description">{selectedRecord.description}</p>
                  <a
                    className="library-open-official"
                    href={selectedRecord.url}
                    target="_blank"
                    rel="noreferrer"
                    data-testid={selectedRecord.group === 'Ohio Public Defender Casebook' ? 'link-open-casebook' : `link-open-official-${testSlug(selectedRecord.id)}`}
                  >
                    {selectedRecord.group === 'Ohio Public Defender Casebook' ? 'Open the casebook' : 'Open official source'}
                    <ExternalLink size={16} />
                  </a>
                </div>
              ) : selectedRecord.readerUrl ? (
                <>
                  {selectedRecord.readerUrl && (
                    <div className="library-reader-copy library-source-summary" data-testid={`reader-content-${testSlug(selectedRecord.id)}`}>
                      {selectedRecord.group === 'Ohio Revised Code' || selectedRecord.group === 'Columbus City Code' ? (
                        <p className="library-summary-label">Official section text · source reader</p>
                      ) : (
                        <p className="library-summary-label">Official source reader</p>
                      )}
                      <p className="library-reader-description">{selectedRecord.description}</p>
                    </div>
                  )}
                  <div className="library-web-wrap">
                    <iframe
                      title={`${selectedRecord.title} official source`}
                      src={selectedRecord.readerUrl}
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      data-testid={`frame-source-${testSlug(selectedRecord.id)}`}
                    />
                    <div className="library-pdf-fallback">
                      <span>If the source does not display here, open it directly.</span>
                      <a href={selectedRecord.readerUrl} target="_blank" rel="noreferrer" data-testid={`link-open-source-${testSlug(selectedRecord.id)}`}>
                        Open official source <ExternalLink size={15} />
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div className="library-reader-copy" data-testid={`reader-content-${testSlug(selectedRecord.id)}`}>
                  {selectedRecord.indexOnly && (
                    <div className="library-index-only"><FileText size={16} /> Index only · no individual public PDF listed</div>
                  )}
                  {selectedRecord.group === 'Oyez Supreme Court Cases' && <p className="library-summary-label">Training summary</p>}
                  <p className="library-reader-description">{selectedRecord.description}</p>
                  {selectedRecord.meta && <p className="library-reader-meta">{selectedRecord.meta}</p>}
                </div>
              )}
              <div className="library-reader-footer">
                <span>{selectedRecord.source}</span>
                {selectedRecord.statutoryText && selectedRecord.url && (
                  <a href={selectedRecord.url} target="_blank" rel="noreferrer" data-testid={`link-reader-source-${testSlug(selectedRecord.id)}`}>
                    Open current official section <ExternalLink size={15} />
                  </a>
                )}
                {selectedRecord.indexOnly && (
                  <a href={DIVISION_DIRECTIVE_SOURCE_URL} target="_blank" rel="noreferrer" data-testid="link-reader-directive-index">
                    Open official index <ExternalLink size={15} />
                  </a>
                )}
                {selectedRecord.group === 'FTO Manual' && <span className="library-reader-passage">Local indexed passage</span>}
              </div>
            </>
          ) : (
            <div className="library-reader-empty">
              <BookOpen size={28} aria-hidden="true" />
              <h3>Select a catalog record</h3>
              <p>Choose a result to read its available text or view the official source.</p>
            </div>
          )}
        </aside>
      </div>

      <footer className="library-note">
        <span className="library-note-rule" />
        <p>For current requirements, use the official law text and Division directive. The summaries are learning aids and are not a substitute for those source documents.</p>
      </footer>

      {ws.role !== 'fto_coc' && (
        <nav className="library-related-links" aria-label="Related portal pages">
          <Link href="/phase-setup" data-testid="link-help-phase-setup"><BookOpen size={16} /> Phase setup</Link>
          <Link href="/reports" data-testid="link-help-records">Saved daily records <ArrowUpRight size={15} /></Link>
        </nav>
      )}
    </div>
  );
}
