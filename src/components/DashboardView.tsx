import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
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
  Compass,
  HardHat,
  KeyRound,
  Loader2,
  LocateFixed,
  MapPin,
  MessageSquare,
  Moon,
  Phone,
  PhoneCall,
  Satellite,
  ShieldCheck,
  Sliders,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  DEFAULT_CITY_MAP_CENTER,
  DEFAULT_CITY_MAP_ZOOM,
  formatToVietnamTimezone,
  isValidLatLonPair,
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
import { buildDeviceLeafletMarkerIcon } from './GPSTrackingView';

interface DashboardViewProps {
  device: HelmetDeviceState;
  ownerName: string;
  config: DeviceConfiguration;
  contacts: EmergencyContact[];
  contactSyncComparison: ContactSyncComparison;
  activeEmergencySos: FirebaseSosEventRecord | null;
  allSosEvents?: FirebaseSosEventRecord[];
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
  isServerDisconnected?: boolean;
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

export function formatFriendlyDeviceName(deviceId: string): string {
  const clean = (deviceId || '').trim();
  if (clean === 'helmet01' || clean === 'helmet-001') {
    return 'Thiết bị CAS-BOX #1';
  }
  if (clean === 'helmet01_phase34') {
    return 'Thiết bị CAS-BOX #2';
  }
  const numMatch = /(\d+)$/.exec(clean);
  if (numMatch) {
    return `Thiết bị CAS-BOX #${Number(numMatch[1])}`;
  }
  return 'Thiết bị bảo hộ CAS-BOX';
}

export function formatFriendlyDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return 'vừa xong';
  }
  if (seconds < 60) {
    return `${seconds} giây`;
  }
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (mins < 60) {
    return remSec > 0 ? `${mins} phút ${remSec} giây` : `${mins} phút`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) {
    return remMins > 0 ? `${hrs} giờ ${remMins} phút` : `${hrs} giờ`;
  }
  const days = Math.floor(hrs / 24);
  return `${days} ngày`;
}

function formatCleanVietnamTime(rawText: string): string {
  return rawText.replace(/\s*\(UTC\+7\)/g, '').trim();
}

function getFriendlyCallResultText(result: string): string {
  switch (result) {
    case 'ANSWERED':
      return 'Đã nghe máy';
    case 'NO_ANSWER':
      return 'Không bắt máy';
    case 'UNCONFIRMED':
      return 'Chưa xác nhận';
    case 'FAILED':
      return 'Không kết nối được';
    default:
      return 'Chưa gọi';
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  ownerName,
  config,
  contacts,
  contactSyncComparison,
  activeEmergencySos,
  allSosEvents,
  realSosEvents,
  resolvingSosId,
  onResolveSos,
  telemetry,
  gpsStatus,
  liveSamples,
  telemetryLoading,
  telemetryError,
  telemetryErrorCode,
  isServerDisconnected = false,
  isStale,
  secondsSinceUpdate,
  lastSeenVietnamText,
  targetDeviceId,
  resolvedAddress,
  addressLoading,
  smartBattery,
  activeModeProfile,
  allModes,
  modeSyncState,
  onSelectMode,
  onNavigateTab,
}) => {
  const friendlyDeviceTitle = formatFriendlyDeviceName(targetDeviceId);
  const isSosActive = Boolean(activeEmergencySos);
  const dashboardMapContainerRef = useRef<HTMLDivElement | null>(null);
  const dashboardMapInstanceRef = useRef<L.Map | null>(null);
  const dashboardMarkerRef = useRef<L.Marker | null>(null);
  const lastDashboardPannedRef = useRef<{
    deviceId: string;
    lat: number;
    lon: number;
  } | null>(null);

  const validSosLat =
    isSosActive &&
    isValidLatLonPair(activeEmergencySos?.loc.lat, activeEmergencySos?.loc.lon)
      ? (activeEmergencySos!.loc.lat as number)
      : null;
  const validSosLon =
    isSosActive &&
    isValidLatLonPair(activeEmergencySos?.loc.lat, activeEmergencySos?.loc.lon)
      ? (activeEmergencySos!.loc.lon as number)
      : null;

  const effectiveMapLat = gpsStatus.displayLat ?? validSosLat;
  const effectiveMapLon = gpsStatus.displayLon ?? validSosLon;
  const hasDashboardMapCoords = isValidLatLonPair(
    effectiveMapLat,
    effectiveMapLon
  );

  const isShowingLastValidWhileSearching =
    hasDashboardMapCoords &&
    (gpsStatus.usingLastValidPosition ||
      gpsStatus.hasInvalidIncomingCoords ||
      gpsStatus.isSearchingSatellites ||
      gpsStatus.rawType === 'OLD');

  // Live Interactive Map on Dashboard with Red Pulsing/Blinking Marker when SOS is active
  // Holds lastValidPosition without panning/zooming when incoming packet has invalid/0,0 coords,
  // or stays at default city center when no valid position has ever been received before.
  useEffect(() => {
    if (!dashboardMapContainerRef.current) return;

    if (!dashboardMapInstanceRef.current) {
      const initialCenter: [number, number] =
        hasDashboardMapCoords &&
        effectiveMapLat !== null &&
        effectiveMapLon !== null
          ? [effectiveMapLat, effectiveMapLon]
          : DEFAULT_CITY_MAP_CENTER;
      const initialZoom =
        hasDashboardMapCoords &&
        effectiveMapLat !== null &&
        effectiveMapLon !== null
          ? 16
          : DEFAULT_CITY_MAP_ZOOM;

      const map = L.map(dashboardMapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      dashboardMapInstanceRef.current = map;

      if (
        hasDashboardMapCoords &&
        effectiveMapLat !== null &&
        effectiveMapLon !== null
      ) {
        lastDashboardPannedRef.current = {
          deviceId: targetDeviceId,
          lat: effectiveMapLat,
          lon: effectiveMapLon,
        };
      }
    }

    const map = dashboardMapInstanceRef.current;

    if (
      !hasDashboardMapCoords ||
      effectiveMapLat === null ||
      effectiveMapLon === null
    ) {
      if (dashboardMarkerRef.current) {
        map.removeLayer(dashboardMarkerRef.current);
        dashboardMarkerRef.current = null;
      }
      if (
        lastDashboardPannedRef.current &&
        lastDashboardPannedRef.current.deviceId !== targetDeviceId
      ) {
        lastDashboardPannedRef.current = null;
        map.setView(DEFAULT_CITY_MAP_CENTER, DEFAULT_CITY_MAP_ZOOM);
      }
      return;
    }

    const effectiveRawTypeForIcon = isShowingLastValidWhileSearching
      ? 'OLD'
      : gpsStatus.rawType;

    const markerIcon = buildDeviceLeafletMarkerIcon(
      activeModeProfile,
      isSosActive,
      effectiveRawTypeForIcon,
      gpsStatus.isStaleCurrentUpload
    );

    const accent = isSosActive
      ? '#F5222D'
      : isShowingLastValidWhileSearching
      ? '#D46B08'
      : activeModeProfile.accentColor;
    const statusLabel = isSosActive
      ? '🔴 ĐANG CẦU CỨU SOS!'
      : isShowingLastValidWhileSearching
      ? 'GPS đang dò vệ tinh (Vị trí gần nhất)'
      : 'Vị trí trực tiếp';

    const addressTitle =
      resolvedAddress || 'Đã xác định vị trí của thiết bị trên bản đồ';

    const popupHtml = `<div style="min-width:215px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">
        <span style="font-weight:700;color:${accent};font-size:12px">${friendlyDeviceTitle}</span>
        <span style="background:${accent};color:#fff;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:700">${statusLabel}</span>
      </div>
      <div style="font-size:12px;font-weight:600;color:#18181B">${addressTitle}</div>
    </div>`;

    if (!dashboardMarkerRef.current) {
      dashboardMarkerRef.current = L.marker(
        [effectiveMapLat, effectiveMapLon],
        {
          icon: markerIcon,
        }
      )
        .addTo(map)
        .bindPopup(popupHtml);
    } else {
      dashboardMarkerRef.current.setIcon(markerIcon);
      dashboardMarkerRef.current.setPopupContent(popupHtml);
    }

    if (isSosActive) {
      dashboardMarkerRef.current.openPopup();
    }

    const prevPanned = lastDashboardPannedRef.current;
    const isFirstValidForDevice =
      !prevPanned || prevPanned.deviceId !== targetDeviceId;
    const hasValidCoordsMoved =
      prevPanned !== null &&
      (Math.abs(prevPanned.lat - effectiveMapLat) > 0.000001 ||
        Math.abs(prevPanned.lon - effectiveMapLon) > 0.000001);

    if (isFirstValidForDevice) {
      dashboardMarkerRef.current.setLatLng([effectiveMapLat, effectiveMapLon]);
      map.setView([effectiveMapLat, effectiveMapLon], 16);
      lastDashboardPannedRef.current = {
        deviceId: targetDeviceId,
        lat: effectiveMapLat,
        lon: effectiveMapLon,
      };
    } else if (
      !gpsStatus.usingLastValidPosition &&
      !gpsStatus.hasInvalidIncomingCoords &&
      hasValidCoordsMoved
    ) {
      dashboardMarkerRef.current.setLatLng([effectiveMapLat, effectiveMapLon]);
      map.setView([effectiveMapLat, effectiveMapLon], map.getZoom());
      lastDashboardPannedRef.current = {
        deviceId: targetDeviceId,
        lat: effectiveMapLat,
        lon: effectiveMapLon,
      };
    }
  }, [
    hasDashboardMapCoords,
    effectiveMapLat,
    effectiveMapLon,
    isSosActive,
    isShowingLastValidWhileSearching,
    activeModeProfile,
    gpsStatus.rawType,
    gpsStatus.usingLastValidPosition,
    gpsStatus.hasInvalidIncomingCoords,
    gpsStatus.isStaleCurrentUpload,
    resolvedAddress,
    friendlyDeviceTitle,
    targetDeviceId,
  ]);

  useEffect(() => {
    return () => {
      dashboardMarkerRef.current = null;
      if (dashboardMapInstanceRef.current) {
        dashboardMapInstanceRef.current.remove();
        dashboardMapInstanceRef.current = null;
      }
    };
  }, []);
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

  const isActuallyOnline =
    Boolean(telemetry) && !isStale && !isServerDisconnected;
  const isStaleOrDisconnected = Boolean(isServerDisconnected || isStale);
  const hasNetworkConnection =
    isActuallyOnline &&
    (rawOnlineFlag ||
      Boolean(deviceIp && deviceIp !== '0.0.0.0') ||
      telemetry?.network?.wifiConnected === true);

  const batteryPercentage = smartBattery.percentage;
  const isLowBatt =
    !smartBattery.isCharging &&
    batteryPercentage <= config.lowBatteryThresholdPercent;

  // Sensor metrics (human-readable interpretation)
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
      ? Number(telemetry.mpu.totalG.toFixed(2))
      : accelX !== null && accelY !== null && accelZ !== null
      ? Number(
          Math.sqrt(
            accelX * accelX + accelY * accelY + accelZ * accelZ
          ).toFixed(2)
        )
      : null;

  const mpuTiltDeg =
    typeof telemetry?.mpu?.tiltDeg === 'number'
      ? Number(telemetry.mpu.tiltDeg.toFixed(1))
      : null;

  const mpuValid = telemetry?.mpu?.valid;

  const getWifiQualityLabel = (rssi: number | null, connected: boolean) => {
    if (!connected) return 'Chưa có kết nối';
    if (rssi === null) return 'Tín hiệu ổn định';
    if (rssi >= -55) return 'Sóng rất mạnh';
    if (rssi >= -70) return 'Sóng tốt';
    if (rssi >= -80) return 'Sóng trung bình';
    return 'Sóng yếu';
  };

  const getPostureHumanText = (tilt: number | null) => {
    if (tilt === null) return 'Chưa có thông tin tư thế';
    if (tilt < 20) return 'Thẳng đứng, ổn định';
    if (tilt < activeModeProfile.thresholds.tiltAngleThresholdDeg) {
      return 'Đang nghiêng nhẹ';
    }
    return 'Đang nghiêng vượt ngưỡng chú ý';
  };

  const getImpactHumanText = (gForce: number | null) => {
    if (gForce === null) return 'Chưa có thông tin chuyển động';
    if (gForce < 1.5) return 'Di chuyển êm ái, bình thường';
    if (gForce < activeModeProfile.thresholds.impactThresholdG) {
      return 'Có rung lắc nhẹ';
    }
    return 'Phát hiện chấn động mạnh';
  };

  const formatLastSeen = () => {
    if (!telemetry) return 'Chưa có dữ liệu';
    return formatCleanVietnamTime(lastSeenVietnamText || 'Vừa xong');
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
    if (hrs > 0) return `${hrs} giờ ${mins} phút`;
    if (mins > 0) return `${mins} phút ${secs} giây`;
    return `${secs} giây`;
  };

  const renderDeviceStatusBadge = () => {
    if (telemetryLoading) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          <Loader2 className="h-3 w-3 animate-spin text-[#1890FF]" />
          Đang kết nối...
        </span>
      );
    }
    if (!telemetry) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Chưa có tín hiệu
        </span>
      );
    }
    if (isServerDisconnected || isStale) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FFF7E6] px-2.5 py-0.5 text-[11px] font-semibold text-[#D46B08] border border-[#FFD591]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FAAD14]" />
          Dữ liệu cũ (Offline)
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6FFED] px-2.5 py-0.5 text-[11px] font-semibold text-[#389E0D] border border-[#B7EB8F]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
        Đang trực tuyến
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* REALTIME EMERGENCY SOS ALERT BANNER (Human-readable End-User View) */}
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
                    CẢNH BÁO KHẨN CẤP SOS
                  </span>
                  <span className="text-xs font-bold text-[#CF1322] bg-white px-2.5 py-0.5 rounded border border-[#FFA39E]">
                    {formatFriendlyDeviceName(activeEmergencySos.deviceId)}
                  </span>
                  <span className="rounded bg-white border border-[#FFA39E] px-2.5 py-0.5 text-[11px] font-semibold text-[#CF1322]">
                    {activeEmergencySos.loc.type === 'CURRENT'
                      ? 'Có vị trí trực tiếp'
                      : activeEmergencySos.loc.type === 'OLD'
                      ? 'Vị trí lưu gần nhất'
                      : 'Chưa rõ tọa độ'}
                  </span>
                </div>
                <h2 className="mt-1.5 text-base sm:text-lg font-extrabold text-[#262626]">
                  Người sử dụng đang cần hỗ trợ khẩn cấp!
                </h2>
                <p className="text-xs text-[#595959] mt-0.5">
                  Thời điểm hệ thống nhận báo cáo:{' '}
                  <strong className="text-[#262626]">
                    {activeEmergencySos.pushedAt
                      ? formatCleanVietnamTime(
                          formatToVietnamTimezone(
                            new Date(activeEmergencySos.pushedAt),
                            true
                          )
                        )
                      : '--'}
                  </strong>{' '}
                  <span className="text-[#8C8C8C]">
                    (Ghi nhận ngay sau khi thiết bị thực hiện gửi tin nhắn và gọi
                    điện cho người thân)
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
                  <span>Mở bản đồ chỉ đường</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}

              <button
                type="button"
                disabled={
                  isServerDisconnected ||
                  resolvingSosId === activeEmergencySos.id
                }
                onClick={() => onResolveSos(activeEmergencySos.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#52C41A] px-4 py-2 text-xs font-bold text-white hover:bg-[#389E0D] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
              >
                {resolvingSosId === activeEmergencySos.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Tắt cảnh báo / Xác nhận</span>
              </button>
            </div>
          </div>

          {/* Human-readable SOS Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#FFA39E]/60 text-xs">
            <div className="rounded-lg bg-white border border-[#FFA39E] p-3">
              <div className="text-[11px] font-semibold text-[#8C8C8C]">
                Vị trí khi phát tín hiệu
              </div>
              {activeEmergencySos.loc.type !== 'NONE' &&
              activeEmergencySos.loc.lat !== undefined &&
              activeEmergencySos.loc.lon !== undefined ? (
                <div className="mt-1 space-y-0.5">
                  <div className="font-bold text-[#262626]">
                    {activeEmergencySos.loc.type === 'CURRENT'
                      ? 'Tọa độ trực tiếp tại chỗ'
                      : 'Tọa độ lưu gần nhất trước đó'}
                  </div>
                  <div className="text-[11px] text-[#595959]">
                    Ghi nhận lúc:{' '}
                    {
                      formatFirmwareGpsUtc(activeEmergencySos.loc.utc).split(
                        ' [Gốc:'
                      )[0]
                    }
                  </div>
                </div>
              ) : (
                <div className="mt-1 font-semibold text-[#CF1322]">
                  Chưa xác định được vị trí vệ tinh
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white border border-[#FFA39E] p-3">
              <div className="text-[11px] font-semibold text-[#8C8C8C]">
                Tin nhắn báo động khẩn cấp (SMS)
              </div>
              <div className="mt-1 text-sm font-bold text-[#262626]">
                Đã gửi yêu cầu tới {activeEmergencySos.sms.sent} /{' '}
                {activeEmergencySos.sms.targets} người thân
              </div>
              <div className="text-[11px] text-[#8C8C8C] mt-0.5">
                Thiết bị đã gửi tin nhắn kèm vị trí lên nhà mạng
              </div>
            </div>

            <div className="rounded-lg bg-white border border-[#FFA39E] p-3">
              <div className="text-[11px] font-semibold text-[#8C8C8C]">
                Kết quả cuộc gọi khẩn cấp
              </div>
              <div className="mt-1 font-bold text-[#262626]">
                {activeEmergencySos.answeredBy > 0 ? (
                  <span className="text-[#389E0D]">
                    ✓ Người thân ưu tiên #{activeEmergencySos.answeredBy} đã
                    nghe máy
                  </span>
                ) : (
                  <span className="text-[#CF1322]">
                    Chưa có người thân bắt máy
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {activeEmergencySos.calls.map((c) => (
                  <span
                    key={`${c.priority}_${c.phone}`}
                    className="rounded bg-[#FAFAFA] border border-[#D9D9D9] px-2 py-0.5 text-[11px] text-[#262626]"
                  >
                    #{c.priority} {formatPhoneForDisplay(c.phone)}:{' '}
                    {getFriendlyCallResultText(c.result)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOADING / ERROR STATES */}
      {telemetryLoading && (
        <div className="rounded-lg border border-[#91D5FF] bg-[#E6F7FF] p-3.5 flex items-center gap-3 text-xs text-[#0050B3]">
          <Loader2 className="h-4 w-4 animate-spin text-[#1890FF] shrink-0" />
          <span>Đang kết nối và cập nhật trạng thái thiết bị...</span>
        </div>
      )}

      {!telemetryLoading && telemetryError && (
        <div className="rounded-lg border border-[#FFD591] bg-[#FFF7E6] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#FA8C16] shrink-0 mt-0.5" />
            <div className="text-xs text-[#262626] space-y-1">
              <div className="font-bold text-[#AD4E00]">
                {telemetryErrorCode === 'CONFIG_MISSING'
                  ? 'Chưa hoàn tất cấu hình kết nối'
                  : telemetryErrorCode === 'PERMISSION_DENIED'
                  ? 'Vui lòng đăng nhập tài khoản để xem dữ liệu'
                  : 'Tạm thời gián đoạn kết nối'}
              </div>
              <p className="text-[#595959]">
                Hệ thống đang thử kết nối lại với thiết bị của bạn.
              </p>
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

      {/* STALE DATA NOTICE (When Device is Offline or Server Connection Lost) */}
      {!telemetryLoading && telemetry && isStaleOrDisconnected && (
        <div className="rounded-lg border border-[#FFD591] bg-[#FFF7E6] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#AD4E00]">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#FA8C16] text-white">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <span>
              <strong className="font-bold">Dữ liệu cũ (Offline):</strong>{' '}
              {isServerDisconnected
                ? 'Đang mất kết nối tới máy chủ. Các thông số cảm biến và bản đồ bên dưới là dữ liệu lưu cuối cùng, không phải dữ liệu thời gian thực.'
                : `Thiết bị chưa gửi tín hiệu mới trong ${formatFriendlyDuration(
                    secondsSinceUpdate
                  )} qua. Các thông số bên dưới là dữ liệu cũ từ lần kết nối gần nhất.`}
            </span>
          </div>
          <span className="font-semibold text-[#873800] shrink-0">
            Cập nhật lần cuối: {formatLastSeen()}
          </span>
        </div>
      )}

      {/* TOP 4 METRIC CARDS (Dimmed with subtle opacity when Stale / Offline) */}
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity duration-300 ${
          isStaleOrDisconnected ? 'opacity-80' : 'opacity-100'
        }`}
      >
        {/* Card 1: Thiết bị & Trạng thái */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>CAS-BOX của {ownerName}</span>
              <ShieldCheck className="h-4 w-4 text-[#1890FF]" />
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-lg sm:text-xl font-bold text-[#262626] tracking-tight truncate">
                {friendlyDeviceTitle}
              </span>
              {renderDeviceStatusBadge()}
            </div>

            <div className="mt-3.5 space-y-1.5 text-xs text-[#595959]">
              <div className="flex items-center justify-between">
                <span>Chế độ sử dụng:</span>
                <span className="font-semibold text-[#1890FF]">
                  {activeModeProfile.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tiết kiệm pin tự động:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    deepSleepFeatureEnabled
                      ? 'bg-[#E6F7FF] text-[#0050B3]'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Moon className="h-3 w-3" />
                  {telemetry?.deepSleep === undefined
                    ? '--'
                    : deepSleepFeatureEnabled
                    ? 'Đang bật'
                    : 'Đang tắt'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Thời gian hoạt động:</span>
                <span className="font-semibold text-[#389E0D]">
                  {formatUptime(uptimeSeconds)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-[#F0F0F0] flex items-center justify-between gap-2 text-xs text-[#595959]">
            <span className="shrink-0">Cập nhật lúc:</span>
            <span className="font-semibold text-[#262626] truncate">
              {formatLastSeen()}
            </span>
          </div>
        </div>

        {/* Card 2: Pin & Thời lượng */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Dung lượng Pin</span>
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
                Còn khoảng {smartBattery.estimatedTimeText}
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
            <span>Tình trạng pin:</span>
            <span
              className={`font-semibold ${
                isLowBatt ? 'text-[#D46B08]' : 'text-[#389E0D]'
              }`}
            >
              {isLowBatt ? 'Pin yếu — Nên sạc sớm' : 'Hoạt động ổn định'}
            </span>
          </div>
        </div>

        {/* Card 3: Kết nối & Liên lạc */}
        <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8C8C8C]">
              <span>Tín hiệu Kết nối</span>
              {hasNetworkConnection ? (
                <Wifi className="h-4 w-4 text-[#1890FF]" />
              ) : (
                <WifiOff className="h-4 w-4 text-slate-400" />
              )}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                className={`text-xl font-bold ${
                  !telemetry
                    ? 'text-[#262626]'
                    : hasNetworkConnection
                    ? 'text-[#389E0D]'
                    : 'text-[#CF1322]'
                }`}
              >
                {!telemetry
                  ? 'Chưa có dữ liệu'
                  : hasNetworkConnection
                  ? 'Đã kết nối mạng'
                  : 'Mất kết nối'}
              </span>
              <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-semibold text-[#0050B3]">
                {getWifiQualityLabel(wifiRssiDbm, hasNetworkConnection)}
              </span>
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
            <span>Chế độ cứu hộ:</span>
            <strong className="text-[#262626]">
              {sosTestMode
                ? 'Chế độ thử nghiệm'
                : autoRealSos !== false
                ? 'Tự động gọi SOS thật'
                : 'Cảnh báo tại chỗ'}
            </strong>
          </div>
        </div>

        {/* Card 4: Định vị GPS (Human-readable) */}
        <div
          onClick={() => onNavigateTab('gps')}
          className="cursor-pointer group rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#1890FF] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-1 text-xs text-[#8C8C8C]">
              <span className="truncate">
                Vị trí định vị (
                {!hasDashboardMapCoords
                  ? 'Chờ tín hiệu GPS'
                  : isShowingLastValidWhileSearching
                  ? 'Đang dò vệ tinh'
                  : gpsStatus.isFreshRealtime
                  ? 'Trực tiếp'
                  : 'Ghi nhận gần nhất'}
                )
              </span>
              <MapPin
                className={`h-4 w-4 shrink-0 ${
                  !isShowingLastValidWhileSearching &&
                  gpsStatus.rawType === 'CURRENT' &&
                  gpsStatus.isFreshRealtime
                    ? 'text-[#52C41A]'
                    : !hasDashboardMapCoords
                    ? 'text-[#CF1322]'
                    : 'text-[#FAAD14]'
                }`}
              />
            </div>

            <div className="mt-2">
              {!isShowingLastValidWhileSearching &&
              gpsStatus.rawType === 'CURRENT' &&
              gpsStatus.lat !== null &&
              gpsStatus.lon !== null ? (
                <>
                  <div className="text-[13.5px] font-bold text-[#262626] line-clamp-2 leading-snug">
                    {addressLoading
                      ? 'Đang xác định tên đường...'
                      : resolvedAddress || 'Đã xác định được tọa độ trên bản đồ'}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-[#595959]">
                      {gpsStatus.isStaleCurrentUpload
                        ? 'Vị trí từ lần kết nối trước'
                        : 'Định vị trực tiếp chính xác'}
                    </span>
                    {gpsStatus.googleMapsUrl && (
                      <a
                        href={gpsStatus.googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 font-semibold text-[#1890FF] hover:underline"
                      >
                        Chỉ đường
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-[#8C8C8C] truncate">
                    Cập nhật:{' '}
                    {formatCleanVietnamTime(gpsStatus.updatedAtText)}
                  </div>
                </>
              ) : hasDashboardMapCoords ? (
                <>
                  <div className="inline-flex items-center gap-1 rounded bg-[#FFFBE6] border border-[#FFE58F] px-2 py-0.5 text-[10.5px] font-bold text-[#AD6800] mb-1">
                    <Satellite className="h-3 w-3 text-[#FAAD14] shrink-0" />
                    <span>GPS đang dò vệ tinh (Hiển thị vị trí gần nhất)</span>
                  </div>
                  <div className="text-[13px] font-bold text-[#262626] line-clamp-1 leading-snug">
                    {addressLoading
                      ? 'Đang xác định tên đường...'
                      : resolvedAddress || 'Đã giữ vị trí hợp lệ gần nhất'}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-[#AD6800]">
                      Giữ nguyên vị trí gần nhất
                    </span>
                    {gpsStatus.googleMapsUrl && (
                      <a
                        href={gpsStatus.googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 font-semibold text-[#1890FF] hover:underline"
                      >
                        Chỉ đường
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-1.5">
                  <div className="inline-flex items-center gap-1.5 rounded bg-slate-100 border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                    <Satellite className="h-3 w-3 text-[#FAAD14] animate-pulse" />
                    <span>Đang chờ tín hiệu GPS...</span>
                  </div>
                  <p className="text-xs text-[#8C8C8C] mt-1.5">
                    Bản đồ đang giữ ở vị trí mặc định trung tâm thành phố.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#595959]">
            <span>
              Tín hiệu định vị:{' '}
              <strong className="text-[#262626]">
                {!hasDashboardMapCoords
                  ? 'Đang tìm sóng'
                  : isShowingLastValidWhileSearching
                  ? 'Đang dò lại sóng'
                  : 'Ổn định'}
              </strong>
            </span>
            <span className="font-semibold text-[#1890FF] group-hover:underline">
              Mở bản đồ →
            </span>
          </div>
        </div>
      </div>

      {/* LIVE DASHBOARD MAP WITH PULSING RED SOS MARKER, LAST VALID POSITION RETENTION & DEFAULT CITY FALLBACK */}
      <div
        className={`rounded-lg border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3 transition-all duration-300 ${
          isSosActive
            ? 'border-2 border-[#F5222D] bg-[#FFF1F0]/45'
            : 'border-[#E8E8E8] bg-white'
        } ${isStaleOrDisconnected && !isSosActive ? 'opacity-80' : ''}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <MapPin
              className={`h-4 w-4 ${
                isSosActive ? 'text-[#F5222D] animate-bounce' : 'text-[#1890FF]'
              }`}
            />
            <h3 className="text-sm font-bold text-[#262626]">
              Bản đồ vị trí thiết bị
            </h3>
            {isSosActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5222D] px-2.5 py-0.5 text-[11px] font-extrabold text-white animate-pulse">
                ● ĐANG PHÁT TÍN HIỆU CẦU CỨU KHẨN CẤP
              </span>
            ) : !hasDashboardMapCoords ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                <Satellite className="h-3.5 w-3.5 text-[#FAAD14] animate-pulse" />
                Đang chờ tín hiệu GPS...
              </span>
            ) : isShowingLastValidWhileSearching ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBE6] border border-[#FFE58F] px-2.5 py-0.5 text-[11px] font-bold text-[#AD6800]">
                <Satellite className="h-3.5 w-3.5 text-[#FAAD14]" />
                GPS đang dò vệ tinh (Hiển thị vị trí gần nhất)
              </span>
            ) : isStaleOrDisconnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-[11px] font-bold text-[#D46B08]">
                ● Dữ liệu cũ (Offline) • Cập nhật lần cuối: {formatLastSeen()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-[11px] font-semibold text-[#389E0D]">
                ● Trạng thái trực tiếp ({activeModeProfile.label})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasDashboardMapCoords && (
              <button
                type="button"
                onClick={() => {
                  if (
                    dashboardMapInstanceRef.current &&
                    effectiveMapLat !== null &&
                    effectiveMapLon !== null
                  ) {
                    dashboardMapInstanceRef.current.flyTo(
                      [effectiveMapLat, effectiveMapLon],
                      16,
                      { duration: 0.7 }
                    );
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md border border-[#D9D9D9] bg-white px-2.5 py-1 text-xs font-medium text-[#262626] hover:border-[#1890FF] hover:text-[#1890FF] transition"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                <span>Định tâm</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigateTab('gps')}
              className="inline-flex items-center gap-1 rounded-md bg-[#1890FF] px-3 py-1 text-xs font-semibold text-white hover:bg-[#40A9FF] transition"
            >
              <span>Mở bản đồ toàn màn hình →</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <div
            ref={dashboardMapContainerRef}
            className="h-[270px] w-full rounded-lg overflow-hidden border border-zinc-200"
          />

          {/* Floating Overlay when no prior valid position exists */}
          {!hasDashboardMapCoords && (
            <div className="pointer-events-none absolute inset-x-4 top-3 z-[400] flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#FFE58F] bg-white/95 px-3.5 py-2 text-xs font-bold text-[#AD6800] shadow-md backdrop-blur-xs">
                <Satellite className="h-4 w-4 text-[#FAAD14] animate-pulse shrink-0" />
                <span>
                  Đang chờ tín hiệu GPS... (Giữ bản đồ tại vị trí trung tâm mặc định)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4 OPERATING MODES SELECTOR (Clean End-User View) */}
      <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6F7FF] text-[#1890FF]">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[#262626]">
                  Chế độ bảo vệ theo phương tiện
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${activeModeProfile.badgeBg} ${activeModeProfile.badgeText} ${activeModeProfile.badgeBorder}`}
                >
                  {renderModeIcon(activeModeProfile.id, 'h-3.5 w-3.5')}
                  <span>{activeModeProfile.label}</span>
                </span>
              </div>
              <p className="text-xs text-[#8C8C8C] mt-0.5">
                {activeModeProfile.shortDesc} — Tự động điều chỉnh độ nhạy phát
                hiện tai nạn phù hợp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isServerDisconnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF1F0] border border-[#FFA39E] px-3 py-1 text-xs font-semibold text-[#CF1322]">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Tạm khóa điều khiển (Mất kết nối máy chủ)</span>
              </span>
            ) : modeSyncState === 'SYNCING' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F7FF] border border-[#91D5FF] px-3 py-1 text-xs font-semibold text-[#0050B3]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1890FF]" />
                <span>Đang đồng bộ xuống thiết bị...</span>
              </span>
            ) : modeSyncState === 'WAITING_ONLINE' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-3 py-1 text-xs font-semibold text-[#D46B08]">
                <Clock className="h-3.5 w-3.5 text-[#FA8C16]" />
                <span>Đã lưu — Sẽ áp dụng khi thiết bị kết nối</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6FFED] border border-[#B7EB8F] px-3 py-1 text-xs font-semibold text-[#389E0D]">
                <Check className="h-3.5 w-3.5 text-[#52C41A]" />
                <span>Đã áp dụng trên thiết bị</span>
              </span>
            )}
          </div>
        </div>

        {/* 4 Mode Buttons: Disabled when server connection is lost */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {allModes.map((m) => {
            const isSelected = m.id === activeModeProfile.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={isServerDisconnected}
                onClick={() => onSelectMode(m.id)}
                className={`group text-left rounded-lg border p-3.5 transition-all flex flex-col justify-between disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
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
                      <div className="text-sm font-bold text-[#262626]">
                        {m.label}
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

                <div className="mt-3 pt-2.5 border-t border-[#E8E8E8]/80 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="rounded bg-white px-2 py-1 border border-[#F0F0F0]">
                    <span className="text-[#8C8C8C] block">Độ nhạy bảo vệ</span>
                    <strong className="text-[#262626]">
                      {m.id === 'wheelchair'
                        ? 'Rất nhạy'
                        : m.id === 'helmet'
                        ? 'Tiêu chuẩn'
                        : m.id === 'motorbike'
                        ? 'Chống rung xe'
                        : 'Di chuyển bộ'}
                    </strong>
                  </div>
                  <div className="rounded bg-white px-2 py-1 border border-[#F0F0F0]">
                    <span className="text-[#8C8C8C] block">Chờ hủy báo động</span>
                    <strong className="text-[#262626]">
                      {m.thresholds.cancelWindowSec} giây
                    </strong>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MIDDLE SECTION: HUMAN-READABLE MOTION & SAFETY STATUS (With Stale Data Dimming & Offline Badge) */}
      <div
        className={`rounded-lg border border-[#E8E8E8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-opacity duration-300 ${
          isStaleOrDisconnected ? 'opacity-75' : 'opacity-100'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-3.5 pb-0 border-b border-[#F0F0F0]">
          <div className="border-b-2 border-[#1890FF] pb-3 text-sm font-semibold text-[#1890FF] flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span>Giám sát Chuyển động &amp; An toàn hành trình</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2.5">
            {isStaleOrDisconnected && (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-1 text-xs font-bold text-[#D46B08]">
                <Clock className="h-3.5 w-3.5 text-[#FA8C16]" />
                Dữ liệu cũ (Offline) • Cập nhật cuối: {formatLastSeen()}
              </span>
            )}

            {sosPending && (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#FFF1F0] text-[#CF1322] border border-[#FFA39E] px-2.5 py-1 text-xs font-semibold">
                Đang có cảnh báo chờ gửi
              </span>
            )}

            {telemetry?.imuFault === false || mpuValid === true ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-1 text-xs font-medium text-[#389E0D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
                Cảm biến chuyển động hoạt động tốt
              </span>
            ) : imuFault ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#FFF1F0] border border-[#FFA39E] px-2.5 py-1 text-xs font-medium text-[#CF1322]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F5222D]" />
                Cần kiểm tra cảm biến chuyển động
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#FAFAFA] border border-[#D9D9D9] px-2.5 py-1 text-xs font-medium text-[#595959]">
                Đang chờ dữ liệu cảm biến
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {imuFault && (
            <div className="rounded-lg border border-[#FFA39E] bg-[#FFF1F0] p-4 text-xs text-[#CF1322] flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Lưu ý kỹ thuật:</strong> Thiết bị phát hiện cảm biến
                chuyển động tạm thời không phản hồi. Vui lòng khởi động lại hoặc
                kiểm tra thiết bị.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* 1. Tư thế & Góc nghiêng */}
            <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#595959]">
                  Tư thế sử dụng hiện tại
                </span>
                <Compass className="h-4 w-4 text-[#1890FF]" />
              </div>
              <div className="my-2">
                <div className="text-xl font-bold text-[#262626]">
                  {getPostureHumanText(mpuTiltDeg)}
                </div>
                <div className="text-xs text-[#595959] mt-1">
                  {mpuTiltDeg === null
                    ? 'Đang chờ thiết bị cập nhật trạng thái tư thế.'
                    : mpuTiltDeg < 20
                    ? 'Thiết bị đang ở tư thế cân bằng và ổn định.'
                    : mpuTiltDeg <
                      activeModeProfile.thresholds.tiltAngleThresholdDeg
                    ? 'Thiết bị đang nghiêng nhẹ nhưng vẫn trong giới hạn an toàn.'
                    : 'Phát hiện thiết bị nghiêng nhiều hơn mức bình thường.'}
                </div>
              </div>
            </div>

            {/* 2. Mức độ chấn động */}
            <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#595959]">
                  Trạng thái chuyển động &amp; Va chạm
                </span>
                <Activity className="h-4 w-4 text-[#13C2C2]" />
              </div>
              <div className="my-2">
                <div className="text-xl font-bold text-[#262626]">
                  {getImpactHumanText(accelMagnitudeG)}
                </div>
                <div className="text-xs text-[#595959] mt-1">
                  {accelMagnitudeG === null
                    ? 'Đang chờ thiết bị gửi thông tin hành trình.'
                    : accelMagnitudeG < 1.5
                    ? 'Không phát hiện va đập, hành trình diễn ra an toàn.'
                    : accelMagnitudeG <
                      activeModeProfile.thresholds.impactThresholdG
                    ? 'Ghi nhận rung lắc nhẹ trên đường di chuyển.'
                    : 'Phát hiện chấn động mạnh, hệ thống đang kiểm tra an toàn.'}
                </div>
              </div>
            </div>

            {/* 3. Quy trình bảo vệ tự động */}
            <div className="rounded-lg border border-[#91D5FF] bg-[#E6F7FF]/50 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0050B3]">
                  Bảo vệ khẩn cấp tự động
                </span>
                <ShieldCheck className="h-4 w-4 text-[#1890FF]" />
              </div>
              <div className="my-2">
                <div className="text-xl font-bold text-[#002766]">
                  Đếm ngược {cancelWindowSec} giây
                </div>
                <div className="text-xs text-[#0050B3] mt-1">
                  Khi phát hiện ngã, thiết bị phát âm báo trong{' '}
                  <strong>{cancelWindowSec} giây</strong> trước khi tự động liên
                  hệ <strong>{activeContactCount} người thân</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* Clean Visual Activity Trend Chart */}
          <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#262626]">
                Biểu đồ mức độ chuyển động gần đây
              </span>
              <span className="text-[11px] text-[#595959]">
                Cập nhật tự động khi thiết bị hoạt động
              </span>
            </div>

            {liveSamples.length > 0 ? (
              <div className="flex items-end gap-1.5 h-16 pt-2 px-2 bg-white rounded border border-[#E8E8E8]">
                {liveSamples.map((s, idx) => {
                  const heightPct = Math.min(
                    100,
                    Math.max(18, Math.round((s.accelTotalG / 3.0) * 100))
                  );
                  return (
                    <div
                      key={idx}
                      title={`Lúc ${formatCleanVietnamTime(
                        s.timeLabel
                      )} — ${getImpactHumanText(s.accelTotalG)}`}
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
                Đang chờ thiết bị gửi mẫu chuyển động mới...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: RECENT SOS INCIDENTS & FAMILY CONTACTS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Recent SOS Incidents (7 cols) */}
        <div className="lg:col-span-7 rounded-lg border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F0F0F0]">
            <div>
              <h3 className="text-sm font-semibold text-[#262626]">
                Lịch sử cảnh báo khẩn cấp gần đây
              </h3>
              <p className="text-[11px] text-[#8C8C8C]">
                Các tín hiệu cầu cứu SOS đã ghi nhận từ thiết bị
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
            {(() => {
              const recentActivityList =
                allSosEvents && allSosEvents.length > 0
                  ? allSosEvents
                  : realSosEvents;
              if (recentActivityList.length === 0) {
                return (
                  <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-6 text-center text-xs text-[#8C8C8C]">
                    Chưa phát sinh sự cố hoặc hoạt động SOS nào trên thiết bị
                    này.
                  </div>
                );
              }
              return recentActivityList.slice(0, 4).map((evt) => {
                const isActive = evt.active === true && evt.resolved !== true;
                const isResolved = evt.resolved === true;

                return (
                  <div
                    key={evt.id}
                    onClick={() => onNavigateTab('events')}
                    className={`cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-lg border px-4 py-3 transition ${
                      isActive
                        ? 'border-[#FFA39E] bg-[#FFF1F0]/50 hover:bg-[#FFF1F0]'
                        : 'border-[#E4E7EC] bg-white hover:border-slate-300 hover:bg-[#FAFAFB]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs ${
                          isActive
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
                          <span className="text-xs font-bold text-[#262626]">
                            Tín hiệu cầu cứu SOS
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10.5px] font-semibold text-white ${
                              isActive
                                ? 'bg-[#F5222D]'
                                : isResolved
                                ? 'bg-[#52C41A]'
                                : 'bg-[#FA8C16]'
                            }`}
                          >
                            {isActive
                              ? 'Đang cần hỗ trợ'
                              : isResolved
                              ? 'Đã hỗ trợ an toàn'
                              : 'Đã ghi nhận'}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-700">
                            {evt.loc.type === 'CURRENT'
                              ? 'Vị trí trực tiếp'
                              : evt.loc.type === 'OLD'
                              ? 'Vị trí lưu gần nhất'
                              : 'Không có vị trí'}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#64748B]">
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-[#1890FF]" />
                            Đã gửi tin nhắn: {evt.sms.sent}/{evt.sms.targets}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <PhoneCall className="h-3 w-3 text-[#52C41A]" />
                            {evt.answeredBy > 0
                              ? `Người thân #${evt.answeredBy} đã nghe máy`
                              : 'Chưa có người bắt máy'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <span className="inline-block rounded bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-semibold text-[#1E293B]">
                        {evt.pushedAt
                          ? formatCleanVietnamTime(
                              formatToVietnamTimezone(
                                new Date(evt.pushedAt),
                                false
                              )
                            )
                          : '--'}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Right: Family Emergency Contacts (5 cols) */}
        <div className="lg:col-span-5 rounded-lg border border-[#E8E8E8] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F0F0F0]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#262626]">
                  Người thân nhận cảnh báo
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold border ${
                    contactSyncComparison.isSynced
                      ? 'bg-[#F6FFED] text-[#389E0D] border-[#B7EB8F]'
                      : 'bg-[#FFF7E6] text-[#D46B08] border-[#FFD591]'
                  }`}
                >
                  {contactSyncComparison.isSynced
                    ? 'Đã đồng bộ'
                    : 'Đang chờ cập nhật'}
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('contacts')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#1890FF] hover:underline"
              >
                <span>Quản lý</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {contacts.length === 0 ? (
                <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 text-center text-xs text-[#8C8C8C]">
                  Chưa có người thân nào trong danh bạ. Bấm &quot;Quản lý&quot; để
                  thêm số điện thoại khẩn cấp.
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
                              <span className="font-medium">
                                {formatPhoneForDisplay(c.phone)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {(c.smsEnabled ?? c.receiveSms) && (
                            <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-medium text-[#1890FF]">
                              Tin nhắn
                            </span>
                          )}
                          {(c.callEnabled ?? c.receiveCall) && (
                            <span className="rounded bg-[#F6FFED] border border-[#B7EB8F] px-2 py-0.5 text-[11px] font-medium text-[#52C41A]">
                              Cuộc gọi
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
              Thời gian chờ hủy báo động trên thiết bị
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
