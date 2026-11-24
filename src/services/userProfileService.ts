import { updateProfile } from 'firebase/auth';
import { DataSnapshot, onValue, ref, set } from 'firebase/database';
import { UserProfile, UserRole } from '../types/helmet';
import {
  DEFAULT_HELMET_DEVICE_ID,
  getFirebaseAuth,
  getFirebaseDatabase,
} from './firebaseService';

export function computeAvatarInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CB';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (
    (words[words.length - 2][0] || '') + (words[words.length - 1][0] || '')
  ).toUpperCase();
}

/**
 * Lắng nghe dữ liệu hồ sơ người dùng theo thời gian thực từ Cloud (Firebase Realtime Database)
 * Path: devices/{deviceId}/profile
 */
export function subscribeToCloudUserProfile(
  deviceId: string = DEFAULT_HELMET_DEVICE_ID,
  onData: (profile: UserProfile | null) => void,
  onError: (err: Error & { code?: string }) => void
): () => void {
  const db = getFirebaseDatabase();
  if (!db) {
    onData(null);
    return () => {};
  }

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
  const profileRef = ref(db, `helmets/${cleanId}/webProfile`);

  return onValue(
    profileRef,
    (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      const raw = snapshot.val() as Record<string, unknown>;
      const fullName = String(raw.fullName || 'Huỳnh Công An');
      const role = (raw.role as UserRole) || 'OWNER';

      const mapped: UserProfile = {
        id: String(raw.id || 'USR-01'),
        fullName,
        email: String(raw.email || ''),
        phone: String(raw.phone || ''),
        role,
        avatarInitials:
          String(raw.avatarInitials || '') || computeAvatarInitials(fullName),
        assignedDeviceId: String(raw.assignedDeviceId || deviceId),
        bloodType: String(raw.bloodType || 'O+'),
        medicalNotes: String(raw.medicalNotes || ''),
      };

      onData(mapped);
    },
    (error: Error & { code?: string }) => {
      onError(error);
    }
  );
}

/**
 * Lưu thông tin hồ sơ cá nhân lên Cloud (Firebase Realtime Database + Firebase Auth DisplayName)
 * Path: devices/{deviceId}/profile
 */
export async function saveUserProfileToCloud(
  deviceId: string,
  profile: UserProfile
): Promise<UserProfile> {
  const db = getFirebaseDatabase();
  if (!db) {
    throw new Error('Chưa kết nối được với Cloud.');
  }

  const auth = getFirebaseAuth();
  const cleanName = profile.fullName.trim() || 'Người dùng';
  const initials = computeAvatarInitials(cleanName);

  const updatedProfile: UserProfile = {
    ...profile,
    fullName: cleanName,
    email: profile.email.trim(),
    phone: profile.phone.trim(),
    bloodType: (profile.bloodType || 'O+').trim(),
    medicalNotes: (profile.medicalNotes || '').trim(),
    avatarInitials: initials,
    assignedDeviceId: deviceId,
  };

  const payload = {
    ...updatedProfile,
    updatedByUid: auth?.currentUser?.uid || null,
    updatedAt: Date.now(),
  };

  const cleanId = deviceId === 'helmet-001' ? 'helmet01' : deviceId;
  await set(ref(db, `helmets/${cleanId}/webProfile`), payload);

  // Đồng bộ luôn displayName lên tài khoản Auth hiện tại (nếu có)
  if (auth?.currentUser) {
    try {
      await updateProfile(auth.currentUser, { displayName: cleanName });
    } catch {
      // Bỏ qua nếu không cần thiết
    }
  }

  return updatedProfile;
}
