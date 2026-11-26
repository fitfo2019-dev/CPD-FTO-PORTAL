import { useEffect, useState } from 'react';
import { photo, SIGN_IN_PHOTOS } from '@/lib/photos.js';

const JOURNEY = ['Academy', 'Phase I', 'Phase II', 'Phase III', 'Phase IV', 'Probationary Phase'];
const BASE = import.meta.env.BASE_URL;

/** Screen-only sign-in header matching the approved companion-site home: rotating Division
 * photographs behind the badge, patch, City of Columbus wordmark, title and program journey. */
export function SignInPhotos() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % SIGN_IN_PHOTOS.length), 6000);
    return () => window.clearInterval(timer);
  }, []);
  return <header className="sign-in-photos" aria-label="Columbus Division of Police" data-testid="sign-in-photos">
    {SIGN_IN_PHOTOS.map((key, i) => {
      const p = photo(key);
      return <img key={key} src={p.src} alt={i === index ? p.alt : ''} aria-hidden={i !== index} className={i === index ? 'is-active' : undefined} style={{ objectPosition: p.position }} decoding="async" />;
    })}
    <div className="sign-in-photos-body">
      <div className="sign-in-insignia">
        <span className="sign-in-badge">
          <img src={`${BASE}branding/silver-police-badge.png`} alt="Columbus Division of Police badge" />
          <span className="portal-badge-easter-egg portal-badge-easter-egg-left" aria-hidden="true">27</span>
          <span className="portal-badge-easter-egg portal-badge-easter-egg-right" aria-hidden="true">37</span>
        </span>
        <span className="sign-in-insignia-rule" aria-hidden="true" />
        <img className="sign-in-patch" src={`${BASE}branding/columbus-police-patch.png`} alt="Columbus Division of Police patch" />
      </div>
      <div className="sign-in-wordmark"><img src={`${BASE}branding/city-of-columbus-wordmark.png`} alt="The City of Columbus" /></div>
      <div>
        <div className="label-caps">Columbus Division of Police</div>
        <h1>Field Training Portal</h1>
      </div>
      <ol className="sign-in-journey">{JOURNEY.map(step => <li key={step}>{step}</li>)}</ol>
    </div>
  </header>;
}
