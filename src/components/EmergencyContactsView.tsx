import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { formatToVietnamTimezone } from '../hooks/useHelmetTelemetry';
import {
  formatPhoneForDisplay,
  validateEmergencyPhone,
} from '../services/emergencyContactsService';
import {
  ContactSyncComparison,
  EmergencyContact,
  FirebaseHelmetTelemetry,
  UserRole,
} from '../types/helmet';
import { formatFriendlyDeviceName } from './DashboardView';

interface EmergencyContactsViewProps {
  deviceId: string;
  contacts: EmergencyContact[];
  telemetry: FirebaseHelmetTelemetry | null;
  syncComparison: ContactSyncComparison;
  loading: boolean;
  saving: boolean;
  error: string | null;
  currentUserRole: UserRole;
  onAddContact: (contact: {
    name: string;
    relationship: string;
    phone: string;
    smsEnabled: boolean;
    callEnabled: boolean;
  }) => Promise<void>;
  onUpdateContact: (contact: EmergencyContact) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onReorderPriority: (id: string, direction: 'UP' | 'DOWN') => Promise<void>;
  onSeedSampleContacts: () => Promise<void>;
  onForceResync: () => Promise<void>;
}

function cleanTimeText(raw: string): string {
  return raw.replace(/\s*\(UTC\+7\)/g, '').trim();
}

export const EmergencyContactsView: React.FC<EmergencyContactsViewProps> = ({
  deviceId,
  contacts,
  syncComparison,
  loading,
  saving,
  error,
  currentUserRole,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onReorderPriority,
  onSeedSampleContacts,
  onForceResync,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [callEnabled, setCallEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmergencyContact | null>(
    null
  );

  const canModify = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const sortedContacts = [...contacts].sort((a, b) => a.priority - b.priority);

  const openAddForm = () => {
    setEditingId(null);
    setName('');
    setRelationship('');
    setPhone('');
    setSmsEnabled(true);
    setCallEnabled(true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (c: EmergencyContact) => {
    setEditingId(c.id);
    setName(c.name);
    setRelationship(c.relationship);
    setPhone(formatPhoneForDisplay(c.phone));
    setSmsEnabled(c.smsEnabled ?? c.receiveSms ?? true);
    setCallEnabled(c.callEnabled ?? c.receiveCall ?? true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Vui lòng nhập họ và tên người thân.');
      return;
    }

    const validation = validateEmergencyPhone(phone, contacts, editingId);
    if (!validation.valid) {
      setFormError(validation.error || 'Số điện thoại không hợp lệ.');
      return;
    }

    try {
      if (editingId) {
        const existing = contacts.find((c) => c.id === editingId);
        if (existing) {
          await onUpdateContact({
            ...existing,
            name: name.trim(),
            relationship: relationship.trim() || 'Người thân',
            phone: validation.normalized,
            smsEnabled,
            callEnabled,
            receiveSms: smsEnabled,
            receiveCall: callEnabled,
            updatedAt: Date.now(),
          });
        }
      } else {
        await onAddContact({
          name: name.trim(),
          relationship: relationship.trim() || 'Người thân',
          phone: validation.normalized,
          smsEnabled,
          callEnabled,
        });
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể lưu thông tin người thân.';
      setFormError(msg);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDeleteContact(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error is handled by hook
    }
  };

  const formatTimestampMs = (ms: number | null) => {
    if (!ms || !Number.isFinite(ms)) return 'Chưa ghi nhận';
    return cleanTimeText(formatToVietnamTimezone(new Date(ms), true));
  };

  return (
    <div className="space-y-4">
      {/* Top description & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-bold text-zinc-900">
              Danh sách người thân nhận thông báo khẩn cấp
            </h2>
            {saving && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang lưu thay đổi...
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Khi xảy ra sự cố mà người sử dụng không hủy cảnh báo,{' '}
            <strong>{formatFriendlyDeviceName(deviceId)}</strong> sẽ nhắn tin và
            gọi điện lần lượt từ trên xuống.
          </p>
        </div>

        {canModify && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onForceResync}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#91D5FF] bg-[#E6F7FF] px-3.5 py-2.5 text-xs font-semibold text-[#0050B3] hover:bg-[#BAE7FF] disabled:opacity-50 transition"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`}
              />
              <span>Đồng bộ xuống thiết bị</span>
            </button>

            <button
              type="button"
              onClick={openAddForm}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1890FF] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#40A9FF] disabled:opacity-50 transition shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm số người thân</span>
            </button>
          </div>
        )}
      </div>

      {/* Friendly Contact Synchronization Status Card */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              syncComparison.isSynced
                ? 'bg-[#F6FFED] text-[#52C41A]'
                : 'bg-[#FFF7E6] text-[#FA8C16]'
            }`}
          >
            {syncComparison.isSynced ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#262626]">
                Trạng thái danh bạ trên thiết bị:
              </span>
              {syncComparison.isSynced ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-xs font-bold text-[#389E0D]">
                  ✓ Đã đồng bộ đầy đủ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-xs font-bold text-[#D46B08]">
                  ● Đang chờ thiết bị cập nhật
                </span>
              )}
            </div>
            <p className="text-xs text-[#595959] mt-0.5">
              {syncComparison.isSynced
                ? `Thiết bị đã lưu ${syncComparison.activeContactCount} số điện thoại người thân vào bộ nhớ trong và sẵn sàng liên hệ khi khẩn cấp.`
                : 'Thay đổi của bạn đã được lưu trên hệ thống. Thiết bị sẽ tự động nạp danh sách mới này ngay trong lần kết nối tiếp theo.'}
            </p>
          </div>
        </div>

        <div className="text-xs text-[#8C8C8C] shrink-0 sm:text-right">
          <div>Cập nhật gần nhất:</div>
          <strong className="text-[#262626]">
            {formatTimestampMs(
              syncComparison.webContactsUpdatedAt ??
                syncComparison.deviceContactsUpdatedAt
            )}
          </strong>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add / Edit Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4"
        >
          <h3 className="text-sm font-bold text-zinc-900">
            {editingId ? 'Chỉnh sửa thông tin người thân' : 'Thêm người thân mới'}
          </h3>

          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                Họ và tên
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                Mối quan hệ
              </label>
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Bố, Mẹ, Anh trai, Vợ..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                Số điện thoại di động
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0909 123 456"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="h-4 w-4 accent-zinc-900 rounded"
              />
              <span>Nhận tin nhắn SMS kèm vị trí bản đồ</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={callEnabled}
                onChange={(e) => setCallEnabled(e.target.checked)}
                className="h-4 w-4 accent-zinc-900 rounded"
              />
              <span>Nhận cuộc gọi điện thoại báo động khẩn cấp</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1890FF] px-4 py-2 text-xs font-medium text-white hover:bg-[#40A9FF] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lưu thông tin
            </button>
          </div>
        </form>
      )}

      {/* Loading / Empty / Contacts List */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span>Đang tải danh sách người thân...</span>
        </div>
      ) : sortedContacts.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 text-center space-y-3">
          <p className="text-xs text-zinc-500">
            Chưa có người thân nào trong danh sách nhận tin khẩn cấp của thiết bị
            này.
          </p>
          {canModify && (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm số người thân đầu tiên
              </button>
              <button
                onClick={onSeedSampleContacts}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Khôi phục danh bạ từ thiết bị
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-white divide-y divide-zinc-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          {sortedContacts.map((contact, idx) => {
            const isSmsOn = contact.smsEnabled ?? contact.receiveSms ?? true;
            const isCallOn = contact.callEnabled ?? contact.receiveCall ?? true;

            return (
              <div
                key={contact.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      contact.priority <= 3
                        ? 'bg-[#314659] text-white'
                        : 'bg-[#F0F2F5] text-[#595959]'
                    }`}
                  >
                    {contact.priority}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900">
                        {contact.name}
                      </h3>
                      <span className="text-xs text-zinc-400">•</span>
                      <span className="text-xs text-zinc-500">
                        {contact.relationship}
                      </span>
                      <span className="rounded bg-zinc-100 px-2 py-0.2 text-[10.5px] font-medium text-zinc-600">
                        Ưu tiên #{contact.priority}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-zinc-700 mt-0.5">
                      {formatPhoneForDisplay(contact.phone)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                  <button
                    disabled={!canModify || saving}
                    onClick={() =>
                      onUpdateContact({
                        ...contact,
                        smsEnabled: !isSmsOn,
                        receiveSms: !isSmsOn,
                      })
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                      isSmsOn
                        ? 'bg-blue-50/70 text-blue-700 border-blue-200'
                        : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                    }`}
                  >
                    Tin nhắn: {isSmsOn ? 'Bật' : 'Tắt'}
                  </button>

                  <button
                    disabled={!canModify || saving}
                    onClick={() =>
                      onUpdateContact({
                        ...contact,
                        callEnabled: !isCallOn,
                        receiveCall: !isCallOn,
                      })
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                      isCallOn
                        ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                    }`}
                  >
                    Cuộc gọi: {isCallOn ? 'Bật' : 'Tắt'}
                  </button>

                  {canModify && (
                    <>
                      <div className="h-4 w-px bg-zinc-200 mx-1" />
                      <button
                        disabled={idx === 0 || saving}
                        onClick={() => onReorderPriority(contact.id, 'UP')}
                        title="Ưu tiên cao hơn"
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={idx === sortedContacts.length - 1 || saving}
                        onClick={() => onReorderPriority(contact.id, 'DOWN')}
                        title="Ưu tiên thấp hơn"
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => openEditForm(contact)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                      >
                        Sửa
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => setDeleteTarget(contact)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/35 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Xác nhận xóa người thân
              </h3>
              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                Bạn có chắc chắn muốn xóa <strong>{deleteTarget.name}</strong> (
                {formatPhoneForDisplay(deleteTarget.phone)}) khỏi danh sách nhận
                thông báo khẩn cấp?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
