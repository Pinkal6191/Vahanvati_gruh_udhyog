import React, { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import './Card.css';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  className,
  padding = 'md',
  ...props
}) => {
  return (
    <div className={cn('card', `card-pad-${padding}`, className)} {...props}>
      {(title || subtitle || action) && (
        <CardHeader title={title} subtitle={subtitle} action={action} />
      )}
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}> = ({ title, subtitle, action, className, children }) => {
  if (children) {
    return <div className={cn('card-header', className)}>{children}</div>;
  }
  return (
    <div className={cn('card-header', className)}>
      <div className="card-header-titles">
        {title && <h3 className="card-title">{title}</h3>}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="card-header-action">{action}</div>}
    </div>
  );
};

export const CardBody: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return <div className={cn('card-body', className)}>{children}</div>;
};

export const CardFooter: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return <div className={cn('card-footer', className)}>{children}</div>;
};
