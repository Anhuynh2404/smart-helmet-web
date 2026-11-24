import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  DEFAULT_HELMET_DEVICE_ID,
  isFirebaseConfigured,
  subscribeToFirebaseAuth,
  subscribeToFirebaseConnectionState,
  subscribeToHelmetTelemetry,
} from '../services/firebaseService';
import { FirebaseHelmetTelemetry, LiveTelemetrySample } from '../types/helmet';

export type TelemetryErrorCode =
  | 'CONFIG_MISSING'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | null;

export interface UseHelmetTelemetryResult {
  telemetry: FirebaseHelmetTelemetry | null;
  liveSamples: LiveTelemetrySample[];
  loading: boolean;
  error: string | null;
  errorCode: TelemetryErrorCode;
  firebaseConnected: boolean;
  isConfigured: boolean;
  isStale: boolean;
  secondsSinceUpdate: number | null;
  lastUpdatedDate: Date | null;
  authUser: User | null;
  authLoading: boolean;
  telemetryPath: string;
  resolvedAddress: string | null;
  addressLoading: boolean;
}

const STALE_THRESHOLD_SECONDS = 90;
const MAX_LIVE_SAMPLES = 20;
const geocodeCache = new Map<string, string>();

/**
 * Parses `lastSeen` (or legacy `updatedAt`) from ESP32 status node.
 */
function parseLastSeen(
  lastSeenVal: number | string | undefined,
  lastPayloadChangeMs: number | null
): Date | null {
  if (typeof lastSeenVal === 'number' && Number.isFinite(lastSeenVal)) {
    if (lastSeenVal > 1e12) {
      return new Date(lastSeenVal);
    }
    if (lastSeenVal > 1e9) {
      return new Date(lastSeenVal * 1000);
    }
  } else if (typeof lastSeenVal === 'string' && lastSeenVal.trim() !== '') {
    const asNum = Number(lastSeenVal);
    if (Number.isFinite(asNum)) {
      if (asNum > 1e12) return new Date(asNum);
      if (asNum > 1e9) return new Date(asNum * 1000);
    }
    const parsed = new Date(lastSeenVal);
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020) {
      return parsed;
    }
  }

  if (lastPayloadChangeMs !== null) {
    return new Date(lastPayloadChangeMs);
  }
  return null;
}

export function useHelmetTelemetry(
  deviceId: string = DEFAULT_HELMET_DEVICE_ID
): UseHelmetTelemetryResult {
  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
  const [telemetry, setTelemetry] = useState<FirebaseHelmetTelemetry | null>(
    null
  );
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

  // 3. Subscribe to `/helmets/{deviceId}/status` via `onValue()`
  useEffect(() => {
    setLoading(true);
    setError(null);
    setErrorCode(null);

    if (!configured) {
      setLoading(false);
      setErrorCode('CONFIG_MISSING');
      setError(
        'Chưa có cấu hình Firebase Web App trong file .env. Vui lòng điền VITE_FIREBASE_API_KEY theo mẫu .env.example.'
      );
      return;
    }

    const unsubscribe = subscribeToHelmetTelemetry(
      cleanId,
      (data) => {
        setLoading(false);
        setError(null);
        setErrorCode(null);

        if (data) {
          const serialized = JSON.stringify(data);
          const now = Date.now();
          if (serialized !== lastPayloadHashRef.current) {
            lastPayloadHashRef.current = serialized;
            lastPayloadChangeMsRef.current = now;

            // Collect live sample in memory while the Website is open
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
                ? data.mpu.totalG
                : Number(Math.sqrt(ax * ax + ay * ay + az * az).toFixed(2));

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
                ? data.mpu.gyroMagnitudeDps
                : Number(Math.sqrt(gx * gx + gy * gy + gz * gz).toFixed(2));

            const sample: LiveTelemetrySample = {
              timeLabel: new Date(now).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
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
            'Từ chối quyền đọc dữ liệu (permission_denied). Vui lòng đăng nhập tài khoản hợp lệ.'
          );
        } else if (err.code === 'CONFIG_MISSING') {
          setErrorCode('CONFIG_MISSING');
          setError(msg);
        } else {
          setErrorCode('NETWORK_ERROR');
          setError(`Không thể đọc dữ liệu tại /${telemetryPath}: ${msg}`);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [cleanId, configured, authUser?.uid]);

  // 4. Reverse Geocoding: Convert GPS (lat, lon) into a concrete street/area address
  const gpsValid =
    telemetry?.gps?.valid === true || telemetry?.gps?.fix === true;
  const rawLat =
    typeof telemetry?.gps?.lat === 'number'
      ? telemetry.gps.lat
      : telemetry?.gps?.latitude;
  const rawLng =
    typeof telemetry?.gps?.lon === 'number'
      ? telemetry.gps.lon
      : telemetry?.gps?.longitude;

  useEffect(() => {
    if (
      !gpsValid ||
      typeof rawLat !== 'number' ||
      typeof rawLng !== 'number' ||
      !Number.isFinite(rawLat) ||
      !Number.isFinite(rawLng) ||
      (rawLat === 0 && rawLng === 0)
    ) {
      setResolvedAddress(null);
      setAddressLoading(false);
      return;
    }

    const cacheKey = `${rawLat.toFixed(4)},${rawLng.toFixed(4)}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      setResolvedAddress(cached);
      setAddressLoading(false);
      return;
    }

    let cancelled = false;
    setAddressLoading(true);

    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${rawLat}&lon=${rawLng}&accept-language=vi`
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
          setResolvedAddress(`${rawLat.toFixed(5)}°N, ${rawLng.toFixed(5)}°E`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedAddress(`${rawLat.toFixed(5)}°N, ${rawLng.toFixed(5)}°E`);
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
  }, [gpsValid, rawLat, rawLng]);

  // 5. Local clock tick every 5 seconds purely to calculate staleness (> 90s)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const rawTimestamp = telemetry?.lastSeen ?? telemetry?.updatedAt;
  const lastUpdatedDate = telemetry
    ? parseLastSeen(rawTimestamp, lastPayloadChangeMsRef.current)
    : null;

  const secondsSinceUpdate =
    lastUpdatedDate !== null
      ? Math.max(0, Math.floor((nowMs - lastUpdatedDate.getTime()) / 1000))
      : null;

  const isStale =
    telemetry !== null &&
    secondsSinceUpdate !== null &&
    secondsSinceUpdate > STALE_THRESHOLD_SECONDS;

  return {
    telemetry,
    liveSamples,
    loading,
    error,
    errorCode,
    firebaseConnected,
    isConfigured: configured,
    isStale,
    secondsSinceUpdate,
    lastUpdatedDate,
    authUser,
    authLoading,
    telemetryPath,
    resolvedAddress,
    addressLoading,
  };
}
