import { DataSnapshot, onValue, ref, set, update } from 'firebase/database';
import {
  FirebaseModeConfigNode,
  OperatingModeId,
  OperatingModeProfile,
} from '../types/helmet';
import {
  DEFAULT_HELMET_DEVICE_ID,
  getFirebaseDatabase,
  normalizeDeviceId,
} from './firebaseService';

export const OPERATING_MODE_PROFILES: Record<
  OperatingModeId,
  OperatingModeProfile
> = {
  helmet: {
    id: 'helmet',
    label: 'Mũ bảo hiểm',
    englishKey: 'helmet',
    shortDesc: 'Bảo vệ người đội mũ bảo hiểm cá nhân',
    accentColor: '#1890FF',
    badgeBg: 'bg-[#E6F7FF]',
    badgeText: 'text-[#0050B3]',
    badgeBorder: 'border-[#91D5FF]',
    thresholds: {
      impactThresholdG: 3.2,
      tiltAngleThresholdDeg: 60,
      gyroThresholdDps: 180,
      cancelWindowSec: 15,
    },
  },
  wheelchair: {
    id: 'wheelchair',
    label: 'Xe lăn',
    englishKey: 'wheelchair',
    shortDesc: 'Phát hiện nghiêng đổ xe lăn cho người cao tuổi / bệnh nhân',
    accentColor: '#13C2C2',
    badgeBg: 'bg-[#E6FFFB]',
    badgeText: 'text-[#006D75]',
    badgeBorder: 'border-[#87E8DE]',
    thresholds: {
      impactThresholdG: 1.8,
      tiltAngleThresholdDeg: 35,
      gyroThresholdDps: 95,
      cancelWindowSec: 12,
    },
  },
  motorbike: {
    id: 'motorbike',
    label: 'Xe máy',
    englishKey: 'motorbike',
    shortDesc: 'Phát hiện va chạm giao thông & ngã xe tốc độ cao',
    accentColor: '#FA8C16',
    badgeBg: 'bg-[#FFF7E6]',
    badgeText: 'text-[#AD4E00]',
    badgeBorder: 'border-[#FFD591]',
    thresholds: {
      impactThresholdG: 4.5,
      tiltAngleThresholdDeg: 65,
      gyroThresholdDps: 240,
      cancelWindowSec: 15,
    },
  },
  backpack: {
    id: 'backpack',
    label: 'Balo',
    englishKey: 'backpack',
    shortDesc: 'Theo dõi hành trình & phát hiện té ngã khi mang balo',
    accentColor: '#722ED1',
    badgeBg: 'bg-[#F9F0FF]',
    badgeText: 'text-[#391085]',
    badgeBorder: 'border-[#D3ADF7]',
    thresholds: {
      impactThresholdG: 2.6,
      tiltAngleThresholdDeg: 55,
      gyroThresholdDps: 140,
      cancelWindowSec: 15,
    },
  },
};

export const MODE_LIST: OperatingModeProfile[] = [
  OPERATING_MODE_PROFILES.helmet,
  OPERATING_MODE_PROFILES.wheelchair,
  OPERATING_MODE_PROFILES.motorbike,
  OPERATING_MODE_PROFILES.backpack,
];

export function isValidOperatingMode(val: unknown): val is OperatingModeId {
  return (
    val === 'helmet' ||
    val === 'wheelchair' ||
    val === 'motorbike' ||
    val === 'backpack'
  );
}

/**
 * Lắng nghe cấu hình chế độ hoạt động từ `/helmets/{deviceId}/config`
 */
export function subscribeToDeviceModeConfig(
  deviceId: string = DEFAULT_HELMET_DEVICE_ID,
  onData: (config: FirebaseModeConfigNode | null) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    onData(null);
    return () => {};
  }

  const cleanId = normalizeDeviceId(deviceId);
  const configRef = ref(db, `helmets/${cleanId}/config`);

  return onValue(
    configRef,
    (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const raw = snapshot.val() as Record<string, unknown>;
      const mode: OperatingModeId = isValidOperatingMode(raw.mode)
        ? raw.mode
        : 'helmet';
      const profile = OPERATING_MODE_PROFILES[mode];
      const configVersion =
        typeof raw.configVersion === 'number' &&
        Number.isFinite(raw.configVersion)
          ? raw.configVersion
          : 1;

      const rawThresholds =
        raw.thresholds && typeof raw.thresholds === 'object'
          ? (raw.thresholds as Record<string, unknown>)
          : {};

      const mapped: FirebaseModeConfigNode = {
        mode,
        modeLabel: profile.label,
        configVersion,
        thresholds: {
          impactThresholdG:
            typeof rawThresholds.impactThresholdG === 'number'
              ? rawThresholds.impactThresholdG
              : profile.thresholds.impactThresholdG,
          tiltAngleThresholdDeg:
            typeof rawThresholds.tiltAngleThresholdDeg === 'number'
              ? rawThresholds.tiltAngleThresholdDeg
              : profile.thresholds.tiltAngleThresholdDeg,
          gyroThresholdDps:
            typeof rawThresholds.gyroThresholdDps === 'number'
              ? rawThresholds.gyroThresholdDps
              : profile.thresholds.gyroThresholdDps,
          cancelWindowSec:
            typeof rawThresholds.cancelWindowSec === 'number'
              ? rawThresholds.cancelWindowSec
              : profile.thresholds.cancelWindowSec,
        },
        updatedAt:
          typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      };

      onData(mapped);
    },
    (err) => {
      onError?.(err);
    }
  );
}

/**
 * Đẩy cấu hình Mode mới xuống `/helmets/{deviceId}/config` với `configVersion` tăng lên
 */
export async function pushModeConfigToFirebase(
  deviceId: string,
  newMode: OperatingModeId,
  nextVersion: number
): Promise<FirebaseModeConfigNode> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const profile = OPERATING_MODE_PROFILES[newMode];
  const now = Date.now();

  const payload: FirebaseModeConfigNode = {
    mode: newMode,
    modeLabel: profile.label,
    configVersion: nextVersion,
    thresholds: profile.thresholds,
    updatedAt: now,
  };

  await update(ref(db, `helmets/${cleanId}/config`), {
    ...payload,
    version: nextVersion,
  });
  return payload;
}
