import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  addEmergencyContactToFirebase,
  deleteEmergencyContactFromFirebase,
  reorderEmergencyContactPriorityInFirebase,
  seedSampleContactsToFirebase,
  subscribeToEmergencyContacts,
  updateEmergencyContactInFirebase,
} from '../services/emergencyContactsService';
import {
  DEFAULT_HELMET_DEVICE_ID,
  isFirebaseConfigured,
} from '../services/firebaseService';
import { EmergencyContact } from '../types/helmet';

export interface UseEmergencyContactsResult {
  contacts: EmergencyContact[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  addContact: (input: {
    name: string;
    relationship: string;
    phone: string;
    smsEnabled: boolean;
    callEnabled: boolean;
  }) => Promise<void>;
  updateContact: (contact: EmergencyContact) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  reorderPriority: (id: string, direction: 'UP' | 'DOWN') => Promise<void>;
  seedSampleContacts: () => Promise<void>;
}

export function useEmergencyContacts(
  deviceId: string = DEFAULT_HELMET_DEVICE_ID,
  authUser: User | null = null
): UseEmergencyContactsResult {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isFirebaseConfigured();

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!configured) {
      setLoading(false);
      setError('Chưa cấu hình kết nối Firebase (.env).');
      return;
    }

    const unsubscribe = subscribeToEmergencyContacts(
      deviceId,
      (list) => {
        setContacts(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        const msg = err.message || 'Không thể tải danh bạ từ Firebase';
        if (
          err.code === 'PERMISSION_DENIED' ||
          msg.toLowerCase().includes('permission_denied') ||
          msg.toLowerCase().includes('permission denied')
        ) {
          setError(
            'Chưa có quyền truy cập danh bạ trên Firebase (permission_denied). Vui lòng đăng nhập tài khoản ở mục "Hồ sơ cá nhân".'
          );
        } else {
          setError(`Lỗi kết nối Firebase: ${msg}`);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [deviceId, configured, authUser?.uid]);

  const addContact = async (input: {
    name: string;
    relationship: string;
    phone: string;
    smsEnabled: boolean;
    callEnabled: boolean;
  }) => {
    setSaving(true);
    setError(null);
    try {
      await addEmergencyContactToFirebase(deviceId, input, contacts.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi thêm người thân';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const updateContact = async (contact: EmergencyContact) => {
    setSaving(true);
    setError(null);
    try {
      await updateEmergencyContactInFirebase(deviceId, contact);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi cập nhật người thân';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteEmergencyContactFromFirebase(deviceId, id, contacts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa người thân';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const reorderPriority = async (id: string, direction: 'UP' | 'DOWN') => {
    setSaving(true);
    setError(null);
    try {
      await reorderEmergencyContactPriorityInFirebase(
        deviceId,
        id,
        direction,
        contacts
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi đổi thứ tự ưu tiên';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const seedSampleContacts = async () => {
    setSaving(true);
    setError(null);
    try {
      await seedSampleContactsToFirebase(deviceId);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi khởi tạo danh bạ mẫu';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    contacts,
    loading,
    saving,
    error,
    addContact,
    updateContact,
    deleteContact,
    reorderPriority,
    seedSampleContacts,
  };
}
