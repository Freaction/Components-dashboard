import React from 'react';
import { MousePointer2 } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <MousePointer2 size={48} />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};
