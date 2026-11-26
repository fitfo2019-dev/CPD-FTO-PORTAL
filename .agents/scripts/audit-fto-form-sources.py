"""Inspect uploaded blank FTO forms without running PDF actions or Excel macros."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "generated-artifacts" / "fto-source-audit"
OUT.mkdir(parents=True, exist_ok=True)
inventory = []
for path in sorted((ROOT / "attached_assets").glob("*1795012335*.pdf")):
    with pymupdf.open(path) as document:
        pages = []
        for index, page in enumerate(document):
            pages.append({
                "page": index + 1,
                "size": list(page.rect),
                "text": page.get_text(),
                "fields": [
                    {"name": field.field_name, "type": field.field_type_string,
                     "rect": list(field.rect)}
                    for field in (page.widgets() or [])
                ],
            })
        inventory.append({"file": path.name, "pages": pages})
        # Render originals to inspect spacing, labels, and continuation layout.
        for index, page in enumerate(document):
            page.get_pixmap(matrix=pymupdf.Matrix(1, 1)).save(
                OUT / f"{path.stem}-page-{index + 1}.png"
            )

workbook = next((ROOT / "attached_assets").glob("*1795012335*.xlsm"))
with ZipFile(workbook) as archive:
    namespace = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    book = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = [sheet.attrib["name"] for sheet in book.findall(".//s:sheet", namespace)]
    strings = ["".join(item.itertext()) for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
    inventory.append({"file": workbook.name, "sheets": sheets, "labels": strings,
                      "macrosExecuted": False})

(OUT / "inventory.json").write_text(json.dumps(inventory, indent=2))
print(f"Audited {len(inventory) - 1} PDFs and {len(sheets)} workbook sheets.")
print(f"Report and page previews: {OUT.relative_to(ROOT)}")
