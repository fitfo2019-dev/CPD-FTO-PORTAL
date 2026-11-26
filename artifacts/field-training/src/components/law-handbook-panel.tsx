import { useState } from 'react';
import { ExternalLink, Scale } from 'lucide-react';
import './geography-map-panel.css';

const HANDBOOK_ROOT = `${import.meta.env.BASE_URL}law-handbook/index.html`;

const WORKBOOKS = {
  ohio: { label: 'Ohio Revised Code', src: HANDBOOK_ROOT },
  columbus: { label: 'Columbus City Code', src: `${HANDBOOK_ROOT}?workbook=columbus` },
} as const;

type Workbook = keyof typeof WORKBOOKS;

export function LawHandbookPanel() {
  const [workbook, setWorkbook] = useState<Workbook>('ohio');
  const active = WORKBOOKS[workbook];
  return (
    <section className="geography-map-panel law-handbook-panel" aria-labelledby="law-handbook-title" data-testid="section-law-handbook">
      <header className="geography-map-head">
        <div className="geography-map-title-wrap">
          <span className="geography-map-icon" aria-hidden="true"><Scale size={22} /></span>
          <div>
            <p className="geography-map-eyebrow">LAW REFERENCE</p>
            <h2 id="law-handbook-title" data-testid="text-law-handbook-title">Ohio and Columbus Law Handbook</h2>
            <div className="law-handbook-tabs" role="tablist" aria-label="Workbook">
              {(Object.keys(WORKBOOKS) as Workbook[]).map(key => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={workbook === key}
                  className={workbook === key ? 'is-active' : undefined}
                  onClick={() => setWorkbook(key)}
                  data-testid={`tab-law-handbook-${key}`}
                >
                  {WORKBOOKS[key].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <a className="geography-map-link" href={active.src} target="_blank" rel="noopener noreferrer" data-testid="link-open-law-handbook">
          <ExternalLink size={16} aria-hidden="true" /> Open Full Page
        </a>
      </header>
      <div className="geography-map-frame-wrap law-handbook-frame-wrap">
        <iframe
          key={workbook}
          src={active.src}
          title={`${active.label} search`}
          loading="lazy"
          data-testid="frame-law-handbook"
        />
      </div>
    </section>
  );
}
