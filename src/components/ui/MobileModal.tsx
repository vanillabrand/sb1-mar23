import React from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileDetect } from '../../hooks/useMobileDetect';

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileModal({ isOpen, onClose, title, children, className = '' }: MobileModalProps) {
  const { isMobile } = useMobileDetect();

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          as={motion.div}
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal container - adjusted to stay within main content area */}
          <div className="fixed inset-0 flex items-center justify-center p-4 mobile-modal-container">
            <Dialog.Panel
              as={motion.div}
              className={`${isMobile ? 'mobile-modal w-full max-w-full' : 'w-full max-w-md'} modal-dark-metal ${className}`}
              initial={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
              animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1 }}
              exit={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b-0">
                <Dialog.Title className="text-lg font-medium text-gray-200">
                  {title}
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full text-gray-400 hover:text-white focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {children}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
