import {
  DataSnapshot,
  get,
  onValue,
  ref,
  remove,
  set,
  update,
} from 'firebase/database';
import { EmergencyContact } from '../types/helmet';
import {
  DEFAULT_HELMET_DEVICE_ID,
  getFirebaseDatabase,
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
  if (cleaned.startsWith('84') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Chuyển số điện thoại sang chuẩn quốc tế E.164 (+84...) để đồng bộ trực tiếp xuống `status/contacts/p1` của ESP32
 * VD: "0376087754" -> "+84376087754"
 */
export function toE164VietnamPhone(raw: string): string {
  const norm = normalizeVietnamPhone(raw);
  if (norm.startsWith('0') && norm.length === 10) {
    return '+84' + norm.slice(1);
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
 * Đồng bộ danh sách số điện thoại ưu tiên (p1, p2, p3...) trực tiếp xuống
 * `/helmets/{deviceId}/status/contacts` và `/helmets/{deviceId}/config/contacts`
 * để thiết bị ESP32 cập nhật ngay số SOS mới khi người dùng Thêm / Sửa / Xóa / Đổi thứ tự trên Web.
 */
async function syncContactsToEspDevice(
  deviceId: string,
  contacts: EmergencyContact[]
) {
  const db = getFirebaseDatabase();
  if (!db) return;

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
  const now = Date.now();
  const sorted = [...contacts].sort((a, b) => a.priority - b.priority);

  const deviceContactsNode: Record<string, string> = {};
  sorted.forEach((c, idx) => {
    deviceContactsNode[`p${idx + 1}`] = toE164VietnamPhone(c.phone);
  });

  if (sorted.length === 0) {
    deviceContactsNode.p1 = '';
  }

  await Promise.all([
    set(ref(db, `helmets/${cleanId}/status/contacts`), deviceContactsNode),
    update(ref(db, `helmets/${cleanId}/config`), {
      contacts: deviceContactsNode,
      updatedAt: now,
    }),
    set(ref(db, `helmets/${cleanId}/contactsUpdatedAt`), now),
    set(ref(db, `helmets/${cleanId}/contactsInitialized`), true),
  ]);
}

/**
 * Lắng nghe danh sách người thân theo thời gian thực từ Firebase Realtime Database.
 * Nếu lần đầu chưa có danh sách trên Web nhưng trên ESP32 có số default (`status/contacts/p1`),
 * tự động nạp số default đó thành một người thân bình thường để người dùng có thể Sửa hoặc Xóa ngay.
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

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
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
            const espContactsSnap = await get(
              ref(db, `helmets/${cleanId}/status/contacts`)
            );
            if (espContactsSnap.exists()) {
              const espVal = espContactsSnap.val() as Record<string, unknown>;
              const p1Raw =
                typeof espVal?.p1 === 'string' ? espVal.p1.trim() : '';
              if (p1Raw) {
                const now = Date.now();
                const defaultId = 'contact_default_p1';
                const defaultContact: EmergencyContact = {
                  id: defaultId,
                  priority: 1,
                  name: 'Liên hệ mặc định',
                  relationship: 'SOS Thiết bị',
                  phone: normalizeVietnamPhone(p1Raw),
                  smsEnabled: true,
                  callEnabled: true,
                  updatedAt: now,
                  receiveSms: true,
                  receiveCall: true,
                  isVerified: true,
                };
                await set(
                  ref(db, `helmets/${cleanId}/emergencyContacts/${defaultId}`),
                  {
                    id: defaultContact.id,
                    priority: defaultContact.priority,
                    name: defaultContact.name,
                    relationship: defaultContact.relationship,
                    phone: defaultContact.phone,
                    smsEnabled: true,
                    callEnabled: true,
                    updatedAt: now,
                  }
                );
                await set(
                  ref(db, `helmets/${cleanId}/contactsInitialized`),
                  true
                );
                return;
              }
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
 * Thêm mới một người thân lên Firebase và đồng bộ ngay xuống thiết bị
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

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
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
  await syncContactsToEspDevice(cleanId, [...existingContacts, newContact]);
}

/**
 * Cập nhật thông tin người thân và đồng bộ ngay xuống thiết bị
 */
export async function updateEmergencyContactInFirebase(
  deviceId: string,
  contact: EmergencyContact,
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
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
  await syncContactsToEspDevice(cleanId, nextList);
}

/**
 * Xóa người thân, đánh lại priority (1, 2, 3...) và cập nhật ngay xuống thiết bị
 */
export async function deleteEmergencyContactFromFirebase(
  deviceId: string,
  contactId: string,
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
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

  await syncContactsToEspDevice(cleanId, remaining);
}

/**
 * Đổi thứ tự ưu tiên (↑ / ↓) giữa 2 người thân và đồng bộ ngay p1, p2... xuống thiết bị
 */
export async function reorderEmergencyContactPriorityInFirebase(
  deviceId: string,
  contactId: string,
  direction: 'UP' | 'DOWN',
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
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
  await syncContactsToEspDevice(cleanId, reordered);
}

/**
 * Khởi tạo danh bạ mẫu chuẩn lên Firebase nếu node đang trống
 */
export async function seedSampleContactsToFirebase(
  deviceId: string
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
  const now = Date.now();
  const list: EmergencyContact[] = [
    {
      id: 'contact_1',
      priority: 1,
      name: 'Huỳnh Minh Tuấn',
      relationship: 'Anh trai',
      phone: '0909128456',
      smsEnabled: true,
      callEnabled: true,
      updatedAt: now,
    },
    {
      id: 'contact_2',
      priority: 2,
      name: 'Nguyễn Thị Lan',
      relationship: 'Mẹ',
      phone: '0918764321',
      smsEnabled: true,
      callEnabled: true,
      updatedAt: now,
    },
    {
      id: 'contact_3',
      priority: 3,
      name: 'Trần Quốc Bảo',
      relationship: 'Bạn cùng phòng',
      phone: '0983551902',
      smsEnabled: true,
      callEnabled: false,
      updatedAt: now,
    },
  ];

  const sampleData: Record<string, EmergencyContact> = {};
  list.forEach((c) => {
    sampleData[c.id] = c;
  });

  await set(ref(db, `helmets/${cleanId}/emergencyContacts`), sampleData);
  await syncContactsToEspDevice(cleanId, list);
}
