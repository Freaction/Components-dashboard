import React, { ButtonHTMLAttributes } from 'react';
import './Button.css';
import { MText } from './MText';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className, ...props }) => {
  // Для первичной кнопки (button-fill-primary) всегда используем text/on/primary
  const getTextToken = () => {
    switch (variant) {
      case 'primary': return 'text/on/primary';
      case 'secondary': return 'text/on/secondary';
      case 'ghost': return 'text/secondary';
      default: return 'text/base';
    }
  };

  return (
    <button className={`ui-button ui-button--${variant} ${className || ''}`} {...props}>
      <MText color={getTextToken() as any}>
        {children}
      </MText>
    </button>
  );
};
