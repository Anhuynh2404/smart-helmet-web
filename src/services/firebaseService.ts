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
import { FirebaseHelmetTelemetry } from '../types/helmet';

export const DEFAULT_FIREBASE_DB_URL =
  'https://smart-helmet-iot-efc7e-default-rtdb.firebaseio.com';
export const DEFAULT_HELMET_DEVICE_ID =
  import.meta.env.VITE_HELMET_DEVICE_ID || 'helmet-001';

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
    appInstance = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
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

/**
 * Subscribe to Firebase Authentication user state
 */
export function subscribeToFirebaseAuth(
  onUserChanged: (user: User | null) => void
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    onUserChanged(null);
    return () => {};
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

/**
 * Subscribe to Firebase client connection state (.info/connected)
 */
export function subscribeToFirebaseConnectionState(
  onConnectedChange: (connected: boolean) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    onConnectedChange(false);
    return () => {};
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

/**
 * Subscribe to real-time telemetry from `devices/{deviceId}/telemetry`
 * Read-only listener using `onValue()`. Never writes or overwrites ESP32 data.
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
    return () => {};
  }

  const telemetryPath = `devices/${deviceId}/telemetry`;
  const telemetryRef = ref(db, telemetryPath);

  const unsubscribe = onValue(
    telemetryRef,
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
