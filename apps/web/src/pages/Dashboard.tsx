import React, { useState } from 'react';
import { Typography, Row, Col, Card, Statistic, Button, Empty, Skeleton, Tag, Progress, Space, Flex, Modal, Form, Input, InputNumber, message, Tabs, Dropdown } from 'antd';
import {
  PlusOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  BarChartOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  StopOutlined,
  MoreOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useProjects, useCreateProject, useDeleteProject, useUpdateProject } from '../lib/api/hooks/projects';
import { useProjectStore } from '../stores/projectStore';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus } from '@ai-corp/shared-types';
import { CostDashboard } from '../components/cost/CostDashboard';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_CONFIG: Record<ProjectStatus, { color: string; icon: React.ReactNode; label: string }> = {
  [ProjectStatus.ACTIVE]: { color: 'blue', icon: <SyncOutlined spin />, label: 'Active' },
  [ProjectStatus.COMPLETED]: { color: 'green', icon: <CheckCircleOutlined />, label: 'Completed' },
  [ProjectStatus.PAUSED]: { color: 'orange', icon: <ClockCircleOutlined />, label: 'Paused' },
  [ProjectStatus.CANCELLED]: { color: 'red', icon: <ClockCircleOutlined />, label: 'Cancelled' },
};

const ProjectCard: React.FC<{
  project: Project;
  onClick: () => void;
  onDelete?: (id: string, name: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}> = ({ project, onClick, onDelete, onPause, onResume }) => {
  const statusCfg = STATUS_CONFIG[project.status] ?? { color: 'default', icon: null, label: project.status };

  const menuItems = [
    project.status === 'active' && {
      key: 'pause',
      icon: <PauseCircleOutlined />,
      label: 'Pause',
      onClick: (e: any) => { e.domEvent.stopPropagation(); onPause?.(project.id); },
    },
    project.status === 'paused' && {
      key: 'resume',
      icon: <PlayCircleOutlined />,
      label: 'Resume',
      onClick: (e: any) => { e.domEvent.stopPropagation(); onResume?.(project.id); },
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      onClick: (e: any) => { e.domEvent.stopPropagation(); onDelete?.(project.id, project.name); },
    },
  ].filter(Boolean);

  // Calculate progress based on workflow status if available
  const workflowRun = project.workflowRuns?.[0];
  let workflowProgress = 0;
  let progressLabel = 'Starting...';
  
  if (workflowRun) {
    // Map workflow status to progress
    if (workflowRun.status === 'completed') {
      workflowProgress = 100;
      progressLabel = 'Completed';
    } else if (workflowRun.status === 'failed') {
      workflowProgress = 50;
      progressLabel = 'Failed';
    } else if (workflowRun.status === 'paused') {
      workflowProgress = 75;
      progressLabel = 'Paused';
    } else {
      // running - estimate based on current node
      const nodes = ['start', 'breakdown', 'develop', 'review', 'market', 'approval', 'end'];
      const nodeIndex = nodes.indexOf(workflowRun.currentNodeId || 'start');
      workflowProgress = nodeIndex >= 0 ? Math.round((nodeIndex / nodes.length) * 100) : 25;
      progressLabel = `Running: ${workflowRun.currentNodeId || 'start'}`;
    }
  } else {
    // Fallback: calculate progress based on cost/budget if available
    if (project.budget != null && project.budget > 0) {
      workflowProgress = Math.min(100, Math.round((Number(project.costAccrued ?? 0) / Number(project.budget ?? 1)) * 100));
      progressLabel = `${workflowProgress}% of budget`;
    }
  }

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="start" style={{ width: '100%' }}>
          <Title level={5} style={{ color: '#e6edf3', margin: 0 }}>
            {project.name}
          </Title>
          <Space>
            <Tag color={statusCfg.color} icon={statusCfg.icon}>
              {statusCfg.label}
            </Tag>
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
            </Dropdown>
          </Space>
        </Flex>

        <Paragraph
          ellipsis={{ rows: 2 }}
          style={{ color: '#8b949e', margin: 0, fontSize: 13 }}
        >
          {project.description || 'No description provided.'}
        </Paragraph>

        <div>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Progress: {progressLabel}</Text>
          <Progress
            percent={workflowProgress}
            strokeColor={workflowProgress >= 100 ? '#52c41a' : workflowProgress >= 50 ? { from: '#1677ff', to: '#722ed1' } : '#ff4d4f'}
            trailColor="#21262d"
            size="small"
            style={{ marginTop: 4 }}
          />
        </div>

        <Flex style={{ width: '100%' }} justify="space-between">
          {project.budget != null && (
            <Statistic
              title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Budget</Text>}
              value={project.budget}
              prefix="$"
              valueStyle={{ color: '#58a6ff', fontSize: 16 }}
            />
          )}
          <Statistic
            title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Cost</Text>}
            value={Number(project.costAccrued ?? 0)}
            prefix={<DollarOutlined style={{ color: Number(project.costAccrued ?? 0) > Number(project.budget ?? Infinity) ? '#ff4d4f' : '#8b949e' }} />}
            valueStyle={{ color: Number(project.costAccrued ?? 0) > Number(project.budget ?? Infinity) ? '#ff4d4f' : '#e6edf3', fontSize: 16 }}
          />
        </Flex>
      </Space>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const { setSelectedProject } = useProjectStore();
  const navigate = useNavigate();

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    navigate(`/projects/${project.id}`);
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    Modal.confirm({
      title: 'Delete Project',
      content: `Are you sure you want to delete "${projectName}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteProject.mutateAsync(projectId);
          message.success('Project deleted successfully!');
        } catch (error) {
          message.error('Failed to delete project.');
        }
      },
    });
  };

  const handlePauseProject = async (projectId: string) => {
    try {
      await updateProject.mutateAsync({ id: projectId, status: 'paused' });
      message.success('Project paused!');
    } catch (error) {
      message.error('Failed to pause project.');
    }
  };

  const handleResumeProject = async (projectId: string) => {
    try {
      await updateProject.mutateAsync({ id: projectId, status: 'active' });
      message.success('Project resumed!');
    } catch (error) {
      message.error('Failed to resume project.');
    }
  };

  const handleCreateProject = async (values: { name: string; description: string; goal: string; budget?: number }) => {
    try {
      await createProject.mutateAsync(values);
      message.success('Project created successfully!');
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('Create project error:', error);
      message.error('Failed to create project. Please try again.');
    }
  };

  const activeCount = projects?.filter((p) => p.status === ProjectStatus.ACTIVE).length ?? 0;
  const completedCount = projects?.filter((p) => p.status === ProjectStatus.COMPLETED).length ?? 0;

  // Calculate total cost across all projects (handle Prisma Decimal as string)
  const totalCost = projects?.reduce((sum, p) => sum + Number(p.costAccrued ?? 0), 0) ?? 0;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <Flex justify="space-between" align="center" style={{ width: '100%', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ color: '#e6edf3', margin: 0 }}>
            Dashboard
          </Title>
          <Text style={{ color: '#8b949e' }}>
            Manage your AI-powered projects and agents.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => setIsModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
            border: 'none',
            borderRadius: 8,
          }}
        >
          New Project
        </Button>
      </Flex>

      {/* Create Project Modal */}
      <Modal
        title={<Title level={4} style={{ color: '#e6edf3', margin: 0 }}>Create New Project</Title>}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
        styles={{
          content: { background: '#161b22', border: '1px solid #30363d' },
          header: { background: '#161b22', borderBottom: '1px solid #30363d' },
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProject}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="name"
            label={<Text style={{ color: '#8b949e' }}>Project Name</Text>}
            rules={[
              { required: true, message: 'Please enter a project name' },
              { min: 3, message: 'Name must be at least 3 characters' },
            ]}
          >
            <Input placeholder="e.g., E-commerce Platform" style={{ background: '#0d1117', borderColor: '#30363d' }} />
          </Form.Item>

          <Form.Item
            name="description"
            label={<Text style={{ color: '#8b949e' }}>Description</Text>}
            rules={[{ required: true, message: 'Please enter a description' }]}
          >
            <TextArea
              rows={3}
              placeholder="Brief description of what you want to build..."
              style={{ background: '#0d1117', borderColor: '#30363d' }}
            />
          </Form.Item>

          <Form.Item
            name="goal"
            label={<Text style={{ color: '#8b949e' }}>Goal</Text>}
            rules={[
              { required: true, message: 'Please enter the project goal' },
              { min: 20, message: 'Goal should be at least 20 characters' },
            ]}
          >
            <TextArea
              rows={5}
              placeholder="Describe the goal in detail. What should the AI agents accomplish?"
              style={{ background: '#0d1117', borderColor: '#30363d' }}
            />
          </Form.Item>

          <Form.Item
            name="budget"
            label={<Text style={{ color: '#8b949e' }}>Budget (optional)</Text>}
            rules={[
              { type: 'number', min: 1, message: 'Budget must be a positive number' },
            ]}
          >
            <InputNumber
              prefix="$"
              placeholder="0.00"
              style={{ width: '100%', background: '#0d1117', borderColor: '#30363d' }}
              min={0}
              precision={2}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setIsModalOpen(false);
                  form.resetFields();
                }}
                style={{ borderColor: '#30363d' }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createProject.isPending}
                style={{
                  background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                  border: 'none',
                }}
              >
                Create Project
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Space>
              <div
                style={{
                  background: '#1677ff22',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 20,
                  color: '#1677ff',
                }}
              >
                <RocketOutlined />
              </div>
              <Statistic
                title={<Text style={{ color: '#8b949e' }}>Total Projects</Text>}
                value={projects?.length ?? 0}
                valueStyle={{ color: '#e6edf3' }}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Space>
              <div
                style={{
                  background: '#52c41a22',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 20,
                  color: '#52c41a',
                }}
              >
                <SyncOutlined spin />
              </div>
              <Statistic
                title={<Text style={{ color: '#8b949e' }}>Active</Text>}
                value={activeCount}
                valueStyle={{ color: '#e6edf3' }}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Space>
              <div
                style={{
                  background: '#722ed122',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 20,
                  color: '#722ed1',
                }}
              >
                <CheckCircleOutlined />
              </div>
              <Statistic
                title={<Text style={{ color: '#8b949e' }}>Completed</Text>}
                value={completedCount}
                valueStyle={{ color: '#e6edf3' }}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Space>
              <div
                style={{
                  background: '#faad1422',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 20,
                  color: '#faad14',
                }}
              >
                <DollarOutlined />
              </div>
              <Statistic
                title={<Text style={{ color: '#8b949e' }}>Total Cost</Text>}
                value={totalCost}
                prefix="$"
                valueStyle={{ color: '#e6edf3' }}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Projects + Analytics Tabs */}
      <Tabs
        defaultActiveKey="projects"
        items={[
          {
            key: 'projects',
            label: (
              <Space>
                <RocketOutlined />
                Projects
              </Space>
            ),
            children: isLoading ? (
              <Row gutter={[16, 16]}>
                {[1, 2, 3].map((i) => (
                  <Col xs={24} md={12} xl={8} key={i}>
                    <Card style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}>
                      <Skeleton active />
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : !projects?.length ? (
              <Card style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, textAlign: 'center' }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<Text style={{ color: '#8b949e' }}>No projects yet. Create one to get started!</Text>}
                />
              </Card>
            ) : (
              <Row gutter={[16, 16]}>
                {projects.map((project) => (
                  <Col xs={24} md={12} xl={8} key={project.id}>
                    <ProjectCard
                      project={project}
                      onClick={() => handleProjectClick(project)}
                      onDelete={handleDeleteProject}
                      onPause={handlePauseProject}
                      onResume={handleResumeProject}
                    />
                  </Col>
                ))}
              </Row>
            ),
          },
          {
            key: 'analytics',
            label: (
              <Space>
                <BarChartOutlined />
                Cost Analytics
              </Space>
            ),
            children: <CostDashboard />,
          },
        ]}
      />
    </div>
  );
};
