import { ExternalLink, MapPinned, ShieldCheck } from "lucide-react";

const viewerUrl = "https://www.google.com/maps/d/u/0/viewer?mid=10NvwFmOwuUJTVQGQ2Jh1EIboXP0&ll=39.95032723201076%2C-82.92253150906822&z=11";
const embedUrl = "https://www.google.com/maps/d/embed?mid=10NvwFmOwuUJTVQGQ2Jh1EIboXP0&ll=39.95032723201076%2C-82.92253150906822&z=11";

export function ColumbusGeographyMap() {
  return (
    <main className="geo-preview">
      <style>{`
        .geo-preview {
          --geo-navy: #173b5e;
          --geo-blue: #1769a6;
          --geo-ink: #263747;
          --geo-muted: #5e6e7b;
          --geo-line: #d6dfe6;
          --geo-paper: #f1f4f6;
          --geo-surface: #fff;
          min-height: 100dvh;
          padding: clamp(20px, 4vw, 48px);
          background: var(--geo-paper);
          color: var(--geo-ink);
          font: 15px/1.5 Arial, Helvetica, sans-serif;
        }
        .geo-preview * { box-sizing: border-box; }
        .geo-card {
          width: min(100%, 1120px);
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid var(--geo-line);
          border-radius: 8px;
          background: var(--geo-surface);
          box-shadow: 0 8px 24px rgb(23 59 94 / 8%);
        }
        .geo-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px 18px;
          border-bottom: 1px solid var(--geo-line);
        }
        .geo-title-wrap { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
        .geo-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border-radius: 6px;
          background: #e8f1f8;
          color: var(--geo-blue);
        }
        .geo-eyebrow {
          margin: 0 0 4px;
          color: var(--geo-blue);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .geo-head h1 {
          margin: 0;
          color: var(--geo-navy);
          font-size: clamp(20px, 2.4vw, 27px);
          line-height: 1.25;
        }
        .geo-description { margin: 6px 0 0; color: var(--geo-muted); font-size: 14px; }
        .geo-link {
          display: inline-flex;
          min-height: 42px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 13px;
          border: 1px solid #9eb8cc;
          border-radius: 5px;
          background: #fff;
          color: var(--geo-navy);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }
        .geo-link:hover { background: #edf4f9; border-color: var(--geo-blue); }
        .geo-link:focus-visible { outline: 3px solid #1769a6; outline-offset: 3px; }
        .geo-map-wrap {
          position: relative;
          width: 100%;
          height: clamp(390px, 59vw, 640px);
          background: #e5ebef;
        }
        .geo-map {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .geo-foot {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 13px 20px;
          border-top: 1px solid var(--geo-line);
          background: #f8fafb;
          color: #536675;
          font-size: 12px;
        }
        .geo-foot svg { flex: 0 0 auto; margin-top: 2px; color: var(--geo-blue); }
        .geo-foot p { margin: 0; }
        @media (max-width: 640px) {
          .geo-preview { padding: 14px; }
          .geo-head { flex-direction: column; gap: 14px; padding: 17px 16px 15px; }
          .geo-title-wrap { gap: 11px; }
          .geo-icon { width: 37px; height: 37px; flex-basis: 37px; }
          .geo-description { font-size: 13px; }
          .geo-link { width: 100%; }
          .geo-map-wrap { height: min(64dvh, 540px); min-height: 370px; }
          .geo-foot { padding: 12px 14px; font-size: 11px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .geo-preview * { scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
      `}</style>
      <section className="geo-card" aria-labelledby="geo-map-title">
        <header className="geo-head">
          <div className="geo-title-wrap">
            <span className="geo-icon" aria-hidden="true"><MapPinned size={22} /></span>
            <div>
              <p className="geo-eyebrow">GEOGRAPHY REFERENCE</p>
              <h1 id="geo-map-title">Columbus Police Geography Map</h1>
              <p className="geo-description">Explore the supplied map in an interactive view.</p>
            </div>
          </div>
          <a
            className="geo-link"
            href={viewerUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="link-open-original-map"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Open Original Map
          </a>
        </header>
        <div className="geo-map-wrap">
          <iframe
            className="geo-map"
            src={embedUrl}
            title="Interactive Columbus Police Geography Map"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            data-testid="frame-columbus-geography-map"
          />
        </div>
        <footer className="geo-foot">
          <ShieldCheck size={15} aria-hidden="true" />
          <p>If the embedded map does not load, use “Open Original Map.” Confirm current geography and assignments through official agency sources.</p>
        </footer>
      </section>
    </main>
  );
}
