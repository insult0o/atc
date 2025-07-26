'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationToastProps {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const STYLES = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800'
};

const ICON_STYLES = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600'
};

export function NotificationToast({
  id,
  type,
  title,
  message,
  duration = 5000,
  onDismiss
}: NotificationToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const Icon = ICONS[type];
  
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration]);
  
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(id);
    }, 300);
  };
  
  return (
    <div
      className={`
        notification-toast flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transition-all duration-300 transform
        ${STYLES[type]}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_STYLES[type]}`} />
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium">{title}</h4>
        {message && (
          <p className="text-sm mt-1 opacity-90">{message}</p>
        )}
      </div>
      
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 ml-4 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface NotificationContainerProps {
  notifications: Array<{
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    duration?: number;
  }>;
  onDismiss: (id: string) => void;
}

export function NotificationContainer({ 
  notifications, 
  onDismiss 
}: NotificationContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          {...notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}