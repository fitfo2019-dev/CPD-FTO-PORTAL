import { PageHead, Panel } from '@/components/bits.js';

export default function CommandReviewPage() {
  return <div className="mx-auto max-w-4xl">
    <PageHead kicker="FTO COC · command review" title="Submitted packets"/>
    <Panel title="Your review queue">
      <p className="p-4 text-sm text-muted-foreground" role="status" data-testid="status-command-access-disabled">None</p>
    </Panel>
  </div>;
}
