import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const title = "City of Columbus Executive Brief";
const outputDirectory = fileURLToPath(
  new URL("../../generated-artifacts/website-records/", import.meta.url),
);
const canonicalPath = fileURLToPath(
  new URL("../../docs/COLUMBUS_FTO_PORTAL_BRIEFING.md", import.meta.url),
);
const outputPaths = {
  markdown: fileURLToPath(
    new URL(
      "../../generated-artifacts/website-records/City-of-Columbus-Executive-Brief.md",
      import.meta.url,
    ),
  ),
  html: fileURLToPath(
    new URL(
      "../../generated-artifacts/website-records/City-of-Columbus-Executive-Brief.html",
      import.meta.url,
    ),
  ),
  text: fileURLToPath(
    new URL(
      "../../generated-artifacts/website-records/City-of-Columbus-Executive-Brief.txt",
      import.meta.url,
    ),
  ),
  pdf: fileURLToPath(
    new URL(
      "../../generated-artifacts/website-records/City-of-Columbus-Executive-Brief.pdf",
      import.meta.url,
    ),
  ),
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function htmlToText(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " "),
  );
}

test("all executive brief exports use the canonical title", () => {
  const canonical = readFileSync(canonicalPath, "utf8");
  assert.equal(canonical.match(/^# (.+)$/m)?.[1], title);

  const markdown = readFileSync(outputPaths.markdown, "utf8");
  const text = readFileSync(outputPaths.text, "utf8");
  const html = readFileSync(outputPaths.html, "utf8");
  const pdfInfo = execFileSync("pdfinfo", [outputPaths.pdf], {
    encoding: "utf8",
  });
  const firstPdfPage = execFileSync(
    "pdftotext",
    ["-f", "1", "-l", "1", "-layout", outputPaths.pdf, "-"],
    { encoding: "utf8" },
  );

  assert.equal(markdown.match(/^# (.+)$/m)?.[1], title);
  assert.equal(text.match(/^# (.+)$/m)?.[1], title);
  assert.equal(html.match(/<title>(.*?)<\/title>/i)?.[1], title);
  assert.equal(html.match(/<h1(?:\s[^>]*)?>(.*?)<\/h1>/i)?.[1], title);
  assert.equal(pdfInfo.match(/^Title:\s*(.+)$/m)?.[1].trim(), title);
  assert.equal(
    firstPdfPage
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean),
    title,
  );
});

test("exports use the executive-brief filenames, not stale website-overview names", () => {
  const filenames = readdirSync(outputDirectory);
  for (const extension of ["md", "html", "txt", "pdf"]) {
    assert.ok(
      filenames.includes(`City-of-Columbus-Executive-Brief.${extension}`),
      `Missing executive brief .${extension} export`,
    );
  }
  assert.deepEqual(
    filenames.filter((name) => /^Columbus-FTO-Website-Overview\./i.test(name)),
    [],
    "Stale website-overview exports should be renamed",
  );
});

test("all formats retain essential readiness and pilot content", () => {
  const canonical = readFileSync(canonicalPath, "utf8");
  const markdown = readFileSync(outputPaths.markdown, "utf8");
  const text = readFileSync(outputPaths.text, "utf8");
  const html = htmlToText(readFileSync(outputPaths.html, "utf8"));
  const pdf = execFileSync("pdftotext", [outputPaths.pdf, "-"], {
    encoding: "utf8",
  });

  const requiredContent = [
    "No operational connection is claimed.",
    "A local save is not an upload",
    "paperwork time, rework, after-hours work/overtime",
  ];
  for (const snippet of requiredContent) {
    assert.ok(canonical.includes(snippet), `Canonical brief missing: ${snippet}`);
    for (const [format, content] of Object.entries({
      markdown,
      text,
      html,
      pdf,
    })) {
      assert.ok(
        normalizeWhitespace(content).includes(snippet),
        `${format} export is missing key content: ${snippet}`,
      );
    }
  }
});
