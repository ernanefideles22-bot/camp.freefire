import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  const { id, type, title, description } = message;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000); // Auto close after 4 seconds

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const config = {
    success: {
      bg: 'bg-zinc-950/95 border-emerald-500/50',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    },
    error: {
      bg: 'bg-zinc-950/95 border-rose-500/50',
      icon: <XCircle className="w-5 h-5 text-rose-400" />,
      glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    },
    warning: {
      bg: 'bg-zinc-950/95 border-amber-500/50',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    },
    info: {
      bg: 'bg-zinc-950/95 border-accent-cyan/50',
      icon: <Info className="w-5 h-5 text-accent-cyan" />,
      glow: 'shadow-[0_0_15px_rgba(0,240,255,0.15)]',
    },
  }[type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border ${config.bg} ${config.glow} text-zinc-100 backdrop-blur-md animate-in slide-in-from-right duration-350 max-w-sm w-full`}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-grow">
        <h4 className="font-semibold text-sm leading-tight text-white">{title}</h4>
        {description && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{description}</p>}
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 p-0.5 rounded-lg hover:bg-zinc-900 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  messages: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ messages, onClose }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-full max-w-xs md:max-w-sm px-4 md:px-0">
      {messages.map((message) => (
        <Toast key={message.id} message={message} onClose={onClose} />
      ))}
    </div>
  );
};
