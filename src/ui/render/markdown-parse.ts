/**
 * Zeno UI v2 — lightweight markdown parser (spec §5, docs/ui/component-spec.md
 * § Message blocks).
 *
 * Pure functions only (no React/Ink) so block/inline parsing is unit-testable
 * without a terminal. Scope is intentionally narrow: enough to render typical
 * assistant output (headers, lists, code, quotes, tables, links, diffs) without
 * a full CommonMark implementation — no dependency was added for this.
 *
 * The renderer lives in `markdown-blocks.tsx`.
 */

export interface InlineText {
  type: "text";
  value: string;
}

export interface InlineBold {
  type: "bold";
  children: Inline[];
}

export interface InlineItalic {
  type: "italic";
  children: Inline[];
}

export interface InlineCode {
  type: "code";
  value: string;
}

export interface InlineLink {
  type: "link";
  text: string;
  url: string;
}

export type Inline = InlineText | InlineBold | InlineItalic | InlineCode | InlineLink;

export interface ListItem {
  children: Inline[];
}

export type Block =
  | { type: "heading"; level: number; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "code"; language?: string; value: string }
  | { type: "quote"; children: Inline[] }
  | { type: "rule" }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "diff"; value: string };

/** Parse inline spans: **bold**, *italic*, `code`, and [text](url). */
export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push({ type: "text", value: text.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      nodes.push({ type: "bold", children: parseInline(m[2]) });
    } else if (m[3] !== undefined) {
      nodes.push({ type: "italic", children: parseInline(m[4]) });
    } else if (m[5] !== undefined) {
      nodes.push({ type: "code", value: m[6] });
    } else if (m[7] !== undefined) {
      nodes.push({ type: "link", text: m[8], url: m[9] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push({ type: "text", value: text.slice(last) });
  }
  return nodes;
}

/** True when content looks like a unified diff (mirrors the v1 MessageList check). */
export function isUnifiedDiff(text: string): boolean {
  return text.includes("@@") && /^diff --git|\+|-/m.test(text);
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Split markdown text into block-level structure. */
export function parseMarkdown(md: string): Block[] {
  const normalized = md.replace(/\r\n/g, "\n");
  if (isUnifiedDiff(normalized)) {
    return [{ type: "diff", value: normalized }];
  }

  const lines = normalized.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Fenced code block.
    const fence = /^```(\S*)\s*$/.exec(line);
    if (fence !== null) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence (may run past end; loop guard handles it)
      blocks.push({ type: "code", language: fence[1] || undefined, value: buf.join("\n") });
      continue;
    }

    // ATX heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      blocks.push({ type: "heading", level: heading[1].length, children: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    // Blockquote (may span multiple ">" lines).
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", children: parseInline(buf.join(" ")) });
      continue;
    }

    // Horizontal rule.
    if (/^(---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }

    // List (bulleted or ordered).
    const bullet = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (bullet !== null) {
      const ordered = /\d/.test(bullet[1]);
      const itemRe = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const itemMatch = itemRe.exec(lines[i]);
        if (itemMatch === null) {
          if (lines[i].trim() === "") {
            i += 1;
          }
          break;
        }
        items.push({ children: parseInline(lines[i].slice(itemMatch[0].length)) });
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Indented code block (4-space indent).
    if (/^ {4}/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && (/^ {4}/.test(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim() !== "") {
          buf.push(lines[i].replace(/^ {4}/, ""));
        }
        i += 1;
      }
      blocks.push({ type: "code", value: buf.join("\n") });
      continue;
    }

    // Table (header row + separator row like |---|---|).
    if (lines[i].includes("|") && lines[i + 1] !== undefined && /^\s*\|?\s*:?-{3,}.*\|/.test(lines[i + 1])) {
      const header = parseTableRow(lines[i]);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // Paragraph: accumulate until a blank line or another block start.
    const buf: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|```|>|[-*+]|\d+[.)]|\s{4})/.test(lines[i]) &&
      !lines[i].includes("|")
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(buf.join(" ")) });
  }

  return blocks;
}
