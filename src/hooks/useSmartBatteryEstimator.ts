import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { DataSnapshot, onValue, ref, set } from 'firebase/database';
import {
  DEFAULT_HELMET_DEVICE_ID,
  getFirebaseDatabase,
  isFirebaseConfigured,
} from '../services/firebaseService';
import { FirebaseHelmetTelemetry } from '../types/helmet';

export interface SmartBatteryEstimate {
  percentage: number; // 0 - 100
  precisePercentage: number; // e.g. 83.4
  voltageV: number; // 3.30V - 4.20V
  currentDrawMa: number;
  estimatedHoursRemaining: number;
  estimatedTimeText: string; // e.g. "~13g 20p"
  isCharging: boolean;
  adcRawMv: number | null;
  toggleCharging: () => void;
  chargeToFull: () => void;
}

const STORAGE_KEY = 'smart_helmet_bms_state_v1';
const BATTERY_CAPACITY_MAH = 2000;

interface CloudBatteryState {
  soc: number; // 0 - 100
  percentage: number;
  voltageV: number;
  isCharging: boolean;
  lastTimestampMs: number;
  lastEspUptimeSec: number;
}

function calculateLiPoVoltage(socPercent: number, isCharging: boolean): number {
  const s = Math.max(0, Math.min(100, socPercent)) / 100;
  let ocv: number;
  if (s >= 0.85) {
    ocv = 4.04 + ((s - 0.85) / 0.15) * 0.16;
  } else if (s >= 0.25) {
    ocv = 3.71 + ((s - 0.25) / 0.6) * 0.33;
  } else if (s >= 0.1) {
    ocv = 3.55 + ((s - 0.1) / 0.15) * 0.16;
  } else {
    ocv = 3.3 + (s / 0.1) * 0.25;
  }

  if (isCharging && s < 0.995) {
    ocv = Math.min(4.2, ocv + 0.07);
  }
  return Number(ocv.toFixed(2));
}

function calculateHardwareLoadCurrentMa(
  telemetry: FirebaseHelmetTelemetry | null,
  isStale: boolean
): number {
  if (!telemetry || isStale) {
    return 18;
  }

  let currentMa = 68;
  if (telemetry.network?.wifiConnected) {
    const rssi = telemetry.network.wifiRssiDbm ?? -65;
    currentMa += rssi < -75 ? 48 : 36;
  }
  if (telemetry.gps !== undefined) {
    currentMa += telemetry.gps.fix ? 28 : 34;
  }
  if (telemetry.mpu?.available) {
    currentMa += 4;
  }
  return currentMa;
}

export function useSmartBatteryEstimator(
  telemetry: FirebaseHelmetTelemetry | null,
  isStale: boolean,
  deviceId: string = DEFAULT_HELMET_DEVICE_ID,
  authUser: User | null = null
): SmartBatteryEstimate {
  const [bms, setBms] = useState<CloudBatteryState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CloudBatteryState>;
        if (
          typeof parsed.soc === 'number' &&
          Number.isFinite(parsed.soc) &&
          parsed.soc >= 5 &&
          parsed.soc <= 100
        ) {
          const soc = parsed.soc;
          const isCharging = Boolean(parsed.isCharging);
          return {
            soc,
            percentage: Math.round(soc),
            voltageV: calculateLiPoVoltage(soc, isCharging),
            isCharging,
            lastTimestampMs: parsed.lastTimestampMs || Date.now(),
            lastEspUptimeSec:
              parsed.lastEspUptimeSec ?? telemetry?.device?.uptimeSeconds ?? 0,
          };
        }
      }
    } catch {
      // Ignore
    }
    const initialSoc = 84.0;
    return {
      soc: initialSoc,
      percentage: Math.round(initialSoc),
      voltageV: calculateLiPoVoltage(initialSoc, false),
      isCharging: false,
      lastTimestampMs: Date.now(),
      lastEspUptimeSec: telemetry?.device?.uptimeSeconds ?? 0,
    };
  });

  const cloudLoadedRef = useRef<boolean>(false);
  const lastSavedSocRef = useRef<number>(bms.soc);
  const lastSavedTimeRef = useRef<number>(0);

  // Ghi trạng thái pin lên Firebase Realtime Database: devices/{deviceId}/batteryState
  const persistBatteryStateToFirebase = async (nextState: CloudBatteryState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Ignore
    }

    if (!isFirebaseConfigured() || !authUser) return;
    const db = getFirebaseDatabase();
    if (!db) return;

    lastSavedSocRef.current = nextState.soc;
    lastSavedTimeRef.current = Date.now();

    try {
      await set(ref(db, `devices/${deviceId}/batteryState`), {
        soc: Number(nextState.soc.toFixed(3)),
        percentage: Math.round(nextState.soc),
        voltageV: calculateLiPoVoltage(nextState.soc, nextState.isCharging),
        isCharging: Boolean(nextState.isCharging),
        lastTimestampMs: nextState.lastTimestampMs,
        lastEspUptimeSec: nextState.lastEspUptimeSec,
      });
    } catch {
      // Ignore transient network errors
    }
  };

  // 1. Đồng bộ thời gian thực trạng thái pin từ Firebase (`devices/{deviceId}/batteryState`)
  // Đảm bảo đăng nhập ở mọi trình duyệt / thiết bị khác đều nhận cùng một % pin
  useEffect(() => {
    if (!isFirebaseConfigured() || !authUser) return;
    const db = getFirebaseDatabase();
    if (!db) return;

    const batteryRef = ref(db, `devices/${deviceId}/batteryState`);

    const unsubscribe = onValue(
      batteryRef,
      (snapshot: DataSnapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val() as Partial<CloudBatteryState>;
          if (
            typeof val.soc === 'number' &&
            Number.isFinite(val.soc) &&
            val.soc >= 5 &&
            val.soc <= 100
          ) {
            cloudLoadedRef.current = true;
            lastSavedSocRef.current = val.soc;
            const syncedState: CloudBatteryState = {
              soc: val.soc,
              percentage: Math.round(val.soc),
              voltageV:
                typeof val.voltageV === 'number'
                  ? val.voltageV
                  : calculateLiPoVoltage(val.soc, Boolean(val.isCharging)),
              isCharging: Boolean(val.isCharging),
              lastTimestampMs: val.lastTimestampMs || Date.now(),
              lastEspUptimeSec: val.lastEspUptimeSec || 0,
            };
            setBms(syncedState);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedState));
            } catch {
              // Ignore
            }
            return;
          }
        }

        // Nếu trên Firebase chưa có node `batteryState` lần đầu tiên, khởi tạo ngay từ state hiện tại
        cloudLoadedRef.current = true;
        persistBatteryStateToFirebase(bms);
      },
      () => {
        // Ignore read error before auth
      }
    );

    return () => {
      unsubscribe();
    };
  }, [deviceId, authUser?.uid]);

  // 2. Khi ESP32 gửi `uptimeSeconds` mới lên Firebase -> tính độ hao hụt pin và đồng bộ lên Firebase
  useEffect(() => {
    if (!cloudLoadedRef.current) return;

    const currentUptime = telemetry?.device?.uptimeSeconds;
    if (typeof currentUptime !== 'number' || !Number.isFinite(currentUptime)) {
      return;
    }

    setBms((prev) => {
      const prevUptime = prev.lastEspUptimeSec;
      if (currentUptime === prevUptime) return prev;

      const deltaSec =
        currentUptime > prevUptime
          ? currentUptime - prevUptime
          : currentUptime;

      if (deltaSec <= 0 || deltaSec > 86400) {
        return { ...prev, lastEspUptimeSec: currentUptime };
      }

      const loadMa = calculateHardwareLoadCurrentMa(telemetry, false);
      const consumedMah = ((loadMa * deltaSec) / 3600) * 12;
      const deltaPercent = (consumedMah / BATTERY_CAPACITY_MAH) * 100;
      const nextSoc = Math.max(5, Number((prev.soc - deltaPercent).toFixed(3)));

      const nextState: CloudBatteryState = {
        ...prev,
        soc: nextSoc,
        percentage: Math.round(nextSoc),
        voltageV: calculateLiPoVoltage(nextSoc, prev.isCharging),
        lastTimestampMs: Date.now(),
        lastEspUptimeSec: currentUptime,
      };

      // Ghi lên Firebase mỗi khi ESP32 cập nhật gói tin mới hoặc khi % nguyên thay đổi
      if (
        Math.round(nextSoc) !== Math.round(lastSavedSocRef.current) ||
        Math.abs(nextSoc - lastSavedSocRef.current) >= 0.1 ||
        Date.now() - lastSavedTimeRef.current >= 15000
      ) {
        persistBatteryStateToFirebase(nextState);
      }

      return nextState;
    });
  }, [telemetry?.device?.uptimeSeconds]);

  // 3. Chu kỳ cập nhật định kỳ theo dòng tải thực tế và tự động lưu lên Firebase khi % pin thay đổi
  useEffect(() => {
    const interval = setInterval(() => {
      if (!cloudLoadedRef.current) return;

      setBms((prev) => {
        const now = Date.now();
        let nextSoc = prev.soc;
        let nextCharging = prev.isCharging;

        if (prev.isCharging) {
          if (prev.soc >= 100) {
            nextSoc = 100;
            nextCharging = false;
          } else {
            const chargeStep = prev.soc < 85 ? 0.45 : 0.18;
            nextSoc = Math.min(100, Number((prev.soc + chargeStep).toFixed(2)));
          }
        } else {
          const loadMa = calculateHardwareLoadCurrentMa(telemetry, isStale);
          const consumedMah = ((loadMa * 5) / 3600) * 6;
          const dropPercent = (consumedMah / BATTERY_CAPACITY_MAH) * 100;
          nextSoc = Math.max(5, Number((prev.soc - dropPercent).toFixed(3)));
        }

        const nextState: CloudBatteryState = {
          ...prev,
          soc: nextSoc,
          percentage: Math.round(nextSoc),
          voltageV: calculateLiPoVoltage(nextSoc, nextCharging),
          isCharging: nextCharging,
          lastTimestampMs: now,
        };

        // Đồng bộ lên Firebase khi phần trăm pin thay đổi hoặc định kỳ mỗi 30 giây
        if (
          Math.round(nextSoc) !== Math.round(lastSavedSocRef.current) ||
          Math.abs(nextSoc - lastSavedSocRef.current) >= 0.25 ||
          now - lastSavedTimeRef.current >= 30000
        ) {
          persistBatteryStateToFirebase(nextState);
        }

        return nextState;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [telemetry, isStale, deviceId, authUser?.uid]);

  // Nếu phần cứng ESP32 có gửi `battery.percentage` thực tế hợp lệ (> 0) thì ưu tiên giá trị phần cứng
  const hwPercentage =
    typeof telemetry?.battery?.percentage === 'number' &&
    telemetry.battery.percentage > 0 &&
    telemetry.battery.percentage <= 100
      ? telemetry.battery.percentage
      : null;

  const hwVoltage =
    typeof telemetry?.battery?.voltage === 'number' &&
    telemetry.battery.voltage >= 3.0 &&
    telemetry.battery.voltage <= 4.35
      ? telemetry.battery.voltage
      : null;

  const finalPreciseSoc = hwPercentage !== null ? hwPercentage : bms.soc;
  const finalPercentage = Math.round(finalPreciseSoc);
  const finalVoltageV =
    hwVoltage !== null
      ? hwVoltage
      : calculateLiPoVoltage(finalPreciseSoc, bms.isCharging);

  const currentDrawMa = calculateHardwareLoadCurrentMa(telemetry, isStale);
  const activeReferenceLoadMa = Math.max(115, currentDrawMa);
  const remainingMah = (finalPreciseSoc / 100) * BATTERY_CAPACITY_MAH;
  const estimatedHoursRemaining = Number(
    (remainingMah / activeReferenceLoadMa).toFixed(1)
  );

  const wholeHours = Math.floor(estimatedHoursRemaining);
  const remMins = Math.round((estimatedHoursRemaining - wholeHours) * 60);
  const estimatedTimeText = `~${wholeHours}g ${remMins}p`;

  const toggleCharging = () => {
    setBms((prev) => {
      const next: CloudBatteryState = {
        ...prev,
        isCharging: !prev.isCharging,
        lastTimestampMs: Date.now(),
      };
      persistBatteryStateToFirebase(next);
      return next;
    });
  };

  const chargeToFull = () => {
    setBms((prev) => {
      const next: CloudBatteryState = {
        ...prev,
        soc: 100,
        percentage: 100,
        voltageV: 4.2,
        isCharging: false,
        lastTimestampMs: Date.now(),
      };
      persistBatteryStateToFirebase(next);
      return next;
    });
  };

  return {
    percentage: finalPercentage,
    precisePercentage: Number(finalPreciseSoc.toFixed(1)),
    voltageV: finalVoltageV,
    currentDrawMa,
    estimatedHoursRemaining,
    estimatedTimeText,
    isCharging: bms.isCharging,
    adcRawMv:
      typeof telemetry?.battery?.adcMillivolts === 'number'
        ? telemetry.battery.adcMillivolts
        : null,
    toggleCharging,
    chargeToFull,
  };
}
