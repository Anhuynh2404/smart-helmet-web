import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, LogOut } from 'lucide-react';
import { signOutFirebase } from '../services/firebaseService';
import { UserProfile, UserRole } from '../types/helmet';

interface AuthProfileViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onSelectUser: (user: UserProfile) => void;
  onSaveProfileToCloud: (updated: UserProfile) => Promise<void>;
  onLoggedOut: () => void;
}

export const AuthProfileView: React.FC<AuthProfileViewProps> = ({
  currentUser,
  allUsers,
  loading = false,
  saving = false,
  error = null,
  onSelectUser,
  onSaveProfileToCloud,
  onLoggedOut,
}) => {
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [bloodType, setBloodType] = useState(currentUser.bloodType || 'O+');
  const [medicalNotes, setMedicalNotes] = useState(
    currentUser.medicalNotes || ''
  );
  const [savedBanner, setSavedBanner] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Đồng bộ dữ liệu vào các ô input khi Cloud trả về dữ liệu mới
  useEffect(() => {
    setFullName(currentUser.fullName);
    setEmail(currentUser.email);
    setPhone(currentUser.phone);
    setBloodType(currentUser.bloodType || 'O+');
    setMedicalNotes(currentUser.medicalNotes || '');
  }, [
    currentUser.fullName,
    currentUser.email,
    currentUser.phone,
    currentUser.bloodType,
    currentUser.medicalNotes,
  ]);

  const handleLogout = async () => {
    await signOutFirebase();
    onLoggedOut();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSavedBanner(false);

    if (!fullName.trim()) {
      setLocalError('Vui lòng nhập họ và tên.');
      return;
    }

    try {
      await onSaveProfileToCloud({
        ...currentUser,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        bloodType: bloodType.trim(),
        medicalNotes: medicalNotes.trim(),
      });
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể lưu thông tin hồ sơ lên Cloud.';
      setLocalError(msg);
    }
  };

  const roleLabels: Record<UserRole, string> = {
    OWNER: 'Chủ mũ bảo hiểm',
    EMERGENCY_CONTACT: 'Người thân gia đình',
    ADMIN: 'Quản trị viên',
  };

  return (
    <div className="w-full space-y-4">
      {/* PERSONAL PROFILE & EMERGENCY INFO CARD */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-bold text-sm border border-blue-100">
              {currentUser.avatarInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900">
                  {currentUser.fullName}
                </h2>
                {loading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {roleLabels[currentUser.role]}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>

        {(error || localError) && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{localError || error}</span>
          </div>
        )}

        {savedBanner && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>Đã lưu và đồng bộ thông tin hồ sơ lên Cloud thành công.</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-zinc-600 font-medium mb-1.5">
                Họ và tên
              </label>
              <input
                type="text"
                required
                disabled={saving}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/40 px-3.5 py-2.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                disabled={saving}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/40 px-3.5 py-2.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1.5">
                Số điện thoại
              </label>
              <input
                type="text"
                disabled={saving}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/40 px-3.5 py-2.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1.5">
                Nhóm máu
              </label>
              <input
                type="text"
                disabled={saving}
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/40 px-3.5 py-2.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-600 font-medium mb-1.5">
              Ghi chú y tế / Thông tin hỗ trợ
            </label>
            <textarea
              rows={2}
              disabled={saving}
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/40 p-3.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1890FF] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#40A9FF] disabled:opacity-50 transition shadow-2xs"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? 'Đang lưu lên Cloud...' : 'Lưu hồ sơ'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Role Switcher */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">
            Chuyển đổi góc nhìn tài khoản
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Xem thử giao diện với quyền của chủ mũ bảo hiểm hoặc người thân trong gia đình
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 pt-1">
          {allUsers.map((u) => {
            const active = u.role === currentUser.role;
            return (
              <button
                key={u.id}
                onClick={() => {
                  onSelectUser({
                    ...currentUser,
                    role: u.role,
                  });
                }}
                className={`rounded-lg border p-3.5 text-left transition ${
                  active
                    ? 'border-[#1890FF] bg-[#E6F7FF] text-[#0050B3]'
                    : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <div className="text-xs font-semibold">
                  {roleLabels[u.role]}
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    active ? 'text-[#1890FF]' : 'text-zinc-500'
                  }`}
                >
                  {u.role === 'OWNER'
                    ? 'Toàn quyền quản lý & cài đặt'
                    : u.role === 'EMERGENCY_CONTACT'
                    ? 'Quyền xem & theo dõi vị trí'
                    : 'Quản trị hệ thống'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
