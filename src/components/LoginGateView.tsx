import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  registerFirebaseEmail,
  signInFirebaseEmail,
} from '../services/firebaseService';

interface LoginGateViewProps {
  onLoginSuccess?: (info: { email: string; fullName?: string }) => void;
}

export const LoginGateView: React.FC<LoginGateViewProps> = ({
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFriendlyErrorMessage = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : '';
    const lower = raw.toLowerCase();
    if (
      lower.includes('invalid-credential') ||
      lower.includes('wrong-password') ||
      lower.includes('user-not-found')
    ) {
      return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
    }
    if (lower.includes('email-already-in-use')) {
      return 'Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.';
    }
    if (lower.includes('weak-password')) {
      return 'Mật khẩu cần có ít nhất 6 ký tự.';
    }
    if (lower.includes('invalid-email')) {
      return 'Định dạng email không hợp lệ.';
    }
    if (lower.includes('too-many-requests')) {
      return 'Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.';
    }
    return raw || 'Đăng nhập không thành công. Vui lòng thử lại.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const cleanEmail = email.trim();
      if (mode === 'LOGIN') {
        await signInFirebaseEmail(cleanEmail, password);
        onLoginSuccess?.({ email: cleanEmail });
      } else {
        await registerFirebaseEmail(cleanEmail, password);
        onLoginSuccess?.({
          email: cleanEmail,
          fullName: fullName.trim() || undefined,
        });
      }
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[#E8E8E8] bg-white p-7 sm:p-8 shadow-[0_6px_24px_rgba(0,21,41,0.06)] space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1890FF] text-white font-bold text-base shadow-xs">
            SH
          </div>
          <h1 className="mt-4 text-xl font-bold text-zinc-900">
            {mode === 'LOGIN' ? 'Đăng nhập Smart Helmet' : 'Tạo tài khoản mới'}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {mode === 'LOGIN'
              ? 'Đăng nhập để vào trang quản lý và giám sát mũ bảo hiểm'
              : 'Đăng ký tài khoản để kết nối và theo dõi mũ bảo hiểm thông minh'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'REGISTER' && (
            <div>
              <label className="block text-zinc-700 font-semibold mb-1.5">
                Họ và tên
              </label>
              <input
                type="text"
                required
                disabled={busy}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên của bạn"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none transition"
              />
            </div>
          )}

          <div>
            <label className="block text-zinc-700 font-semibold mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-zinc-700 font-semibold mb-1.5">
              Mật khẩu
            </label>
            <input
              type="password"
              required
              disabled={busy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1890FF] py-3 text-xs font-semibold text-white hover:bg-[#40A9FF] disabled:opacity-50 transition shadow-2xs"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{mode === 'LOGIN' ? 'Đăng nhập' : 'Đăng ký tài khoản'}</span>
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="pt-4 border-t border-zinc-100 text-center text-xs text-zinc-500">
          {mode === 'LOGIN' ? (
            <>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setError(null);
                }}
                className="font-semibold text-blue-600 hover:underline"
              >
                Đăng ký mới
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setError(null);
                }}
                className="font-semibold text-blue-600 hover:underline"
              >
                Quay lại đăng nhập
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
