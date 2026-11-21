import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  BatteryWarning,
  CheckCircle2,
  Clock,
  MapPin,
  RotateCcw,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { EventType, HelmetEventLog } from '../types/helmet';

interface EventHistoryViewProps {
  events: HelmetEventLog[];
}

export const EventHistoryView: React.FC<EventHistoryViewProps> = ({
  events,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<HelmetEventLog | null>(
    null
  );

  // Balanced medium-rich tones — not neon bright, not overly dark
  const eventTypeMeta: Record<
    EventType,
    {
      label: string;
      icon: React.ReactNode;
      logoBoxClass: string;
      pillClass: string;
    }
  > = {
    BUTTON_CANCELLED: {
      label: 'Hủy bằng nút bấm',
      icon: <CheckCircle2 className="h-5 w-5" />,
      logoBoxClass: 'bg-[#2563EB] text-white',
      pillClass: 'bg-[#2563EB] text-white',
    },
    AUTO_CANCELLED_POSTURE: {
      label: 'Tự hủy khi đứng thẳng',
      icon: <RotateCcw className="h-5 w-5" />,
      logoBoxClass: 'bg-[#16A34A] text-white',
      pillClass: 'bg-[#16A34A] text-white',
    },
    FALL_RISK: {
      label: 'Nguy cơ ngã',
      icon: <AlertTriangle className="h-5 w-5" />,
      logoBoxClass: 'bg-[#D97706] text-white',
      pillClass: 'bg-[#D97706] text-white',
    },
    SOS_ACTIVATED: {
      label: 'Khẩn cấp SOS',
      icon: <AlertOctagon className="h-5 w-5" />,
      logoBoxClass: 'bg-[#DC2626] text-white',
      pillClass: 'bg-[#DC2626] text-white',
    },
    IMPACT_DETECTED: {
      label: 'Va chạm',
      icon: <Zap className="h-5 w-5" />,
      logoBoxClass: 'bg-[#CA8A04] text-white',
      pillClass: 'bg-[#CA8A04] text-white',
    },
    LOW_BATTERY: {
      label: 'Pin yếu',
      icon: <BatteryWarning className="h-5 w-5" />,
      logoBoxClass: 'bg-[#EA580C] text-white',
      pillClass: 'bg-[#EA580C] text-white',
    },
  };

  const filteredEvents = events.filter((evt) => {
    const matchesType = typeFilter === 'ALL' || evt.type === typeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      evt.title.toLowerCase().includes(q) ||
      evt.description.toLowerCase().includes(q) ||
      evt.locationName.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Main Container Card */}
      <div className="rounded-lg border border-[#E8E8E8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {/* Card Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 pt-3.5 pb-3 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-2 border-b-2 border-[#1890FF] pb-2.5 -mb-3 text-sm font-semibold text-[#1890FF]">
            <Clock className="h-4 w-4" />
            <span>Nhật ký hoạt động ({filteredEvents.length})</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
            <div className="relative sm:w-72">
              <Search className="h-4 w-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo nội dung hoặc tên đường..."
                className="w-full rounded-md border border-[#D9D9D9] bg-white pl-9 pr-3.5 py-1.5 text-xs text-[#262626] focus:border-[#1890FF] focus:outline-none transition"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as EventType | 'ALL')
              }
              className="rounded-md border border-[#D9D9D9] bg-white px-3 py-1.5 text-xs text-[#262626] focus:border-[#1890FF] focus:outline-none transition"
            >
              <option value="ALL">Tất cả trạng thái ({events.length})</option>
              <option value="BUTTON_CANCELLED">Hủy bằng nút bấm</option>
              <option value="AUTO_CANCELLED_POSTURE">
                Tự hủy khi đứng thẳng
              </option>
              <option value="FALL_RISK">Nguy cơ ngã</option>
              <option value="SOS_ACTIVATED">Khẩn cấp SOS</option>
              <option value="IMPACT_DETECTED">Va chạm</option>
              <option value="LOW_BATTERY">Pin yếu</option>
            </select>
          </div>
        </div>

        {/* Event Cards List — Clean neutral white/light-gray card background */}
        <div className="p-5 space-y-3">
          {filteredEvents.map((evt) => {
            const meta = eventTypeMeta[evt.type];
            return (
              <div
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className="cursor-pointer group rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-slate-300 hover:bg-[#FAFAFB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Status Logo / Icon Badge */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-2xs ${meta.logoBoxClass}`}
                  >
                    {meta.icon}
                  </div>

                  {/* Event Details */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${meta.pillClass}`}
                      >
                        {meta.label}
                      </span>
                      <h3 className="text-sm font-bold text-[#262626]">
                        {evt.title}
                      </h3>
                    </div>

                    <p className="text-xs text-[#595959] leading-relaxed">
                      {evt.description}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium pt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-[#475569] shrink-0" />
                      <span className="truncate">{evt.locationName}</span>
                    </div>
                  </div>
                </div>

                {/* Right Timestamp Box */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5">
                  <span className="text-xs font-bold text-[#1E293B]">
                    {new Date(evt.timestamp).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    {new Date(evt.timestamp).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="py-12 text-center text-xs text-[#8C8C8C]">
              Không có hoạt động nào khớp với tìm kiếm của bạn.
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-xl border border-[#E8E8E8] bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    eventTypeMeta[selectedEvent.type].logoBoxClass
                  }`}
                >
                  {eventTypeMeta[selectedEvent.type].icon}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      eventTypeMeta[selectedEvent.type].pillClass
                    }`}
                  >
                    {eventTypeMeta[selectedEvent.type].label}
                  </span>
                  <h3 className="text-base font-bold text-[#262626] mt-1">
                    {selectedEvent.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1 text-[#8C8C8C] hover:bg-slate-100 hover:text-[#262626]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#595959] leading-relaxed">
              {selectedEvent.description}
            </p>

            <div className="rounded-lg bg-[#FAFAFA] p-4 border border-[#E8E8E8] space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8C8C8C]">Thời điểm ghi nhận</span>
                <span className="font-semibold text-[#262626]">
                  {new Date(selectedEvent.timestamp).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C8C8C]">Vị trí</span>
                <span className="font-semibold text-[#262626] text-right max-w-[230px]">
                  {selectedEvent.locationName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C8C8C]">
                  Góc nghiêng & Lực tác động
                </span>
                <span className="font-semibold text-[#262626]">
                  {selectedEvent.sensorSnapshot.pitch}° (
                  {selectedEvent.sensorSnapshot.gForce}G)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C8C8C]">Dung lượng pin</span>
                <span className="font-semibold text-[#1F5E3B]">
                  {selectedEvent.sensorSnapshot.batteryPercent}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={`https://www.google.com/maps?q=${selectedEvent.latitude},${selectedEvent.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E4066] hover:underline"
              >
                <span>Mở vị trí trên Google Maps</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg bg-[#1E4066] px-4 py-2 text-xs font-medium text-white hover:bg-[#16304D]"
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
