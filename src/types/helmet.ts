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

/**
 * Exact Firebase Realtime Database Schema for `/helmets/helmet01/status`
 */
export interface FirebaseGpsNode {
  // Primary fields at /helmets/helmet01/status/gps
  lat?: number;
  lon?: number;
  sats?: number;
  hdop?: number;
  ageMs?: number;
  valid?: boolean;
  // Backward-compatible aliases
  fix?: boolean;
  latitude?: number;
  longitude?: number;
  satellites?: number;
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
  p1?: string; // Số điện thoại SOS trên ESP32
  p2?: string;
  p3?: string;
  [key: string]: unknown;
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
  // Primary fields at /helmets/helmet01/status
  fw?: string | number;
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
