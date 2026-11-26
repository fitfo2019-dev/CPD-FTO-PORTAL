import React, { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { tokens } from '@workspace/fto-law-library-schema/tokens';
import { PRIMARY_RUN_FORMS, phaseAssignmentLabel, phaseLabel, shiftCodeLabel, type Report } from '@/lib/model.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import { searchSavedTrainingRunsByIncidentNumber } from '@/lib/training-run-search.js';
import './saved-incident-search.css';

const colors = tokens.color.light;
const searchTheme = {
  '--incident-search-primary': colors.primary,
  '--incident-search-primary-foreground': colors.primaryForeground,
  '--incident-search-secondary': colors.secondary,
  '--incident-search-secondary-foreground': colors.secondaryForeground,
  '--incident-search-accent': colors.accent,
  '--incident-search-accent-foreground': colors.accentForeground,
  '--incident-search-background': colors.background,
  '--incident-search-foreground': colors.foreground,
  '--incident-search-card': colors.card,
  '--incident-search-card-foreground': colors.cardForeground,
  '--incident-search-muted': colors.muted,
  '--incident-search-muted-foreground': colors.mutedForeground,
  '--incident-search-border': colors.border,
  '--incident-search-input': colors.input,
  '--incident-search-ring': colors.ring,
  '--incident-search-radius': tokens.radius,
  '--incident-search-space': tokens.spacing,
  '--incident-search-heading-font': tokens.fontFamily.heading.join(', '),
  '--incident-search-body-font': tokens.fontFamily.sans.join(', '),
  '--incident-search-mono-font': tokens.fontFamily.mono.join(', '),
} as CSSProperties;

export function SavedIncidentSearch({ reports }: { reports: readonly Report[] }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(
    () => searchSavedTrainingRunsByIncidentNumber(reports, query),
    [reports, query],
  );
  const searching = !!query.trim();

  return (
    <section
      className="fls-scope saved-incident-search"
      style={searchTheme}
      aria-labelledby="saved-incident-search-title"
      data-testid="section-saved-incident-search"
    >
      <header className="incident-search-heading">
        <div>
          <h2 id="saved-incident-search-title">Find a run by incident number</h2>
          <p>Search saved runs across your shift reports.</p>
        </div>
        {searching && (
          <span className="incident-search-count" data-testid="status-incident-search-count" aria-live="polite">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        )}
      </header>

      <label className="incident-search-label" htmlFor="input-search-incidents-across-reports">
        Incident number
      </label>
      <div className="incident-search-controls">
        <div className="incident-search-input-wrap">
          <Search aria-hidden="true" className="incident-search-icon" />
          <input
            id="input-search-incidents-across-reports"
            data-testid="input-search-incidents-across-reports"
            type="search"
            inputMode="numeric"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Enter an incident number"
            aria-label="Search saved runs by incident number"
          />
        </div>
        {searching && (
          <button
            type="button"
            className="incident-search-clear"
            onClick={() => setQuery('')}
            data-testid="button-clear-incident-search"
          >
            <X aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {searching && (matches.length > 0 ? (
        <ul className="incident-search-results" data-testid="list-incident-search-results" aria-live="polite">
          {matches.map(({ report, run }) => {
            const form = PRIMARY_RUN_FORMS.find(item => item.key === run.runKind);
            return (
              <li key={`${report.id}:${run.id}`} data-testid={`row-incident-result-${report.id}-${run.id}`}>
                <div className="incident-result-details">
                  <div className="incident-result-title">
                    <span className="incident-result-number">{run.incidentNumber}</span>
                    {form && <span className="incident-result-form">{form.label}</span>}
                  </div>
                  <p className="incident-result-report">
                    Daily log · {formatDateDMY(report.date)} · {shiftCodeLabel(report.shift)} · {phaseLabel(report.phase)}
                  </p>
                  <p className="incident-result-assignment">
                    PO {report.recruitName} #{report.recruitBadge}
                    <span aria-hidden="true"> · </span>
                    {phaseAssignmentLabel(report.ftoAssignment, report.shift, report.cruiserDistrict)}
                  </p>
                </div>
                <Link
                  href={`/reports/${report.id}#run-${run.id}`}
                  className="incident-result-link"
                  data-testid={`link-incident-result-${report.id}-${run.id}`}
                  aria-label={`Open ${form?.label ?? 'training run'} in the shift report dated ${formatDateDMY(report.date)}`}
                >
                  Open run
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="incident-search-empty" data-testid="text-no-incident-results" role="status">
          <Search aria-hidden="true" />
          <div>
            <h3>No matching incidents</h3>
            <p>Try another incident number to search your saved shift reports.</p>
          </div>
        </div>
      ))}
    </section>
  );
}
