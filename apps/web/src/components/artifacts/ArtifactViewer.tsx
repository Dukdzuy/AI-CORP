import React, { useEffect, useState } from 'react';
import { Alert, Empty, Segmented, Space, Spin, Tag, Typography } from 'antd';
import { ArtifactContent } from '../../lib/api/hooks/artifacts';
import { MarkdownView } from './MarkdownView';
import { plantUmlSvgUrl } from './plantuml';
import { formatSize } from './fileTree';

const { Text } = Typography;

const preStyle: React.CSSProperties = {
  background: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: 12,
  fontSize: 12,
  color: '#c9d1d9',
  overflow: 'auto',
  maxHeight: 640,
  margin: 0,
  whiteSpace: 'pre',
};

const CodeBlock: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const width = String(lines.length).length;
  return (
    <pre style={preStyle}>
      {lines.map((line, i) => (
        <div key={i}>
          <span style={{ color: '#484f58', userSelect: 'none', display: 'inline-block', width: `${width + 1}ch` }}>{i + 1}</span>
          {line}
        </div>
      ))}
    </pre>
  );
};

const PlantUmlView: React.FC<{ source: string }> = ({ source }) => {
  const [mode, setMode] = useState<'diagram' | 'source'>('diagram');
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUrl(undefined);
    plantUmlSvgUrl(source).then(u => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (url === null) {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text style={{ color: '#8b949e', fontSize: 12 }}>Diagram rendering is turned off (VITE_PLANTUML_SERVER is empty).</Text>
        <CodeBlock text={source} />
      </Space>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Segmented
        size="small"
        value={mode}
        onChange={v => setMode(v as 'diagram' | 'source')}
        options={[{ label: 'Diagram', value: 'diagram' }, { label: 'Source', value: 'source' }]}
      />
      {mode === 'source' ? (
        <CodeBlock text={source} />
      ) : url === undefined ? (
        <Spin />
      ) : failed ? (
        <Alert type="warning" showIcon message="The PlantUML server could not render this diagram" description="Check the source for syntax errors or the VITE_PLANTUML_SERVER setting." />
      ) : (
        <div style={{ background: '#ffffff', borderRadius: 6, padding: 12, overflow: 'auto', maxHeight: 720, textAlign: 'center' }}>
          <img src={url} alt="PlantUML diagram" style={{ maxWidth: '100%' }} onError={() => setFailed(true)} />
        </div>
      )}
    </Space>
  );
};

export const ArtifactViewer: React.FC<{ file: ArtifactContent | undefined; loading: boolean; error?: unknown }> = ({ file, loading, error }) => {
  if (loading) return <Spin />;
  if (error) {
    const status = (error as any)?.response?.status;
    return (
      <Alert
        type="error"
        showIcon
        message={status === 413 ? 'This file is too large to preview; download the project archive instead.' : 'Could not load this file.'}
      />
    );
  }
  if (!file) return <Empty description={<Text style={{ color: '#8b949e' }}>Select a file</Text>} />;

  let body: React.ReactNode;
  switch (file.kind) {
    case 'markdown':
      body = <MarkdownView source={file.content} />;
      break;
    case 'plantuml':
      body = <PlantUmlView source={file.content} />;
      break;
    case 'json': {
      let pretty = file.content;
      try {
        pretty = JSON.stringify(JSON.parse(file.content), null, 2);
      } catch {
        // show as-is
      }
      body = <CodeBlock text={pretty} />;
      break;
    }
    default:
      body = <CodeBlock text={file.content} />;
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        <Text style={{ color: '#e6edf3', fontFamily: 'monospace' }}>{file.path}</Text>
        <Tag>{file.kind}</Tag>
        <Text style={{ color: '#8b949e', fontSize: 12 }}>{formatSize(file.size)}</Text>
      </Space>
      {body}
    </Space>
  );
};
