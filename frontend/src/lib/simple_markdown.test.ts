import {describe, expect, it} from 'vitest';
import {parseInline, parseMarkdown} from './simple_markdown';

describe('parseInline', () => {
  it('splits bold runs', () => {
    expect(parseInline('a **b** c')).toEqual([
      {text: 'a ', bold: false},
      {text: 'b', bold: true},
      {text: ' c', bold: false},
    ]);
  });

  it('keeps an unmatched marker as literal text', () => {
    expect(parseInline('half **open')).toEqual([
      {text: 'half **open', bold: false},
    ]);
  });
});

describe('parseMarkdown', () => {
  it('groups paragraphs, headings and lists', () => {
    const blocks = parseMarkdown(
      [
        '## Summary',
        'Line one',
        'continues here.',
        '',
        '- first',
        '* second',
        '1. numbered',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      {kind: 'heading', spans: [{text: 'Summary', bold: false}]},
      {
        kind: 'paragraph',
        spans: [{text: 'Line one continues here.', bold: false}],
      },
      {
        kind: 'list',
        ordered: false,
        items: [
          [{text: 'first', bold: false}],
          [{text: 'second', bold: false}],
        ],
      },
      {kind: 'list', ordered: true, items: [[{text: 'numbered', bold: false}]]},
    ]);
  });

  it('treats HTML as plain text', () => {
    expect(parseMarkdown('<img src=x onerror=alert(1)>')).toEqual([
      {
        kind: 'paragraph',
        spans: [{text: '<img src=x onerror=alert(1)>', bold: false}],
      },
    ]);
  });
});
