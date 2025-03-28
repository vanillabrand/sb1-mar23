import React from 'react';
import { Preloader } from './Preloader';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gunmetal-900 flex items-center justify-center">
      <Preloader />
    </div>
  );
};
