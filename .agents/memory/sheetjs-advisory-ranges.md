---
name: SheetJS advisory ranges
description: Official patched SheetJS distribution and advisory scanner limitations.
---

Use the official SheetJS distribution for patched CE releases, not the stale
npm registry release. Do not replace the patched reader with the styling fork
merely to remove an advisory finding.

**Why:** The npm registry still serves an affected release. The dependency
scanner's OSV advisory ranges marked even the official patched CE release as
affected because their npm ranges had no fixed-version endpoint. The publisher
identifies prototype pollution as fixed in 0.19.3 and ReDoS as fixed in 0.20.2.
The styling fork is retained for existing exports, not arbitrary-file imports.

**How to apply:** Verify the installed version and the publisher's advisories at
https://cdn.sheetjs.com/advisories/CVE-2023-30533 and
https://cdn.sheetjs.com/advisories/CVE-2024-22363. Preserve lockfile integrity,
exercise actual Excel imports, and report conflicting scanner results honestly;
do not suppress advisories or rename packages to hide findings.
