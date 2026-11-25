import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  isValidOperatingMode,
  MODE_LIST,
  OPERATING_MODE_PROFILES,
  pushModeConfigToFirebase,
  subscribeToDeviceModeConfig,
} from '../services/deviceModeConfigService';
import { normalizeDeviceId } from '../services/firebaseService';
import {
  FirebaseHelmetTelemetry,
  ModeConfigSyncState,
  OperatingModeId,
  OperatingModeProfile,
} from '../types/helmet';

function getLocalModeKey(deviceId: string) {
  return `casbox_persisted_mode_${normalizeDeviceId(deviceId)}`;
}

function getLocalVersionKey(deviceId: string) {
  return `casbox_persisted_ver_${normalizeDeviceId(deviceId)}`;
}

function getInitialPersistedMode(deviceId: string): OperatingModeId {
  try {
    const saved = localStorage.getItem(getLocalModeKey(deviceId));
    if (isValidOperatingMode(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage error
  }
  return 'helmet';
}

function getInitialPersistedVersion(deviceId: string): number {
  try {
    const saved = Number(localStorage.getItem(getLocalVersionKey(deviceId)));
    if (Number.isFinite(saved) && saved >= 0) {
      return saved;
    }
  } catch {
    // Ignore storage error
  }
  return 1;
}

export interface UseDeviceModeConfigReturn {
  activeMode: OperatingModeId;
  activeModeProfile: OperatingModeProfile;
  allModes: OperatingModeProfile[];
  configVersion: number;
  syncState: ModeConfigSyncState;
  lastSyncedAt: number | null;
  selectMode: (
    newMode: OperatingModeId
  ) => Promise<{ mode: OperatingModeId; version: number; onlineAck: boolean }>;
}

export function useDeviceModeConfig(
  deviceId: string,
  telemetry: FirebaseHelmetTelemetry | null,
  isStale: boolean,
  authUser: User | null
): UseDeviceModeConfigReturn {
  const cleanId = normalizeDeviceId(deviceId);
  const [activeMode, setActiveMode] = useState<OperatingModeId>(() =>
    getInitialPersistedMode(cleanId)
  );
  const [configVersion, setConfigVersion] = useState<number>(() =>
    getInitialPersistedVersion(cleanId)
  );
  const [syncState, setSyncState] = useState<ModeConfigSyncState>('APPLIED');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const isDeviceOnline = Boolean(telemetry) && !isStale;

  const persistLocalMode = useCallback(
    (mode: OperatingModeId, version: number) => {
      try {
        localStorage.setItem(getLocalModeKey(cleanId), mode);
        localStorage.setItem(getLocalVersionKey(cleanId), String(version));
      } catch {
        // Ignore storage errors
      }
    },
    [cleanId]
  );

  // 1. Subscribe to /helmets/{deviceId}/config on Firebase (Unsubscribes old device on switch)
  useEffect(() => {
    setActiveMode(getInitialPersistedMode(cleanId));
    setConfigVersion(getInitialPersistedVersion(cleanId));

    const unsubscribe = subscribeToDeviceModeConfig(cleanId, (remoteConfig) => {
      if (!remoteConfig) return;

      setActiveMode(remoteConfig.mode);
      setConfigVersion(remoteConfig.configVersion);
      setLastSyncedAt(remoteConfig.updatedAt);
      persistLocalMode(remoteConfig.mode, remoteConfig.configVersion);
    });

    return () => {
      unsubscribe();
    };
  }, [cleanId, authUser?.uid, persistLocalMode]);

  // 2. Compare configVersion with ESP32 status.configVersion & status.mode (Read-only on /status)
  useEffect(() => {
    if (!telemetry) {
      setSyncState('WAITING_ONLINE');
      return;
    }

    if (isValidOperatingMode(telemetry.mode) && !lastSyncedAt) {
      setActiveMode(telemetry.mode);
    }

    const statusVer =
      typeof telemetry.configVersion === 'number'
        ? telemetry.configVersion
        : Number(telemetry.configVersion);

    const modeMatches =
      !telemetry.mode || telemetry.mode === activeMode;

    if (
      Number.isFinite(statusVer) &&
      statusVer >= configVersion &&
      modeMatches
    ) {
      setSyncState('APPLIED');
    } else if (isDeviceOnline) {
      setSyncState('SYNCING');
    } else {
      setSyncState('WAITING_ONLINE');
    }
  }, [
    telemetry,
    telemetry?.configVersion,
    telemetry?.mode,
    configVersion,
    activeMode,
    isDeviceOnline,
    lastSyncedAt,
  ]);

  // 3. Action: Select one of the 4 operating modes (Writes ONLY to /helmets/{deviceId}/config, never /status)
  const selectMode = useCallback(
    async (newMode: OperatingModeId) => {
      const currentStatusVer =
        typeof telemetry?.configVersion === 'number'
          ? telemetry.configVersion
          : Number(telemetry?.configVersion) || 0;

      const nextVersion = Math.max(configVersion, currentStatusVer) + 1;

      setActiveMode(newMode);
      setConfigVersion(nextVersion);
      setLastSyncedAt(Date.now());
      persistLocalMode(newMode, nextVersion);

      setSyncState(isDeviceOnline ? 'SYNCING' : 'WAITING_ONLINE');

      try {
        await pushModeConfigToFirebase(cleanId, newMode, nextVersion);
      } catch {
        // Keep local state if transient write error
      }

      return {
        mode: newMode,
        version: nextVersion,
        onlineAck: isDeviceOnline,
      };
    },
    [
      cleanId,
      configVersion,
      isDeviceOnline,
      persistLocalMode,
      telemetry?.configVersion,
    ]
  );

  return {
    activeMode,
    activeModeProfile: OPERATING_MODE_PROFILES[activeMode],
    allModes: MODE_LIST,
    configVersion,
    syncState,
    lastSyncedAt,
    selectMode,
  };
}
