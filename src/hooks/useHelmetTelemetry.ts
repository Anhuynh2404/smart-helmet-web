import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  DEFAULT_HELMET_DEVICE_ID,
  isFirebaseConfigured,
  normalizeDeviceId,
  subscribeToFirebaseAuth,
  subscribeToFirebaseConnectionState,
  subscribeToHelmetGpsStatus,
  subscribeToHelmetTelemetry,
} from '../services/firebaseService';
import {
  FirebaseGpsNode,
  FirebaseHelmetTelemetry,
  GpsFixType,
  LastValidGpsPosition,
  LiveTelemetrySample,
  NormalizedGpsStatus,
} from '../types/helmet';

export type TelemetryErrorCode =
  | 'CONFIG_MISSING'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | null;

export interface UseHelmetTelemetryResult {
  telemetry: FirebaseHelmetTelemetry | null;
  gpsStatus: NormalizedGpsStatus; // Strictly from helmets/{deviceId}/status/gps (V2.4.3-dev + V2.4.2-dev compatible)
  liveSamples: LiveTelemetrySample[];
  loading: boolean;
  error: string | null;
  errorCode: TelemetryErrorCode;
  firebaseConnected: boolean;
  isConfigured: boolean;
  isStale: boolean; // True when > 16 seconds without new packet (Device Offline Timeout)
  secondsSinceUpdate: number | null;
  lastUpdatedDate: Date | null;
  lastSeenVietnamText: string; // Formatted strictly in UTC+7 (Asia/Ho_Chi_Minh)
  authUser: User | null;
  authLoading: boolean;
  telemetryPath: string;
  resolvedAddress: string | null;
  addressLoading: boolean;
}

// Ngưỡng Timeout chuyển trạng thái thiết bị từ Online -> Offline: 16 giây
export const OFFLINE_TIMEOUT_SECONDS = 16;
// Ngưỡng đánh giá độ mới của bản ghi GPS CURRENT dựa trên `status/gps/updatedAt`: 30 giây
export const GPS_REALTIME_FRESHNESS_SECONDS = 30;
// Vị trí trung tâm thành phố mặc định khi thiết bị chưa có bất kỳ tọa độ hợp lệ nào trước đó (Đà Nẵng / Trung tâm đô thị)
export const DEFAULT_CITY_MAP_CENTER: [number, number] = [16.0544, 108.2022];
export const DEFAULT_CITY_MAP_ZOOM = 13;

const MAX_LIVE_SAMPLES = 20;
const geocodeCache = new Map<string, string>();
// Bộ nhớ lưu vị trí hợp lệ gần nhất (`lastValidPosition`) theo từng thiết bị để lọc tọa độ (0, 0) / chưa chốt vệ tinh
const lastValidPositionByDeviceCache = new Map<string, LastValidGpsPosition>();

/**
 * Quy đổi mọi định dạng timestamp (Unix ms, Unix s, chuỗi ISO UTC có hoặc không có hậu tố Z)
 * sang đối tượng Date chuẩn quốc tế.
 */
export function parseUtcTimestamp(
  rawVal: number | string | undefined,
  fallbackMs: number | null
): Date | null {
  if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
    if (rawVal > 1e12) {
      return new Date(rawVal);
    }
    if (rawVal > 1e9) {
      return new Date(rawVal * 1000);
    }
  } else if (typeof rawVal === 'string' && rawVal.trim() !== '') {
    const trimmed = rawVal.trim();
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) {
      if (asNum > 1e12) return new Date(asNum);
      if (asNum > 1e9) return new Date(asNum * 1000);
    }

    let isoCandidate = trimmed.replace(' ', 'T');
    const hasTimezoneDesignator = /([Zz]|[+\-]\d{2}:?\d{2})$/.test(
      isoCandidate
    );
      if (
        !hasTimezoneDesignator &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoCandidate)
      ) {
        isoCandidate += 'Z';
      }

      const parsed = new Date(isoCandidate);
      if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020) {
        return parsed;
      }
    }

    if (fallbackMs !== null) {
      return new Date(fallbackMs);
    }
    return null;
  }

  /**
   * Định dạng thời gian luôn ép cứng theo múi giờ Việt Nam (UTC+7 / Asia/Ho_Chi_Minh)
   */
  export function formatToVietnamTimezone(
    date: Date | null,
    includeDate: boolean = true
  ): string {
    if (!date || Number.isNaN(date.getTime())) {
      return 'Chưa có dữ liệu';
    }
    try {
      const timePart = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date);

      if (!includeDate) {
        return `${timePart} (UTC+7)`;
      }

      const datePart = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);

      return `${timePart} • ${datePart} (UTC+7)`;
    } catch {
      return date.toLocaleString('vi-VN');
    }
  }

  /**
   * Định dạng cặp `lastUtcYMD` (VD: 20261124) và `lastUtcHMS` (VD: 230334) từ Firmware V2.4.2-dev / V2.4.3-dev
   */
  export function formatGpsLastUtcYmdHms(
    ymd?: number,
    hms?: number
  ): string | null {
    if (
      typeof ymd !== 'number' ||
      !Number.isFinite(ymd) ||
      ymd <= 0 ||
      typeof hms !== 'number' ||
      !Number.isFinite(hms) ||
      hms < 0
    ) {
      return null;
    }

    const ymdStr = String(Math.trunc(ymd)).padStart(8, '0');
    const hmsStr = String(Math.trunc(hms)).padStart(6, '0');
    if (ymdStr.length !== 8 || hmsStr.length !== 6) {
      return `${ymdStr} ${hmsStr} UTC`;
    }

    const yyyy = ymdStr.slice(0, 4);
    const mm = ymdStr.slice(4, 6);
    const dd = ymdStr.slice(6, 8);
    const hh = hmsStr.slice(0, 2);
    const min = hmsStr.slice(2, 4);
    const ss = hmsStr.slice(4, 6);

    const isoUtc = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
    const parsed = new Date(isoUtc);
    if (Number.isNaN(parsed.getTime())) {
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`;
    }

    return `${formatToVietnamTimezone(parsed, true)} [Gốc: ${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC]`;
  }

  function parseCoordinateNumber(val: unknown): number | null {
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  /**
   * Kiểm tra cặp tọa độ GPS hợp lệ:
   * - Phải là số hữu hạn nằm trong khoảng [-90..90] và [-180..180]
   * - Loại bỏ tọa độ (0, 0) hoặc tọa độ có lat = 0 / lon = 0 khi module GPS chưa chốt được vệ tinh
   */
  export function isValidLatLonPair(lat: unknown, lon: unknown): boolean {
    const numLat = parseCoordinateNumber(lat);
    const numLon = parseCoordinateNumber(lon);
    if (numLat === null || numLon === null) {
      return false;
    }
    if (Math.abs(numLat) > 90 || Math.abs(numLon) > 180) {
      return false;
    }
    if (Math.abs(numLat) < 0.0001 || Math.abs(numLon) < 0.0001) {
      return false;
    }
    return true;
  }

  /**
   * Chuẩn hóa dữ liệu GPS từ `helmets/{deviceId}/status/gps` cho Firmware V2.4.3-dev
   * và tương thích ngược với V2.4.2-dev khi chưa có trường `type`.
   * - Lọc tọa độ (0, 0) / không hợp lệ khi GPS chưa chốt vệ tinh và giữ nguyên `lastValidPosition` gần nhất.
   * - Đánh giá độ mới dựa trên `updatedAt` để không coi dữ liệu CURRENT đã upload từ lâu là vị trí realtime.
   */
  export function normalizeGpsStatusNode(
    gps: FirebaseGpsNode | null | undefined,
    deviceId: string,
    nowMs: number,
    fallbackStatusLastSeen?: number | string
  ): NormalizedGpsStatus {
    const cleanId = normalizeDeviceId(deviceId);
    const sourcePath = `helmets/${cleanId}/status/gps`;

    const rawLatCandidate = parseCoordinateNumber(gps?.lat ?? gps?.latitude);
    const rawLonCandidate = parseCoordinateNumber(gps?.lon ?? gps?.longitude);
    const rawLastLatCandidate = parseCoordinateNumber(gps?.lastLat);
    const rawLastLonCandidate = parseCoordinateNumber(gps?.lastLon);

    const hasValidCurrentLatLon = isValidLatLonPair(
      rawLatCandidate,
      rawLonCandidate
    );
    const hasValidLastLatLon = isValidLatLonPair(
      rawLastLatCandidate,
      rawLastLonCandidate
    );

    const explicitValidFalse = gps?.valid === false || gps?.fix === false;
    const validFlag =
      !explicitValidFalse && (gps?.valid === true || gps?.fix === true);

    const uartOpen =
      typeof gps?.uartOpen === 'boolean' ? gps.uartOpen : null;
    const sats =
      typeof gps?.sats === 'number' && Number.isFinite(gps.sats)
        ? gps.sats
        : typeof gps?.satellites === 'number' && Number.isFinite(gps.satellites)
          ? gps.satellites
          : null;
    const hdop =
      typeof gps?.hdop === 'number' && Number.isFinite(gps.hdop)
        ? gps.hdop
        : null;
    const ageMs =
      typeof gps?.ageMs === 'number' && Number.isFinite(gps.ageMs)
        ? gps.ageMs
        : null;

    // Đánh giá độ mới dựa trên `updatedAt` (fallback sang `lastSeen` nếu V2.4.2-dev chưa có `gps.updatedAt`)
    const updatedAtDate = parseUtcTimestamp(
      gps?.updatedAt ?? fallbackStatusLastSeen,
      null
    );
    const updatedAtMs = updatedAtDate ? updatedAtDate.getTime() : null;
    const updatedAtText =
      updatedAtDate !== null
        ? formatToVietnamTimezone(updatedAtDate, true)
        : 'Chưa có thời điểm cập nhật';

    // 1. Xác định rawType ('CURRENT' | 'OLD' | 'NONE') — hỗ trợ V2.4.3-dev `type` và tương thích ngược V2.4.2-dev
    let rawType: GpsFixType = 'NONE';
    let isInferredLegacyType = false;

    const explicitType =
      typeof gps?.type === 'string' ? gps.type.trim().toUpperCase() : '';

    if (explicitType === 'CURRENT') {
      if (hasValidCurrentLatLon && !explicitValidFalse) {
        rawType = 'CURRENT';
      } else if (hasValidLastLatLon) {
        rawType = 'OLD';
      } else {
        rawType = 'NONE';
      }
    } else if (explicitType === 'OLD') {
      if (hasValidLastLatLon || hasValidCurrentLatLon) {
        rawType = 'OLD';
      } else {
        rawType = 'NONE';
      }
    } else if (explicitType === 'NONE') {
      rawType = 'NONE';
    } else {
      // Tương thích ngược V2.4.2-dev khi chưa có trường `type`
      isInferredLegacyType = Boolean(gps);
      if (validFlag && hasValidCurrentLatLon) {
        rawType = 'CURRENT';
      } else if (hasValidLastLatLon || (hasValidCurrentLatLon && !explicitValidFalse)) {
        rawType = 'OLD';
      } else {
        rawType = 'NONE';
      }
    }

    const lat =
      hasValidCurrentLatLon && !explicitValidFalse
        ? (rawLatCandidate as number)
        : null;
    const lon =
      hasValidCurrentLatLon && !explicitValidFalse
        ? (rawLonCandidate as number)
        : null;
    const lastLat = hasValidLastLatLon ? (rawLastLatCandidate as number) : null;
    const lastLon = hasValidLastLatLon ? (rawLastLonCandidate as number) : null;

    // 2. Cập nhật hoặc khôi phục `lastValidPosition` cho thiết bị
    if (rawType === 'CURRENT' && lat !== null && lon !== null) {
      lastValidPositionByDeviceCache.set(cleanId, {
        lat,
        lon,
        updatedAtMs,
        updatedAtText,
        sats,
        hdop,
      });
    } else if (rawType === 'OLD') {
      const candidateOldLat = lastLat ?? (hasValidCurrentLatLon ? (rawLatCandidate as number) : null);
      const candidateOldLon = lastLon ?? (hasValidCurrentLatLon ? (rawLonCandidate as number) : null);
      if (candidateOldLat !== null && candidateOldLon !== null) {
        const existing = lastValidPositionByDeviceCache.get(cleanId);
        lastValidPositionByDeviceCache.set(cleanId, {
          lat: candidateOldLat,
          lon: candidateOldLon,
          updatedAtMs: existing?.updatedAtMs ?? updatedAtMs,
          updatedAtText: existing?.updatedAtText ?? updatedAtText,
          sats: sats ?? existing?.sats ?? null,
          hdop: hdop ?? existing?.hdop ?? null,
        });
      }
    }

    const cachedLastValid = lastValidPositionByDeviceCache.get(cleanId) ?? null;

    // Phát hiện gói tin gửi lên có tọa độ (0,0) / không hợp lệ hoặc chưa chốt vệ tinh
    const hasInvalidIncomingCoords =
      !hasValidCurrentLatLon ||
      explicitValidFalse ||
      explicitType === 'NONE';

    // 3. Gán tọa độ hiển thị (`displayLat`, `displayLon`):
    // - Khi gói tin mới có tọa độ không hợp lệ (0,0), giữ nguyên `lastValidPosition` gần nhất của marker.
    // - Nếu chưa từng có vị trí hợp lệ nào trước đó (`cachedLastValid === null`), giữ `displayLat = null`, `displayLon = null`
    //   để bản đồ hiển thị ở vị trí trung tâm thành phố mặc định thay vì đặt marker tại (0, 0).
    let displayLat: number | null = null;
    let displayLon: number | null = null;
    let usingLastValidPosition = false;

    if (rawType === 'CURRENT' && lat !== null && lon !== null) {
      displayLat = lat;
      displayLon = lon;
      usingLastValidPosition = false;
    } else if (rawType === 'OLD') {
      displayLat = lastLat ?? lat ?? cachedLastValid?.lat ?? null;
      displayLon = lastLon ?? lon ?? cachedLastValid?.lon ?? null;
      usingLastValidPosition = displayLat !== null && displayLon !== null;
    } else if (cachedLastValid !== null) {
      displayLat = cachedLastValid.lat;
      displayLon = cachedLastValid.lon;
      usingLastValidPosition = true;
    } else {
      displayLat = null;
      displayLon = null;
      usingLastValidPosition = false;
    }

    const isSearchingSatellites =
      rawType !== 'CURRENT' ||
      hasInvalidIncomingCoords ||
      usingLastValidPosition;

    const secondsSinceGpsUpdate =
      updatedAtMs !== null
        ? Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000))
        : null;

    // Chỉ coi dữ liệu CURRENT là vị trí realtime khi `updatedAt` còn mới (<= 30 giây) và không phải đang dùng lastValidPosition
    const isFreshRealtime =
      rawType === 'CURRENT' &&
      !usingLastValidPosition &&
      validFlag &&
      secondsSinceGpsUpdate !== null &&
      secondsSinceGpsUpdate <= GPS_REALTIME_FRESHNESS_SECONDS;

    const isStaleCurrentUpload =
      rawType === 'CURRENT' && !usingLastValidPosition && !isFreshRealtime;

    const lastUtcText = formatGpsLastUtcYmdHms(
      gps?.lastUtcYMD,
      gps?.lastUtcHMS
    );

    const googleMapsUrl =
      displayLat !== null && displayLon !== null
        ? `https://www.google.com/maps?q=${displayLat.toFixed(
          6
        )},${displayLon.toFixed(6)}`
        : null;

    return {
      rawType,
      isInferredLegacyType,
      valid: validFlag,
      uartOpen,
      lat,
      lon,
      lastLat,
      lastLon,
      displayLat,
      displayLon,
      hasInvalidIncomingCoords,
      isSearchingSatellites,
      usingLastValidPosition,
      lastValidPosition: cachedLastValid,
      sats,
      hdop,
      ageMs,
      updatedAtMs,
      updatedAtText,
      secondsSinceGpsUpdate,
      isFreshRealtime,
      isStaleCurrentUpload,
      lastUtcText,
      googleMapsUrl,
      sourcePath,
    };
  }

  export function useHelmetTelemetry(
    deviceId: string = DEFAULT_HELMET_DEVICE_ID
  ): UseHelmetTelemetryResult {
    const cleanId = normalizeDeviceId(deviceId);
    const [telemetry, setTelemetry] = useState<FirebaseHelmetTelemetry | null>(
      null
    );
    const [dedicatedGpsNode, setDedicatedGpsNode] =
      useState<FirebaseGpsNode | null>(null);
    const [liveSamples, setLiveSamples] = useState<LiveTelemetrySample[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<TelemetryErrorCode>(null);
    const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState<boolean>(true);
    const [nowMs, setNowMs] = useState<number>(() => Date.now());
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [addressLoading, setAddressLoading] = useState<boolean>(false);

    const lastPayloadHashRef = useRef<string>('');
    const lastPayloadChangeMsRef = useRef<number | null>(null);
    const isFirstSnapshotRef = useRef<boolean>(true);

    const configured = isFirebaseConfigured();
    const telemetryPath = `helmets/${cleanId}/status`;

    // 1. Listen to Firebase Authentication state
    useEffect(() => {
      if (!configured) {
        setAuthLoading(false);
        return;
      }
      const unsubAuth = subscribeToFirebaseAuth((user) => {
        setAuthUser(user);
        setAuthLoading(false);
      });
      return () => unsubAuth();
    }, [configured]);

    // 2. Listen to Firebase .info/connected state
    useEffect(() => {
      if (!configured) {
        setFirebaseConnected(false);
        return;
      }
      const unsubConn = subscribeToFirebaseConnectionState((connected) => {
        setFirebaseConnected(connected);
      });
      return () => unsubConn();
    }, [configured]);

    // 3. Subscribe to `/helmets/{deviceId}/status` AND dedicated `/helmets/{deviceId}/status/gps` via `onValue()`
    useEffect(() => {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      setTelemetry(null);
      setDedicatedGpsNode(null);
      setLiveSamples([]);
      setResolvedAddress(null);
      lastPayloadHashRef.current = '';
      lastPayloadChangeMsRef.current = null;
      isFirstSnapshotRef.current = true;

      if (!configured) {
        setLoading(false);
        setErrorCode('CONFIG_MISSING');
        setError(
          'Chưa có cấu hình Firebase Web App trong file .env. Vui lòng điền VITE_FIREBASE_API_KEY theo mẫu .env.example.'
        );
        return;
      }

    // Dedicated listener on `helmets/{deviceId}/status/gps` for instant GPSSYNC updates
    const unsubGps = subscribeToHelmetGpsStatus(cleanId, (gpsVal) => {
        setDedicatedGpsNode(gpsVal);
        setNowMs(Date.now());
      });

      const unsubStatus = subscribeToHelmetTelemetry(
        cleanId,
        (data) => {
          setLoading(false);
          setError(null);
          setErrorCode(null);

          if (data) {
            const telemetryFingerprint = JSON.stringify({
              lastSeen: data.lastSeen,
              updatedAt: data.updatedAt,
              uptimeS: data.uptimeS,
              gps: data.gps,
              mpu: data.mpu,
              wifiRssi: data.wifiRssi,
              online: data.online,
              deepSleep: data.deepSleep,
            });

            const now = Date.now();
            if (telemetryFingerprint !== lastPayloadHashRef.current) {
              const wasFirst = isFirstSnapshotRef.current;
              isFirstSnapshotRef.current = false;
              lastPayloadHashRef.current = telemetryFingerprint;

              const parsedFromPacket = parseUtcTimestamp(
                data.lastSeen ?? data.updatedAt ?? data.gps?.updatedAt,
                null
              );

              if (wasFirst && parsedFromPacket) {
                const packetMs = parsedFromPacket.getTime();
                lastPayloadChangeMsRef.current =
                  packetMs <= now + 60000 ? packetMs : now;
              } else {
                lastPayloadChangeMsRef.current = now;
              }

              const ax =
                typeof data.mpu?.accel?.x === 'number'
                  ? data.mpu.accel.x
                  : typeof data.mpu?.ax === 'number'
                    ? data.mpu.ax
                    : 0;
              const ay =
                typeof data.mpu?.accel?.y === 'number'
                  ? data.mpu.accel.y
                  : typeof data.mpu?.ay === 'number'
                    ? data.mpu.ay
                    : 0;
              const az =
                typeof data.mpu?.accel?.z === 'number'
                  ? data.mpu.accel.z
                  : typeof data.mpu?.az === 'number'
                    ? data.mpu.az
                    : 0;

              const accelTotalG =
                typeof data.mpu?.totalG === 'number'
                  ? Number(data.mpu.totalG.toFixed(3))
                  : Number(Math.sqrt(ax * ax + ay * ay + az * az).toFixed(3));

              const gx =
                typeof data.mpu?.gyro?.x === 'number'
                  ? data.mpu.gyro.x
                  : typeof data.mpu?.gx === 'number'
                    ? data.mpu.gx
                    : 0;
              const gy =
                typeof data.mpu?.gyro?.y === 'number'
                  ? data.mpu.gyro.y
                  : typeof data.mpu?.gy === 'number'
                    ? data.mpu.gy
                    : 0;
              const gz =
                typeof data.mpu?.gyro?.z === 'number'
                  ? data.mpu.gyro.z
                  : typeof data.mpu?.gz === 'number'
                    ? data.mpu.gz
                    : 0;

              const gyroMagnitudeDps =
                typeof data.mpu?.gyroMagnitudeDps === 'number'
                  ? Number(data.mpu.gyroMagnitudeDps.toFixed(2))
                  : Number(Math.sqrt(gx * gx + gy * gy + gz * gz).toFixed(2));

              const displayDate = parsedFromPacket || new Date(now);
              const sample: LiveTelemetrySample = {
                timeLabel: formatToVietnamTimezone(displayDate, false),
                timestampMs: now,
                accelTotalG,
                ax,
                ay,
                az,
                gyroMagnitudeDps,
                gx,
                gy,
                gz,
              };

              setLiveSamples((prev) =>
                [...prev, sample].slice(-MAX_LIVE_SAMPLES)
              );
            }
          }
          setTelemetry(data);
          setNowMs(Date.now());
        },
        (err) => {
          setLoading(false);
          const msg = err.message || 'Lỗi kết nối cơ sở dữ liệu';
          if (
            err.code === 'PERMISSION_DENIED' ||
            msg.toLowerCase().includes('permission_denied') ||
            msg.toLowerCase().includes('permission denied')
          ) {
            setErrorCode('PERMISSION_DENIED');
            setError(
              'Tài khoản hiện tại chưa được cấp quyền xem thiết bị này. Vui lòng đăng nhập tài khoản hợp lệ.'
            );
          } else if (err.code === 'CONFIG_MISSING') {
            setErrorCode('CONFIG_MISSING');
            setError('Hệ thống chưa hoàn tất cấu hình kết nối máy chủ.');
          } else {
            setErrorCode('NETWORK_ERROR');
            setError(
              'Tạm thời không thể tải dữ liệu thiết bị. Hệ thống đang tự động thử kết nối lại...'
            );
          }
        }
      );

      return () => {
        unsubGps();
        unsubStatus();
      };
    }, [cleanId, configured, authUser?.uid]);

    // 4. Local clock tick every 1 second (1000ms) for accurate freshness evaluation
    useEffect(() => {
      const timer = setInterval(() => {
        setNowMs(Date.now());
      }, 1000);
      return () => clearInterval(timer);
    }, []);

    // Merge dedicated `status/gps` listener data with `telemetry.gps`
    const activeGpsNode = dedicatedGpsNode ?? telemetry?.gps ?? null;

    const gpsStatus = useMemo(
      () =>
        normalizeGpsStatusNode(
          activeGpsNode,
          cleanId,
          nowMs,
          telemetry?.lastSeen ?? telemetry?.updatedAt
        ),
      [
        activeGpsNode,
        cleanId,
        nowMs,
        telemetry?.lastSeen,
        telemetry?.updatedAt,
      ]
    );

    // 5. Reverse Geocoding: Convert active displayLat / displayLon into a concrete street/area address
    // Works for both live CURRENT coordinates and retained lastValidPosition
    useEffect(() => {
      if (
        gpsStatus.displayLat === null ||
        gpsStatus.displayLon === null
      ) {
        setResolvedAddress(null);
        setAddressLoading(false);
        return;
      }

    const lat = gpsStatus.displayLat;
    const lon = gpsStatus.displayLon;
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      setResolvedAddress(cached);
      setAddressLoading(false);
      return;
    }

    let cancelled = false;
    setAddressLoading(true);

    fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=vi`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        let formatted = '';
        if (data && data.address) {
          const a = data.address;
          const parts = [
            a.road || a.pedestrian || a.amenity || a.building,
            a.suburb || a.quarter || a.village || a.neighbourhood,
            a.city_district || a.district || a.county || a.town,
            a.city || a.state || a.province,
          ].filter(Boolean);
          if (parts.length > 0) {
            formatted = parts.join(', ');
          }
        }
        if (!formatted && data && typeof data.display_name === 'string') {
          formatted = data.display_name
            .split(',')
            .slice(0, 4)
            .map((s: string) => s.trim())
            .join(', ');
        }
        if (formatted) {
          geocodeCache.set(cacheKey, formatted);
          setResolvedAddress(formatted);
        } else {
          setResolvedAddress('Đã xác định vị trí của thiết bị trên bản đồ');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedAddress('Đã xác định vị trí của thiết bị trên bản đồ');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAddressLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
}, [gpsStatus.rawType, gpsStatus.displayLat, gpsStatus.displayLon]);

// Evaluate overall device lastSeen including GPSSYNC updates (`gps.updatedAt`)
const rawTimestamp =
  telemetry?.lastSeen ?? telemetry?.updatedAt ?? activeGpsNode?.updatedAt;
const packetDate =
  telemetry || activeGpsNode
    ? parseUtcTimestamp(rawTimestamp, lastPayloadChangeMsRef.current)
    : null;

const effectiveLastActiveMs =
  packetDate && gpsStatus.updatedAtMs
    ? Math.max(packetDate.getTime(), gpsStatus.updatedAtMs)
    : packetDate
      ? packetDate.getTime()
      : gpsStatus.updatedAtMs ?? lastPayloadChangeMsRef.current;

const secondsSinceUpdate =
  effectiveLastActiveMs !== null
    ? Math.max(0, Math.floor((nowMs - effectiveLastActiveMs) / 1000))
    : null;

const isStale =
  telemetry !== null &&
  (telemetry.online === false ||
    (secondsSinceUpdate !== null &&
      secondsSinceUpdate > OFFLINE_TIMEOUT_SECONDS));

const lastUpdatedDate =
  effectiveLastActiveMs !== null ? new Date(effectiveLastActiveMs) : null;
const lastSeenVietnamText = formatToVietnamTimezone(lastUpdatedDate, true);

return {
  telemetry,
  gpsStatus,
  liveSamples,
  loading,
  error,
  errorCode,
  firebaseConnected,
  isConfigured: configured,
  isStale,
  secondsSinceUpdate,
  lastUpdatedDate,
  lastSeenVietnamText,
  authUser,
  authLoading,
  telemetryPath,
  resolvedAddress,
  addressLoading,
};
}
