import React, { useMemo } from 'react';
import { Block, Inline, parseMarkdown } from './markdown';

const styles = {
  root: { color: '#c9d1d9', fontSize: 14, lineHeight: 1.6 } as React.CSSProperties,
  code: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, padding: '1px 5px', fontSize: 12, fontFamily: 'monospace' } as React.CSSProperties,
  pre: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: 12, fontSize: 12, overflow: 'auto', margin: '8px 0' } as React.CSSProperties,
  table: { borderCollapse: 'collapse', margin: '8px 0', fontSize: 13, width: '100%' } as React.CSSProperties,
  cell: { border: '1px solid #30363d', padding: '4px 8px', textAlign: 'left', verticalAlign: 'top' } as React.CSSProperties,
  quote: { borderLeft: '3px solid #30363d', margin: '8px 0', padding: '0 12px', color: '#8b949e' } as React.CSSProperties,
};

const HEADING_SIZES = [26, 21, 17, 15, 14, 13];

function renderInline(nodes: Inline[]): React.ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <React.Fragment key={i}>{node.text}</React.Fragment>;
      case 'strong':
        return <strong key={i} style={{ color: '#e6edf3' }}>{renderInline(node.children)}</strong>;
      case 'em':
        return <em key={i}>{renderInline(node.children)}</em>;
      case 'code':
        return <code key={i} style={styles.code}>{node.text}</code>;
      case 'link':
        return /^https?:\/\//i.test(node.href)
          ? <a key={i} href={node.href} target="_blank" rel="noopener noreferrer">{renderInline(node.children)}</a>
          : <span key={i} style={{ textDecoration: 'underline dotted' }}>{renderInline(node.children)}</span>;
    }
  });
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag key={key} style={{ color: '#e6edf3', fontSize: HEADING_SIZES[block.level - 1], margin: '18px 0 8px', borderBottom: block.level <= 2 ? '1px solid #21262d' : undefined, paddingBottom: block.level <= 2 ? 4 : 0 }}>
          {renderInline(block.children)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p key={key} style={{ margin: '8px 0' }}>{renderInline(block.children)}</p>;
    case 'list': {
      const items = block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>);
      return block.ordered
        ? <ol key={key} start={block.start} style={{ paddingLeft: 24, margin: '8px 0' }}>{items}</ol>
        : <ul key={key} style={{ paddingLeft: 24, margin: '8px 0' }}>{items}</ul>;
    }
    case 'table':
      return (
        <div key={key} style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {block.header.map((cell, c) => (
                  <th key={c} style={{ ...styles.cell, background: '#161b22', color: '#e6edf3', textAlign: block.align[c] || 'left' }}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ ...styles.cell, textAlign: block.align[c] || 'left' }}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return <pre key={key} style={styles.pre}><code>{block.text}</code></pre>;
    case 'quote':
      return <blockquote key={key} style={styles.quote}>{block.children.map(renderBlock)}</blockquote>;
    case 'rule':
      return <hr key={key} style={{ border: 0, borderTop: '1px solid #30363d', margin: '16px 0' }} />;
  }
}

/** Renders generated Markdown as React elements (no HTML injection) */
export const MarkdownView: React.FC<{ source: string }> = ({ source }) => {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return <div style={styles.root}>{blocks.map(renderBlock)}</div>;
};
