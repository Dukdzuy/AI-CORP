import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from '../markdown';

describe('parseMarkdown', () => {
  it('parses the generated use case document', () => {
    const md = [
      '# Use Case Specification: Shop',
      '',
      '## Actors',
      '',
      '- Customer',
      '- Admin',
      '',
      '| ID | Name | Priority |',
      '|----|------|---------:|',
      '| UC-001 | Place Order | High |',
      '| **ID** | a \\| b |',
      '',
      '### Main Flow',
      '',
      '1. Customer opens the cart',
      '2. System shows the total',
      '',
      '---',
      '',
      'See `use-case-diagram.puml` for the diagram.',
    ].join('\n');

    const blocks = parseMarkdown(md);

    expect(blocks.map(b => b.type)).toEqual(['heading', 'heading', 'list', 'table', 'heading', 'list', 'rule', 'paragraph']);
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, children: [{ type: 'text', text: 'Use Case Specification: Shop' }] });
    expect(blocks[2]).toEqual(expect.objectContaining({ ordered: false, items: [[{ type: 'text', text: 'Customer' }], [{ type: 'text', text: 'Admin' }]] }));
    const table = blocks[3] as Extract<ReturnType<typeof parseMarkdown>[number], { type: 'table' }>;
    expect(table.align).toEqual([null, null, 'right']);
    expect(table.rows[0].map(c => (c[0] as any).text)).toEqual(['UC-001', 'Place Order', 'High']);
    expect(table.rows[1][0]).toEqual([{ type: 'strong', children: [{ type: 'text', text: 'ID' }] }]);
    expect(table.rows[1][1]).toEqual([{ type: 'text', text: 'a | b' }]);
    expect(table.rows[1][2]).toEqual([]); // missing cells are padded
    expect(blocks[5]).toEqual(expect.objectContaining({ ordered: true, start: 1 }));
    expect((blocks[7] as any).children[1]).toEqual({ type: 'code', text: 'use-case-diagram.puml' });
  });

  it('keeps code fences verbatim and supports quotes', () => {
    const blocks = parseMarkdown('```ts\nconst a = 1;\n# not a heading\n```\n\n> **Note** quoted');
    expect(blocks[0]).toEqual({ type: 'code', lang: 'ts', text: 'const a = 1;\n# not a heading' });
    expect(blocks[1]).toEqual({ type: 'quote', children: [{ type: 'paragraph', children: [
      { type: 'strong', children: [{ type: 'text', text: 'Note' }] }, { type: 'text', text: ' quoted' },
    ] }] });
  });

  it('joins paragraph lines and stops at the next block', () => {
    const blocks = parseMarkdown('line one\nline two\n## Next');
    expect(blocks[0]).toEqual({ type: 'paragraph', children: [{ type: 'text', text: 'line one line two' }] });
    expect(blocks[1].type).toBe('heading');
  });
});

describe('parseInline', () => {
  it('parses emphasis, code and links', () => {
    expect(parseInline('a *b* _c_ **d** `e` [f](https://x.dev)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'em', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'em', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'strong', children: [{ type: 'text', text: 'd' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'e' },
      { type: 'text', text: ' ' },
      { type: 'link', href: 'https://x.dev', children: [{ type: 'text', text: 'f' }] },
    ]);
  });

  it('drops unsafe link targets and leaves snake_case alone', () => {
    expect(parseInline('[click](javascript:evil) [x](data:text/html,hi)')).toEqual([{ type: 'text', text: 'click x' }]);
    expect(parseInline('qa_approved and test_design')).toEqual([{ type: 'text', text: 'qa_approved and test_design' }]);
  });

  it('keeps HTML as text', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });
});
