import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

/** Any URL the app has no page for (it used to render an empty layout) */
export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="This page does not exist, or the link is out of date."
      extra={<Button type="primary" onClick={() => navigate('/')}>Back to Dashboard</Button>}
    />
  );
};
