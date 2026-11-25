import React from 'react';
import {
  Accessibility,
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowUpRight,
  Backpack,
  Battery,
  BatteryWarning,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  HardHat,
  KeyRound,
  Loader2,
  MapPin,
  MessageSquare,
  Moon,
  Phone,
  PhoneCall,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  formatToVietnamTimezone,
  TelemetryErrorCode,
} from '../hooks/useHelmetTelemetry';
import { SmartBatteryEstimate } from '../hooks/useSmartBatteryEstimator';
import { formatPhoneForDisplay } from '../services/emergencyContactsService';
import { formatFirmwareGpsUtc } from '../services/sosEventsService';
import {
  ContactSyncComparison,
  DeviceConfiguration,
  EmergencyContact,
  FirebaseHelmetTelemetry,
  FirebaseSosEventRecord,
  HelmetDeviceState,
  LiveTelemetrySample,
  ModeConfigSyncState,
  NormalizedGpsStatus,
  OperatingModeId,
  OperatingModeProfile,
} from '../types/helmet';

interface DashboardViewProps {
  device: HelmetDeviceState;
  ownerName: string;
  config: DeviceConfiguration;
  contacts: EmergencyContact[];
  contactSyncComparison: ContactSyncComparison;
  activeEmergencySos: FirebaseSosEventRecord | null;
  realSosEvents: FirebaseSosEventRecord[];
  resolvingSosId: string | null;
  onResolveSos: (eventId: string) => Promise<void>;
  telemetry: FirebaseHelmetTelemetry | null;
  gpsStatus: NormalizedGpsStatus;
  liveSamples: LiveTelemetrySample[];
  telemetryLoading: boolean;
  telemetryError: string | null;
  telemetryErrorCode: TelemetryErrorCode;
  firebaseConnected: boolean;
  isStale: boolean;
  secondsSinceUpdate: number | null;
  lastUpdatedDate: Date | null;
  lastSeenVietnamText: string;
  targetDeviceId: string;
  resolvedAddress: string | null;
  addressLoading: boolean;
  smartBattery: SmartBatteryEstimate;
  activeModeProfile: OperatingModeProfile;
  allModes: OperatingModeProfile[];
  modeConfigVersion: number;
  modeSyncState: ModeConfigSyncState;
  onSelectMode: (mode: OperatingModeId) => void;
  onCancelByButton: () => void;
  onCancelByPosture: () => void;
  onResetNormalState: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  device,
  ownerName,
  config,
  contacts,
  contactSyncComparison,
  activeEmergencySos,
  realSosEvents,
  resolvingSosId,
  onResolveSos,
  telemetry,
  gpsStatus,
  liveSamples,
  telemetryLoading,
  telemetryError,
  telemetryErrorCode,
  isStale,
  secondsSinceUpdate,
  lastSeenVietnamText,
  targetDeviceId,
  resolvedAddress,
  addressLoading,
  smartBattery,
  activeModeProfile,
  allModes,
  modeConfigVersion,
  modeSyncState,
  onSelectMode,
  onCancelByButton,
  onCancelByPosture,
  onResetNormalState,
  onNavigateTab,
}) => {
  // 1. Device status fields from /helmets/{deviceId}/status (SmartHelmet V2.4.2-dev)
  const displayDeviceId = targetDeviceId;
  const displayFirmware =
    telemetry?.fw !== undefined
      ? String(telemetry.fw)
      : telemetry?.firmwareVersion || '--';

  // Requirement 6: deepSleep=true ONLY indicates the Deep Sleep feature is enabled on firmware
  const deepSleepFeatureEnabled = telemetry?.deepSleep === true;
  const imuFault = telemetry?.imuFault === true;
  const rawOnlineFlag = telemetry?.online === true;
  const sosPending = telemetry?.sosPending === true;
  const autoRealSos = telemetry?.autoRealSos;
  const sosTestMode = telemetry?.sosTestMode;
  const cancelWindowSec =
    typeof telemetry?.cancelWindowSec === 'number'
      ? telemetry.cancelWindowSec
      : activeModeProfile.thresholds.cancelWindowSec;
  const activeContactCount =
    typeof telemetry?.activeContactCount === 'number'
      ? telemetry.activeContactCount
      : contactSyncComparison.activeContactCount;
  const contactConfigVerified = telemetry?.contactConfigVerified === true;
  const contactSource = telemetry?.contactSource
    ? String(telemetry.contactSource)
    : null;

  const simMode = telemetry?.simMode ? String(telemetry.simMode) : null;
  const syncReason = telemetry?.syncReason
    ? String(telemetry.syncReason)
    : null;
  const uptimeSeconds =
    typeof telemetry?.uptimeS === 'number'
      ? telemetry.uptimeS
      : telemetry?.device?.uptimeSeconds;
  const wifiRssiDbm =
    typeof telemetry?.wifiRssi === 'number'
      ? telemetry.wifiRssi
      : typeof telemetry?.network?.wifiRssiDbm === 'number'
        ? telemetry.network.wifiRssiDbm
        : null;
  const deviceIp = telemetry?.ip ? String(telemetry.ip) : null;
  const configVersion =
    telemetry?.configVersion !== undefined
      ? String(telemetry.configVersion)
      : null;
  const configNote = telemetry?.configNote
    ? String(telemetry.configNote)
    : null;

  // 2. Requirement 6: Do NOT rely solely on online=true to conclude the device is online!
  // Online requires fresh lastSeen (!isStale) AND online !== false
  const isActuallyOnline = Boolean(telemetry) && !isStale;
  const hasNetworkConnection =
    isActuallyOnline &&
    (rawOnlineFlag ||
      Boolean(deviceIp && deviceIp !== '0.0.0.0') ||
      telemetry?.network?.wifiConnected === true);

  // 3. Battery fields
  const batteryPercentage = smartBattery.percentage;
  const isLowBatt =
    !smartBattery.isCharging &&
    batteryPercentage <= config.lowBatteryThresholdPercent;

  // 4. MPU6050 fields from /helmets/{deviceId}/status/mpu
  const accelX =
    typeof telemetry?.mpu?.accel?.x === 'number'
      ? telemetry.mpu.accel.x
      : typeof telemetry?.mpu?.ax === 'number'
        ? telemetry.mpu.ax
        : null;
  const accelY =
    typeof telemetry?.mpu?.accel?.y === 'number'
      ? telemetry.mpu.accel.y
      : typeof telemetry?.mpu?.ay === 'number'
        ? telemetry.mpu.ay
        : null;
  const accelZ =
    typeof telemetry?.mpu?.accel?.z === 'number'
      ? telemetry.mpu.accel.z
      : typeof telemetry?.mpu?.az === 'number'
        ? telemetry.mpu.az
        : null;

  const accelMagnitudeG =
    typeof telemetry?.mpu?.totalG === 'number'
      ? Number(telemetry.mpu.totalG.toFixed(3))
      : accelX !== null && accelY !== null && accelZ !== null
        ? Number(
          Math.sqrt(
            accelX * accelX + accelY * accelY + accelZ * accelZ
          ).toFixed(3)
        )
        : null;

  const mpuTiltDeg =
    typeof telemetry?.mpu?.tiltDeg === 'number'
      ? Number(telemetry.mpu.tiltDeg.toFixed(2))
      : null;

  const mpuValid = telemetry?.mpu?.valid;

  const gyroX =
    typeof telemetry?.mpu?.gyro?.x === 'number'
      ? telemetry.mpu.gyro.x
      : typeof telemetry?.mpu?.gx === 'number'
        ? telemetry.mpu.gx
        : null;
  const gyroY =
    typeof telemetry?.mpu?.gyro?.y === 'number'
      ? telemetry.mpu.gyro.y
      : typeof telemetry?.mpu?.gy === 'number'
        ? telemetry.mpu.gy
        : null;
  const gyroZ =
    typeof telemetry?.mpu?.gyro?.z === 'number'
      ? telemetry.mpu.gyro.z
      : typeof telemetry?.mpu?.gz === 'number'
        ? telemetry.mpu.gz
        : null;

  const gyroMagnitudeDps =
    typeof telemetry?.mpu?.gyroMagnitudeDps === 'number'
      ? telemetry.mpu.gyroMagnitudeDps
      : gyroX !== null && gyroY !== null && gyroZ !== null
        ? Number(
          Math.sqrt(gyroX * gyroX + gyroY * gyroY + gyroZ * gyroZ).toFixed(2)
        )
        : null;

  // Dynamic inspection of status/mpu/raw fields
  const rawSensorEntries: { key: string; value: string }[] = [];
  if (telemetry?.mpu?.raw && typeof telemetry.mpu.raw === 'object') {
    Object.entries(telemetry.mpu.raw).forEach(([k, v]) => {
      if (v !== null && v !== undefined && typeof v !== 'object') {
        rawSensorEntries.push({
          key: k,
          value:
            typeof v === 'number' ? String(Number(v.toFixed(3))) : String(v),
        });
      } else if (v && typeof v === 'object') {
        Object.entries(v as Record<string, unknown>).forEach(([subK, subV]) => {
          if (subV !== null && subV !== undefined) {
            rawSensorEntries.push({
              key: `${k}.${subK}`,
              value:
                typeof subV === 'number'
                  ? String(Number(subV.toFixed(3)))
                  : String(subV),
            });
          }
        });
      }
    });
  }

  // 6. Hardware SOS Contacts & contactChannels from /helmets/{deviceId}/status
  const espContactSlots: {
    slot: string;
    phone: string;
    priority: number;
    smsEnabled: boolean;
    callEnabled: boolean;
  }[] = [];

  if (telemetry?.contacts && typeof telemetry.contacts === 'object') {
    for (let i = 1; i <= 5; i++) {
      const slotKey = `p${i}`;
      const rawPhone = telemetry.contacts[slotKey];
      if (typeof rawPhone === 'string' && rawPhone.trim() !== '') {
        const ch = telemetry.contactChannels?.[slotKey];
        espContactSlots.push({
          slot: slotKey,
          phone: rawPhone.trim(),
          priority:
            typeof ch?.priority === 'number' && Number.isFinite(ch.priority)
              ? ch.priority
              : i,
          smsEnabled:
            typeof ch?.smsEnabled === 'boolean' ? ch.smsEnabled : true,
          callEnabled:
            typeof ch?.callEnabled === 'boolean' ? ch.callEnabled : true,
        });
      }
    }
  }

  const formatLastSeen = () => {
    if (!telemetry) return 'Chưa có dữ liệu';
    return lastSeenVietnamText || 'Vừa xong';
  };

  const renderModeIcon = (modeId: OperatingModeId, className = 'h-4 w-4') => {
    switch (modeId) {
      case 'helmet':
        return <HardHat className={className} />;
      case 'wheelchair':
        return <Accessibility className={className} />;
      case 'motorbike':
        return <Bike className={className} />;
      case 'backpack':
        return <Backpack className={className} />;
    }
  };

  const formatUptime = (sec?: number) => {
    if (typeof sec !== 'number' || !Number.isFinite(sec)) return '--';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    if (hrs > 0) return `${hrs}g ${mins}p ${secs}s`;
    if (mins > 0) return `${mins}p ${secs}s`;
    return `${secs}s`;
  };

  // Requirement 6: Connection badge strictly based on lastSeen freshness (!isStale), NOT deepSleep or online=true alone
  const renderDeviceStatusBadge = () => {
    if (telemetryLoading) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          <Loader2 className="h-3 w-3 animate-spin text-[#1890FF]" />
          Đang tải...
        </span>
      );
    }
    if (!telemetry) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Chưa có dữ liệu
        </span>
      );
    }
    if (isStale) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FFF1F0] px-2.5 py-0.5 text-[11px] font-semibold text-[#CF1322] border border-[#FFA39E]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F5222D]" />
          Offline
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6FFED] px-2.5 py-0.5 text-[11px] font-semibold text-[#389E0D] border border-[#B7EB8F]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
        Online
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* REALTIME EMERGENCY SOS ALERT BANNER (Requirements 2, 3, 4, 7) */}
      {activeEmergencySos && (
        <div className="rounded-xl border-2 border-[#F5222D] bg-[#FFF1F0] p-5 shadow-md space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F5222D] text-white shadow-xs">
                <AlertOctagon className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#F5222D] px-2.5 py-0.5 text-xs font-extrabold text-white">
                    CẢNH BÁO SOS KHẨN CẤP REALTIME
                  </span>
                  <span className="font-mono text-xs font-bold text-[#CF1322] bg-white px-2 py-0.5 rounded border border-[#FFA39E]">
                    Thiết bị: {activeEmergencySos.deviceId} • Event ID: #
                    {activeEmergencySos.id}
                  </span>
                  <span className="rounded bg-white border border-[#FFA39E] px-2 py-0.5 text-[11px] font-semibold text-[#CF1322]">
                    GPS: {activeEmergencySos.loc.type}
                  </span>
                </div>
                <h2 className="mt-1.5 text-base sm:text-lg font-extrabold text-[#262626]">
                  Phát hiện tín hiệu SOS chưa xử lý (active=true, resolved=false,
                  test=false)
                </h2>
                <p className="text-xs text-[#595959] mt-0.5">
                  Thời điểm tải lên Firebase (pushedAt):{' '}
                  <strong className="text-[#262626]">
                    {activeEmergencySos.pushedAt
                      ? formatToVietnamTimezone(
                        new Date(activeEmergencySos.pushedAt),
                        true
                      )
                      : '--'}
                  </strong>{' '}
                  <span className="text-[#8C8C8C]">
                    (Lưu ý: pushedAt là lúc thiết bị đồng bộ lên Cloud, không phải
                    thời điểm tai nạn chính xác)
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
              {activeEmergencySos.loc.mapUrl && (
                <a
                  href={activeEmergencySos.loc.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1890FF] bg-white px-3.5 py-2 text-xs font-bold text-[#1890FF] hover:bg-[#E6F7FF] transition"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Mở Google Maps</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}

              <button
                type="button"
                disabled={resolvingSosId === activeEmergencySos.id}
                onClick={() => onResolveSos(activeEmergencySos.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#52C41A] px-4 py-2 text-xs font-bold text-white hover:bg-[#389E0D] disabled:opacity-50 transition shadow-xs"
              >
                {resolvingSosId === activeEmergencySos.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Xác nhận đã xử lý SOS (Resolve)</span>
              </button>
            </div>
          </div>

          {/* SOS Details Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#FFA39E]/60 text-xs">
            <div className="rounded-lg bg-white border border-[#FFA39E] p-3">
              <div className="text-[11px] font-semibold text-[#8C8C8C]">
                Vị trí GPS tại bản ghi SOS ({activeEmergencySos.loc.type})
              </div>
              {activeEmergencySos.loc.type !== 'NONE' &&
                activeEmergencySos.loc.lat !== undefined &&
                activeEmergencySos.loc.lon !== undefined ? (
                <div className="mt-1 space-y-0.5">
                  <div className="font-mono font-bold text-[#262626]">
                    lat: {activeEmergencySos.loc.lat.toFixed(6)}, lon:{' '}
                    {activeEmergencySos.loc.lon.toFixed(6)}
                  </div>
                  <div className="text-[11px] text-[#595959]">
                    Mẫu GPS: {formatFirmwareGpsUtc(activeEmergencySos.loc.utc)}
                  </div>
                </div>
              ) : (
                <div className="mt-1 font-semibold text-[#CF1322]">
                  Không có tọa độ GPS (NONE)
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white border border-[#FFA39E] p-3">
              <div className="text-[11px] font-semibold text-[#8C8C8C]">
                Tin nhắn SMS đệ trình lên mạng (Modem Submitted)
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-[#262626]">
                Đã gửi lên mạng: {activeEmergencySos.sms.sent} /{' '}
                {activeEmergencySos.sms.targets} mục tiêu
              </div>
              <div className="text-[11px] text-[#8C8C8C] mt-0.5">
                Chưa xác nhận máy người nhận đã nhận tin nhắn
              </div>
            </div>

            <div className="rounded-lg bg-white border border-[#FFA39E] p-3">
              <div className="text-[11px] font-semibold text-[#8C8C8C]">
                Kết quả Gọi điện Khẩn cấp (Voice Calls)
              </div>
              <div className="mt-1 font-bold text-[#262626]">
                {activeEmergencySos.answeredBy > 0 ? (
                  <span className="text-[#389E0D]">
                    ✓ Liên hệ ưu tiên #{activeEmergencySos.answeredBy} đã nghe
                    máy (ANSWERED)
                  </span>
                ) : (
                  <span className="text-[#CF1322]">
                    ✕ Chưa có người bắt máy (answeredBy: 0)
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {activeEmergencySos.calls.map((c) => (
                  <span
                    key={`${c.priority}_${c.phone}`}
                    className="rounded bg-[#FAFAFA] border border-[#D9D9D9] px-1.5 py-0.5 font-mono text-[10.5px] text-[#262626]"
                  >
                    #{c.priority} {formatPhoneForDisplay(c.phone)}: {c.result}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOADING / ERROR / NO DATA STATES */}
      {telemetryLoading && (
        <div className="rounded-lg border border-[#91D5FF] bg-[#E6F7FF] p-3.5 flex items-center gap-3 text-xs text-[#0050B3]">
          <Loader2 className="h-4 w-4 animate-spin text-[#1890FF] shrink-0" />
          <span>
            Đang kết nối và tải dữ liệu từ{' '}
            <code>/helmets/{targetDeviceId}/status</code>...
          </span>
        </div>
      )}

      {!telemetryLoading && telemetryError && (
        <div className="rounded-lg border border-[#FFD591] bg-[#FFF7E6] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#FA8C16] shrink-0 mt-0.5" />
            <div className="text-xs text-[#262626] space-y-1">
              <div className="font-bold text-[#AD4E00]">
                {telemetryErrorCode === 'CONFIG_MISSING'
                  ? 'Chưa cấu hình khóa kết nối (.env)'
                  : telemetryErrorCode === 'PERMISSION_DENIED'
                    ? 'Yêu cầu đăng nhập tài khoản xác thực'
                    : 'Lỗi kết nối dữ liệu'}
              </div>
              <p className="text-[#595959]">{telemetryError}</p>
            </div>
          </div>

          {telemetryErrorCode === 'PERMISSION_DENIED' && (
            <button
              onClick={() => onNavigateTab('auth')}
              className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[#1890FF] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#40A9FF] transition"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Đăng nhập ngay
            </button>
          )}
        </div>
      )}

      {/* OFFLINE TIMEOUT NOTICE (> 16s) — Always shown when lastSeen is stale, regardless of deepSleep=true or online=true */}
      {!telemetryLoading && telemetry && isStale && (
        <div className="rounded-lg border border-[#FFA39E] bg-[#FFF1F0] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#CF1322]">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F5222D] text-white">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <span>
              <strong className="font-bold">
                Thiết bị Offline (Timeout &gt; 16 giây):
              </strong>{' '}
              Đã ngưng nhận gói tin mới cách đây{' '}
              <strong>{secondsSinceUpdate} giây</strong>
              {rawOnlineFlag
                ? ' (cờ status.online=true chỉ là trạng thái lưu cuối trước khi ngắt kết nối/ngủ).'
                : '.'}
            </span>
          </div>
          <span className="font-mono font-semibold text-[#A8071A] shrink-0">
            Last Seen: {formatLastSeen()}
          </span>
        </div>
      )}

      {/* TOP 4 METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: CAS-BOX Status (fw, deepSleep feature flag, configVersion, lastSeen) */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>CAS-BOX của {ownerName}</span>
              <ShieldCheck className="h-4 w-4 text-[#1890FF]" />
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-lg sm:text-xl font-bold text-[#262626] tracking-tight truncate">
                {displayDeviceId}
              </span>
              {renderDeviceStatusBadge()}
            </div>

            <div className="mt-3.5 space-y-1.5 text-xs text-[#595959]">
              <div className="flex items-center justify-between">
                <span>Firmware (fw):</span>
                <span className="font-mono font-bold text-[#1890FF]">
                  {displayFirmware}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tính năng Deep Sleep:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${deepSleepFeatureEnabled
                      ? 'bg-[#E6F7FF] text-[#0050B3]'
                      : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  <Moon className="h-3 w-3" />
                  {telemetry?.deepSleep === undefined
                    ? '--'
                    : deepSleepFeatureEnabled
                      ? 'Đang bật (true)'
                      : 'Đang tắt (false)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Uptime / Config:</span>
                <span className="font-mono font-semibold text-[#262626]">
                  <span className="text-[#52C41A]">
                    ▲ {formatUptime(uptimeSeconds)}
                  </span>{' '}
                  <span className="text-[#8C8C8C]">
                    (v{configVersion ?? modeConfigVersion})
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-[#F0F0F0] flex items-center justify-between gap-2 text-xs text-[#595959]">
            <span className="shrink-0">Last Seen:</span>
            <span className="font-mono font-semibold text-[#262626] truncate">
              {formatLastSeen()}
            </span>
          </div>
        </div>

        {/* Card 2: Pin & Cấu hình (configNote) */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Pin &amp; Điện áp</span>
              {isLowBatt ? (
                <BatteryWarning className="h-4 w-4 text-[#FAAD14]" />
              ) : (
                <Battery className="h-4 w-4 text-[#13C2C2]" />
              )}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                className={`text-2xl font-bold ${isLowBatt ? 'text-[#FAAD14]' : 'text-[#262626]'
                  }`}
              >
                {batteryPercentage}%
              </span>

              <span className="text-xs font-medium text-[#595959]">
                {smartBattery.estimatedTimeText}
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="h-9 w-full overflow-hidden">
                <svg
                  viewBox="0 0 240 44"
                  className="h-full w-full"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,44 L0,28 C30,14 55,34 85,18 C115,4 140,26 175,10 C205,-2 225,22 240,14 L240,44 Z"
                    fill="#36CBCB"
                    fillOpacity="0.28"
                  />
                  <path
                    d="M0,44 L0,34 C35,24 65,38 100,24 C135,12 165,32 200,18 C220,10 230,24 240,20 L240,44 Z"
                    fill="#1890FF"
                    fillOpacity="0.45"
                  />
                  <path
                    d="M0,28 C30,14 55,34 85,18 C115,4 140,26 175,10 C205,-2 225,22 240,14"
                    fill="none"
                    stroke="#13C2C2"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isLowBatt ? 'bg-[#FAAD14]' : 'bg-[#13C2C2]'
                    }`}
                  style={{ width: `${batteryPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between gap-2 text-xs text-[#595959]">
            <span className="shrink-0">configNote:</span>
            <span
              className="font-mono font-semibold text-[#262626] truncate"
              title={configNote || ''}
            >
              {configNote || '--'}
            </span>
          </div>
        </div>

        {/* Card 3: Kết nối Wi-Fi & IP (status/ip & status/wifiRssi) */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>
                Kết nối Wi-Fi{' '}
                {wifiRssiDbm !== null ? `(${wifiRssiDbm} dBm)` : ''}
              </span>
              {hasNetworkConnection ? (
                <Wifi className="h-4 w-4 text-[#1890FF]" />
              ) : (
                <WifiOff className="h-4 w-4 text-slate-400" />
              )}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                className={`text-xl font-bold ${!telemetry
                    ? 'text-[#262626]'
                    : hasNetworkConnection
                      ? 'text-[#389E0D]'
                      : 'text-[#CF1322]'
                  }`}
              >
                {!telemetry
                  ? 'Chưa có dữ liệu'
                  : hasNetworkConnection
                    ? 'Online (Đang kết nối)'
                    : 'Offline (Ngưng gửi tin)'}
              </span>
              {simMode && (
                <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#0050B3]">
                  SIM: {simMode}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-end justify-between gap-2.5 h-11 px-1">
              {[45, 85, 70, 40, 65].map((barH, idx) => (
                <div
                  key={idx}
                  style={{ height: `${barH}%` }}
                  className={`flex-1 rounded-xs transition-all ${hasNetworkConnection ? 'bg-[#1890FF]' : 'bg-slate-200'
                    }`}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>
              IP:{' '}
              <strong className="font-mono text-[#262626]">
                {deviceIp || '--'}
              </strong>
            </span>
            <span>
              Sync:{' '}
              <strong className="text-[#262626]">{syncReason || '--'}</strong>
            </span>
          </div>
        </div>

        {/* Card 4: Định vị GPS (status/gps V2.4.3-dev: CURRENT / OLD / NONE & updatedAt) */}
        <div
          onClick={() => onNavigateTab('gps')}
          className="cursor-pointer group rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#1890FF] transition flex flex-col justify-between"
        >
          <div>
                <div className="flex items-center justify-between gap-1 text-xs text-[#8C8C8C]">
                  <span className="truncate">
                    GPS (
                    {gpsStatus.rawType === 'CURRENT'
                      ? gpsStatus.isFreshRealtime
                        ? 'CURRENT • Realtime'
                        : 'CURRENT • Đã tải từ lâu'
                      : gpsStatus.rawType === 'OLD'
                        ? 'OLD • Vị trí cuối đã biết'
                        : 'NONE • Chưa có định vị'}
                    )
                  </span>
                  <MapPin
                className={`h-4 w-4 shrink-0 ${gpsStatus.rawType === 'CURRENT' && gpsStatus.isFreshRealtime
                        ? 'text-[#52C41A]'
                        : gpsStatus.rawType === 'NONE'
                          ? 'text-[#CF1322]'
                          : 'text-[#FAAD14]'
                      }`}
                  />
                </div>

                <div className="mt-2">
                    {
                      gpsStatus.rawType === 'CURRENT' &&
                        gpsStatus.lat !== null &&
                        gpsStatus.lon !== null ? (
                        <>
                          <div className="text-[13.5px] font-bold text-[#262626] line-clamp-2 leading-snug">
                            {addressLoading
                              ? 'Đang trích xuất địa chỉ...'
                              : resolvedAddress ||
                            `${gpsStatus.lat.toFixed(5)}, ${gpsStatus.lon.toFixed(
                              5
                            )}`}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-xs">
                            <span className="font-mono text-[#595959]">
                              {gpsStatus.lat.toFixed(5)}, {gpsStatus.lon.toFixed(5)}
                            </span>
                            {gpsStatus.googleMapsUrl && (
                              <a
                                href={gpsStatus.googleMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 font-semibold text-[#1890FF] hover:underline"
                              >
                                Maps
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-[#595959] truncate">
                            {gpsStatus.isStaleCurrentUpload ? (
                              <span className="text-[#D46B08] font-medium">
                                ⚠ Upload: {gpsStatus.updatedAtText} (Không phải
                                realtime)
                              </span>
                            ) : (
                              <span>Cập nhật: {gpsStatus.updatedAtText}</span>
                            )}
                          </div>
                        </>
                      ) : gpsStatus.rawType === 'OLD' &&
                        gpsStatus.displayLat !== null &&
                        gpsStatus.displayLon !== null ? (
                        <>
                          <div className="inline-flex items-center gap-1 rounded bg-[#FFF7E6] border border-[#FFD591] px-1.5 py-0.5 text-[10.5px] font-bold text-[#AD4E00] mb-1">
                            ⚠ Vị trí cuối cùng đã biết (lastLat/lastLon)
                          </div>
                          <div className="text-[13px] font-bold text-[#262626] line-clamp-1 leading-snug">
                            {addressLoading
                              ? 'Đang trích xuất địa chỉ...'
                              : resolvedAddress ||
                              `${gpsStatus.displayLat.toFixed(
                                5
                              )}, ${gpsStatus.displayLon.toFixed(5)}`}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs">
                            <span className="font-mono text-[#AD4E00]">
                              {gpsStatus.displayLat.toFixed(5)},{' '}
                              {gpsStatus.displayLon.toFixed(5)}
                            </span>
                            {gpsStatus.googleMapsUrl && (
                              <a
                                href={gpsStatus.googleMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 font-semibold text-[#1890FF] hover:underline"
                              >
                                Maps
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </>
                      ) : (
                <div className="py-1.5">
                  <div className="text-sm font-bold text-[#CF1322]">
                    Chưa có dữ liệu định vị (NONE)
                  </div>
                  <p className="text-xs text-[#8C8C8C] mt-1">
                    Chưa có tọa độ thực tại <code>status/gps</code> (Không tạo
                    tọa độ giả).
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>
              Sats:{' '}
              <strong className="text-[#262626]">
                {gpsStatus.sats ?? '--'}
              </strong>{' '}
              • HDOP:{' '}
              <strong className="text-[#262626]">
                {gpsStatus.hdop ?? '--'}
              </strong>{' '}
              • UART:{' '}
              <strong className="text-[#262626]">
                {gpsStatus.uartOpen === null
                  ? '--'
                  : gpsStatus.uartOpen
                  ? 'ON'
                  : 'OFF'}
              </strong>
            </span>
            <span className="font-semibold text-[#1890FF] group-hover:underline">
              Bản đồ →
            </span>
          </div>
        </div>
      </div>

                {/* NEW: SMARTHELMET V2.4.2-DEV FIRMWARE DIAGNOSTICS & CONTACT VERIFICATION BAR (Requirement 6) */}
                <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#F0F0F0]">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-[#1890FF]" />
                      <h3 className="text-sm font-bold text-[#262626]">
                        Thông số Firmware SmartHelmet V2.4.2-dev &amp; Xác thực Danh bạ (
                        <code>/helmets/{targetDeviceId}/status</code>)
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold border ${contactSyncComparison.isSynced
                            ? 'bg-[#F6FFED] text-[#389E0D] border-[#B7EB8F]'
                            : 'bg-[#FFF7E6] text-[#D46B08] border-[#FFD591]'
                          }`}
                      >
                        Danh bạ: {contactSyncComparison.statusLabel}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold border ${contactConfigVerified
                            ? 'bg-[#F6FFED] text-[#389E0D] border-[#B7EB8F]'
                            : 'bg-[#FFF1F0] text-[#CF1322] border-[#FFA39E]'
                          }`}
                      >
                        contactConfigVerified: {String(contactConfigVerified)}
                      </span>
                    </div>
                  </div>

                  {/* 6 V2.4.2-dev Diagnostic Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 text-xs">
                    <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2.5">
                      <span className="text-[11px] text-[#8C8C8C] block">
                        autoRealSos (Tự phát SOS thật)
                      </span>
                      <strong
                        className={`font-mono text-sm mt-0.5 block ${autoRealSos === true
                            ? 'text-[#389E0D]'
                            : autoRealSos === false
                              ? 'text-[#D46B08]'
                              : 'text-[#262626]'
                          }`}
                      >
                        {autoRealSos === undefined
                          ? '--'
                          : autoRealSos
                            ? 'true (Đang bật)'
                            : 'false (Đang tắt)'}
                      </strong>
                    </div>

                    <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2.5">
                      <span className="text-[11px] text-[#8C8C8C] block">
                        sosTestMode (Chế độ Test SOS)
                      </span>
                      <strong
                        className={`font-mono text-sm mt-0.5 block ${sosTestMode === true
                            ? 'text-[#0050B3]'
                            : sosTestMode === false
                              ? 'text-[#389E0D]'
                              : 'text-[#262626]'
                          }`}
                      >
                        {sosTestMode === undefined
                          ? '--'
                          : sosTestMode
                            ? 'true (Test Mode)'
                            : 'false (Real SOS)'}
                      </strong>
                    </div>

                    <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2.5">
                      <span className="text-[11px] text-[#8C8C8C] block">
                        cancelWindowSec (Chờ hủy SOS)
                      </span>
                      <strong className="font-mono text-sm text-[#1890FF] mt-0.5 block">
                        {cancelWindowSec} giây
                      </strong>
                    </div>

                    <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2.5">
                      <span className="text-[11px] text-[#8C8C8C] block">
                        activeContactCount (Số liên hệ)
                      </span>
                      <strong className="font-mono text-sm text-[#262626] mt-0.5 block">
                        {activeContactCount} liên hệ
                      </strong>
                    </div>

                    <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2.5">
                      <span className="text-[11px] text-[#8C8C8C] block">
                        deepSleep (Tính năng ngủ sâu)
                      </span>
                      <strong className="font-mono text-sm text-[#262626] mt-0.5 block">
                        {telemetry?.deepSleep === undefined
                          ? '--'
                          : deepSleepFeatureEnabled
                            ? 'true (Enabled)'
                            : 'false (Disabled)'}
                      </strong>
                    </div>

                    <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2.5">
                      <span className="text-[11px] text-[#8C8C8C] block">
                        imuFault (Phần cứng MPU6050)
                      </span>
                      <strong
                        className={`font-mono text-sm mt-0.5 block ${imuFault ? 'text-[#CF1322]' : 'text-[#389E0D]'
                          }`}
                      >
                        {telemetry?.imuFault === undefined
                          ? '--'
                          : imuFault
                            ? 'true (Lỗi IMU!)'
                            : 'false (Tốt)'}
                      </strong>
                    </div>
                  </div>

                  {/* contactChannels Breakdown */}
                  <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#595959]">
                        Kênh liên hệ trên ESP32 (<code>contactChannels</code> • nguồn:{' '}
                        <code>{contactSource || '--'}</code>):
                      </span>
                      {espContactSlots.length === 0 ? (
                        <span className="text-[#8C8C8C]">
                          Chưa có slot p1..p5 trong status
                        </span>
                      ) : (
                        espContactSlots.map((slot) => (
                          <span
                            key={slot.slot}
                            className="inline-flex items-center gap-1.5 rounded bg-white border border-[#91D5FF] px-2.5 py-1 font-mono text-[11px]"
                          >
                            <strong className="text-[#1890FF] uppercase">
                              {slot.slot} (#{slot.priority}):
                            </strong>
                            <span className="font-bold text-[#262626]">
                              {formatPhoneForDisplay(slot.phone)}
                            </span>
                            <span className="text-[#595959]">
                              [SMS:{slot.smsEnabled ? 'ON' : 'OFF'} | Call:
                              {slot.callEnabled ? 'ON' : 'OFF'}]
                            </span>
                          </span>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('contacts')}
                      className="self-start sm:self-auto shrink-0 font-semibold text-[#1890FF] hover:underline"
                    >
                      Quản lý danh bạ →
                    </button>
                  </div>
                </div>

                {/* 4 OPERATING MODES SELECTOR & ESP32 CONFIG SYNC / ACK PANEL */}
                <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6F7FF] text-[#1890FF]">
                        <Sliders className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-[#262626]">
                            Chế độ hoạt động &amp; Đồng bộ cấu hình ESP32
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${activeModeProfile.badgeBg} ${activeModeProfile.badgeText} ${activeModeProfile.badgeBorder}`}
                          >
                            {renderModeIcon(activeModeProfile.id, 'h-3.5 w-3.5')}
                            <span>
                              {activeModeProfile.label} ({activeModeProfile.englishKey})
                            </span>
                          </span>
                        </div>
                        <p className="text-xs text-[#8C8C8C] mt-0.5">
                          {activeModeProfile.shortDesc} • Tự động lưu NVS Flash trên ESP32
                          &amp; đổi Marker bản đồ theo chế độ
                        </p>
                      </div>
                    </div>

                    {/* Config Sync Status Badge */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {modeSyncState === 'SYNCING' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F7FF] border border-[#91D5FF] px-3 py-1 text-xs font-semibold text-[#0050B3]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1890FF]" />
                          <span>
                            Pending Sync (Web v{modeConfigVersion} • ESP32 v
                            {configVersion ?? '--'})
                          </span>
                        </span>
                      ) : modeSyncState === 'WAITING_ONLINE' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-3 py-1 text-xs font-semibold text-[#D46B08]">
                          <Clock className="h-3.5 w-3.5 text-[#FA8C16]" />
                          <span>
                            Pending Sync (Chờ ESP32 Online • v{modeConfigVersion})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6FFED] border border-[#B7EB8F] px-3 py-1 text-xs font-semibold text-[#389E0D]">
                          <Check className="h-3.5 w-3.5 text-[#52C41A]" />
                          <span>Synced / Đã áp dụng (ACK v{configVersion ?? modeConfigVersion})</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4 Mode Buttons: Mũ bảo hiểm, Xe lăn, Xe máy, Balo */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {allModes.map((m) => {
                      const isSelected = m.id === activeModeProfile.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelectMode(m.id)}
                          className={`group text-left rounded-lg border p-3.5 transition-all flex flex-col justify-between ${isSelected
                              ? 'border-[#1890FF] bg-[#E6F7FF]/45 shadow-[0_0_0_2px_rgba(24,144,255,0.14)]'
                              : 'border-[#E8E8E8] bg-[#FAFAFA] hover:border-[#91D5FF] hover:bg-white'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                style={{
                                  backgroundColor: isSelected ? m.accentColor : '#FFFFFF',
                                  color: isSelected ? '#FFFFFF' : m.accentColor,
                                  borderColor: m.accentColor,
                                }}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-2xs transition-colors"
                              >
                                {renderModeIcon(m.id, 'h-4 w-4')}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-[#262626] flex items-center gap-1.5">
                                  <span>{m.label}</span>
                                  <span className="font-mono text-[11px] font-normal text-[#8C8C8C]">
                                    ({m.englishKey})
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#595959] line-clamp-1 mt-0.5">
                                  {m.shortDesc}
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1890FF] text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-[#E8E8E8]/80 grid grid-cols-3 gap-1.5 text-[11px]">
                            <div className="rounded bg-white px-2 py-1 border border-[#F0F0F0]">
                              <span className="text-[#8C8C8C] block">G-Shock</span>
                              <strong className="font-mono text-[#262626]">
                                ≥ {m.thresholds.impactThresholdG}g
                              </strong>
                            </div>
                            <div className="rounded bg-white px-2 py-1 border border-[#F0F0F0]">
                              <span className="text-[#8C8C8C] block">Nghiêng</span>
                              <strong className="font-mono text-[#262626]">
                                ≥ {m.thresholds.tiltAngleThresholdDeg}°
                              </strong>
                            </div>
                            <div className="rounded bg-white px-2 py-1 border border-[#F0F0F0]">
                              <span className="text-[#8C8C8C] block">Con quay</span>
                              <strong className="font-mono text-[#262626]">
                                ≥ {m.thresholds.gyroThresholdDps}°/s
                              </strong>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* MIDDLE SECTION: MPU6050 MONITORING (/helmets/{deviceId}/status/mpu) */}
                <div className="rounded-lg border border-[#E8E8E8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-3.5 pb-0 border-b border-[#F0F0F0]">
                    <div className="flex items-center gap-6">
                      <div className="border-b-2 border-[#1890FF] pb-3 text-sm font-semibold text-[#1890FF] flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        <span>Giám sát cảm biến MPU6050 (status/mpu)</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pb-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium border ${sosPending
                            ? 'bg-[#FFF1F0] text-[#CF1322] border-[#FFA39E]'
                            : 'bg-[#FAFAFA] text-[#595959] border-[#D9D9D9]'
                          }`}
                      >
                        SOS Pending:{' '}
                        <strong className="text-[#262626]">
                          {telemetry?.sosPending === undefined
                            ? '--'
                            : sosPending
                              ? 'Đang chờ (true)'
                              : 'Không (false)'}
                        </strong>
                      </span>

                      {telemetry?.imuFault === false || mpuValid === true ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-1 text-xs font-medium text-[#389E0D]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
                          IMU Hoạt động tốt (imuFault: false)
                        </span>
                      ) : imuFault ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-[#FFF1F0] border border-[#FFA39E] px-2.5 py-1 text-xs font-medium text-[#CF1322]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#F5222D]" />
                          Lỗi cảm biến IMU (imuFault: true)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded bg-[#FAFAFA] border border-[#D9D9D9] px-2.5 py-1 text-xs font-medium text-[#595959]">
                          Chưa có trạng thái IMU
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {imuFault && (
                      <div className="rounded-lg border border-[#FFA39E] bg-[#FFF1F0] p-4 text-xs text-[#CF1322] flex items-center gap-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          <strong>Cảnh báo lỗi cảm biến (imuFault = true):</strong> ESP32
                          phát hiện lỗi giao tiếp với cảm biến MPU6050.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      {/* Gyro Magnitude & Total Accel Card (3 cols) */}
                      <div className="lg:col-span-3 rounded-lg border border-[#91D5FF] bg-[#E6F7FF]/60 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#0050B3]">
                            Độ lớn vận tốc góc
                          </span>
                          <span className="rounded bg-[#1890FF] px-2 py-0.5 text-[10px] font-bold text-white">
                            gyroMagnitudeDps
                          </span>
                        </div>
                        <div className="my-2.5">
                          <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#002766]">
                            {gyroMagnitudeDps !== null
                              ? `${gyroMagnitudeDps.toFixed(2)} °/s`
                              : '--'}
                          </span>
                        </div>
                        <div className="text-xs text-[#0050B3] pt-2 border-t border-[#91D5FF]/60 flex items-center justify-between">
                          <span>
                            totalG:{' '}
                            <strong className="font-mono text-[#002766]">
                              {accelMagnitudeG !== null ? `${accelMagnitudeG} g` : '--'}
                            </strong>
                          </span>
                          <span>
                            tiltDeg:{' '}
                            <strong className="font-mono text-[#002766]">
                              {mpuTiltDeg !== null ? `${mpuTiltDeg}°` : '--'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Acceleration X, Y, Z (g) (5 cols) */}
                      <div className="lg:col-span-5 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-[#262626]">
                            Gia tốc 3 trục — accel (đơn vị: g)
                          </span>
                          <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#1890FF]">
                            accel.x / y / z
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                            <span className="text-[11px] font-medium text-[#8C8C8C] block">
                              accel.x (g)
                            </span>
                            <strong className="font-mono text-base font-bold text-[#1890FF] mt-1 block">
                              {accelX !== null ? accelX.toFixed(3) : '--'}
                            </strong>
                          </div>
                          <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                            <span className="text-[11px] font-medium text-[#8C8C8C] block">
                              accel.y (g)
                            </span>
                            <strong className="font-mono text-base font-bold text-[#1890FF] mt-1 block">
                              {accelY !== null ? accelY.toFixed(3) : '--'}
                            </strong>
                          </div>
                          <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                            <span className="text-[11px] font-medium text-[#8C8C8C] block">
                              accel.z (g)
                            </span>
                            <strong className="font-mono text-base font-bold text-[#1890FF] mt-1 block">
                              {accelZ !== null ? accelZ.toFixed(3) : '--'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Gyroscope X, Y, Z (°/s) (4 cols) */}
                      <div className="lg:col-span-4 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-[#262626]">
                            Vận tốc góc 3 trục — gyro (°/s)
                          </span>
                          <span className="rounded bg-[#E6FFFB] border border-[#87E8DE] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#13C2C2]">
                            gyro.x / y / z
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                            <span className="text-[11px] font-medium text-[#8C8C8C] block">
                              gyro.x (°/s)
                            </span>
                            <strong className="font-mono text-base font-bold text-[#006D75] mt-1 block">
                              {gyroX !== null ? gyroX.toFixed(2) : '--'}
                            </strong>
                          </div>
                          <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                            <span className="text-[11px] font-medium text-[#8C8C8C] block">
                              gyro.y (°/s)
                            </span>
                            <strong className="font-mono text-base font-bold text-[#006D75] mt-1 block">
                              {gyroY !== null ? gyroY.toFixed(2) : '--'}
                            </strong>
                          </div>
                          <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                            <span className="text-[11px] font-medium text-[#8C8C8C] block">
                              gyro.z (°/s)
                            </span>
                            <strong className="font-mono text-base font-bold text-[#006D75] mt-1 block">
                              {gyroZ !== null ? gyroZ.toFixed(2) : '--'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RAW SENSOR DATA & LIVE IN-MEMORY SAMPLING CHART */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 pt-1">
                      {/* Dynamic status/mpu/raw Inspector (6 cols) */}
                      <div className="lg:col-span-6 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-semibold text-[#262626] flex items-center gap-1.5">
                            <Cpu className="h-3.5 w-3.5 text-[#1890FF]" />
                            Dữ liệu cảm biến thô (status/mpu/raw)
                          </span>
                          <span className="text-[11px] text-[#8C8C8C]">
                            {rawSensorEntries.length > 0
                              ? `${rawSensorEntries.length} trường con`
                              : 'Tự động đọc các trường con'}
                          </span>
                        </div>

                        {rawSensorEntries.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {rawSensorEntries.map((item) => (
                              <div
                                key={item.key}
                                className="rounded bg-white border border-[#E8E8E8] px-2.5 py-1.5 flex items-center justify-between text-xs"
                              >
                                <span className="font-mono text-[#8C8C8C] truncate mr-1">
                                  {item.key}:
                                </span>
                                <strong className="font-mono text-[#262626]">
                                  {item.value}
                                </strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded bg-white border border-[#E8E8E8] p-3 text-xs text-[#8C8C8C]">
                            Chưa có trường con trong <code>status/mpu/raw</code> hoặc
                            thiết bị chưa gửi nhánh <code>raw</code>.
                          </div>
                        )}
                      </div>

                      {/* Live In-Memory Sampling Trend while Website is open (6 cols) */}
                      <div className="lg:col-span-6 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#262626]">
                            Biểu đồ thu thập mẫu trực tiếp ({liveSamples.length} mẫu trong
                            phiên mở)
                          </span>
                          <span className="text-[11px] font-mono text-[#1890FF]">
                            |accel| (g) &amp; gyro (°/s)
                          </span>
                        </div>

                        {liveSamples.length > 0 ? (
                          <div className="flex items-end gap-1.5 h-16 pt-2 px-1 bg-white rounded border border-[#E8E8E8]">
                            {liveSamples.map((s, idx) => {
                              const heightPct = Math.min(
                                100,
                                Math.max(15, Math.round((s.accelTotalG / 3.0) * 100))
                              );
                              return (
                                <div
                                  key={idx}
                                  title={`${s.timeLabel} — |a|: ${s.accelTotalG}g | gyro: ${s.gyroMagnitudeDps}°/s`}
                                  className="flex-1 flex flex-col items-center justify-end h-full group"
                                >
                                  <div
                                    style={{ height: `${heightPct}%` }}
                                    className="w-full max-w-[18px] rounded-t-xs bg-[#1890FF] group-hover:bg-[#096DD9] transition-all"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded bg-white border border-[#E8E8E8] p-3 text-xs text-[#8C8C8C]">
                            Đang chờ nhận mẫu mới từ{' '}
                            <code>/helmets/{targetDeviceId}/status</code>...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM SECTION: REAL FIREBASE SOS EVENTS & EMERGENCY CONTACTS RANKING */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  {/* Left: Recent Real SOS Events from Firebase (7 cols) */}
                  <div className="lg:col-span-7 rounded-lg border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F0F0F0]">
                      <div>
                        <h3 className="text-sm font-semibold text-[#262626]">
                          Sự cố SOS gần đây trên Firebase ({realSosEvents.length} bản ghi
                          thật)
                        </h3>
                        <p className="text-[11px] text-[#8C8C8C]">
                          Đọc trực tiếp từ <code>/helmets/{targetDeviceId}/sos</code> &amp;{' '}
                          <code>/events</code> (đã cách ly <code>testEvents</code>)
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigateTab('events')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#1890FF] hover:underline"
                      >
                        <span>Xem tất cả</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {realSosEvents.length === 0 ? (
                        <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-6 text-center text-xs text-[#8C8C8C]">
                          Chưa có sự cố SOS thật nào trên thiết bị{' '}
                          <code>{targetDeviceId}</code>.
                        </div>
                      ) : (
                        realSosEvents.slice(0, 4).map((evt) => {
                          const isActive = evt.active === true && evt.resolved !== true;
                          const isResolved = evt.resolved === true;

                          return (
                            <div
                              key={evt.id}
                              onClick={() => onNavigateTab('events')}
                              className={`cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-lg border px-4 py-3 transition ${isActive
                                  ? 'border-[#FFA39E] bg-[#FFF1F0]/50 hover:bg-[#FFF1F0]'
                                  : 'border-[#E4E7EC] bg-white hover:border-slate-300 hover:bg-[#FAFAFB]'
                                }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs ${isActive
                                      ? 'bg-[#F5222D]'
                                      : isResolved
                                        ? 'bg-[#52C41A]'
                                        : 'bg-[#FA8C16]'
                                    }`}
                                >
                                  {isResolved ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <AlertOctagon className="h-4 w-4" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-[#262626]">
                                      SOS #{evt.id}
                                    </span>
                                    <span
                                      className={`rounded px-2 py-0.5 text-[10.5px] font-semibold text-white ${isActive
                                          ? 'bg-[#F5222D]'
                                          : isResolved
                                            ? 'bg-[#52C41A]'
                                            : 'bg-[#FA8C16]'
                                        }`}
                                    >
                                      {isActive
                                        ? 'Đang khẩn cấp'
                                        : isResolved
                                          ? 'Đã xử lý'
                                          : 'Lịch sử SOS'}
                                    </span>
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-mono text-slate-700">
                                      GPS: {evt.loc.type}
                                    </span>
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#64748B]">
                                    <span>
                                      SMS Submitted:{' '}
                                      <strong className="text-[#262626]">
                                        {evt.sms.sent}/{evt.sms.targets}
                                      </strong>
                                    </span>
                                    <span>
                                      • Nghe máy:{' '}
                                      <strong className="text-[#262626]">
                                        {evt.answeredBy > 0
                                          ? `#${evt.answeredBy}`
                                          : 'Chưa ai (0)'}
                                      </strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-left sm:text-right">
                                <span className="inline-block rounded bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-semibold text-[#1E293B]">
                                  Upload:{' '}
                                  {evt.pushedAt
                                    ? formatToVietnamTimezone(
                                      new Date(evt.pushedAt),
                                      false
                                    )
                                    : '--'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Family Emergency Contacts & V2.4.2-dev Sync Status (5 cols) */}
                  <div className="lg:col-span-5 rounded-lg border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F0F0F0]">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[#262626]">
                            Người thân nhận cảnh báo
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold border ${contactSyncComparison.isSynced
                                ? 'bg-[#F6FFED] text-[#389E0D] border-[#B7EB8F]'
                                : 'bg-[#FFF7E6] text-[#D46B08] border-[#FFD591]'
                              }`}
                          >
                            {contactSyncComparison.statusLabel}
                          </span>
                        </div>
                        <button
                          onClick={() => onNavigateTab('contacts')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1890FF] hover:underline"
                        >
                          <span>Chỉnh sửa</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {contacts.length === 0 ? (
                          <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 text-center text-xs text-[#8C8C8C]">
                            Chưa có danh bạ trong{' '}
                            <code>/helmets/{targetDeviceId}/emergencyContacts</code>. Bấm
                            "Chỉnh sửa" để đồng bộ hoặc thêm mới.
                          </div>
                        ) : (
                          [...contacts]
                            .sort((a, b) => a.priority - b.priority)
                            .map((c) => {
                              const isTopThree = c.priority <= 3;
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => onNavigateTab('contacts')}
                                  className="cursor-pointer group flex items-center justify-between gap-3 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] px-3.5 py-2.5 hover:border-[#91D5FF] hover:bg-[#E6F7FF]/30 transition"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isTopThree
                                          ? 'bg-[#314659] text-white'
                                          : 'bg-[#F0F2F5] text-[#595959]'
                                        }`}
                                    >
                                      {c.priority}
                                    </span>

                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[13px] font-semibold text-[#262626] truncate">
                                          {c.name}
                                        </span>
                                        <span className="text-xs text-[#8C8C8C]">
                                          ({c.relationship})
                                        </span>
                                      </div>

                                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#595959]">
                                        <Phone className="h-3 w-3 text-[#8C8C8C] shrink-0" />
                                        <span className="font-mono">
                                          {formatPhoneForDisplay(c.phone)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {(c.smsEnabled ?? c.receiveSms) && (
                                      <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-medium text-[#1890FF]">
                                        SMS
                                      </span>
                                    )}
                                    {(c.callEnabled ?? c.receiveCall) && (
                                      <span className="rounded bg-[#F6FFED] border border-[#B7EB8F] px-2 py-0.5 text-[11px] font-medium text-[#52C41A]">
                                        Gọi
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
                      <span className="text-[#8C8C8C]">
                        Thời gian chờ hủy báo động (cancelWindowSec)
                      </span>
                      <span className="font-semibold text-[#262626]">
                        {cancelWindowSec} giây
                      </span>
                    </div>
                  </div>
                </div>
            </div>
            );
};
