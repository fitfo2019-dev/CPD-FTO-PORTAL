import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Tracked files stay plain: readable names, no working folders, and no author,
// device or location details inside documents and images.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const self = "scripts/src/source-hygiene.test.ts";
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter(Boolean).filter(path => path !== self);

const TEXT = /\.(ts|tsx|js|mjs|cjs|jsx|json|md|txt|html|css|yaml|yml|toml|sql|sh|py)$/i;
const OFFICE = /\.(docx|xlsx|pptx)$/i;
const IMAGE = /\.(jpe?g|webp|png|gif)$/i;

const ALLOWED_DOT_PATHS = new Set([".github", ".canvas", ".gitignore", ".replit", ".replitignore", ".replit-context.md"]);
const PATH_RULES: [string, RegExp][] = [
  ["camera file name", /\bIMG_\d{3,}|\.heic$/i],
  ["numbered file name", /_\d{10,}\.[a-z0-9]{2,4}$/i],
  ["transfer folder", /(^|\/)attach[a-z_-]*\//i],
];
const TEXT_RULES: [string, RegExp][] = [
  ["camera file name", /\bIMG_\d{3,}|\.heic\b/i],
  ["numbered file name", /_\d{10,}\.(pdf|docx?|xlsx?|pptx|png|jpe?g|txt)\b/i],
  ["transfer folder", /\battach[a-z]*_[a-z]+\/|\/attachments\//i],
  ["source-file wording", /\b(uploaded|supplied|attached|pasted) (photos?|photographs?|screenshots?|images?|manuals?|maps?|originals?|copies)\b/i],
  ["source-file wording", /\b(uploaded|supplied|pasted)( [a-z-]+){1,3} (photos?|photographs?|screenshots?|images?|manuals?|maps?|originals?)\b/i],
  ["source-file wording", /\b(user|owner)[- ]uploaded\b|\b(user|owner)'s (photos?|screenshots?)\b/i],
];

test("tracked files have plain names and no source-file wording", () => {
  const problems: string[] = [];
  for (const path of files) {
    const top = path.split("/")[0];
    if (top.startsWith(".") && !ALLOWED_DOT_PATHS.has(top)) problems.push(`${path}: working folder`);
    for (const [label, rule] of PATH_RULES) if (rule.test(path)) problems.push(`${path}: ${label}`);
    if (!TEXT.test(path)) continue;
    const lines = readFileSync(resolve(root, path), "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const [label, rule] of TEXT_RULES) if (rule.test(line)) problems.push(`${path}:${index + 1}: ${label}`);
    });
  }
  assert.deepEqual(problems, []);
});

function zipEntry(zip: Buffer, name: string): string | null {
  const end = zip.lastIndexOf("PK\x05\x06", undefined, "latin1");
  if (end < 0) return null;
  let at = zip.readUInt32LE(end + 16);
  for (let count = zip.readUInt16LE(end + 10); count > 0; count -= 1) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const next = at + 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    if (zip.toString("latin1", at + 46, at + 46 + nameLength) === name) {
      const local = zip.readUInt32LE(at + 42);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const body = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(body) : body).toString("utf8");
    }
    at = next;
  }
  return null;
}

test("documents and images carry no author, device or location details", () => {
  const problems: string[] = [];
  for (const path of files) {
    const bytes = readFileSync(resolve(root, path));
    if (OFFICE.test(path)) {
      const core = zipEntry(bytes, "docProps/core.xml");
      if (core) {
        const people = [...core.matchAll(/<(dc:creator|cp:lastModifiedBy)>([^<]*)</g)].map(match => match[2]);
        if (people.some(name => name !== "" && name !== "Field Training Office")) problems.push(`${path}: author`);
      }
    } else if (/\.pdf$/i.test(path)) {
      const raw = bytes.toString("latin1");
      if (/<x:xmpmeta|Exif\0\0/.test(raw)) problems.push(`${path}: embedded metadata`);
      const author = /\/Author\s*\(([^)]*)\)/.exec(raw);
      if (author && author[1] !== "Field Training Office") problems.push(`${path}: author`);
    } else if (IMAGE.test(path)) {
      const raw = bytes.toString("latin1");
      if (/Exif\0\0|<x:xmpmeta|http:\/\/ns\.adobe\.com\/xap/.test(raw)) problems.push(`${path}: embedded metadata`);
    }
  }
  assert.deepEqual(problems, []);
});
