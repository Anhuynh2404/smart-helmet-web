import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { MOCK_USERS } from '../mocks/mockData';
import {
  DEFAULT_HELMET_DEVICE_ID,
  isFirebaseConfigured,
} from '../services/firebaseService';
import {
  computeAvatarInitials,
  saveUserProfileToCloud,
  subscribeToCloudUserProfile,
} from '../services/userProfileService';
import { UserProfile } from '../types/helmet';

export interface UseUserProfileResult {
  profile: UserProfile;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveProfile: (updated: UserProfile) => Promise<UserProfile>;
  setLocalRoleOrUser: (user: UserProfile) => void;
}

export function useUserProfile(
  deviceId: string = DEFAULT_HELMET_DEVICE_ID,
  authUser: User | null = null
): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile>(() => ({
    ...MOCK_USERS[0],
    assignedDeviceId: deviceId,
  }));
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !authUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCloudUserProfile(
      deviceId,
      (cloudProfile) => {
        if (cloudProfile) {
          setProfile((prev) => ({
            ...cloudProfile,
            email: cloudProfile.email || authUser.email || prev.email,
          }));
        } else {
          // Nếu trên Cloud chưa có node profile, lấy email/displayName từ phiên đăng nhập
          setProfile((prev) => {
            const name = authUser.displayName || prev.fullName;
            return {
              ...prev,
              fullName: name,
              avatarInitials: computeAvatarInitials(name),
              email: authUser.email || prev.email,
              assignedDeviceId: deviceId,
            };
          });
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setError(err.message || 'Không thể tải hồ sơ từ Cloud.');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [deviceId, configured, authUser?.uid]);

  const saveProfile = async (updated: UserProfile): Promise<UserProfile> => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveUserProfileToCloud(deviceId, updated);
      setProfile(saved);
      return saved;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể lưu hồ sơ lên Cloud.';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const setLocalRoleOrUser = (user: UserProfile) => {
    setProfile(user);
  };

  return {
    profile,
    loading,
    saving,
    error,
    saveProfile,
    setLocalRoleOrUser,
  };
}
