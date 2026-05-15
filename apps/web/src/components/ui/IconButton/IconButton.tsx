import React from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton: React.FC<IconButtonProps> = ({ 
  icon, 
  size = 'md', 
  className = '',
  ...props 
}) => {
  const classes = [
    styles.iconButton,
    styles[size],
    className
  ].join(' ');

  return (
    <button className={classes} {...props}>
      {icon}
    </button>
  );
};
