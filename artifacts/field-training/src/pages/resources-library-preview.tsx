import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ChevronRight, ExternalLink, FileCheck2, FileText, Files, LibraryBig, MapPinned, ShieldCheck, X,
} from 'lucide-react';
import {
  apiEndpoint,
  useListResources,
  type ResourceCatalogItem,
} from '@workspace/api-client-react';
import {
  EmptyState,
  LibraryNavigation,
  SearchControls,
  type LibraryResource,
} from '@workspace/fto-law-library-schema/components/library';
import {
  DIRECTIVE_PDF_INDEX_SOURCE,
  DIRECTIVE_PDF_INDEX_VERIFIED_ON,
  DIRECTIVE_PDF_LINKS,
} from '@/lib/directive-pdf-index.js';
import '@workspace/fto-law-library-schema/library.css';
import './resources-library-preview.css';

type ResourceCategory = 'All resources' | 'Reference Files' | 'Division directives' | 'Geography map';
type CatalogRecord = LibraryResource & {
  id: string;
  category: Exclude<ResourceCategory, 'All resources'>;
  description: string;
  searchText: string;
  fileType?: string;
  handlingNote?: string;
  url?: string;
  code?: string;
  groupKey: string;
};

type RecordGroup = { key: string; kicker?: string; title: string; records: CatalogRecord[] };

/** Chapter names as published on the Division directives index. */
const DIRECTIVE_CHAPTERS: Record<string, string> = {
  '1': 'Employee Conduct',
  '2': 'Use of Force',
  '3': 'Arrests, Detention and Searches',
  '4': 'Police Operations and Investigations',
  '5': 'Vehicle Operations and Investigations',
  '6': 'Property and Evidence',
  '7': 'Division Organization and Responsibilities',
  '8': 'Human Resources',
  '9': 'Fiscal and Personnel Management',
  '10': 'Information and Records',
  '11': 'Division Equipment and Uniforms',
};
const FILES_GROUP = 'reference-files';
const MAP_GROUP = 'geography-map';
const chapterOf = (number: string) => number.split('.')[0];
const directiveOrder = (number: string) => number.split('.').map(Number);

const CATEGORIES: ResourceCategory[] = [
  'All resources',
  'Reference Files',
  'Division directives',
  'Geography map',
];

function libraryRecord(item: ResourceCatalogItem): CatalogRecord {
  return {
    id: `file-${item.id}`,
    title: item.title,
    group: 'Reference Files',
    category: 'Reference Files',
    note: item.file_type,
    description: item.description,
    handlingNote: item.handling_note,
    fileType: item.file_type,
    groupKey: FILES_GROUP,
    searchText: `${item.title} Reference Files ${item.file_type} ${item.description} ${item.handling_note}`,
  };
}

const DIRECTIVE_RECORDS: CatalogRecord[] = DIRECTIVE_PDF_LINKS.map((directive) => ({
  id: `directive-${directive.number}`,
  title: directive.title,
  group: 'Division directives',
  category: 'Division directives',
  note: `Directive ${directive.number}`,
  code: directive.number,
  fileType: 'PDF',
  groupKey: `chapter-${chapterOf(directive.number)}`,
  description: `Official Columbus Division of Police directive PDF, number ${directive.number}.`,
  searchText: `${directive.number} ${directive.title} Division directives Chapter ${chapterOf(directive.number)} ${DIRECTIVE_CHAPTERS[chapterOf(directive.number)] ?? ''}`,
  url: directive.url,
}));

const MAP_RECORD: CatalogRecord = {
  id: 'columbus-geography-map',
  title: 'Columbus Police Geography Map',
  group: 'Geography map',
  category: 'Geography map',
  note: 'Interactive map',
  groupKey: MAP_GROUP,
  description: 'Explore the Columbus Police geography map in the embedded viewer.',
  searchText: 'Columbus Police Geography Map Geography map interactive map',
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

export default function ResourcesLibraryPage({ previewOnly = false }: { previewOnly?: boolean } = {}) {
  const { data: resourceResponse, isLoading, isError, refetch } = useListResources();
  const [category, setCategory] = useState<ResourceCategory>('All resources');
  const [query, setQuery] = useState('');
  const [sorted, setSorted] = useState(false);
  const [selected, setSelected] = useState<CatalogRecord | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const libraryResources = useMemo(
    () => Array.isArray(resourceResponse?.data)
      ? resourceResponse.data.filter(isResourceCatalogItem).map(libraryRecord)
      : [],
    [resourceResponse],
  );
  const records = useMemo(
    () => [...libraryResources, ...DIRECTIVE_RECORDS, MAP_RECORD],
    [libraryResources],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleRecords = useMemo(() => {
    const filtered = records.filter((record) => {
      const categoryMatches = category === 'All resources' || record.category === category;
      const queryMatches = !normalizedQuery || record.searchText.toLocaleLowerCase().includes(normalizedQuery);
      return categoryMatches && queryMatches;
    });
    return sorted
      ? [...filtered].sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }))
      : filtered;
  }, [category, normalizedQuery, records, sorted]);

  const groups = useMemo<RecordGroup[]>(() => {
    const byKey = new Map<string, CatalogRecord[]>();
    for (const record of visibleRecords) byKey.set(record.groupKey, [...(byKey.get(record.groupKey) ?? []), record]);
    const ordered: RecordGroup[] = [];
    const files = byKey.get(FILES_GROUP);
    if (files) ordered.push({ key: FILES_GROUP, title: 'Reference Files', records: files });
    Object.keys(DIRECTIVE_CHAPTERS).forEach((chapter) => {
      const records = byKey.get(`chapter-${chapter}`);
      if (!records) return;
      ordered.push({
        key: `chapter-${chapter}`,
        kicker: `Chapter ${chapter}`,
        title: DIRECTIVE_CHAPTERS[chapter],
        records: sorted ? records : [...records].sort((left, right) => {
          const [la, lb] = directiveOrder(left.code ?? '');
          const [ra, rb] = directiveOrder(right.code ?? '');
          return la - ra || lb - rb;
        }),
      });
    });
    const map = byKey.get(MAP_GROUP);
    if (map) ordered.push({ key: MAP_GROUP, title: 'Geography map', records: map });
    return ordered;
  }, [visibleRecords, sorted]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set<string>());
  const searching = normalizedQuery.length > 0;
  const isOpen = (key: string) => searching || category !== 'All resources' && groups.length === 1 || openGroups.has(key);
  const allOpen = groups.every((group) => isOpen(group.key));
  const toggleGroup = (key: string) => setOpenGroups((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleAll = () => setOpenGroups(allOpen ? new Set() : new Set(groups.map((group) => group.key)));

  const counts: Record<ResourceCategory, string | number> = {
    'All resources': isLoading || isError
      ? '—'
      : libraryResources.length + DIRECTIVE_RECORDS.length + 1,
    'Reference Files': isLoading ? 'Loading' : isError ? 'Unavailable' : libraryResources.length,
    'Division directives': DIRECTIVE_RECORDS.length,
    'Geography map': 1,
  };

  const closeDrawer = useCallback(() => setSelected(null), []);
  const selectResource = useCallback((resource: LibraryResource) => {
    const match = records.find((record) => record.id === (resource as CatalogRecord).id);
    if (match) setSelected(match);
  }, [records]);

  useEffect(() => {
    if (!selected) return;
    const previouslyFocused = document.activeElement;
    drawerRef.current?.querySelector<HTMLButtonElement>('.fls-close')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
      }
      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], [tabindex="0"]',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [selected, closeDrawer]);

  const collections = CATEGORIES.map((name) => ({
    name,
    count: counts[name],
    icon: name === 'All resources'
      ? <LibraryBig size={15} aria-hidden="true" />
      : name === 'Reference Files'
        ? <Files size={15} aria-hidden="true" />
        : name === 'Division directives'
          ? <FileCheck2 size={15} aria-hidden="true" />
          : <MapPinned size={15} aria-hidden="true" />,
  }));

  return (
    <section
      className="fls-scope resources-preview"
      id="resources-library"
      aria-labelledby="resources-library-title"
      ref={pageRef}
    >
      {previewOnly && (
        <div className="resources-preview-notice" role="note" data-testid="notice-preview-only">
          <ShieldCheck size={17} aria-hidden="true" />
          <p><strong>Development preview only.</strong> This review screen is separate from the live Resources page.</p>
        </div>
      )}

      <header className="resources-preview-heading">
        <div>
          <p className="resources-preview-eyebrow">Field Training Officer Portal · Columbus</p>
          <h1 id="resources-library-title" className="page-title">Resources Library</h1>
        </div>
      </header>

      <div className="resources-preview-layout">
        <LibraryNavigation
          collections={collections}
          category={category}
          onCategoryChange={(nextCategory) => setCategory(nextCategory as ResourceCategory)}
          title="FTO Resources"
          subtitle="COLUMBUS · FIELD TRAINING"
        />

        <section className="resources-preview-catalog" aria-label="Resource catalog">
          <SearchControls
            query={query}
            onQueryChange={setQuery}
            sorted={sorted}
            onToggleSort={() => setSorted((current) => !current)}
            placeholder="Search resources"
            ariaLabel="Search reference files, directives, or map"
          />

          <div className="resources-preview-results">
            <div className="resources-preview-results-head">
              <div>
                <h2>{category}</h2>
                <p aria-live="polite" data-testid="text-result-count">
                  {isLoading && (category === 'All resources' || category === 'Reference Files')
                    ? 'Loading reference files'
                    : isError && category === 'Reference Files'
                      ? 'Reference files unavailable'
                      : `${visibleRecords.length} ${visibleRecords.length === 1 ? 'resource' : 'resources'} shown`}
                </p>
              </div>
              <div className="rl-head-tools">
                {sorted && <span className="resources-preview-sort-label">Alphabetical order</span>}
                {groups.length > 1 && !searching && (
                  <button type="button" className="rl-toggle-all" onClick={toggleAll} data-testid="button-toggle-all-groups">
                    {allOpen ? 'Collapse all' : 'Expand all'}
                  </button>
                )}
              </div>
            </div>

            {isLoading && (category === 'All resources' || category === 'Reference Files') && (
              <div className="resources-preview-loading" aria-busy="true" aria-label="Loading reference files">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="resources-preview-skeleton" key={index} />
                ))}
              </div>
            )}

            {isError && (category === 'All resources' || category === 'Reference Files') && (
              <div className="resources-preview-error" role="alert" data-testid="error-library-files">
                <div>
                  <strong>Reference files could not be loaded.</strong>
                  <p>Files use your current portal sign-in. Try again; if your session has ended, return to sign in.</p>
                </div>
                <button type="button" onClick={() => { void refetch(); }} data-testid="button-retry-resources">
                  Try again
                </button>
              </div>
            )}

            <div className="rl-groups">
              {groups.map((group) => {
                const open = isOpen(group.key);
                return (
                  <section className="rl-group" key={group.key} data-testid={`group-${group.key}`}>
                    <h3 className="rl-group-heading">
                      <button
                        type="button"
                        className="rl-group-toggle"
                        aria-expanded={open}
                        aria-controls={`rl-rows-${group.key}`}
                        onClick={() => { if (!searching) toggleGroup(group.key); }}
                        aria-disabled={searching || undefined}
                        data-testid={`button-toggle-${group.key}`}
                      >
                        <ChevronRight className="rl-chevron" size={16} aria-hidden="true" />
                        {group.kicker && <span className="rl-group-kicker">{group.kicker}</span>}
                        <span className="rl-group-title">{group.title}</span>
                        <span className="rl-group-count">{group.records.length}</span>
                      </button>
                    </h3>
                    {open && (
                      <ul className="rl-rows" id={`rl-rows-${group.key}`}>
                        {group.records.map((record) => (
                          <li className="rl-row" key={record.id}>
                            <button
                              type="button"
                              className="rl-row-main"
                              onClick={() => selectResource(record)}
                              data-testid={`row-resource-${record.id}`}
                            >
                              <span className={record.code ? 'rl-code' : 'rl-code rl-code-icon'} aria-hidden={!record.code}>
                                {record.code ?? (record.category === 'Geography map'
                                  ? <MapPinned size={16} aria-hidden="true" />
                                  : <FileText size={16} aria-hidden="true" />)}
                              </span>
                              <span className="rl-text">
                                <span className="rl-title">{record.title}</span>
                                {record.category === 'Reference Files' && record.description && (
                                  <span className="rl-desc">{record.description}</span>
                                )}
                              </span>
                            </button>
                            {record.category === 'Reference Files' && record.fileType && <span className="rl-type">{record.fileType}</span>}
                            {record.category === 'Division directives' && (
                              <a className="rl-action" href={record.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${record.title} PDF`} data-testid={`link-row-directive-${record.code}`}>
                                <ExternalLink size={15} aria-hidden="true" /><span>Open</span>
                              </a>
                            )}
                            {record.category === 'Reference Files' && (
                              <a className="rl-action" href={apiEndpoint(`/v1/resources/${encodeURIComponent(record.id.slice('file-'.length))}/download`)} download aria-label={`Download ${record.title}`} data-testid={`link-row-file-${record.id.slice('file-'.length)}`}>
                                <ArrowDownToLine size={15} aria-hidden="true" /><span>Download</span>
                              </a>
                            )}
                            {record.category === 'Geography map' && (
                              <a className="rl-action" href="#resources-preview-map" aria-label="View the geography map" data-testid="link-row-map">
                                <MapPinned size={15} aria-hidden="true" /><span>View</span>
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              {!isLoading && !(isError && category === 'Reference Files') && visibleRecords.length === 0 && (
                <EmptyState
                  title={normalizedQuery ? 'No matching resources' : 'No resources in this category'}
                  description={normalizedQuery
                    ? 'Try a different search or choose another collection.'
                    : 'Reference files available to your signed-in account will appear here.'}
                />
              )}
            </div>

            {category === 'Division directives' && (
              <p className="resources-preview-source-date">
                Official PDF links checked {DIRECTIVE_PDF_INDEX_VERIFIED_ON}.
              </p>
            )}
          </div>
        </section>
      </div>

      {selected && (
        <>
          <div
            className="fls-overlay"
            aria-hidden="true"
            onClick={closeDrawer}
            data-testid="drawer-backdrop"
          />
          <aside
            className="fls-drawer resources-preview-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resources-preview-drawer-title"
            ref={drawerRef}
            data-testid="resource-detail-dialog"
          >
            <header className="fls-drawer-head">
              <div className="fls-drawer-top">
                <span>Resource details</span>
                <button className="fls-close" type="button" onClick={closeDrawer} aria-label="Close resource details" data-testid="button-close-resource-details">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <h2 id="resources-preview-drawer-title">{selected.title}</h2>
              <span className="fls-drawer-category">{selected.category}</span>
            </header>
            <div className="fls-drawer-body">
              <p className="resources-preview-detail-description">{selected.description}</p>
              <div className="fls-info">
                <div className="fls-info-row"><span>Collection</span><span>{selected.category}</span></div>
                {selected.fileType && <div className="fls-info-row"><span>File type</span><span>{selected.fileType}</span></div>}
                {selected.note && selected.category !== 'Reference Files' && <div className="fls-info-row"><span>Reference</span><span>{selected.note}</span></div>}
                {selected.handlingNote && <div className="resources-preview-handling">{selected.handlingNote}</div>}
              </div>

              {selected.category === 'Reference Files' && (
                <a
                  className="resources-preview-action"
                  href={apiEndpoint(`/v1/resources/${encodeURIComponent(selected.id.slice('file-'.length))}/download`)}
                  download
                  data-testid={`link-download-resource-${selected.id.slice('file-'.length)}`}
                >
                  <ArrowDownToLine size={16} aria-hidden="true" /> Download file
                </a>
              )}
              {selected.category === 'Division directives' && (
                <>
                  <a className="resources-preview-action" href={selected.url} target="_blank" rel="noopener noreferrer" data-testid={`link-open-directive-${selected.id.slice('directive-'.length)}`}>
                    <ExternalLink size={16} aria-hidden="true" /> Open official directive PDF
                  </a>
                  <a className="resources-preview-secondary-link" href={DIRECTIVE_PDF_INDEX_SOURCE} target="_blank" rel="noopener noreferrer" data-testid="link-official-directive-index">
                    Official directive index
                  </a>
                  <p className="resources-preview-verification">PDF links checked {DIRECTIVE_PDF_INDEX_VERIFIED_ON}.</p>
                </>
              )}
              {selected.category === 'Geography map' && (
                <a className="resources-preview-action" href="#resources-preview-map" onClick={closeDrawer} data-testid="link-view-embedded-map">
                  <MapPinned size={16} aria-hidden="true" /> View embedded map
                </a>
              )}
            </div>
          </aside>
        </>
      )}
    </section>
  );
}
