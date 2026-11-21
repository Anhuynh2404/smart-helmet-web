import {
  INITIAL_DEVICE_CONFIG,
  INITIAL_DEVICE_STATE,
  INITIAL_EMERGENCY_CONTACTS,
  INITIAL_EVENT_LOGS,
  INITIAL_GPS_ROUTE,
  INITIAL_SOS_INCIDENTS,
  INITIAL_TELEMETRY_HISTORY,
  MOCK_USERS,
} from '../mocks/mockData';
import {
  DeviceConfiguration,
  EmergencyContact,
  GpsRoutePoint,
  HelmetDeviceState,
  HelmetEventLog,
  SOSIncident,
  TelemetryChartPoint,
  UserProfile,
} from '../types/helmet';

/**
 * Clean API Service Layer
 * Separates UI Components from Mock Data and provides exact REST / MQTT / WebSocket
 * endpoint definitions ready for ESP32-S3 + SIMCom A7680C V2 4G hardware integration.
 */
export const API_ENDPOINTS = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.smarthelmet.iot.local/v1',
  WS_URL: import.meta.env.VITE_WS_URL || 'wss://api.smarthelmet.iot.local/ws/telemetry',
  TELEMETRY_INGEST: 'POST /api/v1/devices/:deviceId/telemetry',
  SOS_WEBHOOK: 'POST /api/v1/devices/:deviceId/sos',
  EVENT_INGEST: 'POST /api/v1/devices/:deviceId/events',
  CONFIG_SYNC_POLL: 'GET /api/v1/devices/:deviceId/config/pending',
  CONFIG_UPDATE: 'PUT /api/v1/devices/:deviceId/config',
  CONTACTS_CRUD: 'GET|POST|PUT|DELETE /api/v1/devices/:deviceId/contacts',
};

export const ESP32_HARDWARE_PAYLOAD_EXAMPLE = `{
  "device_id": "SH-ESP32S3-0189",
  "fw_version": "v2.4.1-esp32s3-rtos",
  "timestamp_ms": 1763656148000,
  "state": "EMERGENCY_SOS",
  "battery": {
    "percent": 84,
    "voltage_v": 4.02,
    "charging": false
  },
  "mpu6050": {
    "ax_g": 0.04,
    "ay_g": -0.03,
    "az_g": 0.99,
    "peak_g": 4.85,
    "pitch_deg": 78.4,
    "roll_deg": -64.2
  },
  "gps_neom10n": {
    "fix": true,
    "lat": 10.787200,
    "lng": 106.705200,
    "speed_kmh": 0.0,
    "sats": 14,
    "hdop": 0.78
  },
  "simcom_a7680c": {
    "rssi_dbm": -67,
    "operator": "Viettel",
    "net_mode": "LTE-CAT1"
  }
}`;

export const POSTGRES_SCHEMA_PREVIEW = `-- PostgreSQL Schema for Smart Helmet IoT Platform
CREATE TABLE devices (
  device_id VARCHAR(32) PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  firmware_version VARCHAR(32) NOT NULL,
  connection_status VARCHAR(16) DEFAULT 'OFFLINE',
  cancel_window_sec SMALLINT DEFAULT 15 CHECK (cancel_window_sec BETWEEN 10 AND 15),
  impact_threshold_g NUMERIC(4,2) DEFAULT 3.50,
  power_saving_mode VARCHAR(20) DEFAULT 'BALANCED',
  config_synced BOOLEAN DEFAULT TRUE,
  last_heartbeat_at TIMESTAMPTZ
);

CREATE TABLE sos_incidents (
  incident_id VARCHAR(24) PRIMARY KEY,
  device_id VARCHAR(32) REFERENCES devices(device_id),
  status VARCHAR(20) NOT NULL, -- ACTIVE, ACKNOWLEDGED, RESOLVED, CANCELLED
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  impact_g_force NUMERIC(5,2) NOT NULL,
  tilt_angle_deg NUMERIC(5,2) NOT NULL,
  acknowledged_by VARCHAR(120),
  acknowledged_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emergency_contacts (
  contact_id UUID PRIMARY KEY,
  device_id VARCHAR(32) REFERENCES devices(device_id),
  full_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(24) NOT NULL,
  priority_order SMALLINT NOT NULL,
  enable_sms BOOLEAN DEFAULT TRUE,
  enable_voice_call BOOLEAN DEFAULT TRUE
);`;

class HelmetApiService {
  async fetchInitialDashboardData(): Promise<{
    device: HelmetDeviceState;
    incidents: SOSIncident[];
    events: HelmetEventLog[];
    contacts: EmergencyContact[];
    config: DeviceConfiguration;
    telemetryHistory: TelemetryChartPoint[];
    gpsRoute: GpsRoutePoint[];
    users: UserProfile[];
  }> {
    // Simulate lightweight network latency while keeping UI snappy
    await new Promise((r) => setTimeout(r, 120));
    return {
      device: structuredClone(INITIAL_DEVICE_STATE),
      incidents: structuredClone(INITIAL_SOS_INCIDENTS),
      events: structuredClone(INITIAL_EVENT_LOGS),
      contacts: structuredClone(INITIAL_EMERGENCY_CONTACTS),
      config: structuredClone(INITIAL_DEVICE_CONFIG),
      telemetryHistory: structuredClone(INITIAL_TELEMETRY_HISTORY),
      gpsRoute: structuredClone(INITIAL_GPS_ROUTE),
      users: structuredClone(MOCK_USERS),
    };
  }

  async syncConfigWithEsp32(config: DeviceConfiguration): Promise<DeviceConfiguration> {
    await new Promise((r) => setTimeout(r, 900));
    return {
      ...config,
      syncStatus: 'SYNCED',
      lastSyncedAt: new Date().toISOString(),
    };
  }
}

export const helmetApiService = new HelmetApiService();
