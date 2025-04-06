import React from 'react';
import { useMobileDetect } from '../../hooks/useMobileDetect';

interface MobileFormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  required?: boolean;
}

export function MobileFormField({ 
  label, 
  htmlFor, 
  error, 
  className = '', 
  children,
  required = false
}: MobileFormFieldProps) {
  const { isMobile } = useMobileDetect();
  
  return (
    <div className={`${isMobile ? 'mobile-form-group' : 'mb-4'} ${className}`}>
      <label 
        htmlFor={htmlFor} 
        className={`${isMobile ? 'mobile-form-label' : 'block text-sm font-medium text-gray-300 mb-1'}`}
      >
        {label}
        {required && <span className="text-neon-raspberry ml-1">*</span>}
      </label>
      
      {children}
      
      {error && (
        <p className="mt-1 text-xs text-neon-raspberry">
          {error}
        </p>
      )}
    </div>
  );
}
