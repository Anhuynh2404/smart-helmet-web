export type DeviceConnectionStatus = 'ONLINE' | 'OFFLINE' | 'SLEEPING';

export type SystemSafetyState = 'NORMAL' | 'WARNING_CANCEL_WINDOW' | 'EMERGENCY_SOS';

export type EventType =
  | 'IMPACT_DETECTED'
  | 'FALL_RISK'
  | 'BUTTON_CANCELLED'
  | 'AUTO_CANCELLED_POSTURE'
  | 'SOS_ACTIVATED'
  | 'LOW_BATTERY';

export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type SOSIncidentStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';

export type UserRole = 'OWNER' | 'EMERGENCY_CONTACT' | 'ADMIN';

export type ConfigSyncStatus = 'SYNCED' | 'PENDING_SYNC' | 'SYNCING' | 'FAILED';

export type OperatingModeId = 'helmet' | 'wheelchair' | 'motorbike' | 'backpack';

export type ModeConfigSyncState = 'APPLIED' | 'SYNCING' | 'WAITING_ONLINE';

export interface ModeThresholdPreset {
  impactThresholdG: number; // Ngưỡng gia tốc va chạm (g)
  tiltAngleThresholdDeg: number; // Ngưỡng góc nghiêng (°)
  gyroThresholdDps: number; // Ngưỡng vận tốc góc (°/s)
  cancelWindowSec: number; // Thời gian chờ hủy báo động (giây)
}

export interface OperatingModeProfile {
  id: OperatingModeId;
  label: string;
  englishKey: string;
  shortDesc: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  thresholds: ModeThresholdPreset;
}

export interface FirebaseModeConfigNode {
  mode: OperatingModeId;
  modeLabel: string;
  configVersion: number;
  thresholds: ModeThresholdPreset;
  updatedAt: number;
}

export type GpsFixType = 'CURRENT' | 'OLD' | 'NONE';

/**
 * Exact Firebase Realtime Database Schema for `/helmets/{deviceId}/status/gps`
 * Compatible with Firmware V2.4.3-dev & backward-compatible with V2.4.2-dev
 */
export interface FirebaseGpsNode {
  // Primary V2.4.3-dev fields at /helmets/{deviceId}/status/gps
  type?: GpsFixType | string;
  valid?: boolean;
  uartOpen?: boolean;
  lat?: number;
  lon?: number;
  lastLat?: number;
  lastLon?: number;
  sats?: number;
  hdop?: number;
  ageMs?: number;
  updatedAt?: number | string;
  lastUtcYMD?: number;
  lastUtcHMS?: number;
  // Backward-compatible aliases
  fix?: boolean;
  latitude?: number;
  longitude?: number;
  satellites?: number;
}

export interface LastValidGpsPosition {
  lat: number;
  lon: number;
  updatedAtMs: number | null;
  updatedAtText: string;
  sats: number | null;
  hdop: number | null;
}

export interface NormalizedGpsStatus {
  rawType: GpsFixType; // 'CURRENT' | 'OLD' | 'NONE'
  isInferredLegacyType: boolean; // true if firmware V2.4.2-dev did not send explicit `type`
  valid: boolean;
  uartOpen: boolean | null;
  lat: number | null;
  lon: number | null;
  lastLat: number | null;
  lastLon: number | null;
  displayLat: number | null; // Active lat for map/card (retains lastValidPosition.lat when incoming coords are 0,0 / invalid)
  displayLon: number | null; // Active lon for map/card (retains lastValidPosition.lon when incoming coords are 0,0 / invalid)
  hasInvalidIncomingCoords: boolean; // True when incoming packet contains (0,0) or invalid coordinates
  isSearchingSatellites: boolean; // True when GPS has not locked satellites and is showing lastValidPosition or waiting for first fix
  usingLastValidPosition: boolean; // True when marker is holding lastValidPosition instead of jumping to invalid (0,0)
  lastValidPosition: LastValidGpsPosition | null;
  sats: number | null;
  hdop: number | null;
  ageMs: number | null;
  updatedAtMs: number | null;
  updatedAtText: string; // Formatted in UTC+7
  secondsSinceGpsUpdate: number | null;
  isFreshRealtime: boolean; // True ONLY when rawType === 'CURRENT' AND updatedAt is recent AND !usingLastValidPosition
  isStaleCurrentUpload: boolean; // True when rawType === 'CURRENT' BUT updatedAt was uploaded long ago
  lastUtcText: string | null; // Formatted from lastUtcYMD & lastUtcHMS
  googleMapsUrl: string | null;
  sourcePath: string; // Always `helmets/{deviceId}/status/gps`
}

export interface FirebaseVector3Node {
  x?: number;
  y?: number;
  z?: number;
}

export interface FirebaseMpuNode {
  // Primary fields at /helmets/helmet01/status/mpu
  accel?: FirebaseVector3Node; // Gia tốc 3 trục (g)
  gyro?: FirebaseVector3Node; // Vận tốc góc 3 trục (°/s)
  gyroMagnitudeDps?: number; // Độ lớn vận tốc góc sau hiệu chỉnh (°/s)
  raw?: Record<string, unknown>; // Dữ liệu cảm biến thô (x, y, z...)
  sampleUptimeMs?: number;
  tiltDeg?: number; // Góc nghiêng (°)
  totalG?: number; // Tổng gia tốc (g)
  valid?: boolean; // Trạng thái dữ liệu MPU hợp lệ
  // Backward-compatible aliases
  available?: boolean;
  ax?: number;
  ay?: number;
  az?: number;
  gx?: number;
  gy?: number;
  gz?: number;
}

export interface FirebaseStatusContactsNode {
  p1?: string; // Số điện thoại SOS ưu tiên 1 trên ESP32
  p2?: string;
  p3?: string;
  p4?: string;
  p5?: string;
  [key: string]: unknown;
}

export interface FirebaseContactChannelSlot {
  priority?: number;
  smsEnabled?: boolean;
  callEnabled?: boolean;
}

export interface FirebaseDeviceNode {
  mode?: string;
  uptimeSeconds?: number;
}

export interface FirebaseNetworkNode {
  transport?: string;
  wifiConnected?: boolean;
  wifiRssiDbm?: number;
}

export interface FirebaseBatteryNode {
  adcMillivolts?: number;
  voltage?: number;
  percentage?: number;
}

export interface FirebaseButtonNode {
  cancelPressed?: boolean;
}

export interface FirebaseHelmetTelemetry {
  // Primary fields at /helmets/{deviceId}/status (SmartHelmet V2.4.2-dev)
  fw?: string | number;
  mode?: OperatingModeId | string;
  deepSleep?: boolean;
  imuFault?: boolean;
  ip?: string;
  lastSeen?: number | string;
  configVersion?: number | string;
  configNote?: string;
  online?: boolean;
  simMode?: string;
  sosPending?: boolean;
  syncReason?: string;
  uptimeS?: number;
  wifiRssi?: number;
  // New V2.4.2-dev status fields
  autoRealSos?: boolean;
  sosTestMode?: boolean;
  cancelWindowSec?: number;
  activeContactCount?: number;
  contactConfigVerified?: boolean;
  contactSource?: string;
  contactsUpdatedAt?: number;
  contactChannels?: Record<string, FirebaseContactChannelSlot>;
  impactThresholdG?: number;
  batteryV?: number;
  batteryLow?: boolean;
  gps?: FirebaseGpsNode;
  mpu?: FirebaseMpuNode;
  contacts?: FirebaseStatusContactsNode;

  // Backward-compatible fields
  deviceId?: string;
  firmwareVersion?: string;
  updatedAt?: number | string;
  device?: FirebaseDeviceNode;
  network?: FirebaseNetworkNode;
  battery?: FirebaseBatteryNode;
  button?: FirebaseButtonNode;
}

/**
 * Schema cho bản ghi SOS & Event History của Firmware SmartHelmet V2.4.2-dev
 * Đường dẫn: /helmets/{deviceId}/sos, /helmets/{deviceId}/events/{eventId}, /helmets/{deviceId}/testEvents/{eventId}
 */
export type SosLocationType = 'CURRENT' | 'OLD' | 'NONE';

export interface FirebaseSosLocationNode {
  type: SosLocationType;
  lat?: number;
  lon?: number;
  mapUrl?: string;
  utc?: string; // VD: "20261124 232244"
}

export interface FirebaseSosSmsNode {
  sent: number;
  targets: number;
  initialLocType?: SosLocationType | string;
  gpsUpdatesSubmitted?: number;
}

export type SosCallResultType =
  | 'ANSWERED'
  | 'NO_ANSWER'
  | 'UNCONFIRMED'
  | 'FAILED'
  | 'NOT_CALLED'
  | string;

export interface FirebaseSosCallAttempt {
  priority: number;
  phone: string;
  result: SosCallResultType;
  callEnabled?: boolean;
  smsEnabled?: boolean;
}

export interface FirebaseSosEventRecord {
  id: string;
  deviceId: string;
  type: string; // 'SOS'
  test: boolean;
  sourceNode: 'sos' | 'events' | 'testEvents';
  active?: boolean;
  resolved?: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  pushedAt?: number;
  bootIndex?: number;
  sequence?: number;
  trigger?: string;
  product?: string;
  fw?: string;
  mode?: string;
  answeredBy: number; // 0 = chưa ai bắt máy, 1..5 = vị trí ưu tiên đã nghe máy
  loc: FirebaseSosLocationNode;
  sms: FirebaseSosSmsNode;
  calls: FirebaseSosCallAttempt[];
}

export interface HelmetDeviceSummary {
  deviceId: string;
  fw: string;
  lastSeen?: number | string;
  hasActiveSos: boolean;
  activeSosId: string | null;
  activeContactCount?: number;
  contactConfigVerified?: boolean;
  sosTestMode?: boolean;
}

export interface ContactSyncComparison {
  isSynced: boolean;
  statusLabel: 'Synced' | 'Pending Sync';
  webContactsUpdatedAt: number | null;
  deviceContactsUpdatedAt: number | null;
  webConfigVersion: number | null;
  deviceConfigVersion: number | null;
  contactConfigVerified: boolean;
  contactSource: string | null;
  activeContactCount: number;
  reason: string;
}

/**
 * Mẫu dữ liệu thu thập trực tiếp trên trình duyệt khi Website đang mở
 * (Phục vụ hiển thị biểu đồ theo thời gian mà không ghi đè dữ liệu ESP32)
 */
export interface LiveTelemetrySample {
  timeLabel: string;
  timestampMs: number;
  accelTotalG: number;
  ax: number;
  ay: number;
  az: number;
  gyroMagnitudeDps: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface MPU6050Telemetry {
  accelX: number;
  accelY: number;
  accelZ: number;
  totalGForce: number;
  pitch: number;
  roll: number;
  temperatureC: number;
  postureState: 'UPRIGHT' | 'TILTED' | 'FALLEN_HORIZONTAL';
}

export interface GPSNeoM10NTelemetry {
  latitude: number;
  longitude: number;
  altitudeM: number;
  speedKmh: number;
  satellites: number;
  hdop: number;
  fixValid: boolean;
  addressLabel: string;
  updatedAt: string;
}

export interface SimcomA7680CTelemetry {
  connected: boolean;
  operator: string;
  networkType: '4G LTE' | 'LTE-CAT1' | 'NO SERVICE';
  rssiDbm: number;
  signalPercent: number;
  imei: string;
  iccid: string;
  ipAddress: string;
}

export interface BatteryTelemetry {
  percentage: number;
  voltageV: number;
  isCharging: boolean;
  isLowBattery: boolean;
  estimatedRuntimeHours: number;
}

export interface HelmetDeviceState {
  deviceId: string;
  deviceName: string;
  riderName: string;
  firmwareVersion: string;
  mcuModel: string;
  connectionStatus: DeviceConnectionStatus;
  safetyState: SystemSafetyState;
  cancelCountdownSec: number | null;
  lastHeartbeatAt: string;
  battery: BatteryTelemetry;
  imu: MPU6050Telemetry;
  gps: GPSNeoM10NTelemetry;
  cellular: SimcomA7680CTelemetry;
  buzzerActive: boolean;
  ledAlertActive: boolean;
}

export interface SOSIncident {
  id: string;
  deviceId: string;
  triggeredAt: string;
  status: SOSIncidentStatus;
  latitude: number;
  longitude: number;
  address: string;
  impactGForce: number;
  tiltAngleDeg: number;
  batteryAtIncident: number;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  notes: string;
  timeline: {
    time: string;
    label: string;
    actor: string;
  }[];
}

export interface HelmetEventLog {
  id: string;
  deviceId: string;
  type: EventType;
  severity: EventSeverity;
  title: string;
  description: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  locationName: string;
  sensorSnapshot: {
    gForce: number;
    pitch: number;
    roll: number;
    batteryPercent: number;
    voltageV: number;
    speedKmh: number;
  };
}

export interface EmergencyContact {
  id: string;
  priority: number;
  name: string;
  relationship: string;
  phone: string;
  smsEnabled: boolean;
  callEnabled: boolean;
  updatedAt: number;
  receiveSms?: boolean;
  receiveCall?: boolean;
  isVerified?: boolean;
  lastNotifiedAt?: string;
}

export interface DeviceConfiguration {
  deviceId: string;
  cancelWindowSeconds: number;
  impactThresholdG: number;
  fallAngleThresholdDeg: number;
  postureRecoveryAutoCancel: boolean;
  lowBatteryThresholdPercent: number;
  powerSavingMode: 'PERFORMANCE' | 'BALANCED' | 'ULTRA_SLEEP';
  sleepTimeoutMinutes: number;
  telemetryIntervalSeconds: number;
  buzzerEnabled: boolean;
  ledStrobeEnabled: boolean;
  syncStatus: ConfigSyncStatus;
  lastSyncedAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarInitials: string;
  assignedDeviceId: string;
  bloodType?: string;
  medicalNotes?: string;
}

export interface TelemetryChartPoint {
  time: string;
  batteryPercent: number;
  gForce: number;
  tiltDeg: number;
  speedKmh: number;
}

export interface GpsRoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  speedKmh: number;
  type: 'NORMAL' | 'WARNING' | 'SOS_ACCIDENT';
  label?: string;
}
