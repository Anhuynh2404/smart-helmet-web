import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  FlaskConical,
  Loader2,
  MapPin,
  MessageSquare,
  PhoneCall,
  Search,
  X,
} from 'lucide-react';
import { formatToVietnamTimezone } from '../hooks/useHelmetTelemetry';
import { formatPhoneForDisplay } from '../services/emergencyContactsService';
import { formatFirmwareGpsUtc } from '../services/sosEventsService';
import {
  FirebaseSosCallAttempt,
  FirebaseSosEventRecord,
} from '../types/helmet';
import { formatFriendlyDeviceName } from './DashboardView';

interface EventHistoryViewProps {
  deviceId: string;
  realSosEvents: FirebaseSosEventRecord[];
  testSosEvents: FirebaseSosEventRecord[];
  loading: boolean;
  resolvingId: string | null;
  error: string | null;
  onResolveSos: (eventId: string) => Promise<void>;
}

function cleanTimeText(raw: string): string {
  return raw
    .replace(/\s*\(UTC\+7\)/g, '')
    .replace(/\s*\[Gốc:.*\]/g, '')
    .trim();
}

export const EventHistoryView: React.FC<EventHistoryViewProps> = ({
  deviceId,
  realSosEvents,
  testSosEvents,
  loading,
  resolvingId,
  error,
  onResolveSos,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    'REAL_SOS' | 'TEST_EVENTS'
  >('REAL_SOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'RESOLVED'
  >('ALL');
  const [selectedEvent, setSelectedEvent] =
    useState<FirebaseSosEventRecord | null>(null);

  const sourceList =
    activeCategory === 'REAL_SOS' ? realSosEvents : testSosEvents;

  const filteredEvents = sourceList.filter((evt) => {
    if (statusFilter === 'ACTIVE' && (evt.resolved || !evt.active)) {
      return false;
    }
    if (statusFilter === 'RESOLVED' && !evt.resolved) {
      return false;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const matchPhone = evt.calls.some(
      (c) =>
        c.phone.toLowerCase().includes(q) ||
        formatPhoneForDisplay(c.phone).toLowerCase().includes(q)
    );
    const matchId = evt.id.toLowerCase().includes(q);
    return matchPhone || matchId;
  });

  const renderCallResultBadge = (result: string) => {
    switch (result) {
      case 'ANSWERED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-[11px] font-semibold text-[#389E0D]">
            <Check className="h-3 w-3" />
            Đã nghe máy
          </span>
        );
      case 'NO_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-[11px] font-semibold text-[#D46B08]">
            Không bắt máy
          </span>
        );
      case 'UNCONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FFFBE6] border border-[#FFE58F] px-2.5 py-0.5 text-[11px] font-semibold text-[#AD6800]">
            Chưa xác nhận cuộc gọi
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FFF1F0] border border-[#FFA39E] px-2.5 py-0.5 text-[11px] font-semibold text-[#CF1322]">
            Không kết nối được
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FAFAFA] border border-[#D9D9D9] px-2.5 py-0.5 text-[11px] font-medium text-[#595959]">
            Chưa gọi
          </span>
        );
    }
  };

  const renderLocTypeBadge = (locType: string) => {
    if (locType === 'CURRENT') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#F6FFED] border border-[#B7EB8F] px-2 py-0.5 text-[11px] font-semibold text-[#389E0D]">
          <MapPin className="h-3 w-3" />
          Vị trí trực tiếp
        </span>
      );
    }
    if (locType === 'OLD') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#FFF7E6] border border-[#FFD591] px-2 py-0.5 text-[11px] font-semibold text-[#D46B08]">
          <MapPin className="h-3 w-3" />
          Vị trí lưu gần nhất
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[#FFF1F0] border border-[#FFA39E] px-2 py-0.5 text-[11px] font-semibold text-[#CF1322]">
        <MapPin className="h-3 w-3" />
        Chưa xác định vị trí
      </span>
    );
  };

  const formatPushedAt = (ms?: number) => {
    if (!ms || !Number.isFinite(ms)) return 'Chưa rõ thời gian';
    return cleanTimeText(formatToVietnamTimezone(new Date(ms), true));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#E8E8E8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {/* Top Category Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 pt-4 pb-3 border-b border-[#F0F0F0]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('REAL_SOS')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition border ${
                activeCategory === 'REAL_SOS'
                  ? 'bg-[#FFF1F0] text-[#CF1322] border-[#FFA39E] shadow-2xs'
                  : 'bg-[#FAFAFA] text-[#595959] border-[#E8E8E8] hover:bg-white'
              }`}
            >
              <AlertOctagon className="h-4 w-4" />
              <span>Sự cố khẩn cấp ({realSosEvents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('TEST_EVENTS')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition border ${
                activeCategory === 'TEST_EVENTS'
                  ? 'bg-[#E6F7FF] text-[#0050B3] border-[#91D5FF] shadow-2xs'
                  : 'bg-[#FAFAFA] text-[#595959] border-[#E8E8E8] hover:bg-white'
              }`}
            >
              <FlaskConical className="h-4 w-4" />
              <span>Lịch sử kiểm tra thiết bị ({testSosEvents.length})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
            <div className="relative sm:w-64">
              <Search className="h-4 w-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo số điện thoại người thân..."
                className="w-full rounded-md border border-[#D9D9D9] bg-white pl-9 pr-3.5 py-1.5 text-xs text-[#262626] focus:border-[#1890FF] focus:outline-none transition"
              />
            </div>

            {activeCategory === 'REAL_SOS' && (
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'ALL' | 'ACTIVE' | 'RESOLVED'
                  )
                }
                className="rounded-md border border-[#D9D9D9] bg-white px-3 py-1.5 text-xs text-[#262626] focus:border-[#1890FF] focus:outline-none transition"
              >
                <option value="ALL">
                  Tất cả sự cố ({realSosEvents.length})
                </option>
                <option value="ACTIVE">Đang cần hỗ trợ</option>
                <option value="RESOLVED">Đã hỗ trợ an toàn</option>
              </select>
            )}
          </div>
        </div>

        {/* Category Context Notice */}
        <div className="px-6 py-2.5 bg-[#FAFAFA] border-b border-[#F0F0F0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#595959]">
          {activeCategory === 'REAL_SOS' ? (
            <span>
              Danh sách các cảnh báo khẩn cấp thực tế từ{' '}
              <strong>{formatFriendlyDeviceName(deviceId)}</strong>. Bấm vào
              từng mục để xem chi tiết kết quả liên lạc với người thân.
            </span>
          ) : (
            <span className="text-[#0050B3]">
              Danh sách các lần bấm kiểm tra thử nghiệm chức năng trên thiết bị
              (Không phải sự cố tai nạn thực tế).
            </span>
          )}
        </div>

        {error && (
          <div className="m-5 rounded-lg border border-[#FFA39E] bg-[#FFF1F0] p-3.5 text-xs text-[#CF1322]">
            {error}
          </div>
        )}

        {/* Loading / Empty / List */}
        <div className="p-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#595959] flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#1890FF]" />
              <span>Đang tải nhật ký hoạt động của thiết bị...</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8C8C8C] space-y-1">
              <div className="font-semibold text-[#595959]">
                Chưa có hoạt động nào trong danh mục này.
              </div>
              <div>
                {activeCategory === 'REAL_SOS'
                  ? 'Thiết bị chưa phát sinh cảnh báo khẩn cấp thực tế nào.'
                  : 'Chưa có lịch sử kiểm tra thử nghiệm trên thiết bị.'}
              </div>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isRealActive =
                !evt.test && evt.active === true && evt.resolved !== true;
              const isResolved = evt.resolved === true;

              return (
                <div
                  key={`${evt.sourceNode}_${evt.id}`}
                  onClick={() => setSelectedEvent(evt)}
                  className={`cursor-pointer group rounded-xl border p-4 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isRealActive
                      ? 'border-[#FFA39E] bg-[#FFF1F0]/60 hover:bg-[#FFF1F0]'
                      : 'border-[#E4E7EC] bg-white hover:border-[#91D5FF] hover:bg-[#FAFAFB]'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs ${
                        evt.test
                          ? 'bg-[#1890FF]'
                          : isRealActive
                          ? 'bg-[#F5222D]'
                          : isResolved
                          ? 'bg-[#52C41A]'
                          : 'bg-[#FA8C16]'
                      }`}
                    >
                      {evt.test ? (
                        <FlaskConical className="h-5 w-5" />
                      ) : isResolved ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <AlertOctagon className="h-5 w-5" />
                      )}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#262626]">
                          {evt.test
                            ? 'Kiểm tra tính năng liên lạc khẩn cấp'
                            : 'Tín hiệu cầu cứu khẩn cấp SOS'}
                        </span>

                        {evt.test ? (
                          <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-semibold text-[#0050B3]">
                            Kiểm tra thử nghiệm
                          </span>
                        ) : isRealActive ? (
                          <span className="rounded bg-[#F5222D] px-2.5 py-0.5 text-[11px] font-bold text-white">
                            ● Đang cần hỗ trợ khẩn cấp
                          </span>
                        ) : isResolved ? (
                          <span className="rounded bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-[11px] font-bold text-[#389E0D]">
                            ✓ Đã hỗ trợ an toàn
                          </span>
                        ) : (
                          <span className="rounded bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-[11px] font-bold text-[#D46B08]">
                            Đã ghi nhận
                          </span>
                        )}

                        {renderLocTypeBadge(evt.loc.type)}
                      </div>

                      {/* Friendly SMS & Call Summary */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#595959]">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5 text-[#1890FF]" />
                          <span>
                            Đã gửi yêu cầu nhắn tin:{' '}
                            <strong className="text-[#262626]">
                              {evt.sms.sent}/{evt.sms.targets} người thân
                            </strong>
                          </span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <PhoneCall className="h-3.5 w-3.5 text-[#52C41A]" />
                          <span>
                            Kết quả gọi điện:{' '}
                            <strong
                              className={
                                evt.answeredBy > 0
                                  ? 'text-[#389E0D]'
                                  : 'text-[#CF1322]'
                              }
                            >
                              {evt.answeredBy > 0
                                ? `Người thân ưu tiên #${evt.answeredBy} đã nghe máy`
                                : 'Chưa có người thân bắt máy'}
                            </strong>
                          </span>
                        </span>
                      </div>

                      {/* Location & Google Maps link */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#595959]">
                        {evt.loc.type !== 'NONE' &&
                        evt.loc.lat !== undefined &&
                        evt.loc.lon !== undefined ? (
                          <>
                            <span>
                              Tọa độ: {evt.loc.lat.toFixed(5)},{' '}
                              {evt.loc.lon.toFixed(5)}
                            </span>
                            {evt.loc.utc && (
                              <span>
                                • Ghi nhận vị trí lúc:{' '}
                                {cleanTimeText(
                                  formatFirmwareGpsUtc(evt.loc.utc)
                                )}
                              </span>
                            )}
                            {evt.loc.mapUrl && (
                              <a
                                href={evt.loc.mapUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 font-semibold text-[#1890FF] hover:underline"
                              >
                                <span>Xem trên Google Maps</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-[#CF1322]">
                            Chưa xác định được tọa độ vị trí khi phát tín hiệu
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Box: Time & Resolve Action */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-2 shrink-0">
                    <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 text-left lg:text-right">
                      <div className="text-[10.5px] text-[#64748B]">
                        Thời điểm hệ thống nhận tin:
                      </div>
                      <div className="text-xs font-bold text-[#1E293B]">
                        {formatPushedAt(evt.pushedAt)}
                      </div>
                    </div>

                    {!evt.test && !isResolved && (
                      <button
                        type="button"
                        disabled={resolvingId === evt.id}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onResolveSos(evt.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#52C41A] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#389E0D] disabled:opacity-50 transition shadow-2xs"
                      >
                        {resolvingId === evt.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Xác nhận đã hỗ trợ an toàn</span>
                      </button>
                    )}

                    {isResolved && evt.resolvedAt && (
                      <span className="text-[11px] font-medium text-[#389E0D]">
                        Đã xác nhận lúc: {formatPushedAt(evt.resolvedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detailed SOS Event Modal (End-User Friendly) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#E8E8E8] bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#F0F0F0] pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedEvent.test ? (
                    <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2.5 py-0.5 text-xs font-bold text-[#0050B3]">
                      Kiểm tra thử nghiệm thiết bị
                    </span>
                  ) : selectedEvent.resolved ? (
                    <span className="rounded bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-xs font-bold text-[#389E0D]">
                      ✓ Đã hỗ trợ an toàn
                    </span>
                  ) : (
                    <span className="rounded bg-[#FFF1F0] border border-[#FFA39E] px-2.5 py-0.5 text-xs font-bold text-[#CF1322]">
                      Cảnh báo khẩn cấp SOS
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[#262626] mt-1.5">
                  Chi tiết liên lạc khẩn cấp —{' '}
                  {formatFriendlyDeviceName(selectedEvent.deviceId)}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1 text-[#8C8C8C] hover:bg-slate-100 hover:text-[#262626]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Friendly Explanation Box */}
            <div className="rounded-lg border border-[#FFE58F] bg-[#FFFBE6] p-3.5 text-xs text-[#874D00] space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-[#FAAD14] shrink-0" />
                <span>Thông tin cần lưu ý:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11.5px]">
                <li>
                  <strong>Thời điểm hệ thống nhận tin:</strong> Thiết bị luôn ưu
                  tiên gửi tin nhắn SMS và gọi điện cho người thân trước, sau đó
                  mới gửi báo cáo lên hệ thống.
                </li>
                <li>
                  <strong>Trạng thái tin nhắn SMS:</strong> Cho biết thiết bị đã
                  gửi tin nhắn lên nhà mạng di động, thời gian điện thoại người
                  thân nhận được phụ thuộc vào sóng nhà mạng.
                </li>
              </ul>
            </div>

            {/* Timestamps */}
            <div className="rounded-lg bg-[#FAFAFA] p-4 border border-[#E8E8E8] space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[#8C8C8C]">
                  Thời điểm hệ thống nhận báo cáo:
                </span>
                <span className="font-semibold text-[#262626] text-right">
                  {formatPushedAt(selectedEvent.pushedAt)}
                </span>
              </div>

              {selectedEvent.resolved && (
                <div className="flex justify-between gap-2 pt-1.5 border-t border-[#E8E8E8]">
                  <span className="text-[#389E0D] font-semibold">
                    Đã xác nhận hỗ trợ an toàn lúc:
                  </span>
                  <span className="font-semibold text-[#389E0D] text-right">
                    {formatPushedAt(selectedEvent.resolvedAt)}{' '}
                    {selectedEvent.resolvedBy
                      ? `(${selectedEvent.resolvedBy})`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Location Block */}
            <div className="rounded-lg bg-[#FAFAFA] p-4 border border-[#E8E8E8] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#262626]">
                  Vị trí khi phát tín hiệu
                </span>
                {renderLocTypeBadge(selectedEvent.loc.type)}
              </div>

              {selectedEvent.loc.type !== 'NONE' &&
              selectedEvent.loc.lat !== undefined &&
              selectedEvent.loc.lon !== undefined ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#8C8C8C]">Tọa độ bản đồ:</span>
                    <span className="font-semibold text-[#262626]">
                      {selectedEvent.loc.lat.toFixed(5)},{' '}
                      {selectedEvent.loc.lon.toFixed(5)}
                    </span>
                  </div>
                  {selectedEvent.loc.utc && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[#8C8C8C]">
                        Thời điểm ghi nhận vị trí:
                      </span>
                      <span className="font-semibold text-[#262626] text-right">
                        {cleanTimeText(
                          formatFirmwareGpsUtc(selectedEvent.loc.utc)
                        )}
                      </span>
                    </div>
                  )}
                  {selectedEvent.loc.mapUrl && (
                    <div className="pt-1">
                      <a
                        href={selectedEvent.loc.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#1890FF] hover:underline"
                      >
                        <span>Mở vị trí trên Google Maps</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[#CF1322]">
                  Thiết bị chưa thu thập được tọa độ định vị tại thời điểm phát
                  tín hiệu.
                </div>
              )}
            </div>

            {/* SMS & Voice Calls Breakdown */}
            <div className="rounded-lg bg-[#FAFAFA] p-4 border border-[#E8E8E8] space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#262626]">
                  Kết quả liên hệ người thân
                </span>
                <span
                  className={`rounded px-2.5 py-0.5 text-[11px] font-bold ${
                    selectedEvent.answeredBy > 0
                      ? 'bg-[#F6FFED] text-[#389E0D] border border-[#B7EB8F]'
                      : 'bg-[#FFF1F0] text-[#CF1322] border border-[#FFA39E]'
                  }`}
                >
                  {selectedEvent.answeredBy > 0
                    ? `Người thân ưu tiên #${selectedEvent.answeredBy} đã nghe máy`
                    : 'Chưa có người thân bắt máy'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded bg-white border border-[#E8E8E8] p-2.5">
                  <span className="text-[#8C8C8C] block text-[11px]">
                    Tin nhắn khẩn cấp đã gửi đi
                  </span>
                  <strong className="text-sm text-[#262626]">
                    {selectedEvent.sms.sent} / {selectedEvent.sms.targets} người
                    thân
                  </strong>
                </div>
                <div className="rounded bg-white border border-[#E8E8E8] p-2.5">
                  <span className="text-[#8C8C8C] block text-[11px]">
                    Tin nhắn cập nhật vị trí mới
                  </span>
                  <strong className="text-sm text-[#262626]">
                    {selectedEvent.sms.gpsUpdatesSubmitted
                      ? `Đã gửi bổ sung ${selectedEvent.sms.gpsUpdatesSubmitted} tin`
                      : 'Không cần gửi bổ sung'}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-[#595959]">
                  Thứ tự gọi điện cho từng người thân:
                </div>
                {selectedEvent.calls.length === 0 ? (
                  <div className="rounded bg-white border border-[#E8E8E8] p-2.5 text-[#8C8C8C]">
                    Không có thông tin cuộc gọi trong bản ghi này.
                  </div>
                ) : (
                  selectedEvent.calls.map((c: FirebaseSosCallAttempt) => (
                    <div
                      key={`${c.priority}_${c.phone}`}
                      className="rounded bg-white border border-[#E8E8E8] px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#001529] text-white font-bold text-[11px]">
                          {c.priority}
                        </span>
                        <div>
                          <div className="font-bold text-[#262626]">
                            {formatPhoneForDisplay(c.phone)}
                          </div>
                          <div className="text-[10.5px] text-[#8C8C8C]">
                            Ưu tiên #{c.priority}
                          </div>
                        </div>
                      </div>

                      {renderCallResultBadge(c.result)}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {!selectedEvent.test && !selectedEvent.resolved ? (
                <button
                  type="button"
                  disabled={resolvingId === selectedEvent.id}
                  onClick={async () => {
                    await onResolveSos(selectedEvent.id);
                    setSelectedEvent((prev) =>
                      prev
                        ? {
                            ...prev,
                            active: false,
                            resolved: true,
                            resolvedAt: Date.now(),
                          }
                        : null
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#52C41A] px-4 py-2 text-xs font-bold text-white hover:bg-[#389E0D] disabled:opacity-50 transition"
                >
                  {resolvingId === selectedEvent.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>Xác nhận đã hỗ trợ an toàn</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg bg-[#001529] px-4 py-2 text-xs font-medium text-white hover:bg-[#002140]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
