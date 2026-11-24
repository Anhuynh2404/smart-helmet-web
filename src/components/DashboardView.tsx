import React from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Battery,
  BatteryWarning,
  Check,
  ChevronRight,
  Clock,
  Cpu,
  KeyRound,
  Loader2,
  MapPin,
  Moon,
  Phone,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { TelemetryErrorCode } from '../hooks/useHelmetTelemetry';
import { SmartBatteryEstimate } from '../hooks/useSmartBatteryEstimator';
import { formatPhoneForDisplay } from '../services/emergencyContactsService';
import {
  DeviceConfiguration,
  EmergencyContact,
  FirebaseHelmetTelemetry,
  HelmetDeviceState,
  HelmetEventLog,
  LiveTelemetrySample,
} from '../types/helmet';

interface DashboardViewProps {
  device: HelmetDeviceState;
  ownerName: string;
  config: DeviceConfiguration;
  contacts: EmergencyContact[];
  recentEvents: HelmetEventLog[];
  telemetry: FirebaseHelmetTelemetry | null;
  liveSamples: LiveTelemetrySample[];
  telemetryLoading: boolean;
  telemetryError: string | null;
  telemetryErrorCode: TelemetryErrorCode;
  firebaseConnected: boolean;
  isStale: boolean;
  secondsSinceUpdate: number | null;
  lastUpdatedDate: Date | null;
  targetDeviceId: string;
  resolvedAddress: string | null;
  addressLoading: boolean;
  smartBattery: SmartBatteryEstimate;
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
  recentEvents,
  telemetry,
  liveSamples,
  telemetryLoading,
  telemetryError,
  telemetryErrorCode,
  isStale,
  secondsSinceUpdate,
  lastUpdatedDate,
  targetDeviceId,
  resolvedAddress,
  addressLoading,
  smartBattery,
  onCancelByButton,
  onCancelByPosture,
  onResetNormalState,
  onNavigateTab,
}) => {
  // 1. Device status fields from /helmets/helmet01/status
  const displayDeviceId = telemetry?.deviceId || targetDeviceId;
  const displayFirmware =
    telemetry?.fw !== undefined
      ? String(telemetry.fw)
      : telemetry?.firmwareVersion || '--';
  const deepSleep = telemetry?.deepSleep === true;
  const imuFault = telemetry?.imuFault === true;
  const isOnline = telemetry?.online === true;
  const sosPending = telemetry?.sosPending === true;
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

  // 2. Network & IP state
  const hasNetworkConnection =
    isOnline ||
    Boolean(deviceIp && deviceIp !== '0.0.0.0') ||
    telemetry?.network?.wifiConnected === true;

  // 3. Battery fields
  const batteryPercentage = smartBattery.percentage;
  const isLowBatt =
    !smartBattery.isCharging &&
    batteryPercentage <= config.lowBatteryThresholdPercent;

  // 4. GPS fields from /helmets/helmet01/status/gps
  const gpsValid =
    telemetry?.gps?.valid === true || telemetry?.gps?.fix === true;
  const gpsLat =
    typeof telemetry?.gps?.lat === 'number'
      ? telemetry.gps.lat
      : typeof telemetry?.gps?.latitude === 'number'
      ? telemetry.gps.latitude
      : null;
  const gpsLng =
    typeof telemetry?.gps?.lon === 'number'
      ? telemetry.gps.lon
      : typeof telemetry?.gps?.longitude === 'number'
      ? telemetry.gps.longitude
      : null;
  const gpsSatellites =
    typeof telemetry?.gps?.sats === 'number'
      ? telemetry.gps.sats
      : typeof telemetry?.gps?.satellites === 'number'
      ? telemetry.gps.satellites
      : null;
  const gpsHdop =
    typeof telemetry?.gps?.hdop === 'number' ? telemetry.gps.hdop : null;
  const gpsAgeMs =
    typeof telemetry?.gps?.ageMs === 'number' ? telemetry.gps.ageMs : null;

  // 5. MPU6050 fields from /helmets/helmet01/status/mpu
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
          value: typeof v === 'number' ? String(Number(v.toFixed(3))) : String(v),
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

  // 6. Hardware SOS Contact from /helmets/helmet01/status/contacts/p1
  const espSosPhoneP1 =
    typeof telemetry?.contacts?.p1 === 'string' &&
    telemetry.contacts.p1.trim() !== ''
      ? telemetry.contacts.p1.trim()
      : null;

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatLastSeen = () => {
    if (!telemetry) return 'Chưa có dữ liệu';
    if (lastUpdatedDate) {
      return lastUpdatedDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    if (telemetry.lastSeen !== undefined) {
      return String(telemetry.lastSeen);
    }
    if (telemetry.updatedAt !== undefined) {
      return String(telemetry.updatedAt);
    }
    return 'Vừa xong';
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

  const formatGpsAge = (ms: number | null) => {
    if (ms === null || !Number.isFinite(ms)) return '--';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

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
    if (deepSleep) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#E6F7FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#096DD9] border border-[#91D5FF]">
          <Moon className="h-3 w-3 text-[#1890FF]" />
          Deep Sleep
        </span>
      );
    }
    if (isStale) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FFF7E6] px-2.5 py-0.5 text-[11px] font-semibold text-[#D46B08] border border-[#FFD591]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FAAD14]" />
          Mất cập nhật
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6FFED] px-2.5 py-0.5 text-[11px] font-semibold text-[#389E0D] border border-[#B7EB8F]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
        Đang hoạt động
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* LOADING / ERROR / NO DATA STATES */}
      {telemetryLoading && (
        <div className="rounded-lg border border-[#91D5FF] bg-[#E6F7FF] p-3.5 flex items-center gap-3 text-xs text-[#0050B3]">
          <Loader2 className="h-4 w-4 animate-spin text-[#1890FF] shrink-0" />
          <span>
            Đang kết nối và tải dữ liệu từ <code>/helmets/{targetDeviceId}/status</code>...
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

      {/* STALE TELEMETRY NOTICE (> 90s) */}
      {!telemetryLoading && telemetry && isStale && !deepSleep && (
        <div className="rounded-lg border border-[#FFD591] bg-[#FFF7E6] px-4 py-2.5 flex items-center gap-3 text-xs text-[#AD4E00]">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#FAAD14] text-white">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <span>
            <strong className="font-bold">Chưa có dữ liệu mới:</strong> Thiết bị đã quá 90 giây chưa cập nhật dữ liệu mới (lần cuối cách đây {secondsSinceUpdate} giây).
          </span>
        </div>
      )}

      {/* MANUAL DEMO BANNERS */}
      {device.safetyState === 'WARNING_CANCEL_WINDOW' && (
        <div className="rounded-lg border border-[#FFD591] bg-[#FFF7E6] p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#FAAD14] text-white font-bold text-lg">
                {device.cancelCountdownSec ?? 0}s
              </div>
              <div>
                <div className="text-xs font-semibold text-[#D46B08]">
                  Phát hiện va chạm — Đang chờ xác nhận an toàn
                </div>
                <h3 className="mt-0.5 text-base font-bold text-[#262626]">
                  Tín hiệu SOS sẽ tự động gửi đi sau {device.cancelCountdownSec} giây
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onCancelByButton}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1890FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#40A9FF] transition"
              >
                <Check className="h-3.5 w-3.5" />
                Nhấn nút hủy trên mũ
              </button>
              <button
                onClick={onCancelByPosture}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#D9D9D9] bg-white px-3.5 py-2 text-xs font-medium text-[#262626] hover:border-[#1890FF] hover:text-[#1890FF] transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Đã đứng dậy bình thường
              </button>
            </div>
          </div>
        </div>
      )}

      {device.safetyState === 'EMERGENCY_SOS' && (
        <div className="rounded-lg border border-[#FFA39E] bg-[#FFF1F0] p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F5222D] text-white">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#CF1322]">
                  Tín hiệu khẩn cấp SOS
                </div>
                <h2 className="mt-0.5 text-base font-bold text-[#262626]">
                  Đang bật cảnh báo khẩn cấp
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onResetNormalState}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#52C41A] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#73D13D] transition"
              >
                <Check className="h-3.5 w-3.5" />
                Đánh dấu đã an toàn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP 4 METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: CAS-BOX Status (fw, deepSleep, configVersion, lastSeen) */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>CAS-BOX của {ownerName}</span>
              <ShieldCheck className="h-4 w-4 text-[#1890FF]" />
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-xl sm:text-[22px] font-bold text-[#262626] tracking-tight whitespace-nowrap">
                {displayDeviceId}
              </span>
              {renderDeviceStatusBadge()}
            </div>

            <div className="mt-4 space-y-1 text-xs text-[#595959]">
              <div className="flex items-center justify-between">
                <span>Firmware (fw):</span>
                <span className="font-mono font-semibold text-[#262626]">
                  v{displayFirmware}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Uptime / Config:</span>
                <span className="font-mono font-medium text-[#52C41A]">
                  ▲ {formatUptime(uptimeSeconds)}{' '}
                  <span className="text-[#8C8C8C]">
                    (cfg v{configVersion ?? 0})
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>Cập nhật (lastSeen)</span>
            <span className="font-mono font-semibold text-[#262626]">
              {formatLastSeen()}
            </span>
          </div>
        </div>

        {/* Card 2: Pin & Cấu hình (configNote) */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Pin & Điện áp</span>
              {isLowBatt ? (
                <BatteryWarning className="h-4 w-4 text-[#FAAD14]" />
              ) : (
                <Battery className="h-4 w-4 text-[#13C2C2]" />
              )}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                className={`text-2xl font-bold ${
                  isLowBatt ? 'text-[#FAAD14]' : 'text-[#262626]'
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
                  className={`h-full rounded-full transition-all duration-500 ${
                    isLowBatt ? 'bg-[#FAAD14]' : 'bg-[#13C2C2]'
                  }`}
                  style={{ width: `${batteryPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between gap-2 text-xs text-[#595959]">
            <span className="shrink-0">Ghi chú cấu hình</span>
            <span
              className="font-medium text-[#262626] truncate"
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
                Kết nối Wi-Fi {wifiRssiDbm !== null ? `(${wifiRssiDbm} dBm)` : ''}
              </span>
              {hasNetworkConnection ? (
                <Wifi className="h-4 w-4 text-[#1890FF]" />
              ) : (
                <WifiOff className="h-4 w-4 text-slate-400" />
              )}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-[#262626]">
                {!telemetry
                  ? 'Chưa có dữ liệu'
                  : hasNetworkConnection
                  ? 'Đã kết nối'
                  : 'Mất kết nối'}
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
                  className={`flex-1 rounded-xs transition-all ${
                    hasNetworkConnection ? 'bg-[#1890FF]' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>IP: <strong className="font-mono text-[#262626]">{deviceIp || '--'}</strong></span>
            <span>
              Sync: <strong className="text-[#262626]">{syncReason || '--'}</strong>
            </span>
          </div>
        </div>

        {/* Card 4: Định vị GPS (status/gps: lat, lon, sats, hdop, ageMs, valid) */}
        <div
          onClick={() => onNavigateTab('gps')}
          className="cursor-pointer group rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#1890FF] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Định vị GPS ({gpsValid ? 'Hợp lệ' : 'Chưa hợp lệ'})</span>
              <MapPin
                className={`h-4 w-4 ${
                  gpsValid ? 'text-[#1890FF]' : 'text-[#FAAD14]'
                }`}
              />
            </div>

            <div className="mt-2">
              {gpsValid && gpsLat !== null && gpsLng !== null ? (
                <>
                  <div className="text-[14px] font-bold text-[#262626] line-clamp-2 leading-snug">
                    {addressLoading
                      ? 'Đang trích xuất địa chỉ...'
                      : resolvedAddress ||
                        `${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}`}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-mono text-[#8C8C8C]">
                      {gpsLat.toFixed(4)}°N, {gpsLng.toFixed(4)}°E
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${gpsLat},${gpsLng}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 font-semibold text-[#1890FF] hover:underline"
                    >
                      Maps
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <div className="text-base font-bold text-[#FAAD14]">
                    GPS chưa hợp lệ (valid: false)
                  </div>
                  <p className="text-xs text-[#8C8C8C] mt-1">
                    {gpsLat !== null && gpsLng !== null
                      ? `Tọa độ chờ: ${gpsLat.toFixed(4)}, ${gpsLng.toFixed(4)}`
                      : 'Đang dò tín hiệu vệ tinh...'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>
              Sats: <strong className="text-[#262626]">{gpsSatellites ?? '--'}</strong> •
              HDOP: <strong className="text-[#262626]">{gpsHdop ?? '--'}</strong> •
              Age: <strong className="text-[#262626]">{formatGpsAge(gpsAgeMs)}</strong>
            </span>
            <span className="font-semibold text-[#1890FF] group-hover:underline">
              Bản đồ →
            </span>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: MPU6050 MONITORING (/helmets/helmet01/status/mpu) */}
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
            {/* sosPending flag */}
            <span
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium border ${
                sosPending
                  ? 'bg-[#FFF1F0] text-[#CF1322] border-[#FFA39E]'
                  : 'bg-[#FAFAFA] text-[#595959] border-[#D9D9D9]'
              }`}
            >
              SOS Pending:{' '}
              <strong className="text-[#262626]">
                {telemetry?.sosPending === undefined
                  ? '--'
                  : sosPending
                  ? 'Đang kích hoạt'
                  : 'Không (false)'}
              </strong>
            </span>

            {/* Deep Sleep flag */}
            <span
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium border ${
                deepSleep
                  ? 'bg-[#E6F7FF] text-[#096DD9] border-[#91D5FF]'
                  : 'bg-[#FAFAFA] text-[#595959] border-[#D9D9D9]'
              }`}
            >
              Deep Sleep:{' '}
              <strong className="text-[#262626]">
                {telemetry?.deepSleep === undefined
                  ? '--'
                  : deepSleep
                  ? 'Bật (true)'
                  : 'Tắt (false)'}
              </strong>
            </span>

            {/* imuFault status */}
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
                <strong>Cảnh báo lỗi cảm biến (imuFault = true):</strong> ESP32 phát hiện lỗi giao tiếp với cảm biến MPU6050.
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

            {/* Acceleration X, Y, Z (g) (4.5 cols) */}
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
                  Chưa có trường con trong <code>status/mpu/raw</code> hoặc thiết bị chưa gửi nhánh <code>raw</code>.
                </div>
              )}
            </div>

            {/* Live In-Memory Sampling Trend while Website is open (6 cols) */}
            <div className="lg:col-span-6 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#262626]">
                  Biểu đồ thu thập mẫu trực tiếp ({liveSamples.length} mẫu trong phiên mở)
                </span>
                <span className="text-[11px] font-mono text-[#1890FF]">
                  |accel| (g) & gyro (°/s)
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
                  Đang chờ nhận mẫu mới từ <code>/helmets/{targetDeviceId}/status</code>...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: RECENT ACTIVITY & EMERGENCY CONTACTS RANKING */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Recent Activity Timeline (7 cols) */}
        <div className="lg:col-span-7 rounded-lg border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F0F0F0]">
            <h3 className="text-sm font-semibold text-[#262626]">
              Nhật ký hoạt động gần đây
            </h3>
            <button
              onClick={() => onNavigateTab('events')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1890FF] hover:underline"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentEvents.slice(0, 4).map((evt) => {
              const isCritical = evt.severity === 'CRITICAL';
              const isWarning = evt.severity === 'WARNING';

              return (
                <div
                  key={evt.id}
                  onClick={() => onNavigateTab('events')}
                  className="cursor-pointer group flex items-center justify-between gap-3.5 rounded-lg border border-[#E4E7EC] bg-white px-4 py-3 hover:border-slate-300 hover:bg-[#FAFAFB] transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs ${
                        isCritical
                          ? 'bg-[#DC2626]'
                          : isWarning
                          ? 'bg-[#D97706]'
                          : 'bg-[#2563EB]'
                      }`}
                    >
                      {isCritical ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : isWarning ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[13px] font-semibold text-[#262626] truncate">
                          {evt.title}
                        </h4>
                        <span
                          className={`rounded px-2 py-0.5 text-[10.5px] font-semibold text-white ${
                            isCritical
                              ? 'bg-[#DC2626]'
                              : isWarning
                              ? 'bg-[#D97706]'
                              : 'bg-[#2563EB]'
                          }`}
                        >
                          {isCritical
                            ? 'Khẩn cấp'
                            : isWarning
                            ? 'Cảnh báo'
                            : 'An toàn'}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B] truncate">
                        <MapPin className="h-3.5 w-3.5 text-[#475569] shrink-0" />
                        <span className="truncate">{evt.locationName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="inline-block rounded bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 text-xs font-semibold text-[#1E293B]">
                      {formatTime(evt.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Family Emergency Contacts & status/contacts/p1 (5 cols) */}
        {/* Right: Family Emergency Contacts (5 cols) */}
        <div className="lg:col-span-5 rounded-lg border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F0F0F0]">
              <h3 className="text-sm font-semibold text-[#262626]">
                Người thân nhận cảnh báo
              </h3>
              <button
                onClick={() => onNavigateTab('contacts')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#1890FF] hover:underline"
              >
                <span>Chỉnh sửa</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Hardware SOS Contact p1 from /helmets/helmet01/status/contacts/p1 */}
            <div className="mb-3 rounded-lg border border-[#91D5FF] bg-[#E6F7FF]/60 px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1890FF] text-white text-xs font-bold">
                  p1
                </span>
                <div>
                  <div className="text-xs font-semibold text-[#0050B3]">
                    Số SOS trên ESP32 (status/contacts/p1)
                  </div>
                  <div className="text-xs font-mono font-bold text-[#262626]">
                    {espSosPhoneP1
                      ? formatPhoneForDisplay(espSosPhoneP1)
                      : 'Chưa có dữ liệu p1'}
                  </div>
                </div>
              </div>
              <span className="rounded bg-white border border-[#91D5FF] px-2 py-0.5 text-[11px] font-semibold text-[#1890FF]">
                Thiết bị
              </span>
            </div>

            <div className="space-y-2.5">
              {[...contacts]
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
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isTopThree
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
                })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
            <span className="text-[#8C8C8C]">Thời gian chờ hủy báo động</span>
            <span className="font-semibold text-[#262626]">
              {config.cancelWindowSeconds} giây
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
