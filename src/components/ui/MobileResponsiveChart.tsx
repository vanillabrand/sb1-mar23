import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { useMobileDetect } from '../../hooks/useMobileDetect';

interface MobileResponsiveChartProps {
  children: React.ReactNode;
  height?: number | string;
  mobileHeight?: number | string;
  className?: string;
}

export function MobileResponsiveChart({ 
  children, 
  height = 300, 
  mobileHeight = 200,
  className = '' 
}: MobileResponsiveChartProps) {
  const { isMobile } = useMobileDetect();
  
  return (
    <div 
      className={`w-full ${className}`} 
      style={{ 
        height: isMobile ? mobileHeight : height 
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
