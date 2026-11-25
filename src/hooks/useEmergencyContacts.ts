import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  addEmergencyContactToFirebase,
  compareContactSyncWithDeviceStatus,
  deleteEmergencyContactFromFirebase,
  reorderEmergencyContactPriorityInFirebase,
  seedSampleContactsToFirebase,
  subscribeToContactSyncMetadata,
  subscribeToEmergencyContacts,
  syncContactsMetadataAndConfig,
  updateEmergencyContactInFirebase,
} from '../services/emergencyContactsService';
import {
  DEFAULT_HELMET_DEVICE_ID,
  isFirebaseConfigured,
  normalizeDeviceId,
} from '../services/firebaseService';
import {
  ContactSyncComparison,
  EmergencyContact,
  FirebaseHelmetTelemetry,
} from '../types/helmet';

export interface UseEmergencyContactsResult {
  contacts: EmergencyContact[];
  syncComparison: ContactSyncComparison;
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
  forceResyncContactsConfig: () => Promise<void>;
}

export function useEmergencyContacts(
  deviceId: string = DEFAULT_HELMET_DEVICE_ID,
  authUser: User | null = null,
  telemetry: FirebaseHelmetTelemetry | null = null
): UseEmergencyContactsResult {
  const cleanId = normalizeDeviceId(deviceId);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [webMeta, setWebMeta] = useState<{
    contactsUpdatedAt: number | null;
    configVersion: number | null;
    contactsInitialized: boolean;
  }>({
    contactsUpdatedAt: null,
    configVersion: null,
    contactsInitialized: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isFirebaseConfigured();

  useEffect(() => {
    setLoading(true);
    setError(null);
    setContacts([]);
    setWebMeta({
      contactsUpdatedAt: null,
      configVersion: null,
      contactsInitialized: false,
    });

    if (!configured) {
      setLoading(false);
      setError('Chưa cấu hình kết nối Firebase (.env).');
      return;
    }

    const unsubContacts = subscribeToEmergencyContacts(
      cleanId,
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
            'Chưa có quyền truy cập danh bạ trên Firebase (permission_denied). Vui lòng đăng nhập tài khoản hợp lệ.'
          );
        } else {
          setError(`Lỗi kết nối Firebase: ${msg}`);
        }
      }
    );

    const unsubMeta = subscribeToContactSyncMetadata(cleanId, (meta) => {
      setWebMeta(meta);
    });

    return () => {
      unsubContacts();
      unsubMeta();
    };
  }, [cleanId, configured, authUser?.uid]);

  const syncComparison = useMemo(
    () => compareContactSyncWithDeviceStatus(contacts, webMeta, telemetry),
    [contacts, webMeta, telemetry]
  );

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
      await addEmergencyContactToFirebase(cleanId, input, contacts);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi thêm người thân';
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
      await updateEmergencyContactInFirebase(cleanId, contact, contacts);
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
      await deleteEmergencyContactFromFirebase(cleanId, id, contacts);
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
        cleanId,
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
      await seedSampleContactsToFirebase(cleanId);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi khởi tạo danh bạ';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const forceResyncContactsConfig = async () => {
    setSaving(true);
    setError(null);
    try {
      if (contacts.length > 0) {
        await syncContactsMetadataAndConfig(cleanId, contacts);
      } else {
        await seedSampleContactsToFirebase(cleanId);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Lỗi khi đồng bộ lại cấu hình danh bạ';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    contacts,
    syncComparison,
    loading,
    saving,
    error,
    addContact,
    updateContact,
    deleteContact,
    reorderPriority,
    seedSampleContacts,
    forceResyncContactsConfig,
  };
}
