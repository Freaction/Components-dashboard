import React from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'violet' | 'slate' | 'blue';
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  style,
  onClick
}) => {
  return (
    <span 
      className={`${styles.badge} ${styles[variant]} ${className}`} 
      style={style}
      onClick={onClick}
    >
      {children}
    </span>
  );
};
