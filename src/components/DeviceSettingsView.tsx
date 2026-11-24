import React, { useState } from 'react';
import {
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  DeviceConfiguration,
  FirebaseHelmetTelemetry,
  HelmetDeviceState,
  UserRole,
} from '../types/helmet';

interface DeviceSettingsViewProps {
  device: HelmetDeviceState;
  ownerName: string;
  config: DeviceConfiguration;
  telemetry: FirebaseHelmetTelemetry | null;
  targetDeviceId: string;
  currentUserRole: UserRole;
  onUpdateConfig: (updated: DeviceConfiguration) => void;
  onSyncToDevice: () => Promise<void>;
}

export const DeviceSettingsView: React.FC<DeviceSettingsViewProps> = ({
  ownerName,
  config,
  telemetry,
  targetDeviceId,
  currentUserRole,
  onUpdateConfig,
  onSyncToDevice,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const canEdit = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const displayDeviceId = telemetry?.deviceId || targetDeviceId;
  const displayFirmware = telemetry?.firmwareVersion || '--';
  const displayMode = telemetry?.device?.mode || '--';

  const handleFieldChange = <K extends keyof DeviceConfiguration>(
    key: K,
    val: DeviceConfiguration[K]
  ) => {
    onUpdateConfig({
      ...config,
      [key]: val,
      syncStatus: 'PENDING_SYNC',
    });
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    await onSyncToDevice();
    setIsSyncing(false);
  };

  return (
    <div className="w-full space-y-4">
      {/* Device Overview Header */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-bold text-zinc-900">CAS-BOX của {ownerName}</h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-mono text-zinc-700">
              Device ID: {displayDeviceId}
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">
              Mode: {displayMode}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Firmware: <strong className="font-mono text-zinc-800">{displayFirmware}</strong> •{' '}
            {config.syncStatus === 'SYNCED' ? (
              <span className="text-emerald-600 font-medium">Đã đồng bộ cài đặt mới nhất</span>
            ) : (
              <span className="text-amber-600 font-medium">Có thay đổi chưa đồng bộ lên mũ</span>
            )}
          </p>
        </div>

        <button
          disabled={!canEdit || isSyncing}
          onClick={handleTriggerSync}
          className="self-start sm:self-auto inline-flex items-center gap-2 rounded-lg bg-[#1890FF] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#40A9FF] disabled:opacity-50 transition shadow-2xs"
        >
          {isSyncing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          <span>{isSyncing ? 'Đang lưu...' : 'Lưu cài đặt'}</span>
        </button>
      </div>

      {/* Safety & Preferences Card */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-6">
        {/* Cancel Window 10-15s */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-zinc-900">
                Thời gian đếm ngược chờ hủy cảnh báo
              </label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Khoảng thời gian mũ phát tiếng kêu sau va chạm để người đội bấm nút hủy trước khi gửi tin SOS.
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-900">
              {config.cancelWindowSeconds} giây
            </span>
          </div>

          <div className="pt-2">
            <input
              type="range"
              min={10}
              max={15}
              step={1}
              disabled={!canEdit}
              value={config.cancelWindowSeconds}
              onChange={(e) =>
                handleFieldChange('cancelWindowSeconds', Number(e.target.value))
              }
              className="w-full accent-zinc-900 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
              <span>10 giây</span>
              <span>12 giây</span>
              <span>15 giây (Khuyên dùng)</span>
            </div>
          </div>
        </div>

        {/* Impact Sensitivity */}
        <div className="space-y-2 pt-5 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-zinc-900">
                Độ nhạy phát hiện va chạm
              </label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Mức lực chấn động tối thiểu để mũ kích hoạt quy trình kiểm tra an toàn.
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-900">
              {config.impactThresholdG.toFixed(1)} G
            </span>
          </div>

          <div className="pt-2">
            <input
              type="range"
              min={2.5}
              max={6.0}
              step={0.5}
              disabled={!canEdit}
              value={config.impactThresholdG}
              onChange={(e) =>
                handleFieldChange('impactThresholdG', Number(e.target.value))
              }
              className="w-full accent-zinc-900 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
              <span>Nhạy cao (2.5G)</span>
              <span>Tiêu chuẩn (3.5G)</span>
              <span>Va chạm mạnh (6.0G)</span>
            </div>
          </div>
        </div>

        {/* Power Saving Mode */}
        <div className="space-y-3 pt-5 border-t border-zinc-100">
          <div>
            <label className="text-sm font-semibold text-zinc-900">
              Chế độ pin & định vị
            </label>
            <p className="text-xs text-zinc-500 mt-0.5">
              Lựa chọn tần suất cập nhật GPS phù hợp với nhu cầu di chuyển.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                {
                  id: 'PERFORMANCE',
                  title: 'Liên tục',
                  desc: 'Cập nhật vị trí mỗi 5 giây',
                },
                {
                  id: 'BALANCED',
                  title: 'Cân bằng',
                  desc: 'Tối ưu thời lượng pin cả ngày',
                },
                {
                  id: 'ULTRA_SLEEP',
                  title: 'Tiết kiệm pin',
                  desc: 'Tự nghỉ khi dựng xe đứng yên',
                },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                disabled={!canEdit}
                onClick={() => handleFieldChange('powerSavingMode', mode.id)}
                className={`rounded-lg border p-3.5 text-left transition ${
                  config.powerSavingMode === mode.id
                    ? 'border-[#1890FF] bg-[#E6F7FF] text-[#0050B3]'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <div className="text-xs font-semibold">{mode.title}</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    config.powerSavingMode === mode.id ? 'text-[#1890FF]' : 'text-zinc-500'
                  }`}
                >
                  {mode.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Switch Toggles */}
        <div className="space-y-3 pt-5 border-t border-zinc-100">
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-900">
                Tự tắt cảnh báo khi người đội đứng dậy
              </div>
              <div className="text-xs text-zinc-500">
                Tự động hủy đếm ngược nếu mũ trở lại tư thế thẳng đứng ổn định
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={config.postureRecoveryAutoCancel}
              onChange={(e) =>
                handleFieldChange('postureRecoveryAutoCancel', e.target.checked)
              }
              className="h-4 w-4 accent-zinc-900"
            />
          </label>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-900">
                Âm báo và đèn phát sáng trên mũ
              </div>
              <div className="text-xs text-zinc-500">
                Phát tiếng bíp và chớp đèn để người xung quanh dễ nhận biết khi gặp sự cố
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={config.buzzerEnabled}
              onChange={(e) => handleFieldChange('buzzerEnabled', e.target.checked)}
              className="h-4 w-4 accent-zinc-900"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
