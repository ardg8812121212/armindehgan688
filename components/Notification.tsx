import React, { useEffect, useState } from 'react';
import { Notification as NotificationType } from '../types';

interface Props {
  notification: NotificationType | null;
  onClose: () => void;
}

const Notification: React.FC<Props> = ({ notification, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        handleClose();
      }, 5000); // Auto close after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleClose = () => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for animation to finish
  };

  if (!notification && !visible) return null;

  const bgColors = {
    error: 'bg-gradient-to-r from-red-600/90 to-red-800/90 border-red-500/50 shadow-red-900/20',
    success: 'bg-gradient-to-r from-emerald-600/90 to-emerald-800/90 border-emerald-500/50 shadow-emerald-900/20',
    info: 'bg-gradient-to-r from-blue-600/90 to-blue-800/90 border-blue-500/50 shadow-blue-900/20',
  };

  const icons = {
    error: (
        <div className="bg-red-500/20 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
        </div>
    ),
    success: (
        <div className="bg-emerald-500/20 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
    ),
    info: (
        <div className="bg-blue-500/20 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
        </div>
    )
  };

  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] min-w-[320px] max-w-md w-full px-4 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className={`flex items-center gap-4 p-3 pr-4 rounded-2xl shadow-2xl backdrop-blur-xl border text-white ${notification ? bgColors[notification.type] : ''}`}>
            <div className="flex-shrink-0">
                {notification && icons[notification.type]}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-base mb-0.5 tracking-tight">
                    {notification?.type === 'error' ? 'خطا' : notification?.type === 'success' ? 'موفقیت' : 'اطلاعیه'}
                </h4>
                <p className="text-xs font-medium text-white/90 leading-relaxed break-words">
                    {notification?.message}
                </p>
            </div>
            <button 
                onClick={handleClose} 
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white/70 hover:text-white"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    </div>
  );
};

export default Notification;