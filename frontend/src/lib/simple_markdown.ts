/**
 * @fileoverview A deliberately small Markdown subset for AI answers.
 *
 * Supports paragraphs, `#` headings, `-`/`*`/`1.` lists and `**bold**`. The
 * output is plain data rendered as React elements, never as HTML, so model
 * output cannot inject markup into the page.
 */

export interface InlineSpan {
  text: string;
  bold: boolean;
}

export type MarkdownBlock =
  | {kind: 'heading'; spans: InlineSpan[]}
  | {kind: 'paragraph'; spans: InlineSpan[]}
  | {kind: 'list'; ordered: boolean; items: InlineSpan[][]};

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** Splits `**bold**` runs out of a line of text. */
export function parseInline(text: string): InlineSpan[] {
  const parts = text.split('**');
  // An odd number of `**` markers leaves the last one unmatched (common while
  // an answer is still streaming): keep it as literal text.
  if (parts.length % 2 === 0) {
    const tail = parts.pop() ?? '';
    parts[parts.length - 1] += `**${tail}`;
  }
  return parts
    .map((part, index) => ({text: part, bold: index % 2 === 1}))
    .filter(span => span.text !== '');
}

/** Parses an answer into blocks. Works on partial text while streaming. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({kind: 'paragraph', spans: parseInline(paragraph.join(' '))});
      paragraph = [];
    }
  }

  function addListItem(ordered: boolean, text: string) {
    flushParagraph();
    const last = blocks[blocks.length - 1];
    if (last?.kind === 'list' && last.ordered === ordered) {
      last.items.push(parseInline(text));
    } else {
      blocks.push({kind: 'list', ordered, items: [parseInline(text)]});
    }
  }

  for (const line of source.split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (line.trim() === '') {
      flushParagraph();
    } else if (heading) {
      flushParagraph();
      blocks.push({kind: 'heading', spans: parseInline(heading[1])});
    } else if (bullet) {
      addListItem(false, bullet[1]);
    } else if (numbered) {
      addListItem(true, numbered[1]);
    } else {
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  return blocks;
}
