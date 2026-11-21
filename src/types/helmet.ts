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
 * Exact Firebase Realtime Database Telemetry Interface
 * Path: devices/{deviceId}/telemetry
 */
export interface FirebaseDeviceNode {
  mode?: string;
  uptimeSeconds?: number;
}

export interface FirebaseGpsNode {
  fix?: boolean;
  latitude?: number;
  longitude?: number;
  satellites?: number;
  hdop?: number;
}

export interface FirebaseMpuNode {
  available?: boolean;
  ax?: number; // m/s^2
  ay?: number; // m/s^2
  az?: number; // m/s^2
  gx?: number; // rad/s
  gy?: number; // rad/s
  gz?: number; // rad/s
  totalG?: number; // G
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
  deviceId?: string;
  firmwareVersion?: string;
  updatedAt?: number | string;
  device?: FirebaseDeviceNode;
  gps?: FirebaseGpsNode;
  mpu?: FirebaseMpuNode;
  network?: FirebaseNetworkNode;
  battery?: FirebaseBatteryNode;
  button?: FirebaseButtonNode;
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
  phone: string; // Stored normalized without spaces on Firebase (e.g. "0909128456")
  smsEnabled: boolean;
  callEnabled: boolean;
  updatedAt: number;
  // Backward-compatible aliases for existing UI components
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
