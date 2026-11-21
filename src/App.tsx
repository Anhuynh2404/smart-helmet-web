import React, { useEffect, useState } from 'react';
import {
  Battery,
  BatteryWarning,
  ChevronDown,
  Clock,
  FlaskConical,
  LayoutGrid,
  Loader2,
  MapPin,
  Menu,
  Phone,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react';
import { AuthProfileView } from './components/AuthProfileView';
import { DashboardView } from './components/DashboardView';
import { DeviceSettingsView } from './components/DeviceSettingsView';
import { EmergencyContactsView } from './components/EmergencyContactsView';
import { EventHistoryView } from './components/EventHistoryView';
import { GPSTrackingView } from './components/GPSTrackingView';
import { LoginGateView } from './components/LoginGateView';
import { useEmergencyContacts } from './hooks/useEmergencyContacts';
import { useHelmetTelemetry } from './hooks/useHelmetTelemetry';
import { useSmartBatteryEstimator } from './hooks/useSmartBatteryEstimator';
import { useUserProfile } from './hooks/useUserProfile';
import {
  INITIAL_DEVICE_CONFIG,
  INITIAL_DEVICE_STATE,
  INITIAL_EMERGENCY_CONTACTS,
  INITIAL_EVENT_LOGS,
  MOCK_USERS,
} from './mocks/mockData';
import { DEFAULT_HELMET_DEVICE_ID } from './services/firebaseService';
import { helmetApiService } from './services/helmetApiService';
import {
  DeviceConfiguration,
  EmergencyContact,
  HelmetDeviceState,
  HelmetEventLog,
  UserProfile,
} from './types/helmet';

type NavTabId = 'dashboard' | 'gps' | 'events' | 'contacts' | 'settings' | 'auth';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);

  const targetDeviceId = DEFAULT_HELMET_DEVICE_ID;
  const {
    telemetry,
    loading: telemetryLoading,
    error: telemetryError,
    errorCode: telemetryErrorCode,
    firebaseConnected,
    isStale,
    secondsSinceUpdate,
    lastUpdatedDate,
    authUser: firebaseAuthUser,
    authLoading,
    resolvedAddress,
    addressLoading,
  } = useHelmetTelemetry(targetDeviceId);

  const smartBattery = useSmartBatteryEstimator(
    telemetry,
    isStale,
    targetDeviceId,
    firebaseAuthUser
  );

  const {
    contacts: firebaseContacts,
    loading: contactsLoading,
    saving: contactsSaving,
    error: contactsError,
    addContact: fbAddContact,
    updateContact: fbUpdateContact,
    deleteContact: fbDeleteContact,
    reorderPriority: fbReorderPriority,
    seedSampleContacts: fbSeedSampleContacts,
  } = useEmergencyContacts(targetDeviceId, firebaseAuthUser);

  const {
    profile: currentUser,
    loading: profileLoading,
    saving: profileSaving,
    error: profileError,
    saveProfile: saveCloudProfile,
    setLocalRoleOrUser: setCurrentUser,
  } = useUserProfile(targetDeviceId, firebaseAuthUser);

  const [device, setDevice] = useState<HelmetDeviceState>(INITIAL_DEVICE_STATE);
  const [config, setConfig] = useState<DeviceConfiguration>(INITIAL_DEVICE_CONFIG);
  const [events, setEvents] = useState<HelmetEventLog[]>(INITIAL_EVENT_LOGS);
  const [fallbackContacts] = useState<EmergencyContact[]>(INITIAL_EMERGENCY_CONTACTS);

  // Use real-time Firebase contacts; if empty on Dashboard while not yet seeded, show live list
  const activeContacts = firebaseContacts;

  const [users, setUsers] = useState<UserProfile[]>(MOCK_USERS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  useEffect(() => {
    helmetApiService.fetchInitialDashboardData().then((data) => {
      setDevice(data.device);
      setEvents(data.events);
      setConfig(data.config);
      setUsers(data.users);
    });
  }, []);

  // Cancel Window 10-15s Countdown (for manual demo scenario testing)
  useEffect(() => {
    if (device.safetyState !== 'WARNING_CANCEL_WINDOW' || device.cancelCountdownSec === null) {
      return;
    }

    if (device.cancelCountdownSec <= 0) {
      handleTriggerImmediateSOS();
      return;
    }

    const timer = setTimeout(() => {
      setDevice((prev) => ({
        ...prev,
        cancelCountdownSec:
          prev.cancelCountdownSec !== null ? prev.cancelCountdownSec - 1 : null,
      }));
    }, 1000);

    return () => clearTimeout(timer);
  }, [device.safetyState, device.cancelCountdownSec]);

  const handleTriggerImpactWarning = () => {
    const impactG = Number((config.impactThresholdG + 1.1).toFixed(1));
    const tiltDeg = Number((config.fallAngleThresholdDeg + 8).toFixed(0));
    const nowIso = new Date().toISOString();

    setDevice((prev) => ({
      ...prev,
      connectionStatus: 'ONLINE',
      safetyState: 'WARNING_CANCEL_WINDOW',
      cancelCountdownSec: config.cancelWindowSeconds,
      buzzerActive: config.buzzerEnabled,
      ledAlertActive: config.ledStrobeEnabled,
      lastHeartbeatAt: nowIso,
      imu: {
        ...prev.imu,
        totalGForce: impactG,
        pitch: tiltDeg,
        roll: -60,
        postureState: 'TILTED',
      },
    }));

    const newEvt: HelmetEventLog = {
      id: `${Date.now()}`,
      deviceId: telemetry?.deviceId || targetDeviceId,
      type: 'IMPACT_DETECTED',
      severity: 'WARNING',
      title: 'Phát hiện va chạm mạnh',
      description: `Mũ bị nghiêng ${tiltDeg}° và chịu va chạm. Đang chờ người đội xác nhận trong ${config.cancelWindowSeconds} giây.`,
      timestamp: nowIso,
      latitude: telemetry?.gps?.latitude ?? device.gps.latitude,
      longitude: telemetry?.gps?.longitude ?? device.gps.longitude,
      locationName: device.gps.addressLabel,
      sensorSnapshot: {
        gForce: impactG,
        pitch: tiltDeg,
        roll: -60,
        batteryPercent: telemetry?.battery?.percentage ?? 0,
        voltageV: telemetry?.battery?.voltage ?? 0,
        speedKmh: 0,
      },
    };
    setEvents((prev) => [newEvt, ...prev]);
    setDemoMenuOpen(false);
    showToast(`Đang đếm ngược ${config.cancelWindowSeconds} giây chờ hủy cảnh báo.`);
  };

  const handleCancelByButton = () => {
    const nowIso = new Date().toISOString();
    setDevice((prev) => ({
      ...prev,
      safetyState: 'NORMAL',
      cancelCountdownSec: null,
      buzzerActive: false,
      ledAlertActive: false,
      lastHeartbeatAt: nowIso,
    }));

    const cancelEvt: HelmetEventLog = {
      id: `${Date.now()}`,
      deviceId: telemetry?.deviceId || targetDeviceId,
      type: 'BUTTON_CANCELLED',
      severity: 'INFO',
      title: 'Đã hủy cảnh báo qua nút bấm trên mũ',
      description: 'Người đội đã nhấn nút hủy cảnh báo và xác nhận an toàn.',
      timestamp: nowIso,
      latitude: telemetry?.gps?.latitude ?? device.gps.latitude,
      longitude: telemetry?.gps?.longitude ?? device.gps.longitude,
      locationName: device.gps.addressLabel,
      sensorSnapshot: {
        gForce: telemetry?.mpu?.totalG ?? 1.0,
        pitch: 5,
        roll: -1,
        batteryPercent: telemetry?.battery?.percentage ?? 0,
        voltageV: telemetry?.battery?.voltage ?? 0,
        speedKmh: 0,
      },
    };
    setEvents((prev) => [cancelEvt, ...prev]);
    showToast('Đã hủy cảnh báo qua nút bấm trên mũ.');
  };

  const handleCancelByPosture = () => {
    const nowIso = new Date().toISOString();
    setDevice((prev) => ({
      ...prev,
      safetyState: 'NORMAL',
      cancelCountdownSec: null,
      buzzerActive: false,
      ledAlertActive: false,
      lastHeartbeatAt: nowIso,
    }));

    const postureEvt: HelmetEventLog = {
      id: `${Date.now()}`,
      deviceId: telemetry?.deviceId || targetDeviceId,
      type: 'AUTO_CANCELLED_POSTURE',
      severity: 'INFO',
      title: 'Tự tắt cảnh báo khi dựng thẳng mũ',
      description: 'Mũ đã trở lại tư thế thẳng đứng ổn định.',
      timestamp: nowIso,
      latitude: telemetry?.gps?.latitude ?? device.gps.latitude,
      longitude: telemetry?.gps?.longitude ?? device.gps.longitude,
      locationName: device.gps.addressLabel,
      sensorSnapshot: {
        gForce: telemetry?.mpu?.totalG ?? 1.0,
        pitch: 4,
        roll: -1,
        batteryPercent: telemetry?.battery?.percentage ?? 0,
        voltageV: telemetry?.battery?.voltage ?? 0,
        speedKmh: 0,
      },
    };
    setEvents((prev) => [postureEvt, ...prev]);
    showToast('Mũ đã đứng thẳng trở lại, tự động tắt cảnh báo.');
  };

  const handleTriggerImmediateSOS = () => {
    const nowIso = new Date().toISOString();
    setDevice((prev) => ({
      ...prev,
      safetyState: 'EMERGENCY_SOS',
      cancelCountdownSec: null,
      buzzerActive: true,
      ledAlertActive: true,
      lastHeartbeatAt: nowIso,
    }));

    const sosEvent: HelmetEventLog = {
      id: `${Date.now()}`,
      deviceId: telemetry?.deviceId || targetDeviceId,
      type: 'SOS_ACTIVATED',
      severity: 'CRITICAL',
      title: 'Đã gửi tín hiệu khẩn cấp SOS',
      description: 'Kích hoạt cảnh báo khẩn cấp SOS.',
      timestamp: nowIso,
      latitude: telemetry?.gps?.latitude ?? device.gps.latitude,
      longitude: telemetry?.gps?.longitude ?? device.gps.longitude,
      locationName: device.gps.addressLabel,
      sensorSnapshot: {
        gForce: telemetry?.mpu?.totalG ?? 4.9,
        pitch: 79,
        roll: -72,
        batteryPercent: telemetry?.battery?.percentage ?? 0,
        voltageV: telemetry?.battery?.voltage ?? 0,
        speedKmh: 0,
      },
    };

    setEvents((prev) => [sosEvent, ...prev]);
    setDemoMenuOpen(false);
    showToast('Đã kích hoạt tín hiệu khẩn cấp SOS!');
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
    setDemoMenuOpen(false);
    showToast('Đã đưa thiết bị về trạng thái hoạt động bình thường.');
  };

  const handleSyncConfigToEsp32 = async () => {
    const synced = await helmetApiService.syncConfigWithEsp32(config);
    setConfig(synced);
    showToast('Đã đồng bộ cài đặt mới lên mũ bảo hiểm.');
  };

  // Real or realistically estimated battery percentage
  const fbBatteryPercentage = smartBattery.percentage;

  const fbWifiConnected = telemetry?.network?.wifiConnected === true;

  const navItems: {
    id: NavTabId;
    label: string;
    icon: React.ReactNode;
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

  // Show loading screen while checking persisted login session
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

  // Require login before entering the Dashboard
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

      {/* SIDEBAR — Deep Navy #001529 with #1890FF active item matching reference image */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 transform bg-[#001529] text-white shadow-[2px_0_8px_rgba(0,21,41,0.15)] transition-transform duration-200 lg:static lg:h-screen lg:translate-x-0 flex flex-col justify-between ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Title */}
          <div className="flex items-center justify-between bg-[#002140] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1890FF] text-white font-bold text-xs shadow-xs">
                SH
              </div>
              <div>
                <div className="text-[15px] font-bold text-white leading-tight tracking-tight">
                  Smart Helmet
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
                    className={`w-full flex items-center gap-3 px-6 py-3 text-[13.5px] transition ${
                      isActive
                        ? 'bg-[#1890FF] text-white font-medium'
                        : 'text-white/65 hover:text-white hover:bg-white/5 font-normal'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-white/65'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
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
                  ? 'Chủ mũ bảo hiểm'
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
        {/* Top Bar — Pure white with soft Ant Design shadow */}
        <header className="shrink-0 z-30 bg-white shadow-[0_1px_4px_rgba(0,21,41,0.08)] px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4 w-full">
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

            <div className="flex items-center gap-3">
              {/* Real Firebase Connection & Battery Pill */}
              <div className="hidden sm:flex items-center gap-2 rounded-md border border-[#E8E8E8] bg-[#FAFAFA] px-3 py-1.5 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    telemetry && !isStale && fbWifiConnected
                      ? 'bg-[#52C41A]'
                      : telemetry && isStale
                      ? 'bg-[#FAAD14]'
                      : 'bg-slate-400'
                  }`}
                />
                <span className="font-medium text-[#595959]">
                  {telemetryLoading
                    ? 'Đang tải...'
                    : !telemetry
                    ? 'Chưa có dữ liệu'
                    : isStale
                    ? 'Mất cập nhật'
                    : fbWifiConnected
                    ? 'Wi-Fi kết nối'
                    : 'Wi-Fi ngắt'}
                </span>
                <span className="text-slate-300">|</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    fbBatteryPercentage !== null &&
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
                  {fbBatteryPercentage !== null ? `${fbBatteryPercentage}%` : '--'}
                </span>
              </div>

              {/* Header User Avatar Pill like reference image */}
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
              contacts={activeContacts.length > 0 ? activeContacts : fallbackContacts}
              recentEvents={events}
              telemetry={telemetry}
              telemetryLoading={telemetryLoading}
              telemetryError={telemetryError}
              telemetryErrorCode={telemetryErrorCode}
              firebaseConnected={firebaseConnected}
              isStale={isStale}
              secondsSinceUpdate={secondsSinceUpdate}
              lastUpdatedDate={lastUpdatedDate}
              targetDeviceId={targetDeviceId}
              resolvedAddress={resolvedAddress}
              addressLoading={addressLoading}
              smartBattery={smartBattery}
              onCancelByButton={handleCancelByButton}
              onCancelByPosture={handleCancelByPosture}
              onResetNormalState={handleResetNormalState}
              onNavigateTab={(tab) => setActiveTab(tab as NavTabId)}
            />
          )}

          {activeTab === 'gps' && (
            <GPSTrackingView
              telemetry={telemetry}
              telemetryLoading={telemetryLoading}
              targetDeviceId={targetDeviceId}
              resolvedAddress={resolvedAddress}
              addressLoading={addressLoading}
            />
          )}

          {activeTab === 'events' && <EventHistoryView events={events} />}

          {activeTab === 'contacts' && (
            <EmergencyContactsView
              contacts={activeContacts}
              loading={contactsLoading}
              saving={contactsSaving}
              error={contactsError}
              currentUserRole={currentUser.role}
              onAddContact={async (input) => {
                await fbAddContact(input);
                showToast(`Đã thêm ${input.name} lên Firebase.`);
              }}
              onUpdateContact={async (updated) => {
                await fbUpdateContact(updated);
                showToast(`Đã cập nhật ${updated.name} trên Firebase.`);
              }}
              onDeleteContact={async (id) => {
                await fbDeleteContact(id);
                showToast('Đã xóa liên hệ trên Firebase.');
              }}
              onReorderPriority={async (id, direction) => {
                await fbReorderPriority(id, direction);
                showToast('Đã cập nhật thứ tự ưu tiên trên Firebase.');
              }}
              onSeedSampleContacts={async () => {
                await fbSeedSampleContacts();
                showToast('Đã khởi tạo danh bạ mẫu lên Firebase.');
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
                showToast(`Đã chuyển sang góc nhìn: ${u.role}.`);
              }}
              onSaveProfileToCloud={async (updated) => {
                await saveCloudProfile(updated);
                showToast('Đã lưu thông tin hồ sơ lên Cloud.');
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
