import { ArrowUpRight, BookOpen, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';
import { ApplicationHelpDesk } from '@/components/application-help-desk.js';
import { PageHead } from '@/components/bits.js';
import { DIRECTIVE_PDF_INDEX_SOURCE } from '@/lib/directive-pdf-index.js';
import { useWorkspace } from '@/state/workspace.js';
import ResourcesLibraryPage from '@/pages/resources-library-preview.js';

export default function HelpPage() {
  const { ws } = useWorkspace();

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHead kicker="Field Training Officer Portal · Columbus" title="Help Desk">
        <a
          href={DIRECTIVE_PDF_INDEX_SOURCE}
          target="_blank"
          rel="noreferrer"
          className="library-source-button"
          data-testid="link-official-directives"
        >
          <ExternalLink aria-hidden="true" size={16} /> Official directives
        </a>
      </PageHead>

      <ApplicationHelpDesk role={ws.role} />
      <ResourcesLibraryPage />

      {ws.role !== 'fto_coc' && (
        <nav className="library-related-links" aria-label="Related portal pages">
          <Link href="/phase-setup" data-testid="link-help-phase-setup"><BookOpen size={16} /> Phase setup</Link>
          <Link href="/reports" data-testid="link-help-records">Saved daily records <ArrowUpRight size={15} /></Link>
        </nav>
      )}
    </div>
  );
}
