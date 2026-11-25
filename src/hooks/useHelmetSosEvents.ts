import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  isFirebaseConfigured,
  normalizeDeviceId,
} from '../services/firebaseService';
import {
  resolveSosIncidentTransaction,
  subscribeToDeviceEventMap,
  subscribeToDeviceSosNode,
} from '../services/sosEventsService';
import { FirebaseSosEventRecord } from '../types/helmet';

const SESSION_NOTIFIED_SOS_KEY = 'casbox_notified_sos_keys_v1';

function getSessionNotifiedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_NOTIFIED_SOS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map(String));
      }
    }
  } catch {
    // Ignore storage error
  }
  return new Set();
}

function addSessionNotifiedKey(key: string): void {
  try {
    const set = getSessionNotifiedSet();
    set.add(key);
    sessionStorage.setItem(
      SESSION_NOTIFIED_SOS_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // Ignore storage error
  }
}

export interface UseHelmetSosEventsResult {
  latestSos: FirebaseSosEventRecord | null;
  activeEmergencySos: FirebaseSosEventRecord | null; // Only non-null when active=true, resolved=false, test=false
  realSosEvents: FirebaseSosEventRecord[]; // Strictly real SOS events (test=false)
  testSosEvents: FirebaseSosEventRecord[]; // Strictly test events from testEvents or test=true
  loading: boolean;
  resolvingId: string | null;
  error: string | null;
  resolveSos: (eventId: string, resolverName?: string) => Promise<void>;
}

export function useHelmetSosEvents(
  deviceId: string,
  authUser: User | null,
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

  const notifiedKeysRef = useRef<Set<string>>(getSessionNotifiedSet());
  const onNewSosCallbackRef = useRef(onNewEmergencySosDetected);
  onNewSosCallbackRef.current = onNewEmergencySosDetected;

  const configured = isFirebaseConfigured();

  // Subscribe to /helmets/{deviceId}/sos, /events, and /testEvents
  // Automatically unsubscribes old listeners when deviceId changes
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

        // Requirement 2 & 7: Trigger Realtime SOS Notification ONLY when
        // active === true && resolved === false && test === false
        // Deduplicated by `${deviceId}:${eventId}`
        if (
          sosRecord &&
          sosRecord.active === true &&
          sosRecord.resolved !== true &&
          sosRecord.test !== true
        ) {
          const dedupKey = `${cleanId}:${sosRecord.id}`;
          if (!notifiedKeysRef.current.has(dedupKey)) {
            notifiedKeysRef.current.add(dedupKey);
            addSessionNotifiedKey(dedupKey);
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
        // testEvents may not exist on all devices
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

  // Active Emergency SOS: Strictly active=true, resolved=false, test=false
  const activeEmergencySos = useMemo(() => {
    if (
      latestSos &&
      latestSos.active === true &&
      latestSos.resolved !== true &&
      latestSos.test !== true
    ) {
      return latestSos;
    }
    return null;
  }, [latestSos]);

  // Merge and strictly isolate Real SOS Events vs Test Events (Requirement 3 & 7)
  const { realSosEvents, testSosEvents } = useMemo(() => {
    const realMap = new Map<string, FirebaseSosEventRecord>();
    const testMap = new Map<string, FirebaseSosEventRecord>();

    // 1. From /events/{eventId}
    rawEventsNode.forEach((evt) => {
      if (evt.test) {
        testMap.set(evt.id, evt);
      } else {
        realMap.set(evt.id, evt);
      }
    });

    // 2. From /testEvents/{eventId} (Always isolated as test events)
    rawTestEventsNode.forEach((evt) => {
      testMap.set(evt.id, { ...evt, test: true, sourceNode: 'testEvents' });
    });

    // 3. Merge latest /sos state (active/resolved/resolvedAt) into matching event or prepend if missing
    if (latestSos) {
      if (latestSos.test) {
        const existing = testMap.get(latestSos.id);
        testMap.set(latestSos.id, {
          ...(existing || latestSos),
          active: latestSos.active,
          resolved: latestSos.resolved,
          resolvedAt: latestSos.resolvedAt ?? existing?.resolvedAt,
          resolvedBy: latestSos.resolvedBy ?? existing?.resolvedBy,
        });
      } else {
        const existing = realMap.get(latestSos.id);
        realMap.set(latestSos.id, {
          ...(existing || latestSos),
          active: latestSos.active,
          resolved: latestSos.resolved,
          resolvedAt: latestSos.resolvedAt ?? existing?.resolvedAt,
          resolvedBy: latestSos.resolvedBy ?? existing?.resolvedBy,
        });
      }
    }

    const realList = Array.from(realMap.values()).sort(
      (a, b) => (b.pushedAt || 0) - (a.pushedAt || 0)
    );
    const testList = Array.from(testMap.values()).sort(
      (a, b) => (b.pushedAt || 0) - (a.pushedAt || 0)
    );

    return { realSosEvents: realList, testSosEvents: testList };
  }, [rawEventsNode, rawTestEventsNode, latestSos]);

  const resolveSos = useCallback(
    async (eventId: string, resolverName?: string) => {
      setResolvingId(eventId);
      setError(null);
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
    realSosEvents,
    testSosEvents,
    loading,
    resolvingId,
    error,
    resolveSos,
  };
}
