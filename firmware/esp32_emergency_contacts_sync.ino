/**
 * CAS-BOX (ESP32-S3 Super Mini — Firmware v5.0)
 * Module:
 *  1. Đồng bộ 4 Chế độ hoạt động (helmet, wheelchair, motorbike, backpack) & Bộ ngưỡng từ `/helmets/helmet01/config`
 *  2. Lưu cấu hình Mode vào bộ nhớ NVS Flash (Persistence) để giữ nguyên chế độ (VD: `motorbike`) sau khi mất nguồn hoặc Deep Sleep
 *  3. Gửi gói tin xác nhận ACK (`configVersion`, `mode`, `configNote`) lên `/helmets/helmet01/status` để Web chuyển từ "Đang đồng bộ..." -> "Đã áp dụng"
 *  4. Đồng bộ Danh bạ Người thân (Emergency Contacts) Real-time + Lưu NVS Offline Fallback
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ================= CẤU HÌNH WIFI & FIREBASE =================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* FIREBASE_HOST = "https://smart-helmet-iot-efc7e-default-rtdb.firebaseio.com";
const char* DEVICE_ID     = "helmet01";
const char* FIREBASE_AUTH_TOKEN = "";

// ================= CẤU TRÚC CHẾ ĐỘ HOẠT ĐỘNG & NGƯỠNG BẢO VỆ (4 MODES) =================
struct ModeConfigState {
  String mode;                  // "helmet" | "wheelchair" | "motorbike" | "backpack"
  int configVersion;            // Phiên bản cấu hình đồng bộ với Web
  float impactThresholdG;       // Ngưỡng va chạm G-Shock (g)
  float tiltAngleThresholdDeg;  // Ngưỡng góc nghiêng (độ)
  float gyroThresholdDps;       // Ngưỡng vận tốc góc (°/s)
  int cancelWindowSec;          // Thời gian đếm ngược hủy SOS (giây)
};

ModeConfigState activeConfig = {
  "helmet", // Mặc định chỉ dùng khi NVS hoàn toàn trống lần đầu xuất xưởng
  0,
  3.2f,
  60.0f,
  180.0f,
  15
};

// ================= CẤU TRÚC DỮ LIỆU NGƯỜI THÂN =================
#define MAX_CONTACTS 10

struct EmergencyContactItem {
  String id;
  int priority;
  String name;
  String relationship;
  String phone;
  bool smsEnabled;
  bool callEnabled;
  unsigned long long updatedAt;
};

EmergencyContactItem contactList[MAX_CONTACTS];
int contactCount = 0;
unsigned long long localContactsVersion = 0;

Preferences nvsPrefs;
unsigned long lastSyncCheckMs = 0;
const unsigned long SYNC_CHECK_INTERVAL_MS = 2000; // Kiểm tra cấu hình Mode & Danh bạ mỗi 2 giây

// ================= URL HELPER (/helmets/helmet01/...) =================
String buildHelmetFirebaseUrl(const String& subPath) {
  String url = String(FIREBASE_HOST) + "/helmets/" + String(DEVICE_ID) + "/" + subPath + ".json";
  if (strlen(FIREBASE_AUTH_TOKEN) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH_TOKEN);
  }
  return url;
}

// ================= 1. BỘ NGƯỠNG MẶC ĐỊNH THEO TỪNG CHẾ ĐỘ =================
void applyDefaultThresholdsForMode(const String& modeName, ModeConfigState& target) {
  if (modeName == "wheelchair") {
    target.impactThresholdG      = 1.8f;
    target.tiltAngleThresholdDeg = 35.0f;
    target.gyroThresholdDps      = 95.0f;
    target.cancelWindowSec       = 12;
  } else if (modeName == "motorbike") {
    target.impactThresholdG      = 4.5f;
    target.tiltAngleThresholdDeg = 65.0f;
    target.gyroThresholdDps      = 240.0f;
    target.cancelWindowSec       = 15;
  } else if (modeName == "backpack") {
    target.impactThresholdG      = 2.6f;
    target.tiltAngleThresholdDeg = 55.0f;
    target.gyroThresholdDps      = 140.0f;
    target.cancelWindowSec       = 15;
  } else {
    // "helmet"
    target.impactThresholdG      = 3.2f;
    target.tiltAngleThresholdDeg = 60.0f;
    target.gyroThresholdDps      = 180.0f;
    target.cancelWindowSec       = 15;
  }
}

// ================= 2. LƯU & KHÔI PHỤC CHẾ ĐỘ HOẠT ĐỘNG TỪ NVS FLASH (TEST #6 PERSISTENCE) =================
void saveModeConfigToNVS(const ModeConfigState& cfg) {
  nvsPrefs.begin("casbox_cfg", false);
  nvsPrefs.putString("mode", cfg.mode);
  nvsPrefs.putInt("ver", cfg.configVersion);
  nvsPrefs.putFloat("impactG", cfg.impactThresholdG);
  nvsPrefs.putFloat("tiltDeg", cfg.tiltAngleThresholdDeg);
  nvsPrefs.putFloat("gyroDps", cfg.gyroThresholdDps);
  nvsPrefs.putInt("cancelS", cfg.cancelWindowSec);
  nvsPrefs.end();

  Serial.printf("[NVS PERSISTENCE] Đã lưu chế độ '%s' (v%d) vào NVS Flash (Không bị mất khi tắt nguồn / Deep Sleep).\n",
                cfg.mode.c_str(), cfg.configVersion);
}

void loadModeConfigFromNVS() {
  nvsPrefs.begin("casbox_cfg", true);
  String savedMode = nvsPrefs.getString("mode", "");
  int savedVer     = nvsPrefs.getInt("ver", 0);

  if (savedMode.length() > 0) {
    activeConfig.mode          = savedMode;
    activeConfig.configVersion = savedVer;
    applyDefaultThresholdsForMode(savedMode, activeConfig);

    activeConfig.impactThresholdG      = nvsPrefs.getFloat("impactG", activeConfig.impactThresholdG);
    activeConfig.tiltAngleThresholdDeg = nvsPrefs.getFloat("tiltDeg", activeConfig.tiltAngleThresholdDeg);
    activeConfig.gyroThresholdDps      = nvsPrefs.getFloat("gyroDps", activeConfig.gyroThresholdDps);
    activeConfig.cancelWindowSec       = nvsPrefs.getInt("cancelS", activeConfig.cancelWindowSec);
    nvsPrefs.end();

    Serial.println("\n=======================================================");
    Serial.printf("[NVS RESTORE] Khôi phục thành công chế độ sau khi bật nguồn / thức dậy từ Deep Sleep:\n");
    Serial.printf("  -> Mode: %s | configVersion: %d\n", activeConfig.mode.c_str(), activeConfig.configVersion);
    Serial.printf("  -> Ngưỡng G-Shock: %.1fg | Góc nghiêng: %.0f° | Gyro: %.0f°/s | Hủy SOS: %ds\n",
                  activeConfig.impactThresholdG,
                  activeConfig.tiltAngleThresholdDeg,
                  activeConfig.gyroThresholdDps,
                  activeConfig.cancelWindowSec);
    Serial.println("=======================================================\n");
  } else {
    nvsPrefs.end();
    Serial.println("[NVS RESTORE] Chưa có cấu hình Mode trong NVS, sử dụng mặc định ban đầu (helmet).");
  }
}

// ================= 3. GỬI PHẢN HỒI XÁC NHẬN (ACK) LÊN /helmets/helmet01/status (TEST #5 CONFIG SYNC) =================
bool sendConfigAckToFirebaseStatus() {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String statusUrl = buildHelmetFirebaseUrl("status");
  if (!http.begin(client, statusUrl)) return false;

  http.addHeader("Content-Type", "application/json");

  JsonDocument ackDoc;
  ackDoc["mode"]          = activeConfig.mode;
  ackDoc["configVersion"] = activeConfig.configVersion;
  ackDoc["configNote"]    = String("applied:") + activeConfig.mode + "_v" + String(activeConfig.configVersion) + "_nvs";

  String body;
  serializeJson(ackDoc, body);

  int httpCode = http.PATCH(body);
  http.end();

  if (httpCode == HTTP_CODE_OK) {
    Serial.printf("[CONFIG ACK] Đã gửi ACK lên /helmets/%s/status -> mode=%s, configVersion=%d\n",
                  DEVICE_ID, activeConfig.mode.c_str(), activeConfig.configVersion);
    return true;
  } else {
    Serial.printf("[CONFIG ACK ERROR] PATCH thất bại, HTTP code: %d\n", httpCode);
    return false;
  }
}

// ================= 4. ĐỒNG BỘ CẤU HÌNH 4 MODE TỪ /helmets/helmet01/config =================
void syncModeConfigFromFirebase(bool forceAckOnBoot = false) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String configUrl = buildHelmetFirebaseUrl("config");
  if (http.begin(client, configUrl)) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      payload.trim();

      if (payload != "null" && payload.length() > 2) {
        JsonDocument doc;
        if (!deserializeJson(doc, payload)) {
          String remoteMode = doc["mode"] | activeConfig.mode;
          int remoteVer     = doc["configVersion"] | activeConfig.configVersion;

          bool hasNewConfig = (remoteVer > activeConfig.configVersion) ||
                              (remoteMode != activeConfig.mode && remoteVer >= activeConfig.configVersion);

          if (hasNewConfig) {
            activeConfig.mode          = remoteMode;
            activeConfig.configVersion = remoteVer;
            applyDefaultThresholdsForMode(remoteMode, activeConfig);

            JsonObject thresholds = doc["thresholds"].as<JsonObject>();
            if (!thresholds.isNull()) {
              activeConfig.impactThresholdG      = thresholds["impactThresholdG"] | activeConfig.impactThresholdG;
              activeConfig.tiltAngleThresholdDeg = thresholds["tiltAngleThresholdDeg"] | activeConfig.tiltAngleThresholdDeg;
              activeConfig.gyroThresholdDps      = thresholds["gyroThresholdDps"] | activeConfig.gyroThresholdDps;
              activeConfig.cancelWindowSec       = thresholds["cancelWindowSec"] | activeConfig.cancelWindowSec;
            }

            // Lưu ngay vào NVS Flash để không bị mất khi tắt nguồn / Deep Sleep (Test #6)
            saveModeConfigToNVS(activeConfig);

            // Gửi phản hồi ACK lên /helmets/helmet01/status để Web đổi từ "Đang đồng bộ..." -> "Đã áp dụng" (Test #5)
            sendConfigAckToFirebaseStatus();
          } else if (forceAckOnBoot) {
            // Khi vừa khởi động lại từ NVS, gửi trạng thái Mode hiện tại lên status để đồng bộ với Web
            sendConfigAckToFirebaseStatus();
          }
        }
      } else if (forceAckOnBoot) {
        sendConfigAckToFirebaseStatus();
      }
    }
    http.end();
  }
}

// ================= 5. ĐỒNG BỘ DANH BẠ NGƯỜI THÂN & LƯU NVS =================
void sortContactsByPriority() {
  for (int i = 0; i < contactCount - 1; i++) {
    for (int j = i + 1; j < contactCount; j++) {
      if (contactList[j].priority < contactList[i].priority) {
        EmergencyContactItem temp = contactList[i];
        contactList[i] = contactList[j];
        contactList[j] = temp;
      }
    }
  }
}

void saveContactsToNVS(const String& rawJson, unsigned long long versionTimestamp) {
  nvsPrefs.begin("helmet_contacts", false);
  nvsPrefs.putULong64("version", versionTimestamp);
  nvsPrefs.putString("json", rawJson);
  nvsPrefs.end();
}

bool parseContactsJson(const String& jsonPayload) {
  JsonDocument doc;
  if (deserializeJson(doc, jsonPayload)) return false;

  contactCount = 0;
  JsonObject root = doc.as<JsonObject>();

  for (JsonPair kv : root) {
    if (contactCount >= MAX_CONTACTS) break;
    JsonObject item = kv.value().as<JsonObject>();
    if (item.isNull()) continue;

    contactList[contactCount].id           = item["id"] | String(kv.key().c_str());
    contactList[contactCount].priority     = item["priority"] | (contactCount + 1);
    contactList[contactCount].name         = item["name"] | "Nguoi than";
    contactList[contactCount].relationship = item["relationship"] | "Nguoi than";
    contactList[contactCount].phone        = item["phone"] | "";
    contactList[contactCount].smsEnabled   = item["smsEnabled"] | true;
    contactList[contactCount].callEnabled  = item["callEnabled"] | true;
    contactList[contactCount].updatedAt    = item["updatedAt"] | 0ULL;
    contactList[contactCount].phone.replace(" ", "");
    contactCount++;
  }

  sortContactsByPriority();
  return true;
}

void loadContactsFromNVS() {
  nvsPrefs.begin("helmet_contacts", true);
  localContactsVersion = nvsPrefs.getULong64("version", 0ULL);
  String savedJson = nvsPrefs.getString("json", "");
  nvsPrefs.end();

  if (savedJson.length() > 2) {
    parseContactsJson(savedJson);
  }
}

void syncEmergencyContactsFromFirebase(bool forceFetch = false) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  unsigned long long remoteVersion = 0;
  if (!forceFetch) {
    String versionUrl = buildHelmetFirebaseUrl("contactsUpdatedAt");
    if (http.begin(client, versionUrl)) {
      if (http.GET() == HTTP_CODE_OK) {
        String verPayload = http.getString();
        verPayload.trim();
        if (verPayload != "null" && verPayload.length() > 0) {
          remoteVersion = strtoull(verPayload.c_str(), NULL, 10);
        }
      }
      http.end();
    }
    if (remoteVersion > 0 && remoteVersion == localContactsVersion) {
      return;
    }
  }

  String contactsUrl = buildHelmetFirebaseUrl("emergencyContacts");
  if (http.begin(client, contactsUrl)) {
    if (http.GET() == HTTP_CODE_OK) {
      String payload = http.getString();
      payload.trim();
      if (payload != "null" && payload != "{}" && parseContactsJson(payload)) {
        localContactsVersion = remoteVersion;
        saveContactsToNVS(payload, localContactsVersion);
      }
    }
    http.end();
  }
}

// ================= SETUP & LOOP =================
void setup() {
  Serial.begin(115200);
  delay(500);

  // 1. Nạp ngay Chế độ hoạt động (helmet / wheelchair / motorbike / backpack) & Danh bạ từ NVS Flash
  //    Đảm bảo sau khi tắt nguồn hoặc thoát Deep Sleep, thiết bị giữ nguyên chế độ đã cấu hình!
  loadModeConfigFromNVS();
  loadContactsFromNVS();

  // 2. Kết nối Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WIFI] Đang kết nối Wi-Fi");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  Serial.println();

  // 3. Đồng bộ Cấu hình Mode & Danh bạ với Firebase ngay khi có mạng và gửi ACK trạng thái hiện tại
  if (WiFi.status() == WL_CONNECTED) {
    syncModeConfigFromFirebase(true);
    syncEmergencyContactsFromFirebase(true);
  }
}

void loop() {
  if (millis() - lastSyncCheckMs >= SYNC_CHECK_INTERVAL_MS) {
    lastSyncCheckMs = millis();
    syncModeConfigFromFirebase(false);
    syncEmergencyContactsFromFirebase(false);
  }
}
