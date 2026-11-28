"""Print each actual React fixture through Chromium, then make review PDFs/images."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import html
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import base64
import zipfile
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "generated-artifacts/run-form-proofs"
manifest = json.loads((OUT / "manifest.json").read_text())


def render(proof):
    slug = proof["slug"]
    pdf = OUT / f"{slug}.pdf"
    for old_image in OUT.glob(f"{slug}-[0-9]*.png"):
        old_image.unlink()
    with tempfile.TemporaryDirectory(prefix="form-proof-") as profile:
        subprocess.run([
            "chromium", "--headless", "--no-sandbox", "--disable-dev-shm-usage",
            "--disable-gpu", "--disable-extensions", "--no-first-run",
            "--no-default-browser-check", f"--user-data-dir={profile}",
            "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=1500", f"--print-to-pdf={pdf}",
            (OUT / f"{slug}.html").as_uri(),
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    info = subprocess.check_output(["pdfinfo", str(pdf)], text=True)
    pages = int(next(line.split(":")[1].strip() for line in info.splitlines() if line.startswith("Pages:")))
    if "continuation" not in slug and pages != 1:
        raise AssertionError(f"The base form {slug} must remain one sheet, got {pages}")
    subprocess.run(["pdftoppm", "-scale-to", "1250", "-png", str(pdf), str(OUT / slug)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    bbox = subprocess.check_output(["pdftotext", "-bbox", str(pdf), "-"], text=True)
    doc = ET.fromstring(bbox)
    ns = {"p": "http://www.w3.org/1999/xhtml"}
    bounds = []
    for page in doc.findall(".//p:page", ns):
        words = page.findall(".//p:word", ns)
        # Our CSS page counter is deliberately in the bottom page margin;
        # browser-generated URL/date headers and footers are disabled.
        words = [word for word in words if not (
            float(word.attrib["yMin"]) >= float(page.attrib["height"])-25
            and (word.text in ("Page","of") or (word.text or "").isdigit())
        )]
        bounds.append({
            "width": float(page.attrib["width"]),
            "height": float(page.attrib["height"]),
            "words": len(words),
            "top": min((float(w.attrib["yMin"]) for w in words), default=0),
            "bottom": max((float(w.attrib["yMax"]) for w in words), default=0),
            "left": min((float(w.attrib["xMin"]) for w in words), default=0),
            "right": max((float(w.attrib["xMax"]) for w in words), default=0),
        })
    raw = subprocess.check_output(["pdftotext", "-raw", str(pdf), "-"], text=True)
    normalize = lambda value: re.sub(r"[\W_]+", "", value).casefold()
    raw_normalized = normalize(raw)
    source = (OUT / f"{slug}.html").read_text()
    for field in re.findall(r'<span\b[^>]*data-print-field="[^"]+"[^>]*>(.*?)</span>',source,flags=re.S):
        value=html.unescape(re.sub(r"<[^>]*>","",field))
        if normalize(value) and normalize(value) not in raw_normalized:
            raise AssertionError(f"Missing saved field in {slug}: {value}")
    if slug=="actual-run-header-verification" and "actualrun" not in raw_normalized:
        raise AssertionError("The unchecked Training Only option must print Actual Run")
    if slug=="weekly-log-continuation-verification":
        for number in range(1,19):
            if normalize(f"WEEKLY-NOTE-{number:02d}") not in raw_normalized:
                raise AssertionError(f"Weekly log lost saved note {number}")
        if pages!=len(re.findall(r'class="print-document\s',source)):
            raise AssertionError("Weekly log added an unexpected blank or overflow sheet")
    items = re.findall(r"<li\b[^>]*>(.*?)</li>", source, flags=re.S)
    for item in items:
        label = html.unescape(re.sub(r"<[^>]*>", "", item))
        if normalize(label) not in raw_normalized:
            raise AssertionError(f"Missing checklist text in {slug}: {label}")
    if slug == "long-continuation-verification":
        for number in range(1, 76):
            marker = f"CONTINUATION-MARKER-{number:03d}"
            if normalize(marker) not in raw_normalized:
                raise AssertionError(f"Missing long-narrative paragraph: {marker}")
    for bound in bounds:
        landscape = slug in ("daily-performance-log","weekly-performance-summary","monthly-performance-summary")
        if (bound["width"],bound["height"]) != ((792,612) if landscape else (612,792)):
            raise AssertionError(f"Wrong paper size/orientation in {slug}: {bound}")
        if bound["words"] < 10:
            raise AssertionError(f"Unexpected empty sheet in {slug}")
        if bound["left"] < 29.3 or bound["right"] > bound["width"] - 29.3 or bound["top"] < 24.3 or bound["bottom"] > bound["height"] - 24.3:
            raise AssertionError(f"Text outside shared page margins in {slug}: {bound}")
    if slug == "weekly-acknowledgement":
        for required in ["FICTIONAL SIGNATURE SAMPLE", "FICTIONAL RECRUIT COMMENT", "FICTIONAL FTO COMMENT", "certificate-based Digital ID"]:
            if normalize(required) not in raw_normalized:
                raise AssertionError(f"Missing signature/comment/notice in acknowledgement: {required}")
    if slug == "acknowledgement-continuation-verification":
        first = normalize(subprocess.check_output(["pdftotext","-f","1","-l","1","-raw",str(pdf),"-"],text=True))
        for required in ["FICTIONAL RECRUIT SIGNATURE","FICTIONAL FTO SIGNATURE","FICTIONAL OFFICE SIGNATURE","certificate-based Digital ID"]:
            if normalize(required) not in first:
                raise AssertionError(f"Acknowledgement signature/notice left the base sheet: {required}")
        for number in range(1,13):
            marker=normalize(f"CONTINUATION SAMPLE {number}: Fictional training notes")
            if raw_normalized.count(marker)!=3:
                raise AssertionError(f"Long acknowledgement lost a saved comment paragraph: {number}")
        if pages != len(re.findall(r'class="print-document\s',source)):
            raise AssertionError("Acknowledgement generated an unexpected extra or blank sheet")
    # Leaf data cells include the real record's field values, statistics, and
    # ratings. Check text preservation independently of checklist-only checks.
    data_tables = re.findall(r"<table\b(?![^>]*\bprint-page-frame\b)[^>]*>(.*?)</table>",source,flags=re.S)
    cells = [cell for table in data_tables for cell in re.findall(r"<(?:td|th)\b[^>]*>(.*?)</(?:td|th)>",table,flags=re.S)]
    for cell in cells:
        label=html.unescape(re.sub(r"<[^>]*>","",cell))
        if normalize(label) and normalize(label) not in raw_normalized:
            raise AssertionError(f"Missing table cell in {slug}: {label}")
    print(f"{slug}: {pages} sheet(s)", flush=True)
    return {**proof, "pages": pages, "bounds": bounds, "preservedChecklistItems": len(items)}


if "--package-only" in sys.argv:
    result = json.loads((OUT / "verification.json").read_text())
elif "--only" in sys.argv:
    slug = sys.argv[sys.argv.index("--only")+1]
    proof = next(proof for proof in manifest if proof["slug"] == slug)
    previous = json.loads((OUT / "verification.json").read_text())
    updated = render(proof)
    result = [updated if item["slug"] == slug else item for item in previous]
    if not any(item["slug"]==slug for item in previous):
        result.append(updated)
    (OUT / "verification.json").write_text(json.dumps(result, indent=2))
else:
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [(proof, pool.submit(render, proof)) for proof in manifest]
        result, errors = [], []
        for proof, future in futures:
            try:
                result.append(future.result())
            except Exception as error:
                errors.append({"slug": proof["slug"], "error": str(error)})
    if errors:
        (OUT / "verification-errors.json").write_text(json.dumps(errors, indent=2))
        raise AssertionError(json.dumps(errors, indent=2))
    (OUT / "verification.json").write_text(json.dumps(result, indent=2))
review = [proof for proof in manifest if proof["kind"] != "verification"]
subprocess.run(["pdfunite", *[str(OUT / f'{p["slug"]}.pdf') for p in review],
                str(OUT / "All-FTO-Form-Previews.pdf")], check=True)
print(f"Combined {len(review)} form designs; long narratives and missing optional fields verified separately.")

cards = []
with zipfile.ZipFile(OUT / "Individual-FTO-Form-Previews.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for index, proof in enumerate(review, 1):
        slug = proof["slug"]
        category = "Supplement" if "supplement" in slug else (
            "Primary run form" if "print-run-proof" in slug else "Packet form"
        )
        category = {"summary":"Summary","log":"Performance log","acknowledgement":"Acknowledgement"}.get(proof["kind"],category)
        if "continuation" in slug:
            category = "Narrative continuation"
        title = html.escape(proof["title"])
        proof_result = next(entry for entry in result if entry["slug"] == slug)
        for page_number in range(1, proof_result["pages"] + 1):
          image = base64.b64encode((OUT / f"{slug}-{page_number}.png").read_bytes()).decode()
          cards.append(f"""
          <article id="form-{index}-page-{page_number}">
            <div class="label"><span>{index:02d} · {html.escape(category)} · Sheet {page_number} of {proof_result["pages"]}</span><h2>{title}</h2></div>
            <button class="sheet" aria-label="Enlarge {title}" onclick="enlarge(this)">
              <img alt="{title}, sheet {page_number}" src="data:image/png;base64,{image}">
            </button>
          </article>""")
        safe_name = re.sub(r"[^A-Za-z0-9]+", "-", proof["title"]).strip("-")
        suffix = "-Supplement" if category == "Supplement" else ""
        archive.write(OUT / f"{slug}.pdf", f"{index:02d}-{safe_name}{suffix}.pdf")
gallery = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Columbus FTO form design proofs</title><style>
*{box-sizing:border-box}body{margin:0;background:#e9eef4;color:#1b2f4e;font:16px Arial,sans-serif}
header{background:#1b2f4e;color:white;border-top:4px solid #c9a24a;padding:28px max(24px,calc((100vw - 1500px)/2))}
header p{line-height:1.6;max-width:850px;color:#e3eaf2}h1{margin:0;font-size:28px}
main{max-width:1500px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;padding:28px}
article{min-width:0;scroll-margin-top:20px}.label{padding:0 0 12px}.label span{font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:#526278}h2{margin:5px 0 0;font-size:19px}
.sheet{width:100%;display:block;border:1px solid #bcc6d1;background:white;padding:0;cursor:zoom-in;box-shadow:0 4px 15px #142d4f18}.sheet img{display:block;width:100%;height:auto}
dialog{border:0;padding:12px;background:#e9eef4;max-width:96vw;max-height:96vh}dialog::backdrop{background:#11253dd9}dialog img{display:block;max-width:90vw;width:850px;height:auto}dialog button{position:sticky;top:0;display:block;margin-left:auto;background:#1b2f4e;color:white;padding:10px 20px;border:0;font-weight:bold;cursor:pointer}
@media(max-width:760px){main{grid-template-columns:1fr;padding:18px;gap:24px}h1{font-size:24px}}
</style></head><body><header><h1>Columbus FTO form design proofs</h1>
<p>Actual exported PDF sheets for the related FTO forms, using fictional data. Every base form fits on one sheet. Category cards are equal-sized within each checklist. Only narrative attachments continue onto additional sheets, with the same masthead and footer. The Daily Performance Summary retains its original landscape arrangement; weekly and monthly summary PDFs remain landscape. The separately supplied phase Excel workbook has one tab per Sunday–Saturday week of the selected phase, including any approved extension weeks, and is set to US Letter landscape, one printed page per tab. Unselected optional items and unnecessary additional forms are omitted. Click any page to enlarge it. These are local design proofs, not agency-approved or electronically signed records.</p>
<details><summary>Updated forms and implementation files</summary>
<p>Includes orientation, reporting for duty, all seven primary run forms, arrest/OVI/building-search supplements, narrative and orientation continuations, Daily Performance Summaries and their continuations, weekly performance logs, weekly and monthly summaries, and weekly acknowledgements.</p>
<p>Shared source: <code>src/print-reference.css</code>, <code>src/components/print-template.tsx</code>, <code>src/components/printable-columbus-header.tsx</code>, <code>src/components/print-activity-totals.tsx</code>, <code>src/lib/form-revisions.ts</code>, and <code>src/lib/print-rating-layout.ts</code>.</p>
<p>Phase Excel: <code>src/lib/monthly-export.ts</code> and its targeted tests. Landscape and one-page fitting are written into the saved workbook, with the original worksheet values, merged cells, columns, and styling retained.</p>
<p>Form components: <code>printable-daily-forms.tsx</code>, <code>printable-daily-log.tsx</code>, <code>printable-extended-forms.tsx</code>, <code>printable-weekly-ack.tsx</code>, <code>printable-weekly-summary.tsx</code>, and <code>printable-monthly-summary.tsx</code>, under <code>artifacts/field-training/src/components/</code>.</p>
<p>Revised Word checklist content is shared by the portal editor and printed run forms. Legacy saved task keys remain unchanged. Original agency revision dates remain visible; template revisions are tracked separately. Verification also covers a long narrative and missing optional fields.</p>
<p>Optional-item popup: <code>src/components/run-options-dialog.tsx</code>, integrated in <code>src/pages/report-editor.tsx</code>, with a fictional, memory-only preview in <code>src/pages/run-checklist-preview.tsx</code>. Required-form locks, edited-form detachment confirmation, read-only viewing, and manual statistics boundaries are retained.</p>
<p>For browser print/PDF export, use 100% scale, the form's selected paper orientation, and turn off the browser's URL/date headers and footers. The PDFs shown here were exported with browser headers and footers disabled.</p>
</details></header><main>"""
gallery += "".join(cards)
gallery += """</main><dialog id="zoom"><button onclick="document.getElementById('zoom').close()">Close preview</button><img id="zoom-image" alt=""></dialog>
<script>function enlarge(button){const source=button.querySelector('img'),target=document.getElementById('zoom-image');target.src=source.src;target.alt=source.alt;document.getElementById('zoom').showModal()}</script></body></html>"""
(OUT / "All-FTO-Form-Preview-Gallery.html").write_text(gallery)
print("Created self-contained preview gallery and individual-form PDF ZIP.")
