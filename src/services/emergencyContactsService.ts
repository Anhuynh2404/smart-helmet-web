import {
  DataSnapshot,
  get,
  onValue,
  ref,
  remove,
  set,
  update,
} from 'firebase/database';
import {
  ContactSyncComparison,
  EmergencyContact,
  FirebaseContactChannelSlot,
  FirebaseHelmetTelemetry,
} from '../types/helmet';
import {
  DEFAULT_HELMET_DEVICE_ID,
  getFirebaseDatabase,
  normalizeDeviceId,
} from './firebaseService';

/**
 * Chuẩn hóa số điện thoại Việt Nam về dạng 10 số bắt đầu bằng 0:
 * VD: "+84 947 426 157" -> "0947426157"
 */
export function normalizeVietnamPhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+84')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('0084')) {
    return '0' + cleaned.slice(4);
  }
  if (cleaned.startsWith('84') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Chuyển số điện thoại sang chuẩn quốc tế E.164 (+84...) tương thích với ESP32 Firmware V2.4.2-dev
 * VD: "0376087754" -> "+84376087754"
 */
export function toE164VietnamPhone(raw: string): string {
  const norm = normalizeVietnamPhone(raw);
  if (norm.startsWith('0') && norm.length === 10) {
    return '+84' + norm.slice(1);
  }
  if (norm.startsWith('+')) {
    return norm;
  }
  return norm;
}

/**
 * Định dạng số điện thoại đã chuẩn hóa để hiển thị đẹp trên giao diện Web
 * VD: "0909128456" -> "0909 128 456"
 */
export function formatPhoneForDisplay(phone: string): string {
  const norm = normalizeVietnamPhone(phone);
  if (norm.length === 10) {
    return `${norm.slice(0, 4)} ${norm.slice(4, 7)} ${norm.slice(7)}`;
  }
  return phone;
}

/**
 * Kiểm tra tính hợp lệ của số điện thoại di động Việt Nam và kiểm tra trùng lặp
 */
export function validateEmergencyPhone(
  rawPhone: string,
  existingContacts: EmergencyContact[],
  editingId: string | null = null
): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeVietnamPhone(rawPhone);

  const vnMobileRegex = /^(0[35789])[0-9]{8}$/;
  if (!vnMobileRegex.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        'Số điện thoại không đúng định dạng di động Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09).',
    };
  }

  const isDuplicate = existingContacts.some(
    (c) =>
      c.id !== editingId && normalizeVietnamPhone(c.phone) === normalized
  );
  if (isDuplicate) {
    return {
      valid: false,
      normalized,
      error: 'Số điện thoại này đã tồn tại trong danh sách người thân.',
    };
  }

  return { valid: true, normalized };
}

function mapRawContact(
  key: string,
  raw: Record<string, unknown>,
  fallbackPriority: number
): EmergencyContact {
  const smsEnabled =
    typeof raw.smsEnabled === 'boolean'
      ? raw.smsEnabled
      : typeof raw.receiveSms === 'boolean'
      ? raw.receiveSms
      : true;

  const callEnabled =
    typeof raw.callEnabled === 'boolean'
      ? raw.callEnabled
      : typeof raw.receiveCall === 'boolean'
      ? raw.receiveCall
      : true;

  const phone = normalizeVietnamPhone(String(raw.phone || ''));
  const priority =
    typeof raw.priority === 'number' && Number.isFinite(raw.priority)
      ? raw.priority
      : fallbackPriority;
  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now();

  return {
    id: String(raw.id || key),
    priority,
    name: String(raw.name || 'Người thân'),
    relationship: String(raw.relationship || 'Người thân'),
    phone,
    smsEnabled,
    callEnabled,
    updatedAt,
    receiveSms: smsEnabled,
    receiveCall: callEnabled,
    isVerified: true,
  };
}

/**
 * Đồng bộ cấu hình danh bạ chính thức xuống `/helmets/{deviceId}/config`,
 * `/helmets/{deviceId}/contactsUpdatedAt`, và `/helmets/{deviceId}/contactsInitialized`
 * một cách nhất quán với Firmware SmartHelmet V2.4.2-dev.
 * TUYỆT ĐỐI KHÔNG ghi đè trực tiếp vào `/helmets/{deviceId}/status` (nhánh của ESP32).
 */
export async function syncContactsMetadataAndConfig(
  deviceId: string,
  contacts: EmergencyContact[],
  customTimestamp?: number
): Promise<{ contactsUpdatedAt: number; configVersion: number }> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const now = customTimestamp || Date.now();
  const sorted = [...contacts]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);

  const deviceContactsNode: Record<string, string> = {};
  const contactChannelsNode: Record<string, FirebaseContactChannelSlot> = {};

  sorted.forEach((c, idx) => {
    const slotKey = `p${idx + 1}`;
    deviceContactsNode[slotKey] = toE164VietnamPhone(c.phone);
    contactChannelsNode[slotKey] = {
      priority: idx + 1,
      smsEnabled: Boolean(c.smsEnabled ?? c.receiveSms ?? true),
      callEnabled: Boolean(c.callEnabled ?? c.receiveCall ?? true),
    };
  });

  // Đọc configVersion hiện tại từ /config và /status để tăng nhất quán
  let currentMaxVersion = 0;
  try {
    const [cfgSnap, statusVerSnap] = await Promise.all([
      get(ref(db, `helmets/${cleanId}/config`)),
      get(ref(db, `helmets/${cleanId}/status/configVersion`)),
    ]);
    if (cfgSnap.exists() && typeof cfgSnap.val() === 'object') {
      const cfgVal = cfgSnap.val() as Record<string, unknown>;
      const v1 = Number(cfgVal.configVersion) || 0;
      const v2 = Number(cfgVal.version) || 0;
      currentMaxVersion = Math.max(currentMaxVersion, v1, v2);
    }
    if (statusVerSnap.exists()) {
      const sv = Number(statusVerSnap.val()) || 0;
      currentMaxVersion = Math.max(currentMaxVersion, sv);
    }
  } catch {
    // Fallback if read fails
  }

  const nextConfigVersion = currentMaxVersion + 1;

  await Promise.all([
    set(ref(db, `helmets/${cleanId}/contactsUpdatedAt`), now),
    set(ref(db, `helmets/${cleanId}/contactsInitialized`), true),
    update(ref(db, `helmets/${cleanId}/config`), {
      configVersion: nextConfigVersion,
      version: nextConfigVersion,
      contacts: deviceContactsNode,
      contactChannels: contactChannelsNode,
      contactsUpdatedAt: now,
      updatedAt: now,
    }),
  ]);

  return { contactsUpdatedAt: now, configVersion: nextConfigVersion };
}

/**
 * Khởi tạo nguồn `emergencyContacts` chính thức từ dữ liệu `status/contacts` và `status/contactChannels`
 * của thiết bị (hữu ích khi thiết bị mới như `helmet01_phase34` đang chạy danh bạ từ NVS nhưng chưa có node `emergencyContacts` trên Firebase).
 */
export async function importContactsFromDeviceStatus(
  deviceId: string
): Promise<EmergencyContact[]> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const statusSnap = await get(ref(db, `helmets/${cleanId}/status`));
  if (!statusSnap.exists() || typeof statusSnap.val() !== 'object') {
    return [];
  }

  const statusVal = statusSnap.val() as Record<string, unknown>;
  const rawContacts =
    statusVal.contacts && typeof statusVal.contacts === 'object'
      ? (statusVal.contacts as Record<string, unknown>)
      : {};
  const rawChannels =
    statusVal.contactChannels && typeof statusVal.contactChannels === 'object'
      ? (statusVal.contactChannels as Record<string, unknown>)
      : {};

  // Kiểm tra xem helmet01 có tên người thân cho cùng số điện thoại không để tự động gán tên thân thiện
  const phoneNameDirectory = new Map<
    string,
    { name: string; relationship: string }
  >();
  try {
    const refContactsSnap = await get(
      ref(db, 'helmets/helmet01/emergencyContacts')
    );
    if (refContactsSnap.exists() && typeof refContactsSnap.val() === 'object') {
      Object.values(
        refContactsSnap.val() as Record<string, Record<string, unknown>>
      ).forEach((item) => {
        if (item && typeof item.phone === 'string') {
          phoneNameDirectory.set(normalizeVietnamPhone(item.phone), {
            name: String(item.name || 'Người thân'),
            relationship: String(item.relationship || 'Người thân'),
          });
        }
      });
    }
  } catch {
    // Ignore cross-device lookup error
  }

  const now =
    typeof statusVal.contactsUpdatedAt === 'number' &&
    statusVal.contactsUpdatedAt > 0
      ? statusVal.contactsUpdatedAt
      : Date.now();

  const importedList: EmergencyContact[] = [];
  for (let i = 1; i <= 5; i++) {
    const slotKey = `p${i}`;
    const rawPhone =
      typeof rawContacts[slotKey] === 'string'
        ? String(rawContacts[slotKey]).trim()
        : '';
    if (!rawPhone) continue;

    const normPhone = normalizeVietnamPhone(rawPhone);
    const ch =
      rawChannels[slotKey] && typeof rawChannels[slotKey] === 'object'
        ? (rawChannels[slotKey] as Record<string, unknown>)
        : {};
    const smsEnabled =
      typeof ch.smsEnabled === 'boolean' ? ch.smsEnabled : true;
    const callEnabled =
      typeof ch.callEnabled === 'boolean' ? ch.callEnabled : true;
    const priority =
      typeof ch.priority === 'number' && Number.isFinite(ch.priority)
        ? ch.priority
        : importedList.length + 1;

    const knownInfo = phoneNameDirectory.get(normPhone);
    const id = `contact_slot_p${i}`;

    importedList.push({
      id,
      priority,
      name: knownInfo?.name || `Liên hệ SOS #${i}`,
      relationship: knownInfo?.relationship || `Ưu tiên #${i} trên thiết bị`,
      phone: normPhone,
      smsEnabled,
      callEnabled,
      updatedAt: now,
      receiveSms: smsEnabled,
      receiveCall: callEnabled,
      isVerified: true,
    });
  }

  if (importedList.length > 0) {
    const contactsPayload: Record<string, unknown> = {};
    importedList.forEach((c) => {
      contactsPayload[c.id] = {
        id: c.id,
        priority: c.priority,
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        smsEnabled: c.smsEnabled,
        callEnabled: c.callEnabled,
        updatedAt: c.updatedAt,
      };
    });

    await set(
      ref(db, `helmets/${cleanId}/emergencyContacts`),
      contactsPayload
    );
    await syncContactsMetadataAndConfig(cleanId, importedList, now);
  }

  return importedList;
}

/**
 * Lắng nghe danh sách người thân theo thời gian thực từ `/helmets/{deviceId}/emergencyContacts`.
 * Nếu thiết bị chưa có `emergencyContacts` nhưng trong `status/contacts` đã có các slot `p1..p5`,
 * tự động khởi tạo nguồn `emergencyContacts` chính thức cho thiết bị.
 */
export function subscribeToEmergencyContacts(
  deviceId: string = DEFAULT_HELMET_DEVICE_ID,
  onData: (contacts: EmergencyContact[]) => void,
  onError: (err: Error & { code?: string }) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    const err = new Error(
      'Chưa cấu hình kết nối Firebase (.env).'
    ) as Error & { code?: string };
    err.code = 'CONFIG_MISSING';
    onError(err);
    return () => {};
  }

  const cleanId = normalizeDeviceId(deviceId);
  const contactsRef = ref(db, `helmets/${cleanId}/emergencyContacts`);

  return onValue(
    contactsRef,
    async (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        try {
          const initSnap = await get(
            ref(db, `helmets/${cleanId}/contactsInitialized`)
          );
          if (!initSnap.exists()) {
            const imported = await importContactsFromDeviceStatus(cleanId);
            if (imported.length > 0) {
              return; // onValue will fire immediately with imported contacts
            }
          }
        } catch {
          // Ignore fallback seed check error
        }

        onData([]);
        return;
      }

      const val = snapshot.val();
      const list: EmergencyContact[] = [];

      if (Array.isArray(val)) {
        val.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            list.push(
              mapRawContact(
                String(item.id || `contact_${idx + 1}`),
                item,
                idx + 1
              )
            );
          }
        });
      } else if (val && typeof val === 'object') {
        Object.entries(val).forEach(([key, item], idx) => {
          if (item && typeof item === 'object') {
            list.push(
              mapRawContact(key, item as Record<string, unknown>, idx + 1)
            );
          }
        });
      }

      list.sort((a, b) => a.priority - b.priority);
      onData(list);
    },
    (error: Error & { code?: string }) => {
      onError(error);
    }
  );
}

/**
 * Lắng nghe metadata đồng bộ (`contactsUpdatedAt` và `config/configVersion`) của thiết bị
 */
export function subscribeToContactSyncMetadata(
  deviceId: string,
  onMeta: (meta: {
    contactsUpdatedAt: number | null;
    configVersion: number | null;
    contactsInitialized: boolean;
  }) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    onMeta({
      contactsUpdatedAt: null,
      configVersion: null,
      contactsInitialized: false,
    });
    return () => {};
  }

  const cleanId = normalizeDeviceId(deviceId);
  let contactsUpdatedAt: number | null = null;
  let configVersion: number | null = null;
  let contactsInitialized = false;

  const emit = () => {
    onMeta({ contactsUpdatedAt, configVersion, contactsInitialized });
  };

  const unsubTs = onValue(
    ref(db, `helmets/${cleanId}/contactsUpdatedAt`),
    (snap) => {
      const val = Number(snap.val());
      contactsUpdatedAt = Number.isFinite(val) && val > 0 ? val : null;
      emit();
    },
    () => {}
  );

  const unsubInit = onValue(
    ref(db, `helmets/${cleanId}/contactsInitialized`),
    (snap) => {
      contactsInitialized = snap.val() === true;
      emit();
    },
    () => {}
  );

  const unsubCfg = onValue(
    ref(db, `helmets/${cleanId}/config`),
    (snap) => {
      if (snap.exists() && typeof snap.val() === 'object') {
        const raw = snap.val() as Record<string, unknown>;
        const ver = Number(raw.configVersion ?? raw.version);
        configVersion = Number.isFinite(ver) && ver >= 0 ? ver : null;
      } else {
        configVersion = null;
      }
      emit();
    },
    () => {}
  );

  return () => {
    unsubTs();
    unsubInit();
    unsubCfg();
  };
}

/**
 * So sánh `contactsUpdatedAt`, `configVersion`, danh sách SĐT + kênh liên lạc trên Web
 * với trạng thái thực tế trong `/helmets/{deviceId}/status` của Firmware V2.4.2-dev
 * để kết luận chính xác `Synced` hay `Pending Sync`.
 */
export function compareContactSyncWithDeviceStatus(
  contacts: EmergencyContact[],
  webMeta: {
    contactsUpdatedAt: number | null;
    configVersion: number | null;
    contactsInitialized: boolean;
  },
  telemetry: FirebaseHelmetTelemetry | null
): ContactSyncComparison {
  const deviceContactsUpdatedAt =
    typeof telemetry?.contactsUpdatedAt === 'number'
      ? telemetry.contactsUpdatedAt
      : null;
  const deviceConfigVersion =
    telemetry?.configVersion !== undefined &&
    Number.isFinite(Number(telemetry.configVersion))
      ? Number(telemetry.configVersion)
      : null;
  const contactConfigVerified = telemetry?.contactConfigVerified === true;
  const contactSource =
    typeof telemetry?.contactSource === 'string'
      ? telemetry.contactSource
      : null;
  const activeContactCount =
    typeof telemetry?.activeContactCount === 'number'
      ? telemetry.activeContactCount
      : telemetry?.contacts
      ? Object.values(telemetry.contacts).filter(
          (v) => typeof v === 'string' && v.trim() !== ''
        ).length
      : 0;

  if (!telemetry) {
    return {
      isSynced: false,
      statusLabel: 'Pending Sync',
      webContactsUpdatedAt: webMeta.contactsUpdatedAt,
      deviceContactsUpdatedAt: null,
      webConfigVersion: webMeta.configVersion,
      deviceConfigVersion: null,
      contactConfigVerified: false,
      contactSource: null,
      activeContactCount: 0,
      reason: 'Chưa nhận được dữ liệu status từ thiết bị',
    };
  }

  // Kiểm tra khớp danh sách số điện thoại và kênh SMS/Call giữa emergencyContacts và status
  const sortedWeb = [...contacts]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
  let allSlotsMatch = sortedWeb.length === activeContactCount && sortedWeb.length > 0;

  for (let i = 0; i < sortedWeb.length; i++) {
    const slotKey = `p${i + 1}`;
    const webPhoneE164 = toE164VietnamPhone(sortedWeb[i].phone);
    const devPhoneRaw =
      telemetry.contacts && typeof telemetry.contacts[slotKey] === 'string'
        ? String(telemetry.contacts[slotKey]).trim()
        : '';
    if (toE164VietnamPhone(devPhoneRaw) !== webPhoneE164) {
      allSlotsMatch = false;
      break;
    }

    const devCh = telemetry.contactChannels?.[slotKey];
    if (devCh) {
      const webSms = Boolean(sortedWeb[i].smsEnabled ?? true);
      const webCall = Boolean(sortedWeb[i].callEnabled ?? true);
      if (
        (typeof devCh.smsEnabled === 'boolean' && devCh.smsEnabled !== webSms) ||
        (typeof devCh.callEnabled === 'boolean' && devCh.callEnabled !== webCall)
      ) {
        allSlotsMatch = false;
        break;
      }
    }
  }

  const timestampMatches =
    webMeta.contactsUpdatedAt !== null &&
    deviceContactsUpdatedAt !== null &&
    webMeta.contactsUpdatedAt === deviceContactsUpdatedAt;

  const timestampDeviceNewerOrEqual =
    webMeta.contactsUpdatedAt !== null &&
    deviceContactsUpdatedAt !== null &&
    deviceContactsUpdatedAt >= webMeta.contactsUpdatedAt;

  // Nếu firmware báo contactConfigVerified === false (VD: NVS/unverified hoặc config missing/invalid)
  if (telemetry.contactConfigVerified === false) {
    return {
      isSynced: false,
      statusLabel: 'Pending Sync',
      webContactsUpdatedAt: webMeta.contactsUpdatedAt,
      deviceContactsUpdatedAt,
      webConfigVersion: webMeta.configVersion,
      deviceConfigVersion,
      contactConfigVerified: false,
      contactSource,
      activeContactCount,
      reason: `Thiết bị báo chưa xác thực cấu hình (${
        contactSource || 'NVS/unverified'
      } • ${telemetry.configNote || 'chờ ESP32 đọc emergencyContacts'})`,
    };
  }

  if (
    allSlotsMatch &&
    (timestampMatches ||
      timestampDeviceNewerOrEqual ||
      contactConfigVerified)
  ) {
    return {
      isSynced: true,
      statusLabel: 'Synced',
      webContactsUpdatedAt: webMeta.contactsUpdatedAt,
      deviceContactsUpdatedAt,
      webConfigVersion: webMeta.configVersion,
      deviceConfigVersion,
      contactConfigVerified: true,
      contactSource: contactSource || 'emergencyContacts',
      activeContactCount,
      reason: `Đã đồng bộ (${activeContactCount} liên hệ • nguồn: ${
        contactSource || 'emergencyContacts'
      })`,
    };
  }

  return {
    isSynced: false,
    statusLabel: 'Pending Sync',
    webContactsUpdatedAt: webMeta.contactsUpdatedAt,
    deviceContactsUpdatedAt,
    webConfigVersion: webMeta.configVersion,
    deviceConfigVersion,
    contactConfigVerified,
    contactSource,
    activeContactCount,
    reason: !allSlotsMatch
      ? 'Danh bạ trên Web vừa thay đổi, đang chờ ESP32 đồng bộ ở chu kỳ kế tiếp'
      : 'Timestamp danh bạ trên Web mới hơn trạng thái báo cáo của ESP32',
  };
}

/**
 * Thêm mới một người thân lên Firebase và cập nhật metadata đồng bộ
 */
export async function addEmergencyContactToFirebase(
  deviceId: string,
  input: {
    name: string;
    relationship: string;
    phone: string;
    smsEnabled: boolean;
    callEnabled: boolean;
  },
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const now = Date.now();
  const id = `contact_${now}`;
  const normalizedPhone = normalizeVietnamPhone(input.phone);
  const newPriority = existingContacts.length + 1;

  const newContact: EmergencyContact = {
    id,
    priority: newPriority,
    name: input.name.trim(),
    relationship: input.relationship.trim() || 'Người thân',
    phone: normalizedPhone,
    smsEnabled: Boolean(input.smsEnabled),
    callEnabled: Boolean(input.callEnabled),
    updatedAt: now,
  };

  await set(
    ref(db, `helmets/${cleanId}/emergencyContacts/${id}`),
    newContact
  );
  await syncContactsMetadataAndConfig(
    cleanId,
    [...existingContacts, newContact],
    now
  );
}

/**
 * Cập nhật thông tin người thân và cập nhật metadata đồng bộ
 */
export async function updateEmergencyContactInFirebase(
  deviceId: string,
  contact: EmergencyContact,
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const now = Date.now();
  const normalizedPhone = normalizeVietnamPhone(contact.phone);

  const updated: EmergencyContact = {
    id: contact.id,
    priority: contact.priority,
    name: contact.name.trim(),
    relationship: contact.relationship.trim() || 'Người thân',
    phone: normalizedPhone,
    smsEnabled: Boolean(contact.smsEnabled),
    callEnabled: Boolean(contact.callEnabled),
    updatedAt: now,
  };

  await set(
    ref(db, `helmets/${cleanId}/emergencyContacts/${contact.id}`),
    updated
  );

  const nextList = existingContacts.map((c) =>
    c.id === updated.id ? updated : c
  );
  await syncContactsMetadataAndConfig(cleanId, nextList, now);
}

/**
 * Xóa người thân, đánh lại priority (1, 2, 3...) và cập nhật metadata đồng bộ
 */
export async function deleteEmergencyContactFromFirebase(
  deviceId: string,
  contactId: string,
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const now = Date.now();
  await remove(ref(db, `helmets/${cleanId}/emergencyContacts/${contactId}`));

  const remaining = existingContacts
    .filter((c) => c.id !== contactId)
    .sort((a, b) => a.priority - b.priority)
    .map((c, index) => ({
      ...c,
      priority: index + 1,
      updatedAt: now,
    }));

  if (remaining.length > 0) {
    const updates: Record<string, unknown> = {};
    remaining.forEach((c) => {
      updates[`${c.id}/priority`] = c.priority;
      updates[`${c.id}/updatedAt`] = now;
    });
    await update(ref(db, `helmets/${cleanId}/emergencyContacts`), updates);
  }

  await syncContactsMetadataAndConfig(cleanId, remaining, now);
}

/**
 * Đổi thứ tự ưu tiên (↑ / ↓) giữa 2 người thân và cập nhật metadata đồng bộ
 */
export async function reorderEmergencyContactPriorityInFirebase(
  deviceId: string,
  contactId: string,
  direction: 'UP' | 'DOWN',
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const sorted = [...existingContacts].sort((a, b) => a.priority - b.priority);
  const idx = sorted.findIndex((c) => c.id === contactId);
  if (idx === -1) return;

  const swapIdx = direction === 'UP' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  const temp = sorted[idx];
  sorted[idx] = sorted[swapIdx];
  sorted[swapIdx] = temp;

  const now = Date.now();
  const updates: Record<string, unknown> = {};
  const reordered = sorted.map((c, index) => {
    const newPriority = index + 1;
    updates[`${c.id}/priority`] = newPriority;
    updates[`${c.id}/updatedAt`] = now;
    return { ...c, priority: newPriority, updatedAt: now };
  });

  await update(ref(db, `helmets/${cleanId}/emergencyContacts`), updates);
  await syncContactsMetadataAndConfig(cleanId, reordered, now);
}

/**
 * Khởi tạo danh bạ từ trạng thái thiết bị (hoặc danh bạ mẫu nếu thiết bị trống)
 */
export async function seedSampleContactsToFirebase(
  deviceId: string
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = normalizeDeviceId(deviceId);
  const imported = await importContactsFromDeviceStatus(cleanId);
  if (imported.length > 0) {
    return;
  }

  const now = Date.now();
  const list: EmergencyContact[] = [
    {
      id: 'contact_1',
      priority: 1,
      name: 'AnHC',
      relationship: 'Bố',
      phone: '0559155754',
      smsEnabled: true,
      callEnabled: true,
      updatedAt: now,
    },
    {
      id: 'contact_2',
      priority: 2,
      name: 'Người thân 2',
      relationship: 'Mẹ',
      phone: '0376087754',
      smsEnabled: true,
      callEnabled: true,
      updatedAt: now,
    },
  ];

  const sampleData: Record<string, EmergencyContact> = {};
  list.forEach((c) => {
    sampleData[c.id] = c;
  });

  await set(ref(db, `helmets/${cleanId}/emergencyContacts`), sampleData);
  await syncContactsMetadataAndConfig(cleanId, list, now);
}
