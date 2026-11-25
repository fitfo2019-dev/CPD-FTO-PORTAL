import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ExternalLink, FileCheck2, Files, LibraryBig, MapPinned, ShieldCheck, X,
} from 'lucide-react';
import {
  apiEndpoint,
  useListResources,
  type ResourceCatalogItem,
} from '@workspace/api-client-react';
import {
  EmptyState,
  LibraryNavigation,
  ResourceCard,
  SearchControls,
  type LibraryResource,
} from '@workspace/fto-law-library-schema/components/library';
import { GeographyMapPanel } from '@/components/geography-map-panel.js';
import {
  DIRECTIVE_PDF_INDEX_SOURCE,
  DIRECTIVE_PDF_INDEX_VERIFIED_ON,
  DIRECTIVE_PDF_LINKS,
} from '@/lib/directive-pdf-index.js';
import '@workspace/fto-law-library-schema/library.css';
import './resources-library-preview.css';

type ResourceCategory = 'All resources' | 'Uploaded files' | 'Division directives' | 'Geography map';
type CatalogRecord = LibraryResource & {
  id: string;
  category: Exclude<ResourceCategory, 'All resources'>;
  description: string;
  searchText: string;
  fileType?: string;
  handlingNote?: string;
  url?: string;
};

const CATEGORIES: ResourceCategory[] = [
  'All resources',
  'Uploaded files',
  'Division directives',
  'Geography map',
];

function uploadedRecord(item: ResourceCatalogItem): CatalogRecord {
  return {
    id: `upload-${item.id}`,
    title: item.title,
    group: 'Uploaded files',
    category: 'Uploaded files',
    note: item.file_type,
    description: item.description,
    handlingNote: item.handling_note,
    fileType: item.file_type,
    searchText: `${item.title} Uploaded files ${item.file_type} ${item.description} ${item.handling_note}`,
  };
}

const DIRECTIVE_RECORDS: CatalogRecord[] = DIRECTIVE_PDF_LINKS.map((directive) => ({
  id: `directive-${directive.number}`,
  title: directive.title,
  group: 'Division directives',
  category: 'Division directives',
  note: `Directive ${directive.number}`,
  description: `Official Columbus Division of Police directive PDF, number ${directive.number}.`,
  searchText: `${directive.number} ${directive.title} Division directives`,
  url: directive.url,
}));

const MAP_RECORD: CatalogRecord = {
  id: 'columbus-geography-map',
  title: 'Columbus Police Geography Map',
  group: 'Geography map',
  category: 'Geography map',
  note: 'Interactive map',
  description: 'Explore the supplied Columbus Police geography map in the embedded viewer.',
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

  const uploadedResources = useMemo(
    () => Array.isArray(resourceResponse?.data)
      ? resourceResponse.data.filter(isResourceCatalogItem).map(uploadedRecord)
      : [],
    [resourceResponse],
  );
  const records = useMemo(
    () => [...uploadedResources, ...DIRECTIVE_RECORDS, MAP_RECORD],
    [uploadedResources],
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

  const counts: Record<ResourceCategory, string | number> = {
    'All resources': isLoading || isError
      ? '—'
      : uploadedResources.length + DIRECTIVE_RECORDS.length + 1,
    'Uploaded files': isLoading ? 'Loading' : isError ? 'Unavailable' : uploadedResources.length,
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
      : name === 'Uploaded files'
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
          <h1 id="resources-library-title">Resources library</h1>
          <p className="resources-preview-lede">
            A focused catalog of signed-in uploaded files, official division directive PDFs, and the geography map.
          </p>
        </div>
        <p className="resources-preview-scope">Catalog results include only the sources listed here.</p>
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
            placeholder="Search uploaded files, directives, or map"
            ariaLabel="Search uploaded files, directives, or map"
          />

          <div className="resources-preview-results">
            <div className="resources-preview-results-head">
              <div>
                <h2>{category}</h2>
                <p aria-live="polite" data-testid="text-result-count">
                  {isLoading && (category === 'All resources' || category === 'Uploaded files')
                    ? 'Loading uploaded files'
                    : isError && category === 'Uploaded files'
                      ? 'Uploaded files unavailable'
                      : `${visibleRecords.length} ${visibleRecords.length === 1 ? 'resource' : 'resources'} shown`}
                </p>
              </div>
              {sorted && <span className="resources-preview-sort-label">Alphabetical order</span>}
            </div>

            {isLoading && (category === 'All resources' || category === 'Uploaded files') && (
              <div className="resources-preview-loading" aria-busy="true" aria-label="Loading uploaded resources">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="resources-preview-skeleton" key={index} />
                ))}
              </div>
            )}

            {isError && (category === 'All resources' || category === 'Uploaded files') && (
              <div className="resources-preview-error" role="alert" data-testid="error-uploaded-resources">
                <div>
                  <strong>Uploaded files could not be loaded.</strong>
                  <p>Files use your current portal sign-in. Try again; if your session has ended, return to sign in.</p>
                </div>
                <button type="button" onClick={() => { void refetch(); }} data-testid="button-retry-resources">
                  Try again
                </button>
              </div>
            )}

            <div className="fls-grid resources-preview-grid">
              {visibleRecords.map((record) => (
                <ResourceCard
                  key={record.id}
                  resource={record}
                  onSelect={selectResource}
                />
              ))}
              {!isLoading && !(isError && category === 'Uploaded files') && visibleRecords.length === 0 && (
                <EmptyState
                  title={normalizedQuery ? 'No matching resources' : 'No resources in this category'}
                  description={normalizedQuery
                    ? 'Try a different search or choose another collection.'
                    : 'Uploaded files available to your signed-in account will appear here.'}
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

      <div className="resources-preview-map" id="resources-preview-map" tabIndex={-1} data-testid="section-map-embed">
        <GeographyMapPanel />
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
                {selected.note && selected.category !== 'Uploaded files' && <div className="fls-info-row"><span>Reference</span><span>{selected.note}</span></div>}
                {selected.handlingNote && <div className="resources-preview-handling">{selected.handlingNote}</div>}
              </div>

              {selected.category === 'Uploaded files' && (
                <a
                  className="resources-preview-action"
                  href={apiEndpoint(`/v1/resources/${encodeURIComponent(selected.id.slice('upload-'.length))}/download`)}
                  download
                  data-testid={`link-download-resource-${selected.id.slice('upload-'.length)}`}
                >
                  <ArrowDownToLine size={16} aria-hidden="true" /> Download uploaded file
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
