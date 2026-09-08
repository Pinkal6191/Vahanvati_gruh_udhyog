import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import './common-pages.css';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="common-page-container">
      <Card className="common-page-card">
        <div className="common-page-icon unauthorized-icon">
          <ShieldAlert size={48} />
        </div>
        <h1 className="common-page-title">Access Denied</h1>
        <p className="common-page-desc">
          You do not have administrative permission to view or interact with this section. If you believe this is an error, please contact your system administrator.
        </p>
        <div className="common-page-actions">
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            leftIcon={<LayoutDashboard size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};
