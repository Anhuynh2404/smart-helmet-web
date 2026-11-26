import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  ArrowUpRight,
  Battery,
  BatteryWarning,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  LayoutGrid,
  Loader2,
  MapPin,
  Menu,
  Phone,
  User,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { AuthProfileView } from './components/AuthProfileView';
import {
  DashboardView,
  formatFriendlyDeviceName,
} from './components/DashboardView';
import { DeviceSettingsView } from './components/DeviceSettingsView';
import { EmergencyContactsView } from './components/EmergencyContactsView';
import { EventHistoryView } from './components/EventHistoryView';
import { GPSTrackingView } from './components/GPSTrackingView';
import { LoginGateView } from './components/LoginGateView';
import { useDeviceModeConfig } from './hooks/useDeviceModeConfig';
import { useEmergencyContacts } from './hooks/useEmergencyContacts';
import { useHelmetSosEvents } from './hooks/useHelmetSosEvents';
import {
  formatToVietnamTimezone,
  useHelmetTelemetry,
} from './hooks/useHelmetTelemetry';
import { useServerConnectionStatus } from './hooks/useServerConnectionStatus';
import { useSmartBatteryEstimator } from './hooks/useSmartBatteryEstimator';
import { useUserProfile } from './hooks/useUserProfile';
import {
  INITIAL_DEVICE_CONFIG,
  INITIAL_DEVICE_STATE,
  MOCK_USERS,
} from './mocks/mockData';
import {
  DEFAULT_HELMET_DEVICE_ID,
  KNOWN_DEFAULT_DEVICES,
  normalizeDeviceId,
  subscribeToAccessibleDevices,
} from './services/firebaseService';
import { helmetApiService } from './services/helmetApiService';
import {
  DeviceConfiguration,
  FirebaseSosEventRecord,
  HelmetDeviceState,
  HelmetDeviceSummary,
  UserProfile,
} from './types/helmet';

type NavTabId =
  | 'dashboard'
  | 'gps'
  | 'events'
  | 'contacts'
  | 'settings'
  | 'auth';

const SELECTED_DEVICE_STORAGE_KEY = 'casbox_selected_device_id_v1';

function getInitialSelectedDeviceId(): string {
  try {
    const saved = localStorage.getItem(SELECTED_DEVICE_STORAGE_KEY);
    if (saved && saved.trim() !== '') {
      return normalizeDeviceId(saved);
    }
  } catch {
    // Ignore storage error
  }
  return DEFAULT_HELMET_DEVICE_ID;
}

export function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Requirement 1: Multi-device support (Dynamic Device ID & Accessible Devices discovery)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    getInitialSelectedDeviceId
  );
  const [availableDevices, setAvailableDevices] = useState<
    HelmetDeviceSummary[]
  >(() =>
    KNOWN_DEFAULT_DEVICES.map((id) => ({
      deviceId: id,
      fw: '--',
      hasActiveSos: false,
      activeSosId: null,
    }))
  );

  const handleSelectDevice = useCallback((nextDeviceId: string) => {
    const clean = normalizeDeviceId(nextDeviceId);
    setSelectedDeviceId(clean);
    try {
      localStorage.setItem(SELECTED_DEVICE_STORAGE_KEY, clean);
    } catch {
      // Ignore storage error
    }
  }, []);

  const targetDeviceId = selectedDeviceId;

  const {
    telemetry,
    gpsStatus,
    liveSamples,
    loading: telemetryLoading,
    error: telemetryError,
    errorCode: telemetryErrorCode,
    firebaseConnected,
    isStale,
    secondsSinceUpdate,
    lastUpdatedDate,
    lastSeenVietnamText,
    authUser: firebaseAuthUser,
    authLoading,
    resolvedAddress,
    addressLoading,
  } = useHelmetTelemetry(targetDeviceId);

  const {
    isServerDisconnected,
    showReconnectedNotice,
    dismissReconnectedNotice,
  } = useServerConnectionStatus(firebaseConnected);

  // Discover all accessible devices in `/helmets` (`helmet01`, `helmet01_phase34`, etc.)
  // If any device triggers an active SOS while the current device has no active SOS, automatically switch focus to the SOS device!
  useEffect(() => {
    if (!firebaseAuthUser) return;
    const unsub = subscribeToAccessibleDevices(
      [selectedDeviceId, ...KNOWN_DEFAULT_DEVICES],
      (devices) => {
        if (devices.length > 0) {
          setAvailableDevices(devices);

          const currentDevSummary = devices.find(
            (d) => d.deviceId === selectedDeviceId
          );
          const firstSosDevice = devices.find((d) => d.hasActiveSos);

          if (
            firstSosDevice &&
            (!currentDevSummary || !currentDevSummary.hasActiveSos)
          ) {
            handleSelectDevice(firstSosDevice.deviceId);
          }
        }
      }
    );
    return () => unsub();
}, [firebaseAuthUser, selectedDeviceId, handleSelectDevice]);

const [toastMessage, setToastMessage] = useState<string | null>(null);

const showToast = useCallback((msg: string) => {
  setToastMessage(msg);
  setTimeout(() => {
    setToastMessage((prev) => (prev === msg ? null : prev));
  }, 4500);
}, []);

// Requirement 2, 3, 4, 7: Realtime SOS listener, deduplicated notification, event history & testEvents isolation
const handleNewEmergencySosDetected = useCallback(
  (sos: FirebaseSosEventRecord) => {
    showToast(
      `[KHẨN CẤP] Phát hiện tín hiệu cầu cứu SOS trên ${formatFriendlyDeviceName(
        sos.deviceId
      )}!`
    );
  },
  [showToast]
);

const {
  activeEmergencySos,
  realSosEvents,
  testSosEvents,
  isAlarmPlaying,
  autoplayBlocked,
  loading: sosEventsLoading,
  resolvingId: resolvingSosId,
  error: sosEventsError,
  resolveSos,
  enableOrToggleAudioAlarm,
} = useHelmetSosEvents(
  targetDeviceId,
  firebaseAuthUser,
  telemetry,
  handleNewEmergencySosDetected
);

const {
  activeModeProfile,
  allModes,
  configVersion: modeConfigVersion,
  syncState: modeSyncState,
  selectMode: handleSelectOperatingMode,
} = useDeviceModeConfig(
  targetDeviceId,
  telemetry,
  isStale,
  firebaseAuthUser
);

const smartBattery = useSmartBatteryEstimator(
  telemetry,
  isStale,
  targetDeviceId,
  firebaseAuthUser
);

const {
  contacts: firebaseContacts,
  syncComparison: contactSyncComparison,
  loading: contactsLoading,
  saving: contactsSaving,
  error: contactsError,
  addContact: fbAddContact,
  updateContact: fbUpdateContact,
  deleteContact: fbDeleteContact,
  reorderPriority: fbReorderPriority,
  seedSampleContacts: fbSeedSampleContacts,
  forceResyncContactsConfig: fbForceResyncContacts,
} = useEmergencyContacts(targetDeviceId, firebaseAuthUser, telemetry);

const {
  profile: currentUser,
  loading: profileLoading,
  saving: profileSaving,
  error: profileError,
  saveProfile: saveCloudProfile,
  setLocalRoleOrUser: setCurrentUser,
} = useUserProfile(targetDeviceId, firebaseAuthUser);

const [device, setDevice] = useState<HelmetDeviceState>(INITIAL_DEVICE_STATE);
const [config, setConfig] = useState<DeviceConfiguration>(
  INITIAL_DEVICE_CONFIG
);
const [users, setUsers] = useState<UserProfile[]>(MOCK_USERS);

useEffect(() => {
  helmetApiService.fetchInitialDashboardData().then((data) => {
    setDevice(data.device);
    setConfig(data.config);
    setUsers(data.users);
  });
}, []);

const handleCancelByButton = () => {
  setDevice((prev) => ({
    ...prev,
    safetyState: 'NORMAL',
    cancelCountdownSec: null,
    buzzerActive: false,
    ledAlertActive: false,
    lastHeartbeatAt: new Date().toISOString(),
  }));
  showToast('Đã hủy cảnh báo qua nút bấm trên mũ.');
};

const handleCancelByPosture = () => {
  setDevice((prev) => ({
    ...prev,
    safetyState: 'NORMAL',
    cancelCountdownSec: null,
    buzzerActive: false,
    ledAlertActive: false,
    lastHeartbeatAt: new Date().toISOString(),
  }));
  showToast('Mũ đã đứng thẳng trở lại, tự động tắt cảnh báo.');
};

const handleResetNormalState = () => {
  setDevice((prev) => ({
    ...prev,
    safetyState: 'NORMAL',
    cancelCountdownSec: null,
    buzzerActive: false,
    ledAlertActive: false,
    lastHeartbeatAt: new Date().toISOString(),
  }));
  showToast('Đã đưa thiết bị về trạng thái hoạt động bình thường.');
};

const handleSyncConfigToEsp32 = async () => {
  const synced = await helmetApiService.syncConfigWithEsp32(config);
  setConfig(synced);
  showToast('Đã đồng bộ cài đặt mới lên thiết bị.');
};

const handleResolveSosIncident = async (eventId: string) => {
  await resolveSos(eventId, currentUser.fullName);
  showToast(
    `Đã xác nhận hỗ trợ an toàn cho ${formatFriendlyDeviceName(
      targetDeviceId
    )}.`
  );
};

const fbBatteryPercentage = smartBattery.percentage;

// Find if any OTHER device in `/helmets` currently has an active unresolved real SOS
const otherDevicesWithActiveSos = availableDevices.filter(
  (d) => d.hasActiveSos && d.deviceId !== targetDeviceId
);

const navItems: {
  id: NavTabId;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
}[] = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      icon: <LayoutGrid className="h-[18px] w-[18px]" />,
    },
    {
      id: 'gps',
      label: 'Bản đồ vị trí',
      icon: <MapPin className="h-[18px] w-[18px]" />,
    },
    {
      id: 'events',
      label: 'Nhật ký hoạt động',
      icon: <Clock className="h-[18px] w-[18px]" />,
      badgeCount: activeEmergencySos ? 1 : undefined,
    },
    {
      id: 'contacts',
      label: 'Người thân nhận tin',
      icon: <Phone className="h-[18px] w-[18px]" />,
    },
    {
      id: 'auth',
      label: 'Hồ sơ cá nhân',
      icon: <User className="h-[18px] w-[18px]" />,
    },
  ];

if (authLoading) {
  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
      <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-[#1890FF]" />
        <span>Đang kiểm tra phiên đăng nhập...</span>
      </div>
    </div>
  );
}

if (!firebaseAuthUser) {
  return (
    <LoginGateView
      onLoginSuccess={async ({ email, fullName }) => {
        if (fullName) {
          try {
            await saveCloudProfile({
              ...currentUser,
              email: email || currentUser.email,
              fullName,
            });
          } catch {
            // Ignore if rules block initial write before auth propagates
          }
        }
        setActiveTab('dashboard');
      }}
    />
  );
}

return (
  <div className="h-screen overflow-hidden bg-[#F0F2F5] text-[#262626] flex flex-col lg:flex-row">
    {/* Mobile Sidebar Backdrop */}
    {sidebarOpen && (
      <div
        onClick={() => setSidebarOpen(false)}
        className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
      />
    )}

    {/* SIDEBAR — Deep Navy #001529 */}
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 transform bg-[#001529] text-white shadow-[2px_0_8px_rgba(0,21,41,0.15)] transition-transform duration-200 lg:static lg:h-screen lg:translate-x-0 flex flex-col justify-between ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      <div>
        {/* Brand Title */}
        <div className="flex items-center justify-between bg-[#002140] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1890FF] text-white font-bold text-xs shadow-xs">
              CB
            </div>
            <div>
              <div className="text-[15px] font-bold text-white leading-tight tracking-tight">
                CAS-BOX
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                An toàn hành trình
              </div>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="mt-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-6 py-3 text-[13.5px] transition ${isActive
                      ? 'bg-[#1890FF] text-white font-medium'
                      : 'text-white/65 hover:text-white hover:bg-white/5 font-normal'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={isActive ? 'text-white' : 'text-white/65'}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badgeCount && (
                    <span className="rounded-full bg-[#F5222D] px-2 py-0.2 text-[10px] font-extrabold text-white">
                      SOS
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Footer Card */}
      <div className="p-3.5 border-t border-white/10 bg-[#000C17]/40">
        <button
          onClick={() => setActiveTab('auth')}
          className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-white/5 transition text-left"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1890FF] text-white font-semibold text-xs">
            {currentUser.avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-white truncate">
              {currentUser.fullName}
            </div>
            <div className="text-[11px] text-white/55 truncate">
              {currentUser.role === 'OWNER'
                ? 'Chủ thiết bị'
                : currentUser.role === 'EMERGENCY_CONTACT'
                  ? 'Người thân gia đình'
                  : 'Quản trị viên'}
            </div>
          </div>
        </button>
      </div>
    </aside>

    {/* MAIN AREA */}
    <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
      {/* SERVER / NETWORK DISCONNECTED WARNING BANNER (Error Handling Requirement 1) */}
      {isServerDisconnected && (
        <div
          role="alert"
          className="sticky top-0 z-50 shrink-0 bg-gradient-to-r from-[#D46B08] via-[#FA8C16] to-[#D46B08] text-white px-4 py-2.5 sm:px-6 shadow-[0_4px_14px_rgba(212,107,8,0.35)] border-b border-[#FFD591]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] font-bold">
                <span>
                  Mất kết nối tới máy chủ. Đang thử kết nối lại...
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-[#FFF7E6]">
                  <WifiOff className="h-3 w-3" />
                  Dữ liệu cũ (Offline) • Cập nhật lần cuối:{' '}
                  {lastSeenVietnamText || 'Chưa ghi nhận'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-white/90 font-medium">
              Các nút điều khiển thiết bị tạm thời bị khóa để tránh sai lệch lệnh.
            </div>
          </div>
        </div>
      )}

      {/* AUTO-RECONNECTED GREEN BANNER (Error Handling Requirement 3) */}
      {!isServerDisconnected && showReconnectedNotice && (
        <div
          role="status"
          className="sticky top-0 z-50 shrink-0 bg-[#52C41A] text-white px-4 py-2 sm:px-6 shadow-[0_4px_12px_rgba(82,196,26,0.3)] border-b border-[#B7EB8F] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-xs sm:text-[13px] font-bold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Đã kết nối lại</span>
            <span className="font-normal text-white/90 hidden sm:inline">
              • Dữ liệu trực tuyến từ thiết bị đã được khôi phục và cập nhật mới nhất.
            </span>
          </div>
          <button
            type="button"
            onClick={dismissReconnectedNotice}
            className="rounded p-1 text-white/80 hover:text-white hover:bg-white/15 transition"
            aria-label="Đóng thông báo kết nối lại"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* TASK 1 & TASK 3: STICKY/FIXED RED EMERGENCY SOS ALERT BANNER AT VERY TOP OF SCREEN */}
      {activeEmergencySos && (
        <div className="sticky top-0 z-50 shrink-0 bg-gradient-to-r from-[#A8071A] via-[#F5222D] to-[#A8071A] text-white px-4 py-3 sm:px-6 shadow-[0_6px_20px_rgba(245,34,45,0.45)] border-b-2 border-[#FFA39E]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#F5222D] shadow-sm animate-bounce">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-white px-2 py-0.5 text-[11px] font-extrabold text-[#CF1322] uppercase tracking-wide">
                    CẢNH BÁO KHẨN CẤP SOS
                  </span>
                  <span className="text-xs font-bold text-[#FFF1F0]">
                    {formatFriendlyDeviceName(activeEmergencySos.deviceId)}
                  </span>
                  <span className="text-xs text-white/85 hidden sm:inline">
                    • Đã gửi tin nhắn tới {activeEmergencySos.sms.sent}/
                    {activeEmergencySos.sms.targets} người thân •{' '}
                    {activeEmergencySos.answeredBy > 0
                      ? `Người thân ưu tiên #${activeEmergencySos.answeredBy} đã bắt máy`
                      : 'Chưa có người thân bắt máy'}
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                  Phát hiện tín hiệu cầu cứu khẩn cấp! Vị trí của người sử dụng
                  đang được đánh dấu khẩn cấp trên bản đồ.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
              {/* Audio Alarm & Browser Autoplay Exception Handler Button */}
              {autoplayBlocked ? (
                <button
                  type="button"
                  onClick={enableOrToggleAudioAlarm}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAAD14] px-3 py-2 text-xs font-extrabold text-[#262626] hover:bg-[#FFC53D] transition shadow-sm animate-pulse"
                >
                  <Volume2 className="h-4 w-4" />
                  <span>Bấm vào đây để phát âm thanh còi báo động</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={enableOrToggleAudioAlarm}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 border border-white/35 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition"
                >
                  {isAlarmPlaying ? (
                    <>
                      <Volume2 className="h-4 w-4 animate-pulse" />
                      <span>Còi đang hú (Tạm tắt tiếng)</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4" />
                      <span>Bật lại tiếng còi</span>
                    </>
                  )}
                </button>
              )}

              {activeEmergencySos.loc.mapUrl && (
                <a
                  href={activeEmergencySos.loc.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/15 border border-white/35 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Google Maps</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}

              {/* Primary Reset / Confirm Button */}
              <button
                type="button"
                disabled={
                  isServerDisconnected ||
                  resolvingSosId === activeEmergencySos.id
                }
                title={
                  isServerDisconnected
                    ? 'Đang mất kết nối tới máy chủ. Vui lòng chờ kết nối lại.'
                    : undefined
                }
                onClick={() =>
                  handleResolveSosIncident(activeEmergencySos.id)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-extrabold text-[#CF1322] hover:bg-[#FFF1F0] disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md"
              >
                {resolvingSosId === activeEmergencySos.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#CF1322]" />
                ) : (
                  <Check className="h-4 w-4 stroke-[2.5]" />
                )}
                <span>Tắt cảnh báo / Xác nhận</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar with Multi-Device Selector */}
      <header className="shrink-0 z-30 bg-white shadow-[0_1px_4px_rgba(0,21,41,0.08)] px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-[17px] font-semibold text-[#262626]">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Multi-Device Selector (Friendly End-User Display) */}
            <div className="flex items-center gap-1.5 rounded-lg border border-[#91D5FF] bg-[#E6F7FF]/60 px-2.5 py-1 text-xs">
              <Cpu className="h-3.5 w-3.5 text-[#1890FF] shrink-0" />
              <span className="font-semibold text-[#0050B3] hidden md:inline">
                Thiết bị:
              </span>
              <select
                aria-label="Chọn thiết bị CAS-BOX"
                value={targetDeviceId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  handleSelectDevice(nextId);
                  showToast(
                    `Đã chuyển sang theo dõi ${formatFriendlyDeviceName(
                      nextId
                    )}`
                  );
                }}
                className="bg-transparent font-bold text-[#002766] focus:outline-none cursor-pointer pr-1"
              >
                {availableDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {formatFriendlyDeviceName(dev.deviceId)}
                    {dev.hasActiveSos ? ' (🔴 Có cảnh báo SOS!)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Cross-device Active SOS Quick Switch Pill */}
            {otherDevicesWithActiveSos.map((d) => (
              <button
                key={d.deviceId}
                type="button"
                onClick={() => handleSelectDevice(d.deviceId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5222D] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#CF1322] transition animate-pulse"
              >
                <AlertOctagon className="h-3.5 w-3.5" />
                <span>
                  Cảnh báo SOS trên {formatFriendlyDeviceName(d.deviceId)}!
                  Xem ngay
                </span>
              </button>
            ))}

            {/* Connection, Mode & Battery Pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-md border border-[#E8E8E8] bg-[#FAFAFA] px-3 py-1.5 text-xs">
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-bold border ${activeModeProfile.badgeBg} ${activeModeProfile.badgeText} ${activeModeProfile.badgeBorder}`}
              >
                {activeModeProfile.label}
              </span>
              <span className="text-slate-300">|</span>
              <span
                className={`h-2 w-2 rounded-full ${isServerDisconnected
                    ? 'bg-[#FA8C16] animate-pulse'
                    : telemetry && !isStale
                      ? 'bg-[#52C41A]'
                      : telemetry && isStale
                        ? 'bg-[#F5222D]'
                        : 'bg-slate-400'
                  }`}
              />
              <span
                className={`font-semibold ${isServerDisconnected
                    ? 'text-[#D46B08]'
                    : telemetry && isStale
                      ? 'text-[#CF1322]'
                      : telemetry && !isStale
                        ? 'text-[#389E0D]'
                        : 'text-[#595959]'
                  }`}
              >
                {isServerDisconnected
                  ? 'Mất kết nối máy chủ'
                  : telemetryLoading
                    ? 'Đang kết nối...'
                    : !telemetry
                      ? 'Chưa có tín hiệu'
                      : isStale
                        ? 'Ngoại tuyến'
                        : 'Đang trực tuyến'}
              </span>
              <span className="text-slate-300">|</span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${fbBatteryPercentage !== null &&
                    fbBatteryPercentage <= config.lowBatteryThresholdPercent
                    ? 'text-[#FAAD14]'
                    : 'text-[#262626]'
                  }`}
              >
                {fbBatteryPercentage !== null &&
                  fbBatteryPercentage <= config.lowBatteryThresholdPercent ? (
                  <BatteryWarning className="h-3.5 w-3.5 text-[#FAAD14]" />
                ) : (
                  <Battery className="h-3.5 w-3.5 text-[#52C41A]" />
                )}
                {fbBatteryPercentage !== null
                  ? `${fbBatteryPercentage}%`
                  : '--'}
              </span>
            </div>

            {/* Header User Avatar Pill */}
            <button
              onClick={() => setActiveTab('auth')}
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50 transition"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1890FF] text-white text-xs font-semibold">
                {currentUser.avatarInitials}
              </span>
              <span className="hidden md:inline text-xs font-medium text-[#262626]">
                {currentUser.fullName}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Subtle Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-slate-200 bg-[#001529] px-4 py-3 text-xs font-medium text-white shadow-lg flex items-center justify-between gap-3">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-5 w-full">
        {activeTab === 'dashboard' && (
          <DashboardView
            device={device}
            ownerName={currentUser.fullName}
            config={config}
            contacts={firebaseContacts}
            contactSyncComparison={contactSyncComparison}
            activeEmergencySos={activeEmergencySos}
            realSosEvents={realSosEvents}
            resolvingSosId={resolvingSosId}
            onResolveSos={handleResolveSosIncident}
            telemetry={telemetry}
            gpsStatus={gpsStatus}
            liveSamples={liveSamples}
            telemetryLoading={telemetryLoading}
            telemetryError={telemetryError}
            telemetryErrorCode={telemetryErrorCode}
            firebaseConnected={firebaseConnected}
            isServerDisconnected={isServerDisconnected}
            isStale={isStale}
            secondsSinceUpdate={secondsSinceUpdate}
            lastUpdatedDate={lastUpdatedDate}
            lastSeenVietnamText={lastSeenVietnamText}
            targetDeviceId={targetDeviceId}
            resolvedAddress={resolvedAddress}
            addressLoading={addressLoading}
            smartBattery={smartBattery}
            activeModeProfile={activeModeProfile}
            allModes={allModes}
            modeConfigVersion={modeConfigVersion}
            modeSyncState={modeSyncState}
            onSelectMode={async (newMode) => {
              await handleSelectOperatingMode(newMode);
              const modeLabel =
                allModes.find((m) => m.id === newMode)?.label || newMode;
              showToast(`Đã chuyển sang chế độ bảo vệ "${modeLabel}".`);
            }}
            onCancelByButton={handleCancelByButton}
            onCancelByPosture={handleCancelByPosture}
            onResetNormalState={handleResetNormalState}
            onNavigateTab={(tab) => setActiveTab(tab as NavTabId)}
          />
        )}

        {activeTab === 'gps' && (
          <GPSTrackingView
            telemetry={telemetry}
            gpsStatus={gpsStatus}
            activeEmergencySos={activeEmergencySos}
            resolvingSosId={resolvingSosId}
            onResolveSos={handleResolveSosIncident}
            telemetryLoading={telemetryLoading}
            isServerDisconnected={isServerDisconnected}
            isStale={isStale}
            targetDeviceId={targetDeviceId}
            resolvedAddress={resolvedAddress}
            addressLoading={addressLoading}
            activeModeProfile={activeModeProfile}
            allModes={allModes}
            onSelectMode={async (newMode) => {
              await handleSelectOperatingMode(newMode);
              const modeLabel =
                allModes.find((m) => m.id === newMode)?.label || newMode;
              showToast(`Đã chuyển sang chế độ bảo vệ "${modeLabel}".`);
            }}
          />
        )}

        {activeTab === 'events' && (
          <EventHistoryView
            deviceId={targetDeviceId}
            realSosEvents={realSosEvents}
            testSosEvents={testSosEvents}
            loading={sosEventsLoading}
            resolvingId={resolvingSosId}
            isServerDisconnected={isServerDisconnected}
            error={sosEventsError}
            onResolveSos={handleResolveSosIncident}
          />
        )}

        {activeTab === 'contacts' && (
          <EmergencyContactsView
            deviceId={targetDeviceId}
            contacts={firebaseContacts}
            telemetry={telemetry}
            syncComparison={contactSyncComparison}
            loading={contactsLoading}
            saving={contactsSaving}
            isServerDisconnected={isServerDisconnected}
            error={contactsError}
            currentUserRole={currentUser.role}
            onAddContact={async (input) => {
              await fbAddContact(input);
              showToast(`Đã thêm ${input.name} vào danh sách người thân.`);
            }}
            onUpdateContact={async (updated) => {
              await fbUpdateContact(updated);
              showToast(`Đã cập nhật thông tin liên hệ của ${updated.name}.`);
            }}
            onDeleteContact={async (id) => {
              await fbDeleteContact(id);
              showToast('Đã xóa người thân khỏi danh sách nhận tin.');
            }}
            onReorderPriority={async (id, direction) => {
              await fbReorderPriority(id, direction);
              showToast('Đã cập nhật thứ tự ưu tiên liên hệ khẩn cấp.');
            }}
            onSeedSampleContacts={async () => {
              await fbSeedSampleContacts();
              showToast('Đã khôi phục danh bạ người thân từ thiết bị.');
            }}
            onForceResync={async () => {
              await fbForceResyncContacts();
              showToast('Đã gửi yêu cầu đồng bộ danh bạ xuống thiết bị.');
            }}
          />
        )}

        {activeTab === 'settings' && (
          <DeviceSettingsView
            device={device}
            ownerName={currentUser.fullName}
            config={config}
            telemetry={telemetry}
            targetDeviceId={targetDeviceId}
            currentUserRole={currentUser.role}
            isServerDisconnected={isServerDisconnected}
            onUpdateConfig={setConfig}
            onSyncToDevice={handleSyncConfigToEsp32}
          />
        )}

        {activeTab === 'auth' && (
          <AuthProfileView
            currentUser={currentUser}
            allUsers={users}
            loading={profileLoading}
            saving={profileSaving}
            error={profileError}
            onSelectUser={(u) => {
              setCurrentUser(u);
              const friendlyRole =
                u.role === 'OWNER'
                  ? 'Chủ thiết bị'
                  : u.role === 'EMERGENCY_CONTACT'
                  ? 'Người thân gia đình'
                  : 'Quản trị viên';
              showToast(`Đã chuyển sang góc nhìn: ${friendlyRole}.`);
            }}
            onSaveProfileToCloud={async (updated) => {
              await saveCloudProfile(updated);
              showToast('Đã lưu thông tin hồ sơ cá nhân.');
            }}
            onLoggedOut={() => {
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>
    </div>
  </div>
);
}
export default App;
