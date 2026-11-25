import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  Database,
  DataSnapshot,
  getDatabase,
  onValue,
  ref,
} from 'firebase/database';
import {
  FirebaseGpsNode,
  FirebaseHelmetTelemetry,
  HelmetDeviceSummary,
} from '../types/helmet';

export const DEFAULT_FIREBASE_DB_URL =
  'https://smart-helmet-iot-efc7e-default-rtdb.firebaseio.com';

const rawEnvDeviceId = import.meta.env.VITE_HELMET_DEVICE_ID || 'helmet01';

export function normalizeDeviceId(deviceId: string): string {
  const trimmed = (deviceId || '').trim();
  if (!trimmed || trimmed === 'helmet-001') return 'helmet01';
  return trimmed;
}

export const DEFAULT_HELMET_DEVICE_ID = normalizeDeviceId(rawEnvDeviceId);

export const KNOWN_DEFAULT_DEVICES = ['helmet01', 'helmet01_phase34'];

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'smart-helmet-iot-efc7e.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_DB_URL,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || 'smart-helmet-iot-efc7e',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'smart-helmet-iot-efc7e.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Database | null = null;
let authInstance: Auth | null = null;

export function isFirebaseConfigured(): boolean {
  const key = firebaseConfig.apiKey.trim();
  return Boolean(key && key !== 'your_firebase_api_key_here');
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!appInstance) {
    const existing = getApps();
    appInstance =
      existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
  }
  return appInstance;
}

export function getFirebaseDatabase(): Database | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!dbInstance) {
    dbInstance = getDatabase(app, firebaseConfig.databaseURL);
  }
  return dbInstance;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function subscribeToFirebaseAuth(
  onUserChanged: (user: User | null) => void
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    onUserChanged(null);
    return () => { };
  }
  return onAuthStateChanged(auth, onUserChanged);
}

export async function signInFirebaseEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Chưa cấu hình VITE_FIREBASE_API_KEY trong file .env');
  }
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerFirebaseEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Chưa cấu hình VITE_FIREBASE_API_KEY trong file .env');
  }
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInFirebaseAnonymous() {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Chưa cấu hình VITE_FIREBASE_API_KEY trong file .env');
  }
  return signInAnonymously(auth);
}

export async function signOutFirebase() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  return signOut(auth);
}

export function subscribeToFirebaseConnectionState(
  onConnectedChange: (connected: boolean) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    onConnectedChange(false);
    return () => { };
  }
  const connectedRef = ref(db, '.info/connected');
  return onValue(
    connectedRef,
    (snap) => {
      onConnectedChange(Boolean(snap.val()));
    },
    () => {
      onConnectedChange(false);
    }
  );
}

function buildDeviceSummary(
  deviceId: string,
  nodeVal: Record<string, unknown> | null
): HelmetDeviceSummary {
  const status =
    nodeVal && typeof nodeVal.status === 'object' && nodeVal.status !== null
      ? (nodeVal.status as Record<string, unknown>)
      : {};
  const sos =
    nodeVal && typeof nodeVal.sos === 'object' && nodeVal.sos !== null
      ? (nodeVal.sos as Record<string, unknown>)
      : null;

  const isRealActiveSos = Boolean(
    sos && sos.active === true && sos.resolved !== true
  );

  return {
    deviceId,
    fw:
      status.fw !== undefined
        ? String(status.fw)
        : sos?.fw !== undefined
          ? String(sos.fw)
          : '--',
    lastSeen:
      typeof status.lastSeen === 'number' || typeof status.lastSeen === 'string'
        ? status.lastSeen
        : undefined,
    hasActiveSos: isRealActiveSos,
    activeSosId: isRealActiveSos && sos?.id ? String(sos.id) : null,
    activeContactCount:
      typeof status.activeContactCount === 'number'
        ? status.activeContactCount
        : undefined,
    contactConfigVerified:
      typeof status.contactConfigVerified === 'boolean'
        ? status.contactConfigVerified
        : undefined,
    sosTestMode:
      typeof status.sosTestMode === 'boolean' ? status.sosTestMode : undefined,
  };
}

/**
 * Tự động nhận diện danh sách các thiết bị được phép truy cập trong node `/helmets`.
 * Nếu Security Rules chặn đọc toàn bộ `/helmets` nhưng cho phép đọc từng `/helmets/{deviceId}`,
 * tự động fallback sang lắng nghe danh sách thiết bị được cấp quyền (`helmet01`, `helmet01_phase34`, ...).
 */
export function subscribeToAccessibleDevices(
  candidateDeviceIds: string[],
  onDevices: (devices: HelmetDeviceSummary[]) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    onDevices(
      KNOWN_DEFAULT_DEVICES.map((id) => buildDeviceSummary(id, null))
    );
    return () => { };
  }

  let fallbackUnsubscribes: (() => void)[] = [];
  const helmetsRootRef = ref(db, 'helmets');

  const cleanupFallbacks = () => {
    fallbackUnsubscribes.forEach((u) => u());
    fallbackUnsubscribes = [];
  };

  const rootUnsub = onValue(
    helmetsRootRef,
    (snapshot: DataSnapshot) => {
      cleanupFallbacks();
      if (!snapshot.exists()) {
        onDevices(
          KNOWN_DEFAULT_DEVICES.map((id) => buildDeviceSummary(id, null))
        );
        return;
      }

      const raw = snapshot.val() as Record<string, unknown>;
      const summaries: HelmetDeviceSummary[] = [];

      Object.entries(raw).forEach(([key, val]) => {
        if (val && typeof val === 'object') {
          summaries.push(
            buildDeviceSummary(key, val as Record<string, unknown>)
          );
        }
      });

      // Ensure candidate devices are sorted predictably (helmet01, helmet01_phase34, etc.)
      summaries.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
      onDevices(summaries);
    },
    () => {
      // Fallback: Subscribe individually to candidate device nodes when root `/helmets` read is restricted by rules
      cleanupFallbacks();
      const uniqueIds = Array.from(
        new Set([...KNOWN_DEFAULT_DEVICES, ...candidateDeviceIds.map(normalizeDeviceId)])
      );
      const mapById = new Map<string, HelmetDeviceSummary>();
      uniqueIds.forEach((id) => mapById.set(id, buildDeviceSummary(id, null)));

      const emit = () => {
        onDevices(
          Array.from(mapById.values()).sort((a, b) =>
            a.deviceId.localeCompare(b.deviceId)
          )
        );
      };

      uniqueIds.forEach((id) => {
        const devRef = ref(db, `helmets/${id}`);
        const u = onValue(
          devRef,
          (snap) => {
            if (snap.exists() && typeof snap.val() === 'object') {
              mapById.set(
                id,
                buildDeviceSummary(id, snap.val() as Record<string, unknown>)
              );
              emit();
            }
          },
          () => {
            // If specific device node is restricted, try status + sos subnodes
            const stUnsub = onValue(
              ref(db, `helmets/${id}/status`),
              (stSnap) => {
                const prev = mapById.get(id) || buildDeviceSummary(id, null);
                if (stSnap.exists()) {
                  const st = stSnap.val() as Record<string, unknown>;
                  mapById.set(id, {
                    ...prev,
                    fw: st.fw !== undefined ? String(st.fw) : prev.fw,
                    lastSeen:
                      typeof st.lastSeen === 'number' ||
                        typeof st.lastSeen === 'string'
                        ? st.lastSeen
                        : prev.lastSeen,
                  });
                  emit();
                }
              },
              () => { }
            );
            fallbackUnsubscribes.push(stUnsub);
          }
        );
        fallbackUnsubscribes.push(u);
      });
      emit();
    }
  );

  return () => {
    rootUnsub();
    cleanupFallbacks();
  };
}

/**
 * Subscribe to real-time status from `/helmets/{deviceId}/status`
 * Strictly Read-Only listener using `onValue()`. Never overwrites ESP32 status data.
 */
export function subscribeToHelmetTelemetry(
  deviceId: string,
  onData: (telemetry: FirebaseHelmetTelemetry | null) => void,
  onError: (error: Error & { code?: string }) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    const configErr = new Error(
      'Chưa cấu hình Firebase Web App (VITE_FIREBASE_API_KEY). Vui lòng tạo file .env theo hướng dẫn trong .env.example.'
    ) as Error & { code?: string };
    configErr.code = 'CONFIG_MISSING';
    onError(configErr);
    return () => { };
  }

  const cleanId = normalizeDeviceId(deviceId);
  const statusPath = `helmets/${cleanId}/status`;
  const statusRef = ref(db, statusPath);

  const unsubscribe = onValue(
    statusRef,
    (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const raw = snapshot.val() as FirebaseHelmetTelemetry;
      onData(raw);
    },
    (error: Error & { code?: string }) => {
      onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Subscribe directly to `/helmets/{deviceId}/status/gps` (Firmware V2.4.3-dev GPS Monitoring)
 * Fires immediately whenever ESP32 performs `GPSSYNC` or `SYNC`, without requiring page reload.
 * Strictly separated from `sos/loc` and `events/{eventId}/loc`.
 */
export function subscribeToHelmetGpsStatus(
  deviceId: string,
  onGpsData: (gps: FirebaseGpsNode | null) => void,
  onError?: (error: Error & { code?: string }) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    onGpsData(null);
    return () => { };
  }

  const cleanId = normalizeDeviceId(deviceId);
  const gpsRef = ref(db, `helmets/${cleanId}/status/gps`);

  return onValue(
    gpsRef,
    (snapshot: DataSnapshot) => {
      if (!snapshot.exists() || typeof snapshot.val() !== 'object') {
        onGpsData(null);
        return;
      }
      onGpsData(snapshot.val() as FirebaseGpsNode);
    },
    (error: Error & { code?: string }) => {
      onError?.(error);
    }
  );
}
