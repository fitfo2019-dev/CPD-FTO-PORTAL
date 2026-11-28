type PrintableNarrativeLayout = {
  widthPoints: number;
  heightPoints: number;
  font: string;
  lineHeightPoints: number;
};

// Letter page content after the existing print margins, header, metadata, and footer.
// The browser canvas supplies the active engine's Arial metrics when available.
export const RUN_NARRATIVE_LAYOUT: PrintableNarrativeLayout = {
  widthPoints: 7.8 * 72,
  // Continuation-sheet print rules use 8pt Lato at 1.25 leading; 3.9in
  // leaves measured room for the repeated header, identity fields and footer.
  heightPoints: 3.9 * 72,
  font: "8pt Lato, Arial, sans-serif",
  lineHeightPoints: 8 * 1.25,
};
export const DAILY_NARRATIVE_LAYOUT: PrintableNarrativeLayout = {
  widthPoints: 10.2 * 72,
  heightPoints: 5.75 * 72,
  font: "10pt Arial, Helvetica, sans-serif",
  lineHeightPoints: 10 * 1.5,
};
export const ORIENTATION_NARRATIVE_LAYOUT: PrintableNarrativeLayout = {
  widthPoints: 7.8 * 72,
  heightPoints: 8.1 * 72,
  font: "10pt Arial, Helvetica, sans-serif",
  lineHeightPoints: 10 * 1.45,
};
export const WEEKLY_NARRATIVE_LAYOUT: PrintableNarrativeLayout = {
  widthPoints: 7.8 * 72,
  heightPoints: 7.8 * 72,
  font: "9pt Arial, Helvetica, sans-serif",
  lineHeightPoints: 9 * 1.4,
};

function graphemes(value: string): string[] {
  type SegmenterConstructor = new (
    locale?: string | string[],
    options?: { granularity: "grapheme" },
  ) => { segment(input: string): Iterable<{ segment: string }> };
  const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter;
  return Segmenter
    ? Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), item => item.segment)
    : Array.from(value);
}

function textMeasurer(font: string) {
  if (typeof document !== "undefined") {
    const context = document.createElement("canvas").getContext("2d");
    if (context) {
      context.font = font;
      return (value: string) => context.measureText(value).width * 72 / 96;
    }
  }
  const fontSize = Number.parseFloat(font) || 7;
  return (value: string) => graphemes(value).reduce((width, glyph) => {
    if (/^\s+$/u.test(glyph)) return width + fontSize * 0.28;
    const codePoint = glyph.codePointAt(0) ?? 0;
    if (/\p{Extended_Pictographic}/u.test(glyph) ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xff01 && codePoint <= 0xff60))
      return width + fontSize;
    if (/^[ilI.,:;!'|]$/u.test(glyph)) return width + fontSize * 0.28;
    if (/^[MW@#%&]$/u.test(glyph)) return width + fontSize * 0.82;
    return width + fontSize * 0.52;
  }, 0);
}

function visualLines(value: string, widthPoints: number, font: string): string[] {
  if (!value) return [""];
  const measure = textMeasurer(font);
  const lines: string[] = [];
  let line = "";
  for (const glyph of graphemes(value)) {
    if (glyph === "\n" || glyph === "\r" || glyph === "\r\n") {
      lines.push(`${line}${glyph}`);
      line = "";
      continue;
    }
    if (line && measure(line + glyph) > widthPoints) {
      const lastWhitespace = Array.from(line.matchAll(/\s/gu)).at(-1);
      const whitespaceEnd = lastWhitespace && lastWhitespace.index !== undefined
        ? lastWhitespace.index + lastWhitespace[0].length
        : 0;
      if (whitespaceEnd > 0 && whitespaceEnd < line.length) {
        const prefix = line.slice(0, whitespaceEnd);
        const overflow = line.slice(whitespaceEnd) + glyph;
        let overflowLine = "";
        const wrappedOverflow: string[] = [];
        for (const overflowGlyph of graphemes(overflow)) {
          if (overflowLine && measure(overflowLine + overflowGlyph) > widthPoints) {
            wrappedOverflow.push(overflowLine);
            overflowLine = overflowGlyph;
          } else overflowLine += overflowGlyph;
        }
        lines.push(prefix, ...wrappedOverflow);
        line = overflowLine;
      } else {
        lines.push(line);
        line = glyph;
      }
    } else line += glyph;
  }
  if (line) lines.push(line);
  if (value.endsWith("\n") || value.endsWith("\r")) lines.push("");
  return lines.length ? lines : [""];
}

/** Paginate by printable line height and active-font glyph widths, without altering source text. */
export function paginateNarrativeToPages(
  value: string,
  layout: PrintableNarrativeLayout = RUN_NARRATIVE_LAYOUT,
): string[] {
  if (!value) return [""];
  const capacity = Math.max(1, Math.floor(layout.heightPoints / layout.lineHeightPoints));
  const lines = visualLines(value, layout.widthPoints, layout.font);
  const endsWithLineBreak = value.endsWith("\n") || value.endsWith("\r");
  const pageCapacity = endsWithLineBreak && capacity > 1 ? capacity - 1 : capacity;
  const pages: string[] = [];
  for (let start = 0; start < lines.length; start += pageCapacity) {
    const page = lines.slice(start, start + pageCapacity).join("");
    if (page) pages.push(page);
  }
  if (!pages.length) return [value];
  if (pages.join("") !== value) throw new Error("Narrative pagination did not preserve the source text.");
  return pages;
}

/** Full-width run narrative box across the bottom of every run and supplement sheet. */
export const RUN_BOX_NARRATIVE_LINES = 5;
export const RUN_BOX_NARRATIVE_LAYOUT: PrintableNarrativeLayout = {
  // 7.5in printable width less the box border and padding, rounded down so
  // the measured wrap never runs wider than the printed box.
  widthPoints: 7.2 * 72,
  heightPoints: RUN_BOX_NARRATIVE_LINES * 8.5 * 1.25,
  font: "8.5pt Lato, Arial, sans-serif",
  lineHeightPoints: 8.5 * 1.25,
};

export type RunNarrativeBoxSplit = {
  /** Text printed inside the run-page box, exactly as entered. */
  box: string;
  /** Remaining text, one entry per Narrative Addition / Continuation (U-10.192) page. */
  continuation: string[];
};

/**
 * The box holds the opening lines. When the narrative is longer, or a
 * Narrative Addition is required, the last box line is kept for the
 * continuation reference and the rest starts on U-10.192 at the next word.
 */
export function splitRunNarrativeBox(value: string, explicitlyRequired = false): RunNarrativeBoxSplit {
  const lines = value ? visualLines(value, RUN_BOX_NARRATIVE_LAYOUT.widthPoints, RUN_BOX_NARRATIVE_LAYOUT.font) : [];
  const shown = lines.length && value.endsWith("\n") ? lines.length - 1 : lines.length;
  if (!explicitlyRequired && shown <= RUN_BOX_NARRATIVE_LINES) return { box: value, continuation: [] };
  const keep = RUN_BOX_NARRATIVE_LINES - 1;
  const box = lines.slice(0, keep).join("");
  const rest = lines.slice(keep).join("");
  if (box + rest !== value) throw new Error("Narrative box split did not preserve the source text.");
  return { box, continuation: rest.trim() ? paginateNarrativeToPages(rest, RUN_NARRATIVE_LAYOUT) : [""] };
}

/** Keep the existing continuation trigger; only the page-fit calculation changes. */
export function needsRunNarrativeContinuation(value: string, explicitlyRequired = false): boolean {
  return explicitlyRequired || value.length > 220 || value.split("\n").length > 3;
}

export function splitNarrativeContinuation(value: string): string[] {
  return paginateNarrativeToPages(value, RUN_NARRATIVE_LAYOUT);
}

/** Keep short daily notes on the base sheet and paginate longer notes by printable fit. */
export function dailyLogContinuations(report: { narrative: string; remedial: string }) {
  return [
    { label: "FTO comments / shift narrative", value: report.narrative },
    { label: "Corrective training / retraining", value: report.remedial },
  ].flatMap(note => {
    if (note.value.length <= 120 && note.value.split("\n").length <= 2) return [];
    const parts = paginateNarrativeToPages(note.value, DAILY_NARRATIVE_LAYOUT);
    return parts.map((text, index) => ({
      label: note.label,
      text,
      part: index + 1,
      total: parts.length,
    }));
  });
}
