import {
  DataSnapshot,
  onValue,
  ref,
  runTransaction,
  update,
} from 'firebase/database';
import {
  FirebaseSosCallAttempt,
  FirebaseSosEventRecord,
  FirebaseSosLocationNode,
  FirebaseSosSmsNode,
  SosLocationType,
} from '../types/helmet';
import {
  getFirebaseDatabase,
  normalizeDeviceId,
} from './firebaseService';

const LEGACY_LOCAL_RESOLVED_SOS_STORAGE_KEY = 'casbox_resolved_sos_events_v1';

    // Xóa sạch cache localStorage cũ để không bao giờ tự động ghi đè active=false khi user test lại cùng một Event ID qua Postman
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(LEGACY_LOCAL_RESOLVED_SOS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage error
    }

    /**
     * Định dạng chuỗi `loc.utc` của Firmware V2.4.2-dev (VD: "20261124 232244")
     * sang giờ địa phương Việt Nam (UTC+7) kèm chuỗi UTC gốc.
     */
    export function formatFirmwareGpsUtc(utcRaw?: string): string {
      if (!utcRaw || typeof utcRaw !== 'string') {
        return 'Không có timestamp GPS';
      }
      const trimmed = utcRaw.trim();
      const match = /^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/.exec(trimmed);
      if (!match) {
        return trimmed;
      }
      const [, yyyy, mm, dd, hh, min, ss] = match;
      const isoUtc = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
      const parsed = new Date(isoUtc);
      if (Number.isNaN(parsed.getTime())) {
        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`;
      }

      try {
        const vnTime = new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour12: false,
        }).format(parsed);
        return `${vnTime} (UTC+7) [Gốc: ${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC]`;
      } catch {
        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`;
      }
    }

    function parseLocationType(val: unknown): SosLocationType {
      if (val === 'CURRENT' || val === 'OLD' || val === 'NONE') {
        return val;
      }
      return 'NONE';
    }

    export function parseFirebaseSosEventRecord(
      deviceId: string,
      fallbackId: string,
      raw: Record<string, unknown>,
      sourceNode: 'sos' | 'events' | 'testEvents'
    ): FirebaseSosEventRecord {
      const cleanDeviceId = normalizeDeviceId(deviceId);
      const id = String(raw.id || fallbackId);

      const rawLoc =
        raw.loc && typeof raw.loc === 'object'
          ? (raw.loc as Record<string, unknown>)
          : {};
      const locType = parseLocationType(rawLoc.type);
      const lat =
        typeof rawLoc.lat === 'number' && Number.isFinite(rawLoc.lat)
          ? rawLoc.lat
          : undefined;
      const lon =
        typeof rawLoc.lon === 'number' && Number.isFinite(rawLoc.lon)
          ? rawLoc.lon
          : undefined;
      const mapUrl =
        typeof rawLoc.mapUrl === 'string' && rawLoc.mapUrl.trim() !== ''
          ? rawLoc.mapUrl.trim()
          : lat !== undefined && lon !== undefined && locType !== 'NONE'
            ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`
            : undefined;

      const loc: FirebaseSosLocationNode = {
        type: locType,
        lat,
        lon,
        mapUrl,
        utc: typeof rawLoc.utc === 'string' ? rawLoc.utc : undefined,
      };

      const rawSms =
        raw.sms && typeof raw.sms === 'object'
          ? (raw.sms as Record<string, unknown>)
          : {};
      const sms: FirebaseSosSmsNode = {
        sent:
          typeof rawSms.sent === 'number' && Number.isFinite(rawSms.sent)
            ? rawSms.sent
            : 0,
        targets:
          typeof rawSms.targets === 'number' && Number.isFinite(rawSms.targets)
            ? rawSms.targets
            : 0,
        initialLocType:
          typeof rawSms.initialLocType === 'string'
            ? rawSms.initialLocType
            : undefined,
        gpsUpdatesSubmitted:
          typeof rawSms.gpsUpdatesSubmitted === 'number'
            ? rawSms.gpsUpdatesSubmitted
            : undefined,
      };

      const calls: FirebaseSosCallAttempt[] = [];
      if (Array.isArray(raw.calls)) {
        raw.calls.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            const c = item as Record<string, unknown>;
            calls.push({
              priority:
                typeof c.priority === 'number' && Number.isFinite(c.priority)
                  ? c.priority
                  : idx + 1,
              phone: typeof c.phone === 'string' ? c.phone : '--',
              result: typeof c.result === 'string' ? c.result : 'NOT_CALLED',
              callEnabled:
                typeof c.callEnabled === 'boolean' ? c.callEnabled : undefined,
              smsEnabled:
                typeof c.smsEnabled === 'boolean' ? c.smsEnabled : undefined,
            });
          }
        });
      } else if (raw.calls && typeof raw.calls === 'object') {
        Object.values(raw.calls as Record<string, unknown>).forEach((item, idx) => {
          if (item && typeof item === 'object') {
            const c = item as Record<string, unknown>;
            calls.push({
              priority:
                typeof c.priority === 'number' && Number.isFinite(c.priority)
                  ? c.priority
                  : idx + 1,
              phone: typeof c.phone === 'string' ? c.phone : '--',
              result: typeof c.result === 'string' ? c.result : 'NOT_CALLED',
              callEnabled:
                typeof c.callEnabled === 'boolean' ? c.callEnabled : undefined,
              smsEnabled:
                typeof c.smsEnabled === 'boolean' ? c.smsEnabled : undefined,
            });
          }
        });
      }
      calls.sort((a, b) => a.priority - b.priority);

      // Luôn tin cậy tuyệt đối trạng thái `active` và `resolved` trực tiếp từ Firebase Realtime Database
      const isResolved = raw.resolved === true;
      const isActive =
        raw.active === true && raw.resolved !== true;

      const isTest = Boolean(raw.test === true || sourceNode === 'testEvents');

      return {
        id,
        deviceId: cleanDeviceId,
        type: typeof raw.type === 'string' ? raw.type : 'SOS',
        test: isTest,
        sourceNode,
        active: isActive,
        resolved: isResolved,
        resolvedAt:
        typeof raw.resolvedAt === 'number' ? raw.resolvedAt : undefined,
        resolvedBy:
        typeof raw.resolvedBy === 'string' ? raw.resolvedBy : undefined,
        pushedAt:
          typeof raw.pushedAt === 'number' && Number.isFinite(raw.pushedAt)
            ? raw.pushedAt
            : undefined,
        bootIndex:
          typeof raw.bootIndex === 'number' && Number.isFinite(raw.bootIndex)
            ? raw.bootIndex
            : undefined,
        fw: raw.fw !== undefined ? String(raw.fw) : undefined,
        mode: typeof raw.mode === 'string' ? raw.mode : undefined,
        answeredBy:
          typeof raw.answeredBy === 'number' && Number.isFinite(raw.answeredBy)
            ? raw.answeredBy
            : 0,
        loc,
        sms,
        calls,
      };
    }

    /**
     * Lắng nghe Realtime node `/helmets/{deviceId}/sos`
     */
    export function subscribeToDeviceSosNode(
      deviceId: string,
      onSos: (sos: FirebaseSosEventRecord | null) => void,
      onError?: (err: Error & { code?: string }) => void
    ): () => void {
      const db = getFirebaseDatabase();
      if (!db) {
        onSos(null);
        return () => { };
      }

      const cleanId = normalizeDeviceId(deviceId);
      const sosRef = ref(db, `helmets/${cleanId}/sos`);

      return onValue(
        sosRef,
        (snapshot: DataSnapshot) => {
          if (!snapshot.exists() || typeof snapshot.val() !== 'object') {
            onSos(null);
            return;
          }
          const raw = snapshot.val() as Record<string, unknown>;
          const record = parseFirebaseSosEventRecord(
            cleanId,
            String(raw.id || 'latest_sos'),
            raw,
            'sos'
          );

          onSos(record);
        },
        (err: Error & { code?: string }) => {
          onError?.(err);
        }
      );
    }

    /**
     * Lắng nghe Realtime danh sách sự kiện tại `/helmets/{deviceId}/events` hoặc `/helmets/{deviceId}/testEvents`
     */
    export function subscribeToDeviceEventMap(
      deviceId: string,
      nodeName: 'events' | 'testEvents',
      onEvents: (records: FirebaseSosEventRecord[]) => void,
      onError?: (err: Error & { code?: string }) => void
    ): () => void {
      const db = getFirebaseDatabase();
      if (!db) {
        onEvents([]);
        return () => { };
      }

      const cleanId = normalizeDeviceId(deviceId);
      const eventsRef = ref(db, `helmets/${cleanId}/${nodeName}`);

      return onValue(
        eventsRef,
        (snapshot: DataSnapshot) => {
          if (!snapshot.exists() || typeof snapshot.val() !== 'object') {
            onEvents([]);
            return;
          }

          const rawMap = snapshot.val() as Record<string, unknown>;
          const records: FirebaseSosEventRecord[] = [];

          Object.entries(rawMap).forEach(([key, val]) => {
            if (val && typeof val === 'object') {
              records.push(
                parseFirebaseSosEventRecord(
                  cleanId,
                  key,
                  val as Record<string, unknown>,
                  nodeName
                )
              );
            }
          });

          records.sort((a, b) => (b.pushedAt || 0) - (a.pushedAt || 0));
          onEvents(records);
        },
        (err: Error & { code?: string }) => {
          onError?.(err);
        }
      );
    }

    /**
     * Xác nhận đã xử lý SOS (SOS Resolution) an toàn bằng Firebase Transaction.
     * - Kiểm tra chính xác `current.id === eventId` trước khi ghi `active=false, resolved=true, resolvedAt`
     *   để tuyệt đối KHÔNG đóng nhầm một SOS mới vừa phát sinh.
     * - Cập nhật trạng thái `resolved=true, resolvedAt` vào cả `/helmets/{deviceId}/events/{eventId}` mà KHÔNG xóa lịch sử sự cố.
     */
    export async function resolveSosIncidentTransaction(
      deviceId: string,
      eventId: string,
      resolvedBy: string = 'Người giám sát trên Web',
      customResolvedAt?: number
    ): Promise<{ committed: boolean; resolvedAt: number }> {
      const db = getFirebaseDatabase();
      if (!db) {
        throw new Error('Chưa kết nối Firebase Realtime Database.');
      }

      const cleanId = normalizeDeviceId(deviceId);
      const resolvedAt = customResolvedAt || Date.now();

      const sosRef = ref(db, `helmets/${cleanId}/sos`);
      const txResult = await runTransaction(sosRef, (currentData) => {
        if (!currentData || typeof currentData !== 'object') {
          return currentData;
        }
        const currentId = String((currentData as Record<string, unknown>).id || '');
        // Nếu trên node /sos đã là một Event ID khác mới hơn, hủy cập nhật trên /sos để không đóng nhầm SOS mới
        if (currentId && currentId !== eventId) {
          return; // Abort transaction on /sos
        }
        return {
          ...currentData,
          active: false,
          resolved: true,
          resolvedAt,
          resolvedBy,
        };
      });

      // Đồng thời cập nhật trạng thái đã xử lý vào bản ghi lịch sử `/helmets/{deviceId}/events/{eventId}` (nếu tồn tại)
      const eventHistoryRef = ref(db, `helmets/${cleanId}/events/${eventId}`);
      await runTransaction(eventHistoryRef, (currentEvent) => {
        if (!currentEvent || typeof currentEvent !== 'object') {
          return currentEvent;
        }
        return {
          ...currentEvent,
          active: false,
          resolved: true,
          resolvedAt,
          resolvedBy,
        };
      }).catch(() => { });

      // Đảm bảo tắt cờ `sosPending` trên `/helmets/{deviceId}/status` nếu đang bật
      await update(ref(db, `helmets/${cleanId}/status`), {
        sosPending: false,
      }).catch(() => { });

      return {
        committed: txResult.committed,
        resolvedAt,
      };
    }
