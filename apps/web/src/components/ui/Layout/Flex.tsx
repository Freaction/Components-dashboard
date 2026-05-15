import React from 'react';

interface FlexProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  gap?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const Flex: React.FC<FlexProps> = ({ 
  children, 
  direction = 'row', 
  align = 'stretch', 
  justify = 'flex-start',
  gap = 0,
  className = '',
  style
}) => {
  const flexStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    gap: typeof gap === 'number' ? `var(--space-${gap})` : gap,
    ...style
  };

  return (
    <div className={className} style={flexStyle}>
      {children}
    </div>
  );
};
