import { ApplicationHelpDesk } from '@/components/application-help-desk.js';
import { PageHead } from '@/components/bits.js';
import { useWorkspace } from '@/state/workspace.js';
import { DownloadManualButton } from '@/components/download-manual-button.js';

// Technical roles get application-use help only; training Resources stay with training roles.
export default function AppHelpPage() {
  const { ws } = useWorkspace();
  return <div className="mx-auto max-w-[1440px]" data-testid="page-app-help">
    <PageHead kicker="Field Training Officer Portal · Columbus" title="Help Desk">
      <DownloadManualButton role={ws.role} />
    </PageHead>
    <ApplicationHelpDesk role={ws.role} />
  </div>;
}
