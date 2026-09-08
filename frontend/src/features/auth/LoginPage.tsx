import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, ArrowRight, ShieldCheck, Store, ChefHat } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/forms/Input/Input';
import { Button } from '../../components/ui/Button/Button';
import { Alert } from '../../components/feedback/Alert/Alert';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    try {
      await login(username.trim(), password);
      addToast({
        title: 'Welcome Back',
        message: 'Successfully signed in to Vahanvati Gruh Udhyog.',
        variant: 'success',
      });
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid username or password.');
    }
  };

  const handleDemoFill = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <h2 className="login-title">Sign In</h2>
        <p className="login-subtitle">Enter your credentials to access your terminal</p>
      </div>

      {errorMessage && (
        <Alert
          variant="danger"
          title="Authentication Failed"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
          className="login-alert"
        />
      )}

      <form onSubmit={handleSubmit} className="login-form">
        <Input
          label="Username"
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. admin"
          isRequired
          leftIcon={<User size={18} />}
          autoComplete="username"
          autoFocus
        />

        <Input
          label="Password"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          isRequired
          leftIcon={<Lock size={18} />}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          rightIcon={<ArrowRight size={18} />}
          className="login-submit-btn"
        >
          Sign In to System
        </Button>
      </form>

      <div className="demo-accounts-card">
        <span className="demo-accounts-title">Quick Demo Login (Click to Fill):</span>
        <div className="demo-accounts-grid">
          <button
            type="button"
            className="demo-btn"
            onClick={() => handleDemoFill('admin', 'Admin@123')}
          >
            <ShieldCheck size={14} className="demo-icon admin-icon" />
            <div className="demo-btn-text">
              <strong>Admin</strong>
              <span>Full Access</span>
            </div>
          </button>

          <button
            type="button"
            className="demo-btn"
            onClick={() => handleDemoFill('outlet', 'Outlet@123')}
          >
            <Store size={14} className="demo-icon outlet-icon" />
            <div className="demo-btn-text">
              <strong>Outlet</strong>
              <span>Billing & Returns</span>
            </div>
          </button>

          <button
            type="button"
            className="demo-btn"
            onClick={() => handleDemoFill('production', 'Prod@123')}
          >
            <ChefHat size={14} className="demo-icon prod-icon" />
            <div className="demo-btn-text">
              <strong>Production</strong>
              <span>Batch Entries</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
