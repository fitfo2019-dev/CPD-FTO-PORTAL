import { useEffect, useState } from 'react';
import { photo, SIGN_IN_PHOTOS } from '@/lib/photos.js';

const JOURNEY = ['Academy', 'Phase I', 'Phase II', 'Phase III', 'Phase IV', 'Probationary Phase'];

/** Screen-only slideshow of Division photographs beside the sign-in card. */
export function SignInPhotos() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % SIGN_IN_PHOTOS.length), 6000);
    return () => window.clearInterval(timer);
  }, []);
  return <aside className="sign-in-photos" aria-label="Columbus Division of Police" data-testid="sign-in-photos">
    {SIGN_IN_PHOTOS.map((key, i) => {
      const p = photo(key);
      return <img key={key} src={p.src} alt={i === index ? p.alt : ''} aria-hidden={i !== index} className={i === index ? 'is-active' : undefined} style={{ objectPosition: p.position }} decoding="async" />;
    })}
    <div className="sign-in-photos-body">
      <div className="label-caps">Columbus Division of Police</div>
      <h1>Field Training Office</h1>
      <ol className="sign-in-journey">{JOURNEY.map(step => <li key={step}>{step}</li>)}</ol>
    </div>
  </aside>;
}
