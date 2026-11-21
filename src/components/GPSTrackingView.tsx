import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  ArrowUpRight,
  LocateFixed,
  Satellite,
} from 'lucide-react';
import { FirebaseHelmetTelemetry } from '../types/helmet';

interface GPSTrackingViewProps {
  telemetry: FirebaseHelmetTelemetry | null;
  telemetryLoading: boolean;
  targetDeviceId: string;
  resolvedAddress: string | null;
  addressLoading: boolean;
}

export const GPSTrackingView: React.FC<GPSTrackingViewProps> = ({
  telemetry,
  telemetryLoading,
  targetDeviceId,
  resolvedAddress,
  addressLoading,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const gpsFix = telemetry?.gps?.fix === true;
  const lat =
    typeof telemetry?.gps?.latitude === 'number' &&
    Number.isFinite(telemetry.gps.latitude)
      ? telemetry.gps.latitude
      : null;
  const lng =
    typeof telemetry?.gps?.longitude === 'number' &&
    Number.isFinite(telemetry.gps.longitude)
      ? telemetry.gps.longitude
      : null;

  const hasValidGps = gpsFix && lat !== null && lng !== null;

  const satellites =
    typeof telemetry?.gps?.satellites === 'number'
      ? telemetry.gps.satellites
      : null;
  const hdop =
    typeof telemetry?.gps?.hdop === 'number' ? telemetry.gps.hdop : null;

  useEffect(() => {
    if (!hasValidGps || lat === null || lng === null) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
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

    const helmetIcon = L.divIcon({
      className: 'custom-helmet-icon',
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
          <div style="position:relative;width:18px;height:18px;border-radius:9999px;background:#2563EB;border:3px solid #ffffff;box-shadow:0 2px 10px rgba(37,99,235,0.45);"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const addressTitle =
      resolvedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    const marker = L.marker([lat, lng], { icon: helmetIcon })
      .addTo(map)
      .bindPopup(
        `<div style="min-width:200px">
          <div style="font-weight:700;color:#2563EB;margin-bottom:3px">Vị trí Smart Helmet (${
            telemetry?.deviceId || targetDeviceId
          })</div>
          <div style="font-size:12.5px;font-weight:600;color:#18181B;margin-bottom:3px">${addressTitle}</div>
          <div style="font-size:11px;color:#52525B;font-family:monospace">${lat.toFixed(
            6
          )}, ${lng.toFixed(6)}</div>
          <div style="font-size:11px;color:#71717A;margin-top:4px">Vệ tinh: ${
            satellites ?? '--'
          } • HDOP: ${hdop ?? '--'}</div>
        </div>`
      );

    marker.openPopup();
    map.setView([lat, lng], map.getZoom());
  }, [
    hasValidGps,
    lat,
    lng,
    satellites,
    hdop,
    telemetry?.deviceId,
    targetDeviceId,
    resolvedAddress,
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
    if (mapInstanceRef.current && hasValidGps && lat !== null && lng !== null) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 0.8 });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top GPS Status & Resolved Street Address Bar */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-zinc-500">
              Định vị vệ tinh GPS ({telemetry?.deviceId || targetDeviceId})
            </span>
            {hasValidGps ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Đã định vị (GPS Fix)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                GPS chưa có tín hiệu định vị
              </span>
            )}
          </div>

          {hasValidGps && lat !== null && lng !== null ? (
            <>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                {addressLoading
                  ? 'Đang trích xuất địa chỉ cụ thể...'
                  : resolvedAddress || `${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E`}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span className="font-mono text-zinc-700">
                  Tọa độ: {lat.toFixed(6)}°N, {lng.toFixed(6)}°E
                </span>
                <span>
                  Số vệ tinh:{' '}
                  <strong className="text-zinc-900">
                    {satellites !== null ? satellites : '--'}
                  </strong>
                </span>
                <span>
                  Độ chính xác HDOP:{' '}
                  <strong className="text-zinc-900">
                    {hdop !== null ? hdop : '--'}
                  </strong>
                </span>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-zinc-900">
                GPS chưa có tín hiệu định vị
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span>
                  Số vệ tinh:{' '}
                  <strong className="text-zinc-900">
                    {satellites !== null ? satellites : '--'}
                  </strong>
                </span>
                <span>
                  Độ chính xác HDOP:{' '}
                  <strong className="text-zinc-900">
                    {hdop !== null ? hdop : '--'}
                  </strong>
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasValidGps && lat !== null && lng !== null && (
            <>
              <button
                onClick={recenterMap}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Định tâm vị trí
              </button>

              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                <span>Xem trên Google Maps</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Map or No-Fix Notice */}
      {hasValidGps ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div
            ref={mapContainerRef}
            className="h-[460px] w-full rounded-xl overflow-hidden border border-zinc-100"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 px-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
              {resolvedAddress
                ? `Địa điểm: ${resolvedAddress}`
                : 'Vị trí GPS thực tế'}
            </span>
            <span className="font-mono text-[11px]">
              Satellites: {satellites ?? '--'} • HDOP: {hdop ?? '--'}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-10 text-center shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 border border-amber-200">
            <Satellite className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">
            GPS chưa có tín hiệu định vị
          </h3>
          <p className="mx-auto max-w-md text-xs text-zinc-500 leading-relaxed">
            {telemetryLoading
              ? 'Đang tải trạng thái GPS...'
              : 'Module GPS trên mũ bảo hiểm hiện đang báo gps.fix = false (số vệ tinh: ' +
                (satellites ?? 0) +
                '). Bản đồ và địa chỉ sẽ tự động hiển thị ngay khi thiết bị bắt được tín hiệu vệ tinh.'}
          </p>
        </div>
      )}
    </div>
  );
};
