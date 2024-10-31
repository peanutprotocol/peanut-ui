"use client"

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
}

interface ToastMessage extends ToastOptions {
  id: number;
}

interface ToastContextType {
  toast: (options: ToastOptions | string) => void;
  success: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => void;
  error: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => void;
  info: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => void;
  warning: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const Toast: React.FC<ToastMessage> = ({ type = 'info', message }) => {
  const colors = {
    success: 'border-green-500 ',
    error: 'border-red-500 ',
    info: 'border-blue-500 ',
    warning: 'border-yellow-500 ',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={twMerge(
        `px-6 py-1 border-2`,
        "card shadow-primary-4",
        colors[type],
      )}
    >
      <p className="text-sm font-bold">
        {message}
      </p>
    </motion.div>
  );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const createToast = useCallback((options: ToastOptions | string) => {
    const defaults: Partial<ToastOptions> = {
      type: 'info',
      duration: 3000,
      position: 'top-right',
    };

    const toastOptions = typeof options === 'string'
      ? { message: options }
      : options;

    const toast = {
      ...defaults,
      ...toastOptions,
      id: Date.now(),
    };

    setToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, toast.duration);
  }, []);

  const contextValue: ToastContextType = {
    toast: createToast,
    success: (message, options) => createToast({ ...options, type: 'success', message }),
    error: (message, options) => createToast({ ...options, type: 'error', message }),
    info: (message, options) => createToast({ ...options, type: 'info', message }),
    warning: (message, options) => createToast({ ...options, type: 'warning', message }),
  };

  const getPositionClasses = (position: ToastPosition = 'top-right') => {
    const positions: Record<ToastPosition, string> = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
    };
    return positions[position];
  };

  return (
    <>
      <ToastContext.Provider value={contextValue}>
        <div className={`fixed z-50 flex flex-col gap-2 ${getPositionClasses('top-right')}`}>
          <AnimatePresence mode="sync">
            {toasts.map((toast) => (
              <Toast key={toast.id} {...toast} />
            ))}
          </AnimatePresence>
        </div>
        {children}
      </ToastContext.Provider>
    </>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
