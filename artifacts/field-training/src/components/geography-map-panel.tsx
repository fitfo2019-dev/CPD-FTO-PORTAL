import { ExternalLink, MapPinned, ShieldCheck } from 'lucide-react';
import './geography-map-panel.css';

export const COLUMBUS_MAP_VIEWER_URL = 'https://www.google.com/maps/d/u/0/viewer?mid=10NvwFmOwuUJTVQGQ2Jh1EIboXP0&ll=39.95032723201076%2C-82.92253150906822&z=11';
export const COLUMBUS_MAP_EMBED_URL = 'https://www.google.com/maps/d/embed?mid=10NvwFmOwuUJTVQGQ2Jh1EIboXP0&ll=39.95032723201076%2C-82.92253150906822&z=11';

export function GeographyMapPanel() {
  return (
    <section className="geography-map-panel" aria-labelledby="geography-map-title" data-testid="section-geography-map">
      <header className="geography-map-head">
        <div className="geography-map-title-wrap">
          <span className="geography-map-icon" aria-hidden="true"><MapPinned size={22} /></span>
          <div>
            <p className="geography-map-eyebrow">GEOGRAPHY REFERENCE</p>
            <h2 id="geography-map-title" data-testid="text-geography-map-title">Columbus Police Geography Map</h2>
            <p className="geography-map-description">Explore the supplied map in an interactive view.</p>
          </div>
        </div>
        <a className="geography-map-link" href={COLUMBUS_MAP_VIEWER_URL} target="_blank" rel="noopener noreferrer" data-testid="link-open-original-map">
          <ExternalLink size={16} aria-hidden="true" /> Open Original Map
        </a>
      </header>
      <div className="geography-map-frame-wrap">
        <iframe
          src={COLUMBUS_MAP_EMBED_URL}
          title="Interactive Columbus Police Geography Map"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          data-testid="frame-columbus-geography-map"
        />
      </div>
      <footer className="geography-map-foot">
        <ShieldCheck size={15} aria-hidden="true" />
        <p>If the embedded map does not load, use “Open Original Map.” Confirm current geography and assignments through official agency sources.</p>
      </footer>
    </section>
  );
}
