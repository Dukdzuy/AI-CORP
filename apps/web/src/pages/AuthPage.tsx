import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api/client';

const { Title, Text } = Typography;

export const AuthPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', values);
      setAuth(res.data.accessToken, res.data.user);
      message.success('Login successful!');
      navigate('/');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { email: string; name: string; password: string }) => {
    setLoading(true);
    try {
      await apiClient.post('/auth/register', values);
      message.success('Registration successful! Please login.');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
      }}
    >
      <Card
        style={{
          width: 420,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 12,
        }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ color: '#e6edf3', margin: 0 }}>
              AI Corp Platform
            </Title>
            <Text style={{ color: '#8b949e' }}>Sign in to your workspace</Text>
          </div>

          <Tabs
            defaultActiveKey="login"
            centered
            items={[
              {
                key: 'login',
                label: 'Login',
                children: (
                  <Form onFinish={handleLogin} layout="vertical" size="large">
                    <Form.Item
                      name="email"
                      rules={[{ required: true, message: 'Please enter your email' }]}
                    >
                      <Input
                        prefix={<MailOutlined style={{ color: '#8b949e' }} />}
                        placeholder="Email"
                        style={{ background: '#0d1117', borderColor: '#30363d' }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      rules={[{ required: true, message: 'Please enter your password' }]}
                    >
                      <Input.Password
                        prefix={<LockOutlined style={{ color: '#8b949e' }} />}
                        placeholder="Password"
                        style={{ background: '#0d1117', borderColor: '#30363d' }}
                      />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        block
                        style={{
                          background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                          border: 'none',
                          borderRadius: 8,
                          height: 44,
                        }}
                      >
                        Sign In
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
              {
                key: 'register',
                label: 'Register',
                children: (
                  <Form onFinish={handleRegister} layout="vertical" size="large">
                    <Form.Item
                      name="name"
                      rules={[{ required: true, message: 'Please enter your name' }]}
                    >
                      <Input
                        prefix={<UserOutlined style={{ color: '#8b949e' }} />}
                        placeholder="Full Name"
                        style={{ background: '#0d1117', borderColor: '#30363d' }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="email"
                      rules={[
                        { required: true, message: 'Please enter your email' },
                        { type: 'email', message: 'Invalid email format' },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined style={{ color: '#8b949e' }} />}
                        placeholder="Email"
                        style={{ background: '#0d1117', borderColor: '#30363d' }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      rules={[
                        { required: true, message: 'Please enter a password' },
                        { min: 6, message: 'Password must be at least 6 characters' },
                      ]}
                    >
                      <Input.Password
                        prefix={<LockOutlined style={{ color: '#8b949e' }} />}
                        placeholder="Password"
                        style={{ background: '#0d1117', borderColor: '#30363d' }}
                      />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        block
                        style={{
                          background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                          border: 'none',
                          borderRadius: 8,
                          height: 44,
                        }}
                      >
                        Create Account
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
            ]}
          />
        </Space>
      </Card>
    </div>
  );
};
