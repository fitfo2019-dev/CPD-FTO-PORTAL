import { FileDown } from 'lucide-react';
import columbusLogoSvg from '@/assets/columbus-logo.svg?raw';
import { roleManualHtml } from '@/lib/role-manual.js';
import { localISODate, formatDateDMY } from '@/lib/training-calendar.js';
import type { Role } from '@/lib/model.js';

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
    document.querySelectorAll('iframe[data-manual-print]').forEach(old => old.remove());
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.dataset.manualPrint = 'true';
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.srcdoc = html;
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) { frame.remove(); return; }
      const images = [...win.document.images];
      Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(done => { img.onload = img.onerror = () => done(undefined); })))
        .then(() => {
          win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0), { once: true });
          win.focus();
          win.print();
        });
    };
    document.body.appendChild(frame);
  };
  return <button type="button" onClick={open} className="library-source-button" data-testid="button-download-manual-pdf">
    <FileDown aria-hidden="true" size={16} /> Download Manual PDF
  </button>;
}
