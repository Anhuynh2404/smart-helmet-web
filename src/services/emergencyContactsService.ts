import {
  DataSnapshot,
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
 * Chuẩn hóa số điện thoại Việt Nam trước khi lưu lên Firebase cho ESP32:
 * - Xóa toàn bộ khoảng trắng, dấu gạch ngang, dấu chấm, dấu ngoặc
 * - Chuyển đầu số +84 hoặc 84 về 0 (VD: "+84 909 128 456" -> "0909128456")
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

  // Đầu số di động Việt Nam hợp lệ: 03x, 05x, 07x, 08x, 09x (tổng 10 chữ số)
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

/**
 * Chuyển đổi dữ liệu thô từ Firebase sang kiểu EmergencyContact chuẩn
 */
function mapRawContact(key: string, raw: Record<string, unknown>, fallbackPriority: number): EmergencyContact {
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
 * Lắng nghe danh sách người thân theo thời gian thực từ Firebase Realtime Database
 * Path: devices/{deviceId}/emergencyContacts
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

  const contactsRef = ref(db, `devices/${deviceId}/emergencyContacts`);

  return onValue(
    contactsRef,
    (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        onData([]);
        return;
      }

      const val = snapshot.val();
      const list: EmergencyContact[] = [];

      if (Array.isArray(val)) {
        val.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            list.push(mapRawContact(String(item.id || `contact_${idx + 1}`), item, idx + 1));
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
 * Cập nhật timestamp tổng ở node `devices/{deviceId}/contactsUpdatedAt`
 * giúp ESP32 dễ dàng kiểm tra phiên bản danh bạ mới nhất.
 */
async function touchContactsVersion(deviceId: string, timestamp: number) {
  const db = getFirebaseDatabase();
  if (!db) return;
  await set(ref(db, `devices/${deviceId}/contactsUpdatedAt`), timestamp);
}

/**
 * Thêm mới một người thân lên Firebase
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
  currentCount: number
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const now = Date.now();
  const id = `contact_${now}`;
  const normalizedPhone = normalizeVietnamPhone(input.phone);

  const payload = {
    id,
    priority: currentCount + 1,
    name: input.name.trim(),
    relationship: input.relationship.trim() || 'Người thân',
    phone: normalizedPhone,
    smsEnabled: Boolean(input.smsEnabled),
    callEnabled: Boolean(input.callEnabled),
    updatedAt: now,
  };

  await set(ref(db, `devices/${deviceId}/emergencyContacts/${id}`), payload);
  await touchContactsVersion(deviceId, now);
}

/**
 * Cập nhật thông tin người thân (Sửa hoặc Bật/Tắt nhanh SMS / Cuộc gọi)
 */
export async function updateEmergencyContactInFirebase(
  deviceId: string,
  contact: EmergencyContact
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const now = Date.now();
  const normalizedPhone = normalizeVietnamPhone(contact.phone);

  const payload = {
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
    ref(db, `devices/${deviceId}/emergencyContacts/${contact.id}`),
    payload
  );
  await touchContactsVersion(deviceId, now);
}

/**
 * Xóa người thân và tự động đánh lại thứ tự priority (1, 2, 3...) cho các mục còn lại
 */
export async function deleteEmergencyContactFromFirebase(
  deviceId: string,
  contactId: string,
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const now = Date.now();
  await remove(ref(db, `devices/${deviceId}/emergencyContacts/${contactId}`));

  const remaining = existingContacts
    .filter((c) => c.id !== contactId)
    .sort((a, b) => a.priority - b.priority);

  if (remaining.length > 0) {
    const updates: Record<string, unknown> = {};
    remaining.forEach((c, index) => {
      const newPriority = index + 1;
      if (c.priority !== newPriority) {
        updates[`${c.id}/priority`] = newPriority;
        updates[`${c.id}/updatedAt`] = now;
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db, `devices/${deviceId}/emergencyContacts`), updates);
    }
  }

  await touchContactsVersion(deviceId, now);
}

/**
 * Đổi thứ tự ưu tiên (↑ / ↓) giữa 2 người thân và đồng bộ atomic lên Firebase
 */
export async function reorderEmergencyContactPriorityInFirebase(
  deviceId: string,
  contactId: string,
  direction: 'UP' | 'DOWN',
  existingContacts: EmergencyContact[]
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

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

  sorted.forEach((c, index) => {
    const newPriority = index + 1;
    updates[`${c.id}/priority`] = newPriority;
    updates[`${c.id}/updatedAt`] = now;
  });

  await update(ref(db, `devices/${deviceId}/emergencyContacts`), updates);
  await touchContactsVersion(deviceId, now);
}

/**
 * Khởi tạo danh bạ mẫu chuẩn lên Firebase nếu node đang trống
 */
export async function seedSampleContactsToFirebase(
  deviceId: string
): Promise<void> {
  const db = getFirebaseDatabase();
  if (!db) throw new Error('Chưa kết nối Firebase');

  const now = Date.now();
  const sampleData = {
    contact_1: {
      id: 'contact_1',
      priority: 1,
      name: 'Huỳnh Minh Tuấn',
      relationship: 'Anh trai',
      phone: '0909128456',
      smsEnabled: true,
      callEnabled: true,
      updatedAt: now,
    },
    contact_2: {
      id: 'contact_2',
      priority: 2,
      name: 'Nguyễn Thị Lan',
      relationship: 'Mẹ',
      phone: '0918764321',
      smsEnabled: true,
      callEnabled: true,
      updatedAt: now,
    },
    contact_3: {
      id: 'contact_3',
      priority: 3,
      name: 'Trần Quốc Bảo',
      relationship: 'Bạn cùng phòng',
      phone: '0983551902',
      smsEnabled: true,
      callEnabled: false,
      updatedAt: now,
    },
  };

  await set(ref(db, `devices/${deviceId}/emergencyContacts`), sampleData);
  await touchContactsVersion(deviceId, now);
}
