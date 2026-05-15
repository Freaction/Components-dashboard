import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import styles from './Select.module.css';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | string[];
  onChange: (value: any) => void;
  placeholder?: string;
  multiSelect?: boolean;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  multiSelect = false,
  fullWidth = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter((v) => v !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const isSelected = (optionValue: string) => {
    if (multiSelect) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  const getDisplayValue = () => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.length === 0) return placeholder;
      if (currentValues.length === 1) {
        return options.find((o) => o.value === currentValues[0])?.label || placeholder;
      }
      return `${currentValues.length} selected`;
    }
    const selectedOption = options.find((o) => o.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  };

  return (
    <div 
      className={`${styles.container} ${fullWidth ? styles.fullWidth : ''}`} 
      ref={containerRef}
    >
      <button 
        type="button"
        className={styles.trigger} 
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.value}>{getDisplayValue()}</span>
        <ChevronDown size={16} strokeWidth={1.2} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {options.map((option) => (
            <div
              key={option.value}
              className={`${styles.option} ${isSelected(option.value) ? styles.optionSelected : ''}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={isSelected(option.value)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              {isSelected(option.value) && (
                <Check size={14} strokeWidth={2.0} className={styles.checkmark} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
