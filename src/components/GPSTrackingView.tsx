import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Accessibility,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Backpack,
  Bike,
  Check,
  Clock,
  HardHat,
  Loader2,
  LocateFixed,
  Satellite,
} from 'lucide-react';
import {
  DEFAULT_CITY_MAP_CENTER,
  DEFAULT_CITY_MAP_ZOOM,
  isValidLatLonPair,
} from '../hooks/useHelmetTelemetry';
import {
  FirebaseHelmetTelemetry,
  FirebaseSosEventRecord,
  NormalizedGpsStatus,
  OperatingModeId,
  OperatingModeProfile,
} from '../types/helmet';
import {
  formatFriendlyDeviceName,
  formatFriendlyDuration,
} from './DashboardView';

interface GPSTrackingViewProps {
  telemetry: FirebaseHelmetTelemetry | null;
  gpsStatus: NormalizedGpsStatus;
  isServerDisconnected?: boolean;
  isStale?: boolean;
  activeEmergencySos?: FirebaseSosEventRecord | null;
  resolvingSosId?: string | null;
  onResolveSos?: (eventId: string) => Promise<void>;
  telemetryLoading: boolean;
  targetDeviceId: string;
  resolvedAddress: string | null;
  addressLoading: boolean;
  activeModeProfile: OperatingModeProfile;
  allModes?: OperatingModeProfile[];
  onSelectMode?: (mode: OperatingModeId) => void;
}

export function getModeMarkerSvg(modeId: OperatingModeId): string {
  switch (modeId) {
    case 'helmet':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    case 'wheelchair':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/></svg>`;
    case 'motorbike':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;
    case 'backpack':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"/><path d="M8 10h8"/></svg>`;
  }
}

/**
 * Tạo Leaflet DivIcon hỗ trợ đổi sang màu đỏ và hiệu ứng nhấp nháy (CSS pulse/blink animation)
 * ngay khi có sự kiện SOS đang kích hoạt (`isSosActive = true`).
 */
export function buildDeviceLeafletMarkerIcon(
  modeProfile: OperatingModeProfile,
  isSosActive: boolean,
  rawGpsType: 'CURRENT' | 'OLD' | 'NONE',
  isStaleCurrentUpload: boolean
): L.DivIcon {
  const modeSvg = getModeMarkerSvg(modeProfile.id);

  if (isSosActive) {
    return L.divIcon({
      className: `custom-sos-pulsing-marker-${modeProfile.id}`,
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:64px;height:72px;">
          <!-- Nhãn SOS nhấp nháy phía trên -->
          <div style="
            position:absolute;
            top:0;
            z-index:30;
            background:#CF1322;
            color:#ffffff;
            font-size:10px;
            font-weight:800;
            padding:1px 6px;
            border-radius:9999px;
            border:1.5px solid #ffffff;
            box-shadow:0 2px 6px rgba(245,34,45,0.6);
            letter-spacing:0.5px;
          ">SOS!</div>

          <!-- Vòng sóng radar đỏ lan tỏa (CSS Pulse Animation) -->
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin-top:12px;">
            <div class="sos-pulse-ring-1" style="
              position:absolute;
              width:40px;
              height:40px;
              border-radius:9999px;
              background:rgba(245, 34, 45, 0.55);
              border:2px solid #F5222D;
              pointer-events:none;
            "></div>
            <div class="sos-pulse-ring-2" style="
              position:absolute;
              width:40px;
              height:40px;
              border-radius:9999px;
              background:rgba(255, 77, 79, 0.4);
              border:1.5px solid #FF4D4F;
              pointer-events:none;
            "></div>

            <!-- Nhân Marker màu đỏ nhấp nháy (CSS Blink Animation) -->
            <div class="sos-marker-core-blink" style="
              position:relative;
              z-index:20;
              display:flex;
              align-items:center;
              justify-content:center;
              width:38px;
              height:38px;
              border-radius:9999px;
              background:#F5222D;
              border:3px solid #ffffff;
            ">
              ${modeSvg}
            </div>
          </div>

          <!-- Mũi ghim màu đỏ -->
          <div style="
            width:0;
            height:0;
            border-left:7px solid transparent;
            border-right:7px solid transparent;
            border-top:9px solid #F5222D;
            margin-top:-3px;
            z-index:20;
          "></div>
        </div>
      `,
      iconSize: [64, 72],
      iconAnchor: [32, 66],
      popupAnchor: [0, -58],
    });
  }

  const accent =
    rawGpsType === 'OLD'
      ? '#D46B08'
      : isStaleCurrentUpload
      ? '#FA8C16'
      : modeProfile.accentColor;

  return L.divIcon({
    className: `custom-mode-marker-${modeProfile.id}-${rawGpsType}`,
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:44px;height:52px;">
        <div style="
          display:flex;
          align-items:center;
          justify-content:center;
          width:36px;
          height:36px;
          border-radius:9999px;
          background:${accent};
          border:3px solid #ffffff;
          box-shadow:0 4px 12px rgba(0,0,0,0.28);
        ">
          ${modeSvg}
        </div>
        <div style="
          width:0;
          height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid ${accent};
          margin-top:-2px;
        "></div>
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 48],
    popupAnchor: [0, -44],
  });
}

function cleanTimeText(raw: string): string {
  return raw
    .replace(/\s*\(UTC\+7\)/g, '')
    .replace(/\s*\[Gốc:.*\]/g, '')
    .trim();
}

export const GPSTrackingView: React.FC<GPSTrackingViewProps> = ({
  gpsStatus,
  isServerDisconnected = false,
  isStale = false,
  activeEmergencySos = null,
  resolvingSosId = null,
  onResolveSos,
  telemetryLoading,
  targetDeviceId,
  resolvedAddress,
  addressLoading,
  activeModeProfile,
  allModes,
  onSelectMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const lastPannedCoordsRef = useRef<{
    deviceId: string;
    lat: number;
    lon: number;
  } | null>(null);

  const isSosActive = Boolean(activeEmergencySos);
  const isStaleOrOffline = Boolean(isServerDisconnected || isStale);

  const {
    rawType,
    displayLat,
    displayLon,
    hasInvalidIncomingCoords,
    isSearchingSatellites,
    usingLastValidPosition,
    lastValidPosition,
    sats,
    updatedAtText,
    secondsSinceGpsUpdate,
    isFreshRealtime,
    isStaleCurrentUpload,
    lastUtcText,
    googleMapsUrl,
  } = gpsStatus;

  // Nếu đang có SOS mà status/gps chưa có tọa độ hợp lệ, chỉ fallback sang tọa độ SOS nếu tọa độ SOS hợp lệ (khác 0,0)
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

  const effectiveLat = displayLat ?? validSosLat;
  const effectiveLon = displayLon ?? validSosLon;

  const hasMapCoordinates = isValidLatLonPair(effectiveLat, effectiveLon);

  const isShowingLastValidWhileSearching =
    hasMapCoordinates &&
    (usingLastValidPosition ||
      hasInvalidIncomingCoords ||
      isSearchingSatellites ||
      rawType === 'OLD');

  const effectiveMapsUrl =
    googleMapsUrl ||
    (hasMapCoordinates && activeEmergencySos?.loc.mapUrl
      ? activeEmergencySos.loc.mapUrl
      : null) ||
    (hasMapCoordinates
      ? `https://www.google.com/maps?q=${effectiveLat!.toFixed(
          6
        )},${effectiveLon!.toFixed(6)}`
      : null);

  const renderModeLucideIcon = (modeId: OperatingModeId) => {
    switch (modeId) {
      case 'helmet':
        return <HardHat className="h-3.5 w-3.5" />;
      case 'wheelchair':
        return <Accessibility className="h-3.5 w-3.5" />;
      case 'motorbike':
        return <Bike className="h-3.5 w-3.5" />;
      case 'backpack':
        return <Backpack className="h-3.5 w-3.5" />;
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Khởi tạo bản đồ:
    // - Nếu đã có tọa độ hợp lệ (hoặc lastValidPosition): đặt tâm tại vị trí đó.
    // - Trường hợp chưa có vị trí hợp lệ nào trước đó: giữ bản đồ ở vị trí mặc định trung tâm thành phố (tuyệt đối không nhảy ra 0, 0).
    if (!mapInstanceRef.current) {
      const initialCenter: [number, number] =
        hasMapCoordinates && effectiveLat !== null && effectiveLon !== null
          ? [effectiveLat, effectiveLon]
          : DEFAULT_CITY_MAP_CENTER;
      const initialZoom =
        hasMapCoordinates && effectiveLat !== null && effectiveLon !== null
          ? 16
          : DEFAULT_CITY_MAP_ZOOM;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      if (hasMapCoordinates && effectiveLat !== null && effectiveLon !== null) {
        lastPannedCoordsRef.current = {
          deviceId: targetDeviceId,
          lat: effectiveLat,
          lon: effectiveLon,
        };
      }
    }

    const map = mapInstanceRef.current;

    // Trường hợp chưa có vị trí hợp lệ nào trước đó: xóa marker (không đặt marker tại 0,0) và giữ nguyên bản đồ ở trung tâm thành phố
    if (!hasMapCoordinates || effectiveLat === null || effectiveLon === null) {
      if (markerInstanceRef.current) {
        map.removeLayer(markerInstanceRef.current);
        markerInstanceRef.current = null;
      }
      if (
        lastPannedCoordsRef.current &&
        lastPannedCoordsRef.current.deviceId !== targetDeviceId
      ) {
        lastPannedCoordsRef.current = null;
        map.setView(DEFAULT_CITY_MAP_CENTER, DEFAULT_CITY_MAP_ZOOM);
      }
      return;
    }

    const effectiveRawTypeForIcon = isShowingLastValidWhileSearching
      ? 'OLD'
      : rawType;

    const markerIcon = buildDeviceLeafletMarkerIcon(
      activeModeProfile,
      isSosActive,
      effectiveRawTypeForIcon,
      isStaleCurrentUpload
    );

    const addressTitle =
      resolvedAddress || 'Đã xác định vị trí của thiết bị trên bản đồ';

    const accent = isSosActive
      ? '#F5222D'
      : isShowingLastValidWhileSearching
      ? '#D46B08'
      : isStaleCurrentUpload
      ? '#FA8C16'
      : activeModeProfile.accentColor;

    const statusPopupBadge = isSosActive
      ? '🔴 ĐANG CẦU CỨU SOS!'
      : isShowingLastValidWhileSearching
      ? 'GPS đang dò vệ tinh (Vị trí gần nhất)'
      : isFreshRealtime
      ? 'Vị trí trực tiếp'
      : 'Vị trí ghi nhận gần nhất';

    const displayUpdatedTime =
      usingLastValidPosition && lastValidPosition?.updatedAtText
        ? lastValidPosition.updatedAtText
        : updatedAtText;

    const popupHtml = `<div style="min-width:235px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">
        <span style="font-weight:700;color:${accent};font-size:12.5px">
          ${formatFriendlyDeviceName(targetDeviceId)}
        </span>
        <span style="background:${accent};color:#fff;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:700">
          ${statusPopupBadge}
        </span>
      </div>
      <div style="font-size:12.5px;font-weight:600;color:#18181B;margin-bottom:4px">${addressTitle}</div>
      <div style="font-size:11px;color:#52525B">
        Chế độ bảo vệ: <strong>${activeModeProfile.label}</strong>
      </div>
      <div style="font-size:11px;color:#71717A;margin-top:3px">
        Cập nhật lúc: ${cleanTimeText(displayUpdatedTime)}
      </div>
    </div>`;

    if (!markerInstanceRef.current) {
      markerInstanceRef.current = L.marker([effectiveLat, effectiveLon], {
        icon: markerIcon,
      })
        .addTo(map)
        .bindPopup(popupHtml);
      markerInstanceRef.current.openPopup();
    } else {
      markerInstanceRef.current.setIcon(markerIcon);
      markerInstanceRef.current.setPopupContent(popupHtml);
    }

    // Chỉ di chuyển marker và pan bản đồ khi tọa độ hợp lệ thực sự thay đổi (hoặc lần đầu có tọa độ hợp lệ).
    // Khi nhận gói tin có tọa độ không hợp lệ (0,0 / đang dò vệ tinh), TUYỆT ĐỐI giữ nguyên vị trí marker và không pan/zoom bản đồ!
    const prevPanned = lastPannedCoordsRef.current;
    const isFirstValidForDevice =
      !prevPanned || prevPanned.deviceId !== targetDeviceId;
    const hasValidCoordsMoved =
      prevPanned !== null &&
      (Math.abs(prevPanned.lat - effectiveLat) > 0.000001 ||
        Math.abs(prevPanned.lon - effectiveLon) > 0.000001);

    if (isFirstValidForDevice) {
      markerInstanceRef.current.setLatLng([effectiveLat, effectiveLon]);
      map.setView([effectiveLat, effectiveLon], 16);
      lastPannedCoordsRef.current = {
        deviceId: targetDeviceId,
        lat: effectiveLat,
        lon: effectiveLon,
      };
    } else if (!usingLastValidPosition && !hasInvalidIncomingCoords && hasValidCoordsMoved) {
      markerInstanceRef.current.setLatLng([effectiveLat, effectiveLon]);
      map.setView([effectiveLat, effectiveLon], map.getZoom());
      lastPannedCoordsRef.current = {
        deviceId: targetDeviceId,
        lat: effectiveLat,
        lon: effectiveLon,
      };
    }
  }, [
    hasMapCoordinates,
    effectiveLat,
    effectiveLon,
    isSosActive,
    rawType,
    isShowingLastValidWhileSearching,
    usingLastValidPosition,
    hasInvalidIncomingCoords,
    lastValidPosition,
    isFreshRealtime,
    isStaleCurrentUpload,
    updatedAtText,
    targetDeviceId,
    resolvedAddress,
    activeModeProfile,
  ]);

  useEffect(() => {
    return () => {
      markerInstanceRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const recenterMap = () => {
    if (
      mapInstanceRef.current &&
      hasMapCoordinates &&
      effectiveLat !== null &&
      effectiveLon !== null
    ) {
      mapInstanceRef.current.flyTo([effectiveLat, effectiveLon], 16, {
        duration: 0.8,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top GPS Status Header */}
      <div
        className={`rounded-lg border p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4 transition-colors ${
          isSosActive
            ? 'border-2 border-[#F5222D] bg-[#FFF1F0]/60'
            : 'border-[#E8E8E8] bg-white'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">
                Định vị hành trình — {formatFriendlyDeviceName(targetDeviceId)}
              </span>

              {isSosActive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5222D] px-3 py-0.5 text-xs font-extrabold text-white animate-pulse">
                  <AlertOctagon className="h-3.5 w-3.5" />
                  ĐANG PHÁT TÍN HIỆU CẦU CỨU KHẨN CẤP
                </span>
              )}

              {isStaleOrOffline && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-xs font-bold text-[#D46B08]">
                  <Clock className="h-3.5 w-3.5 text-[#FA8C16]" />
                  Dữ liệu cũ (Offline) • Cập nhật lần cuối:{' '}
                  {cleanTimeText(updatedAtText)}
                </span>
              )}

              {!isSosActive &&
                !isShowingLastValidWhileSearching &&
                rawType === 'CURRENT' &&
                isFreshRealtime && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-xs font-bold text-[#389E0D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
                    Định vị trực tiếp
                  </span>
                )}

              {!isSosActive &&
                !isShowingLastValidWhileSearching &&
                rawType === 'CURRENT' &&
                isStaleCurrentUpload && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-xs font-bold text-[#D46B08]">
                    <Clock className="h-3.5 w-3.5 text-[#FA8C16]" />
                    Vị trí ghi nhận cách đây{' '}
                    {formatFriendlyDuration(secondsSinceGpsUpdate)}
                  </span>
                )}

              {isShowingLastValidWhileSearching && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBE6] border border-[#FFE58F] px-2.5 py-0.5 text-xs font-bold text-[#AD6800]">
                  <Satellite className="h-3.5 w-3.5 text-[#FAAD14]" />
                  GPS đang dò vệ tinh (Hiển thị vị trí gần nhất)
                </span>
              )}

              {!hasMapCoordinates && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                  <Satellite className="h-3.5 w-3.5 text-[#FAAD14] animate-pulse" />
                  Đang chờ tín hiệu GPS...
                </span>
              )}

              {/* Active Mode Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${activeModeProfile.badgeBg} ${activeModeProfile.badgeText} ${activeModeProfile.badgeBorder}`}
              >
                {renderModeLucideIcon(activeModeProfile.id)}
                <span>Chế độ: {activeModeProfile.label}</span>
              </span>
            </div>

            {/* Main Location Heading */}
            {hasMapCoordinates &&
            effectiveLat !== null &&
            effectiveLon !== null ? (
              <>
                <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                  {addressLoading
                    ? 'Đang xác định địa chỉ đường phố...'
                    : resolvedAddress ||
                      'Đã xác định được vị trí của thiết bị trên bản đồ'}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
                  <span>
                    Chất lượng định vị:{' '}
                    <strong className="text-zinc-900">
                      {isShowingLastValidWhileSearching
                        ? 'Đang giữ vị trí gần nhất'
                        : sats !== null && sats >= 4
                        ? 'Tín hiệu rõ nét'
                        : 'Ổn định'}
                    </strong>
                  </span>
                  <span>
                    Cập nhật lúc:{' '}
                    <strong className="text-zinc-900">
                      {cleanTimeText(updatedAtText)}
                    </strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-bold text-zinc-900">
                  Đang chờ tín hiệu GPS...
                </h2>
                <p className="text-xs text-zinc-500">
                  Thiết bị đang tìm tín hiệu định vị ngoài trời. Bản đồ tạm thời giữ ở vị trí mặc định trung tâm thành phố và sẽ tự động đặt điểm ghim ngay khi bắt được sóng GPS.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Mode Switcher on Map Tab (Disabled when server connection is lost) */}
            {allModes && onSelectMode && (
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-1">
                {allModes.map((m) => {
                  const isSelected = m.id === activeModeProfile.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isServerDisconnected}
                      onClick={() => onSelectMode(m.id)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-[#1890FF] text-white shadow-2xs'
                          : 'text-[#595959] hover:text-[#262626] hover:bg-white'
                      }`}
                    >
                      {renderModeLucideIcon(m.id)}
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {hasMapCoordinates && effectiveMapsUrl && (
              <>
                <button
                  onClick={recenterMap}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1890FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#40A9FF] transition"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                  Định tâm vị trí
                </button>

                <a
                  href={effectiveMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#91D5FF] bg-[#E6F7FF] px-3.5 py-2 text-xs font-semibold text-[#0050B3] hover:bg-[#BAE7FF] transition"
                >
                  <span>Chỉ đường trên Google Maps</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </>
            )}

            {isSosActive && activeEmergencySos && onResolveSos && (
              <button
                type="button"
                disabled={
                  isServerDisconnected ||
                  resolvingSosId === activeEmergencySos.id
                }
                onClick={() => onResolveSos(activeEmergencySos.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#52C41A] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#389E0D] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
              >
                {resolvingSosId === activeEmergencySos.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Tắt cảnh báo / Xác nhận</span>
              </button>
            )}
          </div>
        </div>

        {/* Friendly Notice when GPS is searching satellites & holding lastValidPosition */}
        {isShowingLastValidWhileSearching && (
          <div className="rounded-lg border border-[#FFE58F] bg-[#FFFBE6] px-4 py-3 flex items-start gap-3 text-xs text-[#AD6800]">
            <AlertTriangle className="h-4 w-4 text-[#FAAD14] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">
                GPS đang dò vệ tinh (Hiển thị vị trí gần nhất):
              </div>
              <p>
                Thiết bị hiện đang ở trong nhà hoặc khu vực khuất sóng định vị nên chưa có vị trí mới. Hệ thống đang giữ nguyên vị trí hợp lệ gần nhất trên bản đồ
                {lastUtcText ? ` (ghi nhận lúc ${cleanTimeText(lastUtcText)})` : ''}. Các thông tin về pin và an toàn chuyển động vẫn cập nhật bình thường.
              </p>
            </div>
          </div>
        )}

        {/* Friendly Notice when CURRENT position was uploaded earlier */}
        {!isShowingLastValidWhileSearching &&
          rawType === 'CURRENT' &&
          isStaleCurrentUpload && (
          <div className="rounded-lg border border-[#FFD591] bg-[#FFFBE6] px-4 py-3 flex items-start gap-3 text-xs text-[#AD6800]">
            <Clock className="h-4 w-4 text-[#FAAD14] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">
                Vị trí được ghi nhận từ lần kết nối trước:
              </div>
              <p>
                Tọa độ này được thiết bị gửi lên lúc{' '}
                <strong>{cleanTimeText(updatedAtText)}</strong> (cách đây{' '}
                <strong>{formatFriendlyDuration(secondsSinceGpsUpdate)}</strong>
                ). Bản đồ sẽ tự động cập nhật vị trí di chuyển mới ngay khi
                thiết bị gửi tín hiệu tiếp theo.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Map Container (Always rendered: holds lastValidPosition or stays at default city center when waiting for first GPS fix) */}
      <div
        className={`relative rounded-lg border p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-300 ${
          isSosActive
            ? 'border-2 border-[#F5222D] bg-[#FFF1F0]/40'
            : 'border-[#E8E8E8] bg-white'
        } ${isStaleOrOffline && !isSosActive ? 'opacity-75' : 'opacity-100'}`}
      >
        <div className="relative">
          <div
            ref={mapContainerRef}
            className="h-[460px] w-full rounded-lg overflow-hidden border border-zinc-100"
          />

          {/* Floating Status Banner when no prior valid position exists (Default City Center view) */}
          {!hasMapCoordinates && (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-[400] flex justify-center">
              <div className="inline-flex items-center gap-2.5 rounded-xl border border-[#FFE58F] bg-white/95 px-4 py-2.5 text-xs font-bold text-[#AD6800] shadow-lg backdrop-blur-xs">
                <Satellite className="h-4 w-4 text-[#FAAD14] animate-pulse shrink-0" />
                <span>
                  Đang chờ tín hiệu GPS... (Bản đồ đang giữ ở vị trí mặc định trung tâm thành phố)
                </span>
              </div>
            </div>
          )}

          {/* Floating Status Badge when holding lastValidPosition while GPS searches for satellites */}
          {isShowingLastValidWhileSearching && (
            <div className="pointer-events-none absolute right-3 top-3 z-[400]">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFE58F] bg-[#FFFBE6]/95 px-3 py-1.5 text-[11px] font-bold text-[#AD6800] shadow-md">
                <Satellite className="h-3.5 w-3.5 text-[#FAAD14] shrink-0" />
                <span>GPS đang dò vệ tinh (Hiển thị vị trí gần nhất)</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 px-2 text-xs text-zinc-500">
          {hasMapCoordinates ? (
            <span className="inline-flex items-center gap-2">
              <span
                style={{
                  backgroundColor: isSosActive
                    ? '#F5222D'
                    : isShowingLastValidWhileSearching
                    ? '#D46B08'
                    : isStaleCurrentUpload
                    ? '#FA8C16'
                    : activeModeProfile.accentColor,
                }}
                className={`h-2.5 w-2.5 rounded-full inline-block ${
                  isSosActive ? 'animate-ping' : ''
                }`}
              />
              <strong className={isSosActive ? 'text-[#CF1322]' : ''}>
                {isSosActive
                  ? '🔴 VỊ TRÍ CẦU CỨU SOS:'
                  : isShowingLastValidWhileSearching
                  ? 'Vị trí hợp lệ gần nhất:'
                  : 'Vị trí ghi nhận:'}
              </strong>{' '}
              {resolvedAddress || 'Đang hiển thị trên bản đồ'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-amber-700 font-semibold">
              <Satellite className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              <span>
                Đang chờ tín hiệu GPS... Điểm ghim sẽ tự động xuất hiện ngay khi xác định được vị trí.
              </span>
            </span>
          )}
          <span className="text-[11px]">
            Chế độ bảo vệ: <strong>{activeModeProfile.label}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
