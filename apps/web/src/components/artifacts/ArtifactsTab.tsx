import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, message, Row, Space, Spin, Tree, Typography } from 'antd';
import { DownloadOutlined, FileMarkdownOutlined, FileOutlined, FileTextOutlined, PartitionOutlined, CodeOutlined } from '@ant-design/icons';
import {
  ArtifactKind,
  downloadProjectArchive,
  useOoadMetrics,
  useProjectFile,
  useProjectFiles,
  useQualityGates,
} from '../../lib/api/hooks/artifacts';
import { buildFileTree, defaultFile, FileTreeNode, folderKeys, formatSize } from './fileTree';
import { latestGates, GateView, WarningView } from './qualityGate';
import { ArtifactViewer } from './ArtifactViewer';
import { OoadSummary, QualityGateList, QualityWarnings } from './QualityPanel';

const { Text } = Typography;

const KIND_ICONS: Record<ArtifactKind, React.ReactNode> = {
  markdown: <FileMarkdownOutlined style={{ color: '#1677ff' }} />,
  plantuml: <PartitionOutlined style={{ color: '#a371f7' }} />,
  code: <CodeOutlined style={{ color: '#fa8c16' }} />,
  json: <FileTextOutlined style={{ color: '#52c41a' }} />,
  text: <FileOutlined style={{ color: '#8b949e' }} />,
};

const toTreeData = (nodes: FileTreeNode[]): any[] =>
  nodes.map(n => ({
    key: n.key,
    title: n.isLeaf ? (
      <span>
        <Text style={{ color: '#c9d1d9' }}>{n.title}</Text>
        <Text style={{ color: '#484f58', fontSize: 11, marginLeft: 6 }}>{formatSize(n.size || 0)}</Text>
      </span>
    ) : (
      <Text style={{ color: '#e6edf3' }}>{n.title}</Text>
    ),
    icon: n.isLeaf ? KIND_ICONS[n.kind || 'text'] : undefined,
    isLeaf: n.isLeaf,
    selectable: n.isLeaf,
    children: n.children ? toTreeData(n.children) : undefined,
  }));

interface Props {
  projectId: string;
  projectName: string;
  liveGates: GateView[];
  liveWarnings: WarningView[];
}

/**
 * Artifacts tab (Phase 3, Task 13): everything the agents generated for the project, i.e. the
 * use cases, diagrams, code, tests and traceability matrix, plus the quality gate checklist,
 * QC warnings and the OOAD summary.
 */
export const ArtifactsTab: React.FC<Props> = ({ projectId, projectName, liveGates, liveWarnings }) => {
  const { data, isLoading } = useProjectFiles(projectId);
  const { data: gateHistory = [] } = useQualityGates(projectId);
  const { data: metrics } = useOoadMetrics(projectId);
  const files = data?.files || [];
  const [selected, setSelected] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const fileQuery = useProjectFile(projectId, selected);

  const tree = useMemo(() => buildFileTree(files), [files]);
  const treeData = useMemo(() => toTreeData(tree), [tree]);
  const gates = useMemo(() => latestGates(gateHistory, liveGates), [gateHistory, liveGates]);

  useEffect(() => {
    if (!selected || !files.some(f => f.path === selected)) setSelected(defaultFile(files));
  }, [files, selected]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadProjectArchive(projectId, `${projectName || projectId}.zip`);
    } catch {
      message.error('Could not download the project archive');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <QualityWarnings warnings={liveWarnings} />
      <OoadSummary metrics={metrics} />
      <QualityGateList gates={gates} />

      {isLoading ? (
        <Spin />
      ) : files.length === 0 ? (
        <Empty description={<Text style={{ color: '#8b949e' }}>No generated files yet. The BA and Architect write them in the first workflow steps.</Text>} />
      ) : (
        <Row gutter={16}>
          <Col xs={24} md={8} lg={7}>
            <Card
              size="small"
              style={{ background: '#161b22', border: '1px solid #30363d' }}
              title={<Text style={{ color: '#e6edf3' }}>{files.length} files · {formatSize(data?.totalSize || 0)}</Text>}
              extra={<Button size="small" icon={<DownloadOutlined />} loading={downloading} onClick={download}>Download zip</Button>}
            >
              <Tree
                showIcon
                blockNode
                defaultExpandedKeys={folderKeys(tree)}
                selectedKeys={selected ? [selected] : []}
                onSelect={keys => keys[0] && setSelected(String(keys[0]))}
                treeData={treeData}
                style={{ background: 'transparent', maxHeight: 640, overflow: 'auto' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={16} lg={17}>
            <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d', minHeight: 300 }}>
              <ArtifactViewer file={fileQuery.data} loading={fileQuery.isLoading && !!selected} error={fileQuery.error} />
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  );
};
