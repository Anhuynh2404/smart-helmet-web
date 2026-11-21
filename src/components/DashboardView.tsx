import React from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Check,
  ChevronRight,
  Clock,
  KeyRound,
  Loader2,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
  Zap,
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
} from '../types/helmet';

interface DashboardViewProps {
  device: HelmetDeviceState;
  ownerName: string;
  config: DeviceConfiguration;
  contacts: EmergencyContact[];
  recentEvents: HelmetEventLog[];
  telemetry: FirebaseHelmetTelemetry | null;
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
  const displayDeviceId = telemetry?.deviceId || targetDeviceId;
  const displayFirmware = telemetry?.firmwareVersion || '--';
  const rawMode = telemetry?.device?.mode;
  const uptimeSeconds = telemetry?.device?.uptimeSeconds;

  // Wi-Fi fields
  const hasNetworkNode =
    telemetry?.network !== undefined && telemetry?.network !== null;
  const wifiConnected = telemetry?.network?.wifiConnected === true;
  const wifiRssiDbm =
    typeof telemetry?.network?.wifiRssiDbm === 'number'
      ? telemetry.network.wifiRssiDbm
      : null;
  const networkTransport = telemetry?.network?.transport || 'Wi-Fi';

  // Battery fields (Using realistic Li-Po Coulomb-Counting & OCV estimator)
  const batteryPercentage = smartBattery.percentage;
  const batteryVoltage = smartBattery.voltageV;
  const batteryAdcMv = smartBattery.adcRawMv;

  const isLowBatt =
    !smartBattery.isCharging &&
    batteryPercentage <= config.lowBatteryThresholdPercent;

  // GPS fields
  const gpsFix = telemetry?.gps?.fix === true;
  const gpsLat =
    typeof telemetry?.gps?.latitude === 'number' ? telemetry.gps.latitude : null;
  const gpsLng =
    typeof telemetry?.gps?.longitude === 'number'
      ? telemetry.gps.longitude
      : null;
  const gpsSatellites =
    typeof telemetry?.gps?.satellites === 'number'
      ? telemetry.gps.satellites
      : null;
  const gpsHdop =
    typeof telemetry?.gps?.hdop === 'number' ? telemetry.gps.hdop : null;

  // MPU6050 fields
  const mpuAvailable = telemetry?.mpu?.available;
  const mpuAx = typeof telemetry?.mpu?.ax === 'number' ? telemetry.mpu.ax : null;
  const mpuAy = typeof telemetry?.mpu?.ay === 'number' ? telemetry.mpu.ay : null;
  const mpuAz = typeof telemetry?.mpu?.az === 'number' ? telemetry.mpu.az : null;
  const mpuGx = typeof telemetry?.mpu?.gx === 'number' ? telemetry.mpu.gx : null;
  const mpuGy = typeof telemetry?.mpu?.gy === 'number' ? telemetry.mpu.gy : null;
  const mpuGz = typeof telemetry?.mpu?.gz === 'number' ? telemetry.mpu.gz : null;
  const mpuTotalG =
    typeof telemetry?.mpu?.totalG === 'number' ? telemetry.mpu.totalG : null;

  // Button field
  const cancelPressed = telemetry?.button?.cancelPressed;

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

  const formatLastUpdated = () => {
    if (!telemetry) return 'Chưa có dữ liệu';
    if (lastUpdatedDate) {
      return lastUpdatedDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    if (telemetry.updatedAt !== undefined) {
      return String(telemetry.updatedAt);
    }
    return 'Chưa rõ';
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
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FFF7E6] px-2.5 py-0.5 text-[11px] font-semibold text-[#D46B08] border border-[#FFD591]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FAAD14]" />
          Mất cập nhật
        </span>
      );
    }
    if (rawMode && rawMode.toUpperCase().includes('SLEEP')) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#E6F7FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#096DD9] border border-[#91D5FF]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1890FF]" />
          Chế độ Sleep
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
            Đang kết nối và tải dữ liệu thiết bị (<code>{targetDeviceId}</code>)...
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
      {!telemetryLoading && telemetry && isStale && (
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
                  Mô phỏng va chạm — Đang chờ xác nhận an toàn
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
                  Mô phỏng tín hiệu khẩn cấp SOS
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

      {/* TOP 4 METRIC CARDS — Styled directly after the reference image's 4 top white cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Smart Helmet Overview */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Smart Helmet của {ownerName}</span>
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
                <span>Firmware:</span>
                <span className="font-mono font-medium text-[#262626]">
                  {displayFirmware}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Thời gian chạy (Uptime):</span>
                <span className="font-medium text-[#52C41A]">
                  ▲ {formatUptime(uptimeSeconds)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>Cập nhật gần nhất</span>
            <span className="font-semibold text-[#262626]">
              {formatLastUpdated()}
            </span>
          </div>
        </div>

        {/* Card 2: Pin & Điện áp */}
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

            {/* Smooth SVG Area Wave + Real-time Battery Level Progress Bar */}
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

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>ADC Millivolts</span>
            <span className="font-mono font-semibold text-[#262626]">
              {batteryAdcMv !== null ? `${batteryAdcMv} mV` : '-- mV'}
            </span>
          </div>
        </div>

        {/* Card 3: Kết nối Wi-Fi (With vertical blue bars like "Payments" card in reference) */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Kết nối Wi-Fi ({networkTransport})</span>
              {wifiConnected ? (
                <Wifi className="h-4 w-4 text-[#1890FF]" />
              ) : (
                <WifiOff className="h-4 w-4 text-slate-400" />
              )}
            </div>

            <div className="mt-2 text-2xl font-bold text-[#262626]">
              {!hasNetworkNode
                ? 'Chưa có dữ liệu'
                : wifiConnected
                ? 'Đã kết nối'
                : 'Mất kết nối'}
            </div>

            {/* 5 Vibrant #1890FF vertical bars matching the "Payments" card in reference image */}
            <div className="mt-3 flex items-end justify-between gap-2.5 h-11 px-1">
              {[45, 85, 70, 40, 65].map((barH, idx) => {
                const active = wifiConnected;
                return (
                  <div
                    key={idx}
                    style={{ height: `${barH}%` }}
                    className={`flex-1 rounded-xs transition-all ${
                      active ? 'bg-[#1890FF]' : 'bg-slate-200'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>Cường độ tín hiệu</span>
            <span className="font-mono font-semibold text-[#262626]">
              {wifiRssiDbm !== null ? `${wifiRssiDbm} dBm` : '-- dBm'}
            </span>
          </div>
        </div>

        {/* Card 4: Định vị GPS (Clean summary card like "Operation Effect" in reference) */}
        <div
          onClick={() => onNavigateTab('gps')}
          className="cursor-pointer group rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#1890FF] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Định vị GPS</span>
              <MapPin className="h-4 w-4 text-[#1890FF]" />
            </div>

            <div className="mt-2">
              {gpsFix && gpsLat !== null && gpsLng !== null ? (
                <>
                  <div className="text-[14px] font-bold text-[#262626] line-clamp-2 leading-snug">
                    {addressLoading
                      ? 'Đang trích xuất địa chỉ...'
                      : resolvedAddress || `${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}`}
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
                <div className="py-3">
                  <div className="text-base font-bold text-[#FAAD14]">
                    Chưa có tín hiệu GPS
                  </div>
                  <p className="text-xs text-[#8C8C8C] mt-1">
                    Đang dò vệ tinh ngoài trời...
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>
              Vệ tinh: <strong className="text-[#262626]">{gpsSatellites ?? '--'}</strong> • HDOP:{' '}
              <strong className="text-[#262626]">{gpsHdop ?? '--'}</strong>
            </span>
            <span className="font-semibold text-[#1890FF] group-hover:underline">
              Bản đồ →
            </span>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: MPU6050 MONITORING (Styled with Ant Design tab header underline) */}
      <div className="rounded-lg border border-[#E8E8E8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {/* Card Header with active blue bottom border tab */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-3.5 pb-0 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-6">
            <div className="border-b-2 border-[#1890FF] pb-3 text-sm font-semibold text-[#1890FF] flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>Giám sát cảm biến MPU6050 & Nút nhấn</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium border ${
                cancelPressed === true
                  ? 'bg-[#FFF7E6] text-[#D46B08] border-[#FFD591]'
                  : 'bg-[#FAFAFA] text-[#595959] border-[#D9D9D9]'
              }`}
            >
              Nút hủy (Cancel):{' '}
              <strong className="text-[#262626]">
                {cancelPressed === true
                  ? 'Đang nhấn'
                  : cancelPressed === false
                  ? 'Không nhấn'
                  : '--'}
              </strong>
            </span>

            {mpuAvailable === true ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-1 text-xs font-medium text-[#389E0D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
                MPU6050 đã kết nối
              </span>
            ) : mpuAvailable === false ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#FFF1F0] border border-[#FFA39E] px-2.5 py-1 text-xs font-medium text-[#CF1322]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F5222D]" />
                MPU6050 chưa kết nối
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#FAFAFA] border border-[#D9D9D9] px-2.5 py-1 text-xs font-medium text-[#595959]">
                Chưa có trạng thái MPU6050
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          {mpuAvailable === false ? (
            <div className="rounded-lg border border-[#FFA39E] bg-[#FFF1F0] p-4 text-xs text-[#CF1322] flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>MPU6050 chưa kết nối:</strong> Cảm biến hiện không phản hồi trên bus I2C.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Total Acceleration Card (3 cols) */}
              <div className="lg:col-span-3 rounded-lg border border-[#91D5FF] bg-[#E6F7FF]/60 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0050B3]">
                    Total Acceleration
                  </span>
                  <span className="rounded bg-[#1890FF] px-2 py-0.5 text-[10px] font-bold text-white">
                    G-Force
                  </span>
                </div>
                <div className="my-3">
                  <span className="text-3xl font-extrabold font-mono text-[#002766]">
                    {mpuTotalG !== null ? `${mpuTotalG.toFixed(2)} G` : '--'}
                  </span>
                </div>
                <span className="text-xs text-[#0050B3] pt-2 border-t border-[#91D5FF]/60">
                  Tổng hợp lực gia tốc 3 trục
                </span>
              </div>

              {/* Acceleration X, Y, Z (m/s²) (5 cols) */}
              <div className="lg:col-span-5 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#262626]">
                    Gia tốc — Acceleration (m/s²)
                  </span>
                  <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#1890FF]">
                    ax, ay, az
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                    <span className="text-[11px] font-medium text-[#8C8C8C] block">
                      Trục X (ax)
                    </span>
                    <strong className="font-mono text-base font-bold text-[#1890FF] mt-1 block">
                      {mpuAx !== null ? mpuAx.toFixed(2) : '--'}
                    </strong>
                  </div>
                  <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                    <span className="text-[11px] font-medium text-[#8C8C8C] block">
                      Trục Y (ay)
                    </span>
                    <strong className="font-mono text-base font-bold text-[#1890FF] mt-1 block">
                      {mpuAy !== null ? mpuAy.toFixed(2) : '--'}
                    </strong>
                  </div>
                  <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                    <span className="text-[11px] font-medium text-[#8C8C8C] block">
                      Trục Z (az)
                    </span>
                    <strong className="font-mono text-base font-bold text-[#1890FF] mt-1 block">
                      {mpuAz !== null ? mpuAz.toFixed(2) : '--'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Gyroscope X, Y, Z (rad/s) (4 cols) */}
              <div className="lg:col-span-4 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#262626]">
                    Con quay — Gyroscope (rad/s)
                  </span>
                  <span className="rounded bg-[#E6FFFB] border border-[#87E8DE] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#13C2C2]">
                    gx, gy, gz
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                    <span className="text-[11px] font-medium text-[#8C8C8C] block">
                      Trục X (gx)
                    </span>
                    <strong className="font-mono text-base font-bold text-[#006D75] mt-1 block">
                      {mpuGx !== null ? mpuGx.toFixed(3) : '--'}
                    </strong>
                  </div>
                  <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                    <span className="text-[11px] font-medium text-[#8C8C8C] block">
                      Trục Y (gy)
                    </span>
                    <strong className="font-mono text-base font-bold text-[#006D75] mt-1 block">
                      {mpuGy !== null ? mpuGy.toFixed(3) : '--'}
                    </strong>
                  </div>
                  <div className="rounded-md bg-white border border-[#E8E8E8] p-3">
                    <span className="text-[11px] font-medium text-[#8C8C8C] block">
                      Trục Z (gz)
                    </span>
                    <strong className="font-mono text-base font-bold text-[#006D75] mt-1 block">
                      {mpuGz !== null ? mpuGz.toFixed(3) : '--'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: RECENT ACTIVITY & EMERGENCY CONTACTS RANKING (Styled like bottom card in reference image) */}
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

        {/* Right: Family Emergency Contacts Ranking (5 cols — Styled like "Sales ranking" in reference image) */}
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

            <div className="space-y-3">
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
                        {/* Numbered ranking badge matching #314659 dark navy circle in reference image */}
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
