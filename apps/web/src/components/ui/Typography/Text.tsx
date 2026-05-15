import React from 'react';

interface TextProps {
  children: React.ReactNode;
  variant?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success';
  className?: string;
  style?: React.CSSProperties;
}

export const Text: React.FC<TextProps> = ({ 
  children, 
  variant = 'base', 
  weight = 'normal', 
  color = 'primary',
  className = '',
  style
}) => {
  const styles: React.CSSProperties = {
    fontSize: `var(--text-${variant})`,
    fontWeight: `var(--font-${weight})`,
    color: `var(--color-text-${color})`,
    ...style
  };

  return (
    <span className={className} style={styles}>
      {children}
    </span>
  );
};
