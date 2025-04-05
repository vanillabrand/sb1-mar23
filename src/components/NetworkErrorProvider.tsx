import React, { useState, useEffect } from 'react';
import { NetworkErrorModal } from './NetworkErrorModal';
import { networkErrorHandler } from '../lib/network-error-handler';
import { exchangeService } from '../lib/exchange-service';

interface NetworkErrorProviderProps {
  children: React.ReactNode;
}

export function NetworkErrorProvider({ children }: NetworkErrorProviderProps) {
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Add listener for network errors
    const handleNetworkError = (error: Error) => {
      setErrorMessage(error.message);
      setIsErrorModalOpen(true);
      networkErrorHandler.setModalOpen(true);
    };

    networkErrorHandler.addListener(handleNetworkError);

    // Clean up listener on unmount
    return () => {
      networkErrorHandler.removeListener(handleNetworkError);
    };
  }, []);

  const handleCloseModal = () => {
    setIsErrorModalOpen(false);
    networkErrorHandler.setModalOpen(false);
    networkErrorHandler.clearLastError();
  };

  const handleRetry = async () => {
    try {
      // Check if we have an active exchange
      const activeExchange = await exchangeService.getActiveExchange();
      if (activeExchange) {
        // Try to reconnect
        await exchangeService.connect(activeExchange);
        setIsErrorModalOpen(false);
        networkErrorHandler.setModalOpen(false);
        networkErrorHandler.clearLastError();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Retry failed:', error);
      return false;
    }
  };

  return (
    <>
      {children}
      <NetworkErrorModal
        isOpen={isErrorModalOpen}
        onClose={handleCloseModal}
        onRetry={handleRetry}
        errorMessage={errorMessage}
      />
    </>
  );
}
