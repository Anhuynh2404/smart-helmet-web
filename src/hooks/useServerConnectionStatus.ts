import { useEffect, useRef, useState } from 'react';
import { reconnectFirebaseDatabase } from '../services/firebaseService';

export interface ServerConnectionStatus {
  isServerDisconnected: boolean;
  browserOnline: boolean;
  firebaseConnected: boolean;
  showReconnectedNotice: boolean;
  dismissReconnectedNotice: () => void;
}

/**
 * Giám sát kết nối mạng trình duyệt (`navigator.onLine` + events `online`/`offline`)
 * kết hợp kết nối WebSocket của Firebase Realtime Database (`.info/connected`).
 * - Phát hiện ngay lập tức khi mất mạng hoặc mất kết nối tới máy chủ Firebase.
 * - Tự động gọi `reconnectFirebaseDatabase()` và bật thông báo xanh "Đã kết nối lại" khi có mạng trở lại.
 */
export function useServerConnectionStatus(
  firebaseConnected: boolean
): ServerConnectionStatus {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [initialGraceFinished, setInitialGraceFinished] =
    useState<boolean>(false);
  const [showReconnectedNotice, setShowReconnectedNotice] =
    useState<boolean>(false);

  const hasEverConnectedRef = useRef<boolean>(false);
  const wasDisconnectedRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Lắng nghe sự kiện mất mạng / có mạng của trình duyệt (DevTools Offline hoặc rớt Wi-Fi)
  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      reconnectFirebaseDatabase();
    };
    const handleOffline = () => {
      setBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Thời gian chờ khởi tạo WebSocket ban đầu (3 giây) để tránh nháy cảnh báo lúc mới F5 trang
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialGraceFinished(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (browserOnline && firebaseConnected) {
    hasEverConnectedRef.current = true;
  }

  // Mất kết nối khi trình duyệt mất mạng HOẶC kết nối Firebase bị đứt sau khi đã kết nối (hoặc quá thời gian khởi tạo)
  const isServerDisconnected =
    !browserOnline ||
    (!firebaseConnected &&
      (hasEverConnectedRef.current || initialGraceFinished));

  // 3. Phát hiện thời điểm khôi phục kết nối (Auto-reconnect: từ Disconnected -> Connected)
  useEffect(() => {
    if (isServerDisconnected) {
      wasDisconnectedRef.current = true;
      setShowReconnectedNotice(false);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    } else if (wasDisconnectedRef.current && browserOnline && firebaseConnected) {
      wasDisconnectedRef.current = false;
      reconnectFirebaseDatabase();
      setShowReconnectedNotice(true);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = setTimeout(() => {
        setShowReconnectedNotice(false);
      }, 4500);
    }
  }, [isServerDisconnected, browserOnline, firebaseConnected]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return {
    isServerDisconnected,
    browserOnline,
    firebaseConnected,
    showReconnectedNotice,
    dismissReconnectedNotice: () => setShowReconnectedNotice(false),
  };
}
