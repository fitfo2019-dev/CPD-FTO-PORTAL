import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const title = "Field Training Officer Portal";
const outputStem = "City-of-Columbus-Chain-of-Command-Brief";
const outputDirectory = fileURLToPath(
  new URL("../../generated-artifacts/website-records/", import.meta.url),
);
const canonicalPath = fileURLToPath(
  new URL("../../docs/COLUMBUS_FTO_PORTAL_BRIEFING.md", import.meta.url),
);
const outputPaths = {
  markdown: fileURLToPath(
    new URL(
      `../../generated-artifacts/website-records/${outputStem}.md`,
      import.meta.url,
    ),
  ),
  html: fileURLToPath(
    new URL(
      `../../generated-artifacts/website-records/${outputStem}.html`,
      import.meta.url,
    ),
  ),
  text: fileURLToPath(
    new URL(
      `../../generated-artifacts/website-records/${outputStem}.txt`,
      import.meta.url,
    ),
  ),
  pdf: fileURLToPath(
    new URL(
      `../../generated-artifacts/website-records/${outputStem}.pdf`,
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
  assert.equal(text.split(/\r?\n/)[0], title);
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

test("exports use the current chain-of-command brief filenames", () => {
  const filenames = readdirSync(outputDirectory);
  for (const extension of ["md", "html", "txt", "pdf"]) {
    assert.ok(
      filenames.includes(`${outputStem}.${extension}`),
      `Missing chain-of-command brief .${extension} export`,
    );
  }
});

test("contents links resolve in HTML and remain clickable in the PDF", () => {
  const canonical = readFileSync(canonicalPath, "utf8");
  const html = readFileSync(outputPaths.html, "utf8");
  const contentsStart = canonical.indexOf("## Contents");
  const nextSection = canonical.indexOf("\n## ", contentsStart + "## Contents".length);
  const contents =
    contentsStart >= 0
      ? canonical.slice(contentsStart, nextSection >= 0 ? nextSection : undefined)
      : "";
  const destinations = [...contents.matchAll(/\[[^\]]+\]\(#([a-z0-9-]+)\)/g)].map(
    (match) => match[1],
  );

  assert.ok(destinations.length >= 8, "The canonical contents list should cover major sections");
  for (const destination of destinations) {
    assert.ok(
      html.includes(`href="#${destination}"`),
      `HTML contents link is missing: ${destination}`,
    );
    assert.ok(
      html.includes(`id="${destination}"`),
      `HTML section destination is missing: ${destination}`,
    );
  }

  const pdfObjects = execFileSync("mutool", ["show", outputPaths.pdf, "grep"], {
    encoding: "utf8",
  });
  assert.match(pdfObjects, /\/Subtype\/Link/, "PDF should contain clickable link annotations");
  for (const destination of destinations) {
    assert.ok(
      pdfObjects.includes(`/Dest/${destination}/F`),
      `PDF contents link is missing: ${destination}`,
    );
    assert.ok(
      pdfObjects.includes(`/${destination}[`),
      `PDF destination is missing: ${destination}`,
    );
  }
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
