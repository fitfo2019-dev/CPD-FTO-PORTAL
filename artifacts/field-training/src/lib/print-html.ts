/** Prints a complete HTML document from a hidden frame once its images load; the print window saves it as PDF. */
export function printHtmlDocument(html: string, marker: string) {
  document.querySelectorAll(`iframe[data-print-document="${marker}"]`).forEach(old => old.remove());
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.dataset.printDocument = marker;
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
}
