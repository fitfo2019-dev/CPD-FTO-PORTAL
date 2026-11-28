import { useClickToEngage } from '@/hooks/use-click-to-engage.js';
import { ExternalLink, Hand, MapPinned } from 'lucide-react';
import './geography-map-panel.css';

export const COLUMBUS_MAP_VIEWER_URL = 'https://www.google.com/maps/d/u/0/viewer?mid=10NvwFmOwuUJTVQGQ2Jh1EIboXP0&ll=39.95032723201076%2C-82.92253150906822&z=11';
export const COLUMBUS_MAP_EMBED_URL = 'https://www.google.com/maps/d/embed?mid=10NvwFmOwuUJTVQGQ2Jh1EIboXP0&ll=39.95032723201076%2C-82.92253150906822&z=11';

export function GeographyMapPanel() {
  // The map takes scroll and drag only after a click, so the page scrolls past it (owner, Nov 28, 2026).
  const { ref, engaged: active, engage, release } = useClickToEngage<HTMLDivElement>();
  return (
    <section className="geography-map-panel" aria-labelledby="geography-map-title" data-testid="section-geography-map">
      <header className="geography-map-head">
        <div className="geography-map-title-wrap">
          <span className="geography-map-icon" aria-hidden="true"><MapPinned size={22} /></span>
          <div>
            <p className="geography-map-eyebrow">GEOGRAPHY REFERENCE</p>
            <h2 id="geography-map-title" data-testid="text-geography-map-title">Columbus Police Geography Map</h2>
            <p className="geography-map-description" data-testid="text-map-click-note">Click the map to move it.</p>
          </div>
        </div>
        <a className="geography-map-link" href={COLUMBUS_MAP_VIEWER_URL} target="_blank" rel="noopener noreferrer" data-testid="link-open-original-map">
          <ExternalLink size={16} aria-hidden="true" /> Open Original Map
        </a>
      </header>
      <div ref={ref} className={`geography-map-frame-wrap${active ? ' is-active' : ''}`} onMouseLeave={release}>
        <iframe
          src={COLUMBUS_MAP_EMBED_URL}
          title="Interactive Columbus Police Geography Map"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          data-testid="frame-columbus-geography-map"
        />
        {!active && (
          <button type="button" className="geography-map-shield" onClick={engage} data-testid="button-activate-map">
            <span><Hand size={16} aria-hidden="true" /> Click to move the map</span>
          </button>
        )}
      </div>
    </section>
  );
}
