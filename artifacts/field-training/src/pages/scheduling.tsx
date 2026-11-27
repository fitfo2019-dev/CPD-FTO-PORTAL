import { lazy, Suspense } from 'react';
import SubstituteFtoPage from '@/pages/substitute-fto.js';

// Phase Sign-Up is preview-only until its server routes are integrated.
const PhaseSignUp = import.meta.env.DEV
  ? lazy(() => import('@/features/rebuild/pages.js').then(m => ({ default: m.RebuildPhaseSignUp })))
  : null;

export default function SchedulingPage() {
  return <div className="space-y-8" data-testid="page-scheduling">
    {PhaseSignUp && <Suspense fallback={null}><PhaseSignUp /></Suspense>}
    <SubstituteFtoPage />
  </div>;
}
