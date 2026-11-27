import { lazy, Suspense } from 'react';
import { PageHead } from '@/components/bits';
import { usePacketReview } from '@/state/packet-review.js';
import PacketSubmissions from '@/pages/packet-submissions.js';
import RoleAccessPage from '@/pages/role-access.js';

// Contact cards read the sample roster, so they render only in preview builds until the server roster is live.
const PoContacts = import.meta.env.DEV
  ? lazy(() => import('@/features/rebuild/pages.js').then(m => ({ default: m.RebuildPoContacts })))
  : null;

export default function PoTrainingPage() {
  const { context, loading, previewOnly } = usePacketReview();
  // Account Access stays in front of the PO until the server opens a PO record for this account.
  if (!previewOnly && !loading && (!context?.available || context.role !== 'PO')) return <RoleAccessPage />;
  return <div className="space-y-4" data-testid="page-po-training">
    <PageHead kicker="Probationary Officer" title="My Training" />
    {PoContacts && <Suspense fallback={null}><PoContacts /></Suspense>}
    <PacketSubmissions embedded />
  </div>;
}
