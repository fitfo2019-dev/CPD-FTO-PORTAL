import { FileDown } from 'lucide-react';
import columbusLogoSvg from '@/assets/columbus-logo.svg?raw';
import { roleManualHtml } from '@/lib/role-manual.js';
import { localISODate, formatDateDMY } from '@/lib/training-calendar.js';
import type { Role } from '@/lib/model.js';
import { printHtmlDocument } from '@/lib/print-html.js';

const WORDMARK = columbusLogoSvg
  .replace(/<style>[\s\S]*?<\/style>/, '')
  .replaceAll('class="st0"', 'fill="#142d4f"')
  .replaceAll('class="st1"', 'fill="#E10012"');

/** Prints this role's Help Desk content as a branded US Letter manual; the print dialog saves it as PDF. */
export function DownloadManualButton({ role }: { role: Role }) {
  const open = () => {
    const base = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const html = roleManualHtml(role, formatDateDMY(localISODate()), {
      wordmarkSvg: WORDMARK,
      patchUrl: `${base}branding/columbus-police-patch-white-eagle.png`,
      badgeUrl: `${base}branding/silver-police-badge.png`,
    });
    printHtmlDocument(html, 'manual');
  };
  return <button type="button" onClick={open} className="library-source-button" data-testid="button-download-manual-pdf">
    <FileDown aria-hidden="true" size={16} /> Download Manual PDF
  </button>;
}
