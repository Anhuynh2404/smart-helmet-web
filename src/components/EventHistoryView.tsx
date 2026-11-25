import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  FlaskConical,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { formatToVietnamTimezone } from '../hooks/useHelmetTelemetry';
import { formatPhoneForDisplay } from '../services/emergencyContactsService';
import { formatFirmwareGpsUtc } from '../services/sosEventsService';
import {
  FirebaseSosCallAttempt,
  FirebaseSosEventRecord,
} from '../types/helmet';

interface EventHistoryViewProps {
  deviceId: string;
  realSosEvents: FirebaseSosEventRecord[];
  testSosEvents: FirebaseSosEventRecord[];
  loading: boolean;
  resolvingId: string | null;
  error: string | null;
  onResolveSos: (eventId: string) => Promise<void>;
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
  // Requirement 7: Tách biệt hoàn toàn testEvents khỏi SOS thật
  const [activeCategory, setActiveCategory] = useState<'REAL_SOS' | 'TEST_EVENTS'>(
    'REAL_SOS'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>(
    'ALL'
  );
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

    const matchId = evt.id.toLowerCase().includes(q);
    const matchMode = (evt.mode || '').toLowerCase().includes(q);
    const matchFw = (evt.fw || '').toLowerCase().includes(q);
    const matchLoc = (evt.loc.type || '').toLowerCase().includes(q);
    const matchPhone = evt.calls.some((c) =>
      c.phone.toLowerCase().includes(q)
    );
    return matchId || matchMode || matchFw || matchLoc || matchPhone;
  });

  const renderCallResultBadge = (result: string) => {
    switch (result) {
      case 'ANSWERED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#F6FFED] border border-[#B7EB8F] px-2 py-0.5 text-[11px] font-semibold text-[#389E0D]">
            <Check className="h-3 w-3" />
            ANSWERED (Đã nghe máy)
          </span>
        );
      case 'NO_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FFF7E6] border border-[#FFD591] px-2 py-0.5 text-[11px] font-semibold text-[#D46B08]">
            NO_ANSWER (Không bắt máy)
          </span>
        );
      case 'UNCONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FFFBE6] border border-[#FFE58F] px-2 py-0.5 text-[11px] font-semibold text-[#AD6800]">
            UNCONFIRMED (Chưa xác nhận)
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FFF1F0] border border-[#FFA39E] px-2 py-0.5 text-[11px] font-semibold text-[#CF1322]">
            FAILED (Gọi thất bại)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FAFAFA] border border-[#D9D9D9] px-2 py-0.5 text-[11px] font-medium text-[#595959]">
            NOT_CALLED (Chưa gọi)
          </span>
        );
    }
  };

  const renderLocTypeBadge = (locType: string) => {
    if (locType === 'CURRENT') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#F6FFED] border border-[#B7EB8F] px-2 py-0.5 text-[11px] font-semibold text-[#389E0D]">
          <MapPin className="h-3 w-3" />
          GPS: CURRENT (Tọa độ mới)
        </span>
      );
    }
    if (locType === 'OLD') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#FFF7E6] border border-[#FFD591] px-2 py-0.5 text-[11px] font-semibold text-[#D46B08]">
          <MapPin className="h-3 w-3" />
          GPS: OLD (Tọa độ lưu gần nhất)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[#FFF1F0] border border-[#FFA39E] px-2 py-0.5 text-[11px] font-semibold text-[#CF1322]">
        <MapPin className="h-3 w-3" />
        GPS: NONE (Không có tọa độ)
      </span>
    );
  };

  const formatPushedAt = (ms?: number) => {
    if (!ms || !Number.isFinite(ms)) return 'Chưa rõ thời điểm upload';
    return formatToVietnamTimezone(new Date(ms), true);
  };

  return (
    <div className="space-y-4">
      {/* Main Container Card */}
      <div className="rounded-lg border border-[#E8E8E8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {/* Top Category Tabs: Real SOS Events vs Isolated Test Events */}
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
              <span>Sự cố SOS thật ({realSosEvents.length})</span>
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
              <span>
                Sự kiện Kiểm thử / testEvents ({testSosEvents.length})
              </span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
            <div className="relative sm:w-64">
              <Search className="h-4 w-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo Event ID, SĐT, Mode..."
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
                  Tất cả SOS thật ({realSosEvents.length})
                </option>
                <option value="ACTIVE">Đang khẩn cấp (Chưa xử lý)</option>
                <option value="RESOLVED">Đã xác nhận xử lý (Resolved)</option>
              </select>
            )}
          </div>
        </div>

        {/* Category Context Notice */}
        <div className="px-6 py-2.5 bg-[#FAFAFA] border-b border-[#F0F0F0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#595959]">
          {activeCategory === 'REAL_SOS' ? (
            <span>
              Đang hiển thị lịch sử <strong>SOS thật (`test = false`)</strong> từ{' '}
              <code>/helmets/{deviceId}/sos</code> và{' '}
              <code>/helmets/{deviceId}/events</code>. Các bản ghi kiểm thử đã được tách biệt hoàn toàn.
            </span>
          ) : (
            <span className="text-[#0050B3]">
              <strong>Chế độ cách ly kiểm thử (Test Isolation):</strong> Các bản ghi trong{' '}
              <code>/helmets/{deviceId}/testEvents</code> (hoặc <code>test = true</code>) chỉ dùng để đối chiếu kỹ thuật và <strong>không kích hoạt báo động khẩn cấp</strong>.
            </span>
          )}
          <span className="font-mono text-[11px] text-[#8C8C8C]">
            Thiết bị: {deviceId}
          </span>
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
              <span>
                Đang tải lịch sử sự kiện từ <code>/helmets/{deviceId}</code>...
              </span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8C8C8C] space-y-1">
              <div className="font-semibold text-[#595959]">
                Không có bản ghi nào trong mục này cho thiết bị{' '}
                <code>{deviceId}</code>.
              </div>
              <div>
                {activeCategory === 'REAL_SOS'
                  ? 'Thiết bị chưa phát sinh sự cố SOS thật nào hoặc không khớp bộ lọc.'
                  : 'Chưa có bản ghi kiểm thử trong node testEvents.'}
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
                    {/* Icon Box */}
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

                    {/* Main Event Info */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#262626] bg-[#F0F2F5] px-2 py-0.5 rounded border border-[#D9D9D9]">
                          ID: #{evt.id}
                        </span>

                        {evt.test ? (
                          <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-[11px] font-bold text-[#0050B3]">
                            TEST EVENT ({evt.sourceNode})
                          </span>
                        ) : isRealActive ? (
                          <span className="rounded bg-[#F5222D] px-2.5 py-0.5 text-[11px] font-bold text-white">
                            ● SOS ĐANG KÍCH HOẠT (Chưa xử lý)
                          </span>
                        ) : isResolved ? (
                          <span className="rounded bg-[#F6FFED] border border-[#B7EB8F] px-2.5 py-0.5 text-[11px] font-bold text-[#389E0D]">
                            ✓ ĐÃ XỬ LÝ (RESOLVED)
                          </span>
                        ) : (
                          <span className="rounded bg-[#FFF7E6] border border-[#FFD591] px-2.5 py-0.5 text-[11px] font-bold text-[#D46B08]">
                            Lịch sử SOS
                          </span>
                        )}

                        {renderLocTypeBadge(evt.loc.type)}

                        {evt.fw && (
                          <span className="text-[11px] font-mono text-[#8C8C8C]">
                            FW: {evt.fw}
                          </span>
                        )}
                        {evt.mode && (
                          <span className="text-[11px] font-mono text-[#8C8C8C]">
                            • Mode: {evt.mode}
                          </span>
                        )}
                        {evt.bootIndex !== undefined && (
                          <span className="text-[11px] font-mono text-[#8C8C8C]">
                            • Boot #{evt.bootIndex}
                          </span>
                        )}
                      </div>

                      {/* SMS & Call Summary */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#595959]">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5 text-[#1890FF]" />
                          <span>
                            SMS đã gửi lên mạng (Submitted):{' '}
                            <strong className="text-[#262626]">
                              {evt.sms.sent}/{evt.sms.targets}
                            </strong>
                          </span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <PhoneCall className="h-3.5 w-3.5 text-[#52C41A]" />
                          <span>
                            Người bắt máy (answeredBy):{' '}
                            <strong
                              className={
                                evt.answeredBy > 0
                                  ? 'text-[#389E0D]'
                                  : 'text-[#CF1322]'
                              }
                            >
                              {evt.answeredBy > 0
                                ? `Liên hệ ưu tiên #${evt.answeredBy}`
                                : 'Chưa có người bắt máy (0)'}
                            </strong>
                          </span>
                        </span>
                      </div>

                      {/* Location & GPS UTC */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#595959]">
                        {evt.loc.type !== 'NONE' &&
                        evt.loc.lat !== undefined &&
                        evt.loc.lon !== undefined ? (
                          <>
                            <span className="font-mono text-[#262626]">
                              Tọa độ: {evt.loc.lat.toFixed(6)},{' '}
                              {evt.loc.lon.toFixed(6)}
                            </span>
                            {evt.loc.utc && (
                              <span>
                                • Mẫu GPS: {formatFirmwareGpsUtc(evt.loc.utc)}
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
                                <span>Google Maps</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-[#CF1322]">
                            Không có tọa độ GPS khi phát SOS (loc.type = NONE)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Box: Upload Time (pushedAt) & Resolve Action */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-2 shrink-0">
                    <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 text-left lg:text-right">
                      <div className="text-[10.5px] text-[#64748B]">
                        Thời điểm tải lên (pushedAt):
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
                        <span>Xác nhận đã xử lý SOS</span>
                      </button>
                    )}

                    {isResolved && evt.resolvedAt && (
                      <span className="text-[11px] font-medium text-[#389E0D]">
                        Đã xử lý lúc: {formatPushedAt(evt.resolvedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detailed SOS Event Modal (Requirement 3 & 4) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#E8E8E8] bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#F0F0F0] pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-[#F0F2F5] px-2 py-0.5 rounded border border-[#D9D9D9]">
                    Event ID: #{selectedEvent.id}
                  </span>
                  {selectedEvent.test ? (
                    <span className="rounded bg-[#E6F7FF] border border-[#91D5FF] px-2 py-0.5 text-xs font-bold text-[#0050B3]">
                      Bản ghi Kiểm thử (test = true)
                    </span>
                  ) : selectedEvent.resolved ? (
                    <span className="rounded bg-[#F6FFED] border border-[#B7EB8F] px-2 py-0.5 text-xs font-bold text-[#389E0D]">
                      Đã xử lý (resolved = true)
                    </span>
                  ) : (
                    <span className="rounded bg-[#FFF1F0] border border-[#FFA39E] px-2 py-0.5 text-xs font-bold text-[#CF1322]">
                      SOS Thật ({selectedEvent.active ? 'active = true' : 'active = false'})
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[#262626] mt-1.5">
                  Chi tiết bản ghi SOS — Thiết bị {selectedEvent.deviceId}
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

            {/* 1. Upload Time vs GPS Sample Time Disclaimer (Requirement 3) */}
            <div className="rounded-lg border border-[#FFE58F] bg-[#FFFBE6] p-3.5 text-xs text-[#874D00] space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-[#FAAD14] shrink-0" />
                <span>Lưu ý về Thời điểm sự kiện &amp; Trạng thái tin nhắn SMS:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11.5px]">
                <li>
                  <strong>Thời điểm tải lên (pushedAt):</strong> Là lúc ESP32 kết nối Wi-Fi và đẩy báo cáo lên Firebase (sau khi đã thực hiện xong gửi SMS và gọi điện), <strong>không phải thời điểm va chạm chính xác</strong>.
                </li>
                <li>
                  <strong>SMS Sent / Targets:</strong> Phản ánh số tin nhắn modem SIM A7680C đã đệ trình lên nhà mạng (SMS submission), <strong>không khẳng định điện thoại người thân đã nhận được tin nhắn</strong>.
                </li>
              </ul>
            </div>

            {/* 2. Metadata & Timestamps */}
            <div className="rounded-lg bg-[#FAFAFA] p-4 border border-[#E8E8E8] space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[#8C8C8C]">
                  Thời điểm tải lên Firebase (pushedAt):
                </span>
                <span className="font-mono font-semibold text-[#262626] text-right">
                  {formatPushedAt(selectedEvent.pushedAt)}
                </span>
              </div>

              <div className="flex justify-between gap-2">
                <span className="text-[#8C8C8C]">
                  Firmware / Chế độ / Boot Index:
                </span>
                <span className="font-mono font-semibold text-[#262626]">
                  {selectedEvent.fw || '--'} • Mode:{' '}
                  {selectedEvent.mode || '--'} • Boot #
                  {selectedEvent.bootIndex ?? '--'}
                </span>
              </div>

              {selectedEvent.resolved && (
                <div className="flex justify-between gap-2 pt-1 border-t border-[#E8E8E8]">
                  <span className="text-[#389E0D] font-semibold">
                    Thời điểm xác nhận xử lý (resolvedAt):
                  </span>
                  <span className="font-mono font-semibold text-[#389E0D] text-right">
                    {formatPushedAt(selectedEvent.resolvedAt)}{' '}
                    {selectedEvent.resolvedBy
                      ? `(${selectedEvent.resolvedBy})`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {/* 3. GPS Location Block (CURRENT / OLD / NONE) */}
            <div className="rounded-lg bg-[#FAFAFA] p-4 border border-[#E8E8E8] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#262626]">
                  Thông tin Vị trí GPS (loc)
                </span>
                {renderLocTypeBadge(selectedEvent.loc.type)}
              </div>

              {selectedEvent.loc.type !== 'NONE' &&
              selectedEvent.loc.lat !== undefined &&
              selectedEvent.loc.lon !== undefined ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#8C8C8C]">Tọa độ (lat, lon):</span>
                    <span className="font-mono font-semibold text-[#262626]">
                      {selectedEvent.loc.lat.toFixed(6)},{' '}
                      {selectedEvent.loc.lon.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#8C8C8C]">
                      Thời điểm mẫu GPS (loc.utc):
                    </span>
                    <span className="font-mono font-semibold text-[#262626] text-right">
                      {formatFirmwareGpsUtc(selectedEvent.loc.utc)}
                    </span>
                  </div>
                  {selectedEvent.loc.mapUrl && (
                    <div className="pt-1">
                      <a
                        href={selectedEvent.loc.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#1890FF] hover:underline"
                      >
                        <span>Mở vị trí sự cố trên Google Maps</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[#CF1322]">
                  Thiết bị không có tọa độ GPS tại thời điểm phát SOS (loc.type =
                  NONE).
                </div>
              )}
            </div>

            {/* 4. SMS & Voice Calls Breakdown */}
            <div className="rounded-lg bg-[#FAFAFA] p-4 border border-[#E8E8E8] space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#262626]">
                  Kết quả Gửi SMS &amp; Gọi Khẩn cấp (SIM A7680C)
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                    selectedEvent.answeredBy > 0
                      ? 'bg-[#F6FFED] text-[#389E0D] border border-[#B7EB8F]'
                      : 'bg-[#FFF1F0] text-[#CF1322] border border-[#FFA39E]'
                  }`}
                >
                  answeredBy:{' '}
                  {selectedEvent.answeredBy > 0
                    ? `Liên hệ ưu tiên #${selectedEvent.answeredBy}`
                    : '0 (Chưa ai nghe máy)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded bg-white border border-[#E8E8E8] p-2.5">
                  <span className="text-[#8C8C8C] block text-[11px]">
                    SMS Submitted / Targets
                  </span>
                  <strong className="font-mono text-sm text-[#262626]">
                    {selectedEvent.sms.sent} / {selectedEvent.sms.targets}
                  </strong>
                </div>
                <div className="rounded bg-white border border-[#E8E8E8] p-2.5">
                  <span className="text-[#8C8C8C] block text-[11px]">
                    Loại GPS trong SMS đầu
                  </span>
                  <strong className="font-mono text-sm text-[#262626]">
                    {selectedEvent.sms.initialLocType ||
                      selectedEvent.loc.type}
                  </strong>
                </div>
                <div className="rounded bg-white border border-[#E8E8E8] p-2.5">
                  <span className="text-[#8C8C8C] block text-[11px]">
                    SMS cập nhật GPS mới
                  </span>
                  <strong className="font-mono text-sm text-[#262626]">
                    {selectedEvent.sms.gpsUpdatesSubmitted ?? 0} tin
                  </strong>
                </div>
              </div>

              {/* Call Attempts List */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-[#595959]">
                  Chi tiết từng liên hệ theo thứ tự ưu tiên (calls):
                </div>
                {selectedEvent.calls.length === 0 ? (
                  <div className="rounded bg-white border border-[#E8E8E8] p-2.5 text-[#8C8C8C]">
                    Không có danh sách cuộc gọi chi tiết trong bản ghi này.
                  </div>
                ) : (
                  selectedEvent.calls.map((c: FirebaseSosCallAttempt) => (
                    <div
                      key={`${c.priority}_${c.phone}`}
                      className="rounded bg-white border border-[#E8E8E8] px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#001529] text-white font-bold text-[11px]">
                          #{c.priority}
                        </span>
                        <div>
                          <div className="font-mono font-bold text-[#262626]">
                            {formatPhoneForDisplay(c.phone)}{' '}
                            <span className="text-[11px] font-normal text-[#8C8C8C]">
                              ({c.phone})
                            </span>
                          </div>
                          {(c.smsEnabled !== undefined ||
                            c.callEnabled !== undefined) && (
                            <div className="text-[10.5px] text-[#8C8C8C]">
                              Kênh cấu hình: SMS{' '}
                              {c.smsEnabled !== false ? 'Bật' : 'Tắt'} • Gọi{' '}
                              {c.callEnabled !== false ? 'Bật' : 'Tắt'}
                            </div>
                          )}
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
                  <span>Xác nhận đã xử lý SOS (Transaction)</span>
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
