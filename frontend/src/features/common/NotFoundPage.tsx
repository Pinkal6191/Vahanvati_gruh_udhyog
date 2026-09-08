import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import './common-pages.css';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="common-page-container">
      <Card className="common-page-card">
        <div className="common-page-icon notfound-icon">
          <HelpCircle size={48} />
        </div>
        <h1 className="common-page-title">Page Not Found</h1>
        <p className="common-page-desc">
          The page or resource you are looking for does not exist or may have been moved.
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
