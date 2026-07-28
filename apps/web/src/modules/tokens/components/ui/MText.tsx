import React from 'react';
import { useTokens } from '../../context/TokenContext';
import { resolveTokenValue, getDisplayColor } from '../../utils/tokens';

interface MTextProps {
  color?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const MText: React.FC<MTextProps> = ({ color, children, className = '', style = {} }) => {
  const { tokensData } = useTokens();
  
  // Если передан путь к токену, пытаемся его разрешить
  const resolvedValue = color ? resolveTokenValue(color, tokensData) : color;
  const displayColor = getDisplayColor(resolvedValue) || (typeof color === 'string' && !color.includes('/') ? color : undefined);

  const combinedStyle: React.CSSProperties = {
    ...style,
    color: displayColor || undefined
  };

  return (
    <span className={className} style={combinedStyle}>
      {children}
    </span>
  );
};
