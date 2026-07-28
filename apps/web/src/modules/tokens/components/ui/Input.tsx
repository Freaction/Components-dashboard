import React, { InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = (props) => (
  <input className="ui-input" {...props} />
);
