import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Accessibility,
  AlertTriangle,
  ArrowUpRight,
  Backpack,
  Bike,
  CheckCircle2,
  Clock,
  Cpu,
  HardHat,
  LocateFixed,
  MapPin,
  Satellite,
} from 'lucide-react';
import {
  FirebaseHelmetTelemetry,
  NormalizedGpsStatus,
  OperatingModeId,
  OperatingModeProfile,
} from '../types/helmet';

interface GPSTrackingViewProps {
  telemetry: FirebaseHelmetTelemetry | null;
  gpsStatus: NormalizedGpsStatus;
  telemetryLoading: boolean;
  targetDeviceId: string;
  resolvedAddress: string | null;
  addressLoading: boolean;
  activeModeProfile: OperatingModeProfile;
  allModes?: OperatingModeProfile[];
  onSelectMode?: (mode: OperatingModeId) => void;
}

function getModeMarkerSvg(modeId: OperatingModeId): string {
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

export const GPSTrackingView: React.FC<GPSTrackingViewProps> = ({
  gpsStatus,
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

  const {
    rawType,
    isInferredLegacyType,
    valid,
    uartOpen,
    lat,
    lon,
    lastLat,
    lastLon,
    displayLat,
    displayLon,
    sats,
    hdop,
    ageMs,
    updatedAtText,
    secondsSinceGpsUpdate,
    isFreshRealtime,
    isStaleCurrentUpload,
    lastUtcText,
    googleMapsUrl,
    sourcePath,
  } = gpsStatus;

  // Strictly NO fake coordinates when rawType === 'NONE'
  const hasMapCoordinates =
    rawType !== 'NONE' && displayLat !== null && displayLon !== null;

  const formatAgeMs = (ms: number | null) => {
    if (ms === null || !Number.isFinite(ms)) return '--';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} giây`;
  };

  const formatSecondsAgo = (sec: number | null) => {
    if (sec === null || !Number.isFinite(sec)) return '--';
    if (sec < 60) return `${sec} giây trước`;
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (mins < 60) return `${mins} phút ${remSec}s trước`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} giờ ${mins % 60}p trước`;
  };

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
      if (!hasMapCoordinates || displayLat === null || displayLon === null) {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        return;
      }

      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [displayLat, displayLon],
          zoom: 16,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      });

      const modeSvg = getModeMarkerSvg(activeModeProfile.id);
      const accent =
        rawType === 'OLD'
          ? '#D46B08'
          : isStaleCurrentUpload
            ? '#FA8C16'
            : activeModeProfile.accentColor;

      const modeMarkerIcon = L.divIcon({
        className: `custom-mode-marker-${activeModeProfile.id}-${rawType}`,
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

      const addressTitle =
      resolvedAddress || `${displayLat.toFixed(6)}, ${displayLon.toFixed(6)}`;

      const statusPopupBadge =
        rawType === 'CURRENT'
          ? isFreshRealtime
            ? 'CURRENT (Realtime)'
            : 'CURRENT (Đã upload từ lâu)'
          : 'OLD (Vị trí cuối đã biết)';

      const coordLabel =
        rawType === 'OLD'
          ? `lastLat: ${displayLat.toFixed(6)}, lastLon: ${displayLon.toFixed(6)}`
          : `lat: ${displayLat.toFixed(6)}, lon: ${displayLon.toFixed(6)}`;

      const marker = L.marker([displayLat, displayLon], { icon: modeMarkerIcon })
        .addTo(map)
        .bindPopup(
        `< div style = "min-width:235px" >
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">
            <span style="font-weight:700;color:${accent};font-size:12.5px">
              CAS-BOX (${targetDeviceId})
            </span>
            <span style="background:${accent};color:#fff;padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700">
              ${statusPopupBadge}
            </span>
          </div>
          <div style="font-size:12.5px;font-weight:600;color:#18181B;margin-bottom:3px">${addressTitle}</div>
          <div style="font-size:11px;color:#52525B;font-family:monospace">${coordLabel}</div>
          <div style="font-size:11px;color:#52525B;margin-top:4px">
            Cập nhật (updatedAt): <strong>${updatedAtText}</strong>
          </div>
          <div style="font-size:11px;color:#71717A;margin-top:3px">Sats: ${
            sats ?? '--'
          } • HDOP: ${hdop ?? '--'} • Age: ${formatAgeMs(ageMs)}</div>
        </div > `
      );

    marker.openPopup();
    map.setView([displayLat, displayLon], map.getZoom());
  }, [
    hasMapCoordinates,
    displayLat,
    displayLon,
    rawType,
    isFreshRealtime,
    isStaleCurrentUpload,
    sats,
    hdop,
    ageMs,
    updatedAtText,
    targetDeviceId,
    resolvedAddress,
    activeModeProfile,
  ]);

  useEffect(() => {
    return () => {
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
      displayLat !== null &&
      displayLon !== null
    ) {
      mapInstanceRef.current.flyTo([displayLat, displayLon], 16, {
        duration: 0.8,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top GPS Status & V2.4.3-dev Schema Header */}
      <div className="rounded-lg border border-[#E8E8E8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">
                Giám sát GPS Realtime (<code>/{sourcePath}</code>)
              </span>

              {/* 1. Primary type Badge: CURRENT / OLD / NONE */}
              {rawType === 'CURRENT' && isFreshRealtime && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-xs font-bold text-[#389E0D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#52C41A]" />
                  type: CURRENT (Realtime • valid: true)
                </span>
              )}

              {rawType === 'CURRENT' && isStaleCurrentUpload && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-xs font-bold text-[#D46B08]">
                  <Clock className="h-3.5 w-3.5 text-[#FA8C16]" />
                  type: CURRENT (Bản ghi đã upload từ{' '}
                  {formatSecondsAgo(secondsSinceGpsUpdate)} • Không phải
                  Realtime)
                </span>
              )}

              {rawType === 'OLD' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-xs font-bold text-[#D46B08]">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#FAAD14]" />
                  type: OLD (Vị trí cuối cùng đã biết • valid:{' '}
                  {String(valid)})
                </span>
              )}

              {rawType === 'NONE' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF1F0] border border-[#FFA39E] px-2.5 py-0.5 text-xs font-bold text-[#CF1322]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F5222D]" />
                  type: NONE (Chưa có dữ liệu định vị)
                </span>
              )}

              {isInferredLegacyType && (
                <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                  Tương thích V2.4.2-dev
                </span>
              )}

              {/* 2. uartOpen Badge */}
              <span
                className={`inline - flex items - center gap - 1 rounded - full px - 2.5 py - 0.5 text - xs font - semibold border ${
  uartOpen === true
    ? 'bg-[#E6F7FF] text-[#0050B3] border-[#91D5FF]'
    : uartOpen === false
      ? 'bg-[#FFF1F0] text-[#CF1322] border-[#FFA39E]'
      : 'bg-slate-100 text-slate-600 border-slate-200'
} `}
              >
                <Cpu className="h-3 w-3" />
                uartOpen:{' '}
                {uartOpen === null ? '--' : uartOpen ? 'true' : 'false'}
              </span>

              {/* 3. Active Mode Marker Badge */}
              <span
                className={`inline - flex items - center gap - 1.5 rounded - full px - 2.5 py - 0.5 text - xs font - bold border ${ activeModeProfile.badgeBg } ${ activeModeProfile.badgeText } ${ activeModeProfile.badgeBorder } `}
              >
                {renderModeLucideIcon(activeModeProfile.id)}
                <span>Marker: {activeModeProfile.label}</span>
              </span>
            </div>

            {/* Main Location Heading by CURRENT / OLD / NONE */}
            {rawType === 'CURRENT' && lat !== null && lon !== null ? (
              <>
                <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                  {addressLoading
                    ? 'Đang trích xuất địa chỉ đường phố...'
                    : resolvedAddress ||
                      `${ lat.toFixed(6) }°N, ${ lon.toFixed(6) }°E`}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
                  <span className="font-mono font-semibold text-zinc-900">
                    lat: {lat.toFixed(6)} • lon: {lon.toFixed(6)}
                  </span>
                  <span>
                    Vệ tinh (sats):{' '}
                    <strong className="text-zinc-900">
                      {sats !== null ? sats : '--'}
                    </strong>
                  </span>
                  <span>
                    HDOP:{' '}
                    <strong className="text-zinc-900">
                      {hdop !== null ? hdop : '--'}
                    </strong>
                  </span>
                  <span>
                    Tuổi mẫu NMEA (ageMs):{' '}
                    <strong className="text-zinc-900">
                      {formatAgeMs(ageMs)}
                    </strong>
                  </span>
                  <span>
                    Thời điểm cập nhật (updatedAt):{' '}
                    <strong className="font-mono text-zinc-900">
                      {updatedAtText}
                    </strong>
                  </span>
                </div>
              </>
            ) : rawType === 'OLD' &&
              displayLat !== null &&
              displayLon !== null ? (
              <>
                <h2 className="text-base sm:text-lg font-bold text-[#AD4E00]">
                  [Vị trí lưu cuối cùng - OLD]{' '}
                  {addressLoading
                    ? 'Đang trích xuất địa chỉ...'
                    : resolvedAddress ||
                      `${ displayLat.toFixed(6) }°N, ${ displayLon.toFixed(6) }°E`}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
                  <span className="font-mono font-semibold text-[#AD4E00]">
                    lastLat: {(lastLat ?? displayLat).toFixed(6)} • lastLon:{' '}
                    {(lastLon ?? displayLon).toFixed(6)}
                  </span>
                  {lastUtcText && (
                    <span>
                      Thời điểm chốt GPS cuối (lastUtc):{' '}
                      <strong className="font-mono text-zinc-900">
                        {lastUtcText}
                      </strong>
                    </span>
                  )}
                  <span>
                    Thời điểm cập nhật (updatedAt):{' '}
                    <strong className="font-mono text-zinc-900">
                      {updatedAtText}
                    </strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-bold text-zinc-900">
                  Chưa có dữ liệu định vị (GPS: NONE)
                </h2>
                <p className="text-xs text-zinc-500">
                  Thiết bị chưa có tọa độ hiện tại (<code>lat/lon</code>) lẫn vị
                  trí lưu cuối cùng (<code>lastLat/lastLon</code>). Hệ thống không
                  hiển thị hoặc tạo tọa độ giả.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Mode Switcher on Map Tab */}
            {allModes && onSelectMode && (
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-1">
                {allModes.map((m) => {
                  const isSelected = m.id === activeModeProfile.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMode(m.id)}
                      className={`inline - flex items - center gap - 1 rounded - md px - 2.5 py - 1.5 text - xs font - semibold transition ${
  isSelected
    ? 'bg-[#1890FF] text-white shadow-2xs'
    : 'text-[#595959] hover:text-[#262626] hover:bg-white'
} `}
                    >
                      {renderModeLucideIcon(m.id)}
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {hasMapCoordinates && googleMapsUrl && (
              <>
                <button
                  onClick={recenterMap}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1890FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#40A9FF] transition"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                  Định tâm vị trí
                </button>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#91D5FF] bg-[#E6F7FF] px-3.5 py-2 text-xs font-semibold text-[#0050B3] hover:bg-[#BAE7FF] transition"
                >
                  <span>Xem trên Google Maps</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Warning Banner when type === 'OLD' */}
        {rawType === 'OLD' && (
          <div className="rounded-lg border border-[#FFD591] bg-[#FFF7E6] px-4 py-3 flex items-start gap-3 text-xs text-[#AD4E00]">
            <AlertTriangle className="h-4 w-4 text-[#FA8C16] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">
                Cảnh báo vị trí cuối cùng đã biết (type = OLD • valid = false):
              </div>
              <p>
                Module GPS hiện chưa khóa được tín hiệu vệ tinh mới. Tọa độ{' '}
                <code className="font-mono font-bold">
                  lastLat={(lastLat ?? displayLat)?.toFixed(6)}, lastLon=
                  {(lastLon ?? displayLon)?.toFixed(6)}
                </code>{' '}
                đang hiển thị là vị trí cuối cùng được lưu trong NVS của thiết
                bị{lastUtcText ? ` (${ lastUtcText })` : ''}, không phải vị trí
                thời gian thực.
              </p>
            </div>
          </div>
        )}

        {/* Warning Banner when type === 'CURRENT' but updatedAt was uploaded a long time ago */}
        {rawType === 'CURRENT' && isStaleCurrentUpload && (
          <div className="rounded-lg border border-[#FFD591] bg-[#FFFBE6] px-4 py-3 flex items-start gap-3 text-xs text-[#AD6800]">
            <Clock className="h-4 w-4 text-[#FAAD14] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">
                Cảnh báo độ mới của bản ghi (Đánh giá theo{' '}
                <code>status/gps/updatedAt</code>):
              </div>
              <p>
                Bản ghi này có <code>type = &quot;CURRENT&quot;</code> tại thời
                điểm ESP32 tải lên (<strong>{updatedAtText}</strong> — cách đây{' '}
                <strong>{formatSecondsAgo(secondsSinceGpsUpdate)}</strong>). Do
                thiết bị chưa gửi gói <code>GPSSYNC</code> hoặc{' '}
                <code>SYNC</code> mới trong 30 giây gần đây, tọa độ này{' '}
                <strong>không được coi là vị trí di chuyển realtime hiện tại</strong>.
              </p>
            </div>
          </div>
        )}

{/* V2.4.3-dev Full GPS Schema Telemetry Grid & Separation Note */ }
<div className="pt-3 border-t border-[#F0F0F0] space-y-2.5">
  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 text-xs">
    <div className="rounded bg-[#FAFAFA] border border-[#E8E8E8] px-2.5 py-1.5">
      <span className="text-[10.5px] text-[#8C8C8C] block">
        type / valid
      </span>
      <strong className="font-mono text-[#262626]">
        {rawType} / {String(valid)}
      </strong>
    </div>

    <div className="rounded bg-[#FAFAFA] border border-[#E8E8E8] px-2.5 py-1.5">
      <span className="text-[10.5px] text-[#8C8C8C] block">
        uartOpen
      </span>
      <strong className="font-mono text-[#262626]">
        {uartOpen === null ? '--' : String(uartOpen)}
      </strong>
    </div>

    <div className="rounded bg-[#FAFAFA] border border-[#E8E8E8] px-2.5 py-1.5">
      <span className="text-[10.5px] text-[#8C8C8C] block">
        lat / lon (CURRENT)
      </span>
      <strong className="font-mono text-[#262626] text-[11px]">
        {lat !== null && lon !== null
          ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
          : '--'}
      </strong>
    </div>

    <div className="rounded bg-[#FAFAFA] border border-[#E8E8E8] px-2.5 py-1.5">
      <span className="text-[10.5px] text-[#8C8C8C] block">
        lastLat / lastLon (OLD)
      </span>
      <strong className="font-mono text-[#262626] text-[11px]">
        {lastLat !== null && lastLon !== null
          ? `${lastLat.toFixed(5)}, ${lastLon.toFixed(5)}`
          : '--'}
      </strong>
    </div>

    <div className="rounded bg-[#FAFAFA] border border-[#E8E8E8] px-2.5 py-1.5">
      <span className="text-[10.5px] text-[#8C8C8C] block">
        sats / hdop
      </span>
      <strong className="font-mono text-[#262626]">
        {sats ?? '--'} / {hdop ?? '--'}
      </strong>
    </div>

    <div className="rounded bg-[#FAFAFA] border border-[#E8E8E8] px-2.5 py-1.5">
      <span className="text-[10.5px] text-[#8C8C8C] block">ageMs</span>
      <strong className="font-mono text-[#262626]">
        {ageMs !== null ? `${ageMs} ms` : '--'}
      </strong>
    </div>

    <div className="rounded bg-[#FAFAFA] border border-[#E8E8E8] px-2.5 py-1.5 sm:col-span-2">
      <span className="text-[10.5px] text-[#8C8C8C] block">
        updatedAt (Độ mới bản ghi)
      </span>
      <strong className="font-mono text-[#262626] text-[11px]">
        {updatedAtText}
      </strong>
    </div>
  </div>

  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8C8C8C]">
    <span>
      Nguồn giám sát: <code>/{sourcePath}</code> (Tự động cập nhật khi
      ESP32 chạy <code>GPSSYNC</code> hoặc <code>SYNC</code> — Tách biệt
      với vị trí sự cố tại <code>sos/loc</code> và{' '}
      <code>events/&#123;eventId&#125;/loc</code>)
    </span>
    {lastUtcText && (
      <span className="font-mono">
        lastUtcYMD/HMS: {lastUtcText}
      </span>
    )}
  </div>
</div>
      </div >

    {/* Map or NONE State Notice */ }
      {
    hasMapCoordinates ? (
      <div className="rounded-lg border border-[#E8E8E8] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div
          ref={mapContainerRef}
          className="h-[460px] w-full rounded-lg overflow-hidden border border-zinc-100"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 px-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <span
              style={{
                backgroundColor:
                  rawType === 'OLD'
                    ? '#D46B08'
                    : isStaleCurrentUpload
                      ? '#FA8C16'
                      : activeModeProfile.accentColor,
              }}
              className="h-2.5 w-2.5 rounded-full inline-block"
            />
            <strong>
              [{rawType === 'CURRENT' ? 'GPS CURRENT' : 'GPS OLD Fallback'}]
            </strong>{' '}
            {resolvedAddress
              ? `Địa điểm: ${resolvedAddress}`
            : `Tọa độ từ /${sourcePath}`}
          </span>
          <span className="font-mono text-[11px]">
            sats: {sats ?? '--'} • hdop: {hdop ?? '--'} • ageMs:{' '}
            {ageMs ?? '--'} • uartOpen:{' '}
            {uartOpen === null ? '--' : String(uartOpen)}
          </span>
        </div>
      </div>
    ) : (
      <div className="rounded-lg border border-[#E8E8E8] bg-white p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1F0] text-[#CF1322] border border-[#FFA39E]">
            <Satellite className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">
            Chưa có dữ liệu định vị (GPS: NONE)
          </h3>
            <p className="mx-auto max-w-lg text-xs text-zinc-500 leading-relaxed">
              {telemetryLoading
              ? `Đang tải dữ liệu từ /${sourcePath}...`
              : `Nhánh /${sourcePath} hiện ở trạng thái type = NONE (valid = ${String(
                valid
              )}, uartOpen = ${
                uartOpen === null ? '--' : String(uartOpen)
              }, sats = ${sats ?? '--'}, hdop = ${
                hdop ?? '--'
              }). Hệ thống không tạo tọa độ giả; bản đồ sẽ tự động hiển thị ngay khi ESP32 gửi GPSSYNC / SYNC có tọa độ CURRENT hoặc OLD.`}
            </p>
        </div>
      )}
      </div>
    );
  };
