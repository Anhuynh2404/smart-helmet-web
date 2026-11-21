/**
 * SMART HELMET (ESP32-S3 Super Mini)
 * Module: Đồng bộ Danh bạ Người thân (Emergency Contacts) Real-time từ Firebase
 *         + Lưu trữ Offline vào bộ nhớ nội NVS (Preferences)
 *         + Xử lý gửi SMS / Gọi điện theo thứ tự ưu tiên (priority: 1 -> 2 -> 3)
 *
 * Thư viện yêu cầu:
 * - WiFi.h, HTTPClient.h, WiFiClientSecure.h (Có sẵn trong core ESP32)
 * - Preferences.h (Có sẵn trong core ESP32 để lưu NVS Flash)
 * - ArduinoJson (v6 hoặc v7)
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
const char* DEVICE_ID     = "helmet-001";
// Nếu dùng Database Secret hoặc ID Token của Firebase Auth, điền vào đây (để trống nếu dùng token khác):
const char* FIREBASE_AUTH_TOKEN = "";

// ================= CẤU TRÚC DỮ LIỆU NGƯỜI THÂN =================
#define MAX_CONTACTS 10

struct EmergencyContactItem {
  String id;
  int priority;
  String name;
  String relationship;
  String phone;        // Số điện thoại đã chuẩn hóa không khoảng trắng (VD: "0909128456")
  bool smsEnabled;
  bool callEnabled;
  unsigned long long updatedAt;
};

EmergencyContactItem contactList[MAX_CONTACTS];
int contactCount = 0;
unsigned long long localContactsVersion = 0;

Preferences nvsPrefs;
unsigned long lastSyncCheckMs = 0;
const unsigned long SYNC_CHECK_INTERVAL_MS = 3000; // Kiểm tra phiên bản mới mỗi 3 giây

// ================= 1. SẮP XẾP DANH BẠ THEO PRIORITY TĂNG DẦN =================
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

// ================= 2. IN LOG DEBUG RA SERIAL MONITOR =================
void printContactsToSerial(const char* sourceLabel) {
  Serial.println("\n=======================================================");
  Serial.printf("[CONTACTS SYNC] Nguồn dữ liệu: %s (Version: %llu)\n", sourceLabel, localContactsVersion);
  Serial.printf("[CONTACTS SYNC] Tổng số người thân: %d\n", contactCount);
  Serial.println("-------------------------------------------------------");
  for (int i = 0; i < contactCount; i++) {
    Serial.printf("  #%d | %-18s (%-14s) | SĐT: %-11s | SMS: %-3s | GỌI: %-3s\n",
                  contactList[i].priority,
                  contactList[i].name.c_str(),
                  contactList[i].relationship.c_str(),
                  contactList[i].phone.c_str(),
                  contactList[i].smsEnabled ? "BẬT" : "TẮT",
                  contactList[i].callEnabled ? "BẬT" : "TẮT");
  }
  Serial.println("=======================================================\n");
}

// ================= 3. LƯU & ĐỌC DANH BẠ TỪ NVS FLASH (OFFLINE FALLBACK) =================
void saveContactsToNVS(const String& rawJson, unsigned long long versionTimestamp) {
  nvsPrefs.begin("helmet_contacts", false);
  nvsPrefs.putULong64("version", versionTimestamp);
  nvsPrefs.putString("json", rawJson);
  nvsPrefs.end();
  Serial.println("[NVS STORAGE] Đã lưu danh bạ người thân vào bộ nhớ NVS (Offline Fallback sẵn sàng).");
}

bool parseContactsJson(const String& jsonPayload) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, jsonPayload);
  if (error) {
    Serial.printf("[JSON ERROR] Không thể parse JSON danh bạ: %s\n", error.c_str());
    return false;
  }

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

    // Đảm bảo loại bỏ mọi khoảng trắng trong số điện thoại cho module SIM
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
    if (parseContactsJson(savedJson)) {
      printContactsToSerial("BỘ NHỚ NỘI NVS (OFFLINE CACHE)");
    }
  } else {
    Serial.println("[NVS STORAGE] Chưa có danh bạ lưu trong NVS.");
  }
}

// ================= 4. ĐỒNG BỘ REALTIME TỪ FIREBASE =================
String buildFirebaseUrl(const String& subPath) {
  String url = String(FIREBASE_HOST) + "/devices/" + String(DEVICE_ID) + "/" + subPath + ".json";
  if (strlen(FIREBASE_AUTH_TOKEN) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH_TOKEN);
  }
  return url;
}

void syncEmergencyContactsFromFirebase(bool forceFetch = false) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // Bước 1: Kiểm tra nhanh `contactsUpdatedAt` (chỉ ~15 bytes) để biết Web có vừa cập nhật không
  unsigned long long remoteVersion = 0;
  if (!forceFetch) {
    String versionUrl = buildFirebaseUrl("contactsUpdatedAt");
    if (http.begin(client, versionUrl)) {
      int httpCode = http.GET();
      if (httpCode == HTTP_CODE_OK) {
        String verPayload = http.getString();
        verPayload.trim();
        if (verPayload != "null" && verPayload.length() > 0) {
          remoteVersion = strtoull(verPayload.c_str(), NULL, 10);
        }
      }
      http.end();
    }

    // Nếu phiên bản trên Firebase không đổi so với bản trong ESP32 thì bỏ qua
    if (remoteVersion > 0 && remoteVersion == localContactsVersion) {
      return;
    }
  }

  // Bước 2: Tải danh sách `emergencyContacts` mới nhất khi phát hiện thay đổi từ Website
  String contactsUrl = buildFirebaseUrl("emergencyContacts");
  if (http.begin(client, contactsUrl)) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      payload.trim();

      if (payload == "null" || payload == "{}") {
        contactCount = 0;
        localContactsVersion = remoteVersion;
        saveContactsToNVS("{}", localContactsVersion);
        Serial.println("[FIREBASE SYNC] Danh sách người thân trên Website hiện đang trống.");
      } else if (parseContactsJson(payload)) {
        if (remoteVersion == 0) {
          // Lấy max updatedAt từ các phần tử nếu node contactsUpdatedAt chưa có
          for (int i = 0; i < contactCount; i++) {
            if (contactList[i].updatedAt > remoteVersion) {
              remoteVersion = contactList[i].updatedAt;
            }
          }
        }
        localContactsVersion = remoteVersion;
        saveContactsToNVS(payload, localContactsVersion);
        printContactsToSerial("FIREBASE REALTIME DATABASE (VỪA CẬP NHẬT TỪ WEB)");
      }
    } else {
      Serial.printf("[FIREBASE ERROR] HTTP GET thất bại, mã lỗi: %d\n", httpCode);
    }
    http.end();
  }
}

// ================= 5. LOGIC GỬI SMS & GỌI ĐIỆN KHI XẢY RA SỰ CỐ SOS =================
void executeEmergencySOSSequence(float lat, float lng) {
  Serial.println("\n[SOS TRIGGERED] Bắt đầu quy trình liên hệ người thân theo thứ tự ưu tiên:");

  if (contactCount == 0) {
    // Nếu mất mạng từ lúc khởi động, đọc lại từ NVS
    loadContactsFromNVS();
  }

  String mapsLink = "https://www.google.com/maps?q=" + String(lat, 6) + "," + String(lng, 6);

  // Bước A: Gửi SMS cho tất cả người thân có cờ `smsEnabled == true` theo thứ tự priority 1 -> 2 -> 3
  for (int i = 0; i < contactCount; i++) {
    if (contactList[i].smsEnabled && contactList[i].phone.length() >= 9) {
      Serial.printf("  -> [SMS] Đang gửi SMS khẩn cấp tới #%d %s (%s): %s\n",
                    contactList[i].priority,
                    contactList[i].name.c_str(),
                    contactList[i].phone.c_str(),
                    mapsLink.c_str());
      // Gọi hàm gửi AT+CMGS qua SIMCom A7680C tại đây:
      // sim7680SendSMS(contactList[i].phone.c_str(), "SOS! Phat hien tai nan tai: " + mapsLink);
    }
  }

  // Bước B: Thực hiện cuộc gọi theo thứ tự ưu tiên cho người có cờ `callEnabled == true`
  for (int i = 0; i < contactCount; i++) {
    if (contactList[i].callEnabled && contactList[i].phone.length() >= 9) {
      Serial.printf("  -> [CALL] Đang quay số gọi khẩn cấp tới #%d %s (%s)...\n",
                    contactList[i].priority,
                    contactList[i].name.c_str(),
                    contactList[i].phone.c_str());
      // Gọi hàm ATD<phone>; qua SIMCom A7680C tại đây:
      // sim7680DialCall(contactList[i].phone.c_str());
    }
  }
}

// ================= SETUP & LOOP =================
void setup() {
  Serial.begin(115200);
  delay(500);

  // 1. Khôi phục ngay danh bạ từ bộ nhớ NVS khi vừa bật nguồn (đảm bảo có dữ liệu kể cả khi chưa có mạng)
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

  // 3. Đồng bộ danh bạ mới nhất từ Firebase ngay khi có mạng
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Đã kết nối! Đang kiểm tra danh bạ trên Firebase...");
    syncEmergencyContactsFromFirebase(true);
  }
}

void loop() {
  // Kiểm tra đồng bộ danh bạ từ Firebase định kỳ mỗi 3 giây
  if (millis() - lastSyncCheckMs >= SYNC_CHECK_INTERVAL_MS) {
    lastSyncCheckMs = millis();
    syncEmergencyContactsFromFirebase(false);
  }
}
