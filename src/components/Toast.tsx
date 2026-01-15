import { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          background: 'rgba(0,255,159,0.15)',
          border: '1px solid rgba(0,255,159,0.4)',
          color: '#00ff9f',
        };
      case 'error':
        return {
          background: 'rgba(255,85,99,0.15)',
          border: '1px solid rgba(255,85,99,0.4)',
          color: '#ff5563',
        };
      case 'info':
      default:
        return {
          background: 'rgba(0,229,255,0.15)',
          border: '1px solid rgba(0,229,255,0.4)',
          color: '#00e5ff',
        };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '1rem 1.5rem',
        borderRadius: 'var(--radius-md)',
        ...getTypeStyles(),
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 9999,
        maxWidth: '400px',
        animation: 'slideIn 0.3s ease-out',
        fontWeight: 500,
      }}
    >
      {message}
    </div>
  );
}
