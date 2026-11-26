import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  isFirebaseConfigured,
  normalizeDeviceId,
} from '../services/firebaseService';
import {
  registerGlobalAudioUnlock,
  startSosSirenAlarm,
  stopSosSirenAlarm,
} from '../services/sosAudioAlarmService';
import {
  resolveSosIncidentTransaction,
  subscribeToDeviceEventMap,
  subscribeToDeviceSosNode,
} from '../services/sosEventsService';
import {
  FirebaseHelmetTelemetry,
  FirebaseSosEventRecord,
} from '../types/helmet';

export interface UseHelmetSosEventsResult {
  latestSos: FirebaseSosEventRecord | null;
  activeEmergencySos: FirebaseSosEventRecord | null; // Non-null whenever SOS is triggered on Firebase
  allSosEvents: FirebaseSosEventRecord[]; // Toàn bộ sự kiện từ /events, /sos và /testEvents của thiết bị
  realSosEvents: FirebaseSosEventRecord[];
  testSosEvents: FirebaseSosEventRecord[];
  isAlarmPlaying: boolean;
  autoplayBlocked: boolean;
  isAlarmMutedByUser: boolean;
  loading: boolean;
  resolvingId: string | null;
  error: string | null;
  resolveSos: (eventId: string, resolverName?: string) => Promise<void>;
  enableOrToggleAudioAlarm: () => Promise<void>;
}

export function useHelmetSosEvents(
  deviceId: string,
  authUser: User | null,
  telemetry: FirebaseHelmetTelemetry | null = null,
  onNewEmergencySosDetected?: (sos: FirebaseSosEventRecord) => void
): UseHelmetSosEventsResult {
  const cleanId = normalizeDeviceId(deviceId);
  const [latestSos, setLatestSos] = useState<FirebaseSosEventRecord | null>(
    null
  );
  const [rawEventsNode, setRawEventsNode] = useState<FirebaseSosEventRecord[]>(
    []
  );
  const [rawTestEventsNode, setRawTestEventsNode] = useState<
    FirebaseSosEventRecord[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Audio Alarm states
  const [isAlarmPlaying, setIsAlarmPlaying] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isAlarmMutedByUser, setIsAlarmMutedByUser] = useState<boolean>(false);

  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const onNewSosCallbackRef = useRef(onNewEmergencySosDetected);
  onNewSosCallbackRef.current = onNewEmergencySosDetected;

  const configured = isFirebaseConfigured();

  // Subscribe to /helmets/{deviceId}/sos, /events, and /testEvents
  useEffect(() => {
    setLoading(true);
    setError(null);
    setLatestSos(null);
    setRawEventsNode([]);
    setRawTestEventsNode([]);

    if (!configured) {
      setLoading(false);
      return;
    }

    let sosLoaded = false;
    let eventsLoaded = false;
    let testEventsLoaded = false;

    const checkAllLoaded = () => {
      if (sosLoaded && eventsLoaded && testEventsLoaded) {
        setLoading(false);
      }
    };

    const unsubSos = subscribeToDeviceSosNode(
      cleanId,
      (sosRecord) => {
        sosLoaded = true;
        setLatestSos(sosRecord);
        checkAllLoaded();

        // Khi node /helmets/{deviceId}/sos có active === true && resolved !== true -> Kích hoạt SOS Trigger!
        if (
          sosRecord &&
          sosRecord.active === true &&
          sosRecord.resolved !== true
        ) {
          const dedupKey = `${cleanId}:${sosRecord.id}:${sosRecord.pushedAt || 0}`;
          if (!notifiedKeysRef.current.has(dedupKey)) {
            notifiedKeysRef.current.add(dedupKey);
            setIsAlarmMutedByUser(false);
            onNewSosCallbackRef.current?.(sosRecord);
          }
        }
      },
      (err) => {
        sosLoaded = true;
        setError(err.message);
        checkAllLoaded();
      }
    );

    const unsubEvents = subscribeToDeviceEventMap(
      cleanId,
      'events',
      (list) => {
        eventsLoaded = true;
        setRawEventsNode(list);
        checkAllLoaded();
      },
      (err) => {
        eventsLoaded = true;
        setError(err.message);
        checkAllLoaded();
      }
    );

    const unsubTestEvents = subscribeToDeviceEventMap(
      cleanId,
      'testEvents',
      (list) => {
        testEventsLoaded = true;
        setRawTestEventsNode(list);
        checkAllLoaded();
      },
      () => {
        testEventsLoaded = true;
        checkAllLoaded();
      }
    );

    return () => {
      unsubSos();
      unsubEvents();
      unsubTestEvents();
    };
  }, [cleanId, configured, authUser?.uid]);

  // Determine Active Emergency SOS from `/helmets/{deviceId}/sos` (active=true, resolved=false)
  // OR from `/helmets/{deviceId}/status/sosPending === true`
  const activeEmergencySos = useMemo<FirebaseSosEventRecord | null>(() => {
    if (
      latestSos &&
      latestSos.active === true &&
      latestSos.resolved !== true
    ) {
      return latestSos;
    }

    if (telemetry?.sosPending === true) {
      const gpsLat = telemetry.gps?.lat ?? telemetry.gps?.lastLat;
      const gpsLon = telemetry.gps?.lon ?? telemetry.gps?.lastLon;
      const hasCoords =
        typeof gpsLat === 'number' &&
        typeof gpsLon === 'number' &&
        !(gpsLat === 0 && gpsLon === 0);

      return {
        id: latestSos?.id || 'sos_pending',
        deviceId: cleanId,
        type: 'SOS',
        test: false,
        sourceNode: 'sos',
        active: true,
        resolved: false,
        pushedAt:
          typeof telemetry.lastSeen === 'number'
            ? telemetry.lastSeen
            : Date.now(),
        answeredBy: latestSos?.answeredBy ?? 0,
        loc: {
          type:
            telemetry.gps?.valid === true && hasCoords
              ? 'CURRENT'
              : hasCoords
              ? 'OLD'
              : 'NONE',
          lat: hasCoords ? gpsLat : undefined,
          lon: hasCoords ? gpsLon : undefined,
          mapUrl: hasCoords
            ? `https://www.google.com/maps?q=${gpsLat!.toFixed(
                6
              )},${gpsLon!.toFixed(6)}`
            : undefined,
        },
        sms: latestSos?.sms ?? { sent: 0, targets: 0 },
        calls: latestSos?.calls ?? [],
      };
    }

    return null;
  }, [latestSos, telemetry, cleanId]);

  // Pre-unlock AudioContext & HTML5 Audio on first user click anywhere on the page.
  // If an SOS is currently active and was blocked by browser Autoplay, immediately start playing on that first click!
  useEffect(() => {
    const cleanup = registerGlobalAudioUnlock(() => {
      if (activeEmergencySos && !isAlarmMutedByUser) {
        startSosSirenAlarm().then((res) => {
          setIsAlarmPlaying(res.playing);
          setAutoplayBlocked(res.autoplayBlocked);
        });
      }
    });
    return cleanup;
  }, [activeEmergencySos, isAlarmMutedByUser]);

  // Automatically start/stop HTML5 Audio Siren Loop whenever `activeEmergencySos` changes
  useEffect(() => {
    if (activeEmergencySos && !isAlarmMutedByUser) {
      startSosSirenAlarm().then((res) => {
        setIsAlarmPlaying(res.playing);
        setAutoplayBlocked(res.autoplayBlocked);
      });
    } else {
      stopSosSirenAlarm();
      setIsAlarmPlaying(false);
      setAutoplayBlocked(false);
    }

    return () => {
      stopSosSirenAlarm();
    };
  }, [activeEmergencySos, isAlarmMutedByUser]);

  const enableOrToggleAudioAlarm = useCallback(async () => {
    if (!activeEmergencySos) return;

    if (isAlarmPlaying) {
      // User manually muted the siren while viewing the alert
      stopSosSirenAlarm();
      setIsAlarmPlaying(false);
      setAutoplayBlocked(false);
      setIsAlarmMutedByUser(true);
    } else {
      setIsAlarmMutedByUser(false);
      const res = await startSosSirenAlarm();
      setIsAlarmPlaying(res.playing);
      setAutoplayBlocked(res.autoplayBlocked);
    }
  }, [activeEmergencySos, isAlarmPlaying]);

  // Merge all events from /events, /sos, and /testEvents so the Activity Log always shows all Firebase events
  const { allSosEvents, realSosEvents, testSosEvents } = useMemo(() => {
    const allMap = new Map<string, FirebaseSosEventRecord>();
    const realMap = new Map<string, FirebaseSosEventRecord>();
    const testMap = new Map<string, FirebaseSosEventRecord>();

    rawEventsNode.forEach((evt) => {
      allMap.set(evt.id, evt);
      if (evt.test) {
        testMap.set(evt.id, evt);
      } else {
        realMap.set(evt.id, evt);
      }
    });

    rawTestEventsNode.forEach((evt) => {
      const normalizedTestEvt: FirebaseSosEventRecord = {
        ...evt,
        test: true,
        sourceNode: 'testEvents',
      };
      if (!allMap.has(evt.id)) {
        allMap.set(evt.id, normalizedTestEvt);
      }
      testMap.set(evt.id, normalizedTestEvt);
    });

    if (latestSos) {
      const existingAll = allMap.get(latestSos.id);
      const mergedLatest: FirebaseSosEventRecord = {
        ...(existingAll || latestSos),
        active: latestSos.active,
        resolved: latestSos.resolved,
        resolvedAt: latestSos.resolvedAt ?? existingAll?.resolvedAt,
        resolvedBy: latestSos.resolvedBy ?? existingAll?.resolvedBy,
      };
      allMap.set(latestSos.id, mergedLatest);

      if (latestSos.test) {
        testMap.set(latestSos.id, mergedLatest);
      } else {
        realMap.set(latestSos.id, mergedLatest);
      }
    }

    const sortEvents = (list: FirebaseSosEventRecord[]) =>
      list.sort((a, b) => {
        const timeDiff = (b.pushedAt || 0) - (a.pushedAt || 0);
        if (timeDiff !== 0) return timeDiff;
        return (b.sequence || 0) - (a.sequence || 0);
      });

    const allList = sortEvents(Array.from(allMap.values()));
    const realList = sortEvents(Array.from(realMap.values()));
    const testList = sortEvents(Array.from(testMap.values()));

    return {
      allSosEvents: allList,
      realSosEvents: realList,
      testSosEvents: testList,
    };
  }, [rawEventsNode, rawTestEventsNode, latestSos]);

  const resolveSos = useCallback(
    async (eventId: string, resolverName?: string) => {
      setResolvingId(eventId);
      setError(null);
      // Immediately stop the siren audio alarm when user clicks "Tắt cảnh báo / Xác nhận"
      stopSosSirenAlarm();
      setIsAlarmPlaying(false);
      setAutoplayBlocked(false);
      setIsAlarmMutedByUser(false);

      try {
        await resolveSosIncidentTransaction(
          cleanId,
          eventId,
          resolverName || authUser?.email || 'Người giám sát trên Web'
        );
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật trạng thái xử lý SOS.';
        setError(msg);
        throw err;
      } finally {
        setResolvingId(null);
      }
    },
    [cleanId, authUser?.email]
  );

  return {
    latestSos,
    activeEmergencySos,
    allSosEvents,
    realSosEvents,
    testSosEvents,
    isAlarmPlaying,
    autoplayBlocked,
    isAlarmMutedByUser,
    loading,
    resolvingId,
    error,
    resolveSos,
    enableOrToggleAudioAlarm,
  };
}
