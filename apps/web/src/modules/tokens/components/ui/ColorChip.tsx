import React from 'react';
import './ColorChip.css';

interface ColorChipProps {
  color: string | null;
  size?: number;
  className?: string;
}

export const ColorChip: React.FC<ColorChipProps> = ({ color, size = 24, className = '' }) => {
  if (!color) return null;

  return (
    <div 
      className={`color-chip-container ${className}`} 
      style={{ width: size, height: size }}
    >
      <div className="color-chip-checkerboard" />
      <div className="color-chip-value" style={{ backgroundColor: color }} />
    </div>
  );
};
