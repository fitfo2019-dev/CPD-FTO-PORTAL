import columbusLogoSvg from '@/assets/columbus-logo.svg?raw';
import { formTemplateRevision } from '@/lib/form-revisions.js';

// Inline fill attributes avoid leaking the logo's generic SVG style classes
// into the portal masthead when this hidden printable component is mounted.
const PRINT_CITY_LOGO = columbusLogoSvg
  .replace(/<style>[\s\S]*?<\/style>/, '')
  .replaceAll('class="st0"', 'fill="#142d4f"')
  .replaceAll('class="st1"', 'fill="#E10012"');

export function PrintableColumbusHeader({ formId }: { formId: string }) {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="print-columbus-lockup print-ref-lockup" role="img" aria-label="City of Columbus, Division of Police, Field Training Office">
      <span className="print-ref-rule" aria-hidden="true" />
      <span
        className="print-columbus-city-logo"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: PRINT_CITY_LOGO }}
      />
      <span className="print-ref-separator" aria-hidden="true" />
      <span className="print-columbus-center">
        <span className="print-columbus-titles">
          <b>DIVISION OF POLICE</b>
          <span>FIELD TRAINING OFFICE</span>
        </span>
      </span>
      <img className="print-ref-patch" src={`${base}branding/columbus-police-patch-white-eagle.png`} alt="" aria-hidden="true" />
      <span className="print-template-revision">Template revised {formTemplateRevision(formId)}</span>
    </div>
  );
}

export function PrintableColumbusFooterMarks() {
  const base = import.meta.env.BASE_URL;
  return (
    <>
      <img className="print-columbus-footer-badge" src={`${base}branding/silver-police-badge.png`} alt="" />
      <img className="print-columbus-footer-patch" src={`${base}branding/columbus-police-patch-white-eagle.png`} alt="" />
    </>
  );
}
