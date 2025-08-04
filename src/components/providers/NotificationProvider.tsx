'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useDeviceToken } from '@/hooks/useDeviceToken';
import { NotificationPermissionModal } from '@/components/domain/notifications/NotificationPermissionModal';

interface NotificationContextType {
  hasRequestedPermission: boolean;
  shouldShowPermissionModal: boolean;
  requestPermission: () => void;
  dismissPermissionModal: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
  autoRequest?: boolean;
  delay?: number; // 권한 요청 지연 시간 (ms)
}

export function NotificationProvider({ 
  children, 
  autoRequest = true, 
  delay = 3000 
}: NotificationProviderProps) {
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [shouldShowPermissionModal, setShouldShowPermissionModal] = useState(false);
  const [hasShownAutoRequest, setHasShownAutoRequest] = useState(false);

  const { 
    isSupported, 
    permission, 
    token, 
    requestPermission: requestDevicePermission 
  } = useDeviceToken();

  // 자동 권한 요청
  useEffect(() => {
    if (!autoRequest || hasShownAutoRequest || !isSupported) {
      return;
    }

    const timer = setTimeout(() => {
      // 권한이 아직 요청되지 않았고, 사용자가 로그인되어 있다면 권한 요청
      if (permission === 'default') {
        setShouldShowPermissionModal(true);
        setHasShownAutoRequest(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [autoRequest, hasShownAutoRequest, isSupported, permission, delay]);

  // 권한 상태 변경 감지
  useEffect(() => {
    if (permission !== 'default') {
      setHasRequestedPermission(true);
    }
  }, [permission]);

  const requestPermission = () => {
    setShouldShowPermissionModal(true);
  };

  const dismissPermissionModal = () => {
    setShouldShowPermissionModal(false);
  };

  const handlePermissionGranted = () => {
    setHasRequestedPermission(true);
    setShouldShowPermissionModal(false);
    
    // 토큰 자동 등록 시도
    if (permission === 'granted' && !token) {
      // useDeviceToken의 자동 등록 로직이 처리함
      console.log('알림 권한이 허용되었습니다. 토큰 등록을 시도합니다.');
    }
  };

  const handlePermissionDenied = () => {
    setHasRequestedPermission(true);
    setShouldShowPermissionModal(false);
    console.log('알림 권한이 거부되었습니다.');
  };

  const contextValue: NotificationContextType = {
    hasRequestedPermission,
    shouldShowPermissionModal,
    requestPermission,
    dismissPermissionModal,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      <NotificationPermissionModal
        isOpen={shouldShowPermissionModal}
        onClose={dismissPermissionModal}
        onPermissionGranted={handlePermissionGranted}
        onPermissionDenied={handlePermissionDenied}
      />
    </NotificationContext.Provider>
  );
} 