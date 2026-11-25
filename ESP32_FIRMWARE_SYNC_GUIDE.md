# Tài Liệu Đặc Tả Nâng Cấp Firmware ESP32 (`SmartHelmet_V2_1.ino`) Đồng Bộ Với Website CAS-BOX

Tài liệu này phân tích trực tiếp mã nguồn hiện tại của file [SmartHelmet_V2_1.ino](file:///d:/anhc_ws/Web_helmet/SmartHelmet_V2_1.ino) (phiên bản **Alpha 5.0 - ESP32-S3 Super Mini**) và liệt kê chi tiết các hạng mục cùng đoạn mã C++ cần cập nhật trên Firmware để đồng bộ **100%** với toàn bộ tính năng hiện có trên Website **CAS-BOX**.

---

## 1. Bảng Đối Chiếu Hiện Trạng Giữa `SmartHelmet_V2_1.ino` & Website CAS-BOX

| STT | Nhóm tính năng trên Website | Hiện trạng trong `SmartHelmet_V2_1.ino` | Mức độ tương thích | Yêu cầu cập nhật trên Firmware |
| :-: | :--- | :--- | :---: | :--- |
| **1** | **Live Stream Telemetry** (`gps`, `mpu`, `wifiRssi`, `ip`, `uptimeS`, `fw`, `imuFault`) | Đã có trong `buildStatusJson()` (Dòng `1632–1717`), gửi qua `PATCH /helmets/helmet01/status.json`. | ✅ Đã khớp 90% | Gửi thêm `sats` và `hdop` ngay cả khi GPS chưa chốt (`valid: false`) để Web hiển thị số vệ tinh đang dò. |
| **2** | **Offline Timeout (> 16 giây)** & **Cờ Deep Sleep** | `SERVICE_SYNC_PERIOD_MS = 15000` (15 giây - Dòng `94`) và `d["deepSleep"] = ENABLE_DEEP_SLEEP` (Dòng `1642`). | ⚠️ Cần sửa ngay | 1. Giảm `SERVICE_SYNC_PERIOD_MS` xuống **`4000` ms (4 giây)** để không bị trễ quá 16s gây báo Offline giả.<br>2. Chỉ báo `deepSleep: true` khi thực sự chuẩn bị ngủ, không gán cứng theo hằng số `ENABLE_DEEP_SLEEP`. |
| **3** | **Đồng bộ Múi giờ chuẩn (`UTC` → `UTC+7`)** | Dùng `d["lastSeen"][".sv"] = "timestamp"` (Dòng `1635`) trả về Unix Epoch UTC (ms). | ✅ Đã khớp 100% | Giữ nguyên. Website đã tự động quy đổi Epoch UTC hoặc ISO UTC sang giờ Việt Nam (`UTC+7`). |
| **4** | **Chuyển đổi 4 Chế độ hoạt động** (`helmet`, `wheelchair`, `motorbike`, `backpack`) & **Bộ ngưỡng động** | Các ngưỡng đang gán cứng (`static constexpr`) tại Dòng `130–133` (`IMPACT_G = 2.50f`, `PRECHECK_TILT_DEG = 45.0f`, `ALERT_MS = 15000`). Chưa có biến `mode`. | ❌ Chưa có | Thay các hằng số ngưỡng cố định bằng struct `OperatingModeConfig` thay đổi linh hoạt theo 4 chế độ. |
| **5** | **Đồng bộ cấu hình xuống ESP32 & Phản hồi xác nhận (ACK)** | `applyRemoteConfig()` (Dòng `1444`) chỉ đọc `version` và `contacts`. Nếu `contacts` không có trong `/config`, hàm trả về `false` và bỏ qua toàn bộ. | ❌ Cần nâng cấp | Cập nhật `applyRemoteConfig()` để đọc `mode`, `configVersion`, `thresholds`, `contacts` và gửi trả `mode` + `configVersion` vào `/status` làm tín hiệu **ACK**. |
| **6** | **Lưu cấu hình Mode vào NVS sau khi mất nguồn / Deep Sleep (Persistence)** | NVS namespace `"helmet4"` (Dòng `1375`) mới chỉ lưu danh bạ `c0..c4` và `cver`. Chưa lưu `mode` và bộ ngưỡng. | ❌ Cần bổ sung | Lưu `mode`, `configVersion` và 4 ngưỡng bảo vệ vào NVS `"helmet4"`, tự động nạp lại trong `setup()` khi bật nguồn hoặc thức dậy từ Deep Sleep. |
| **7** | **Quản lý Danh bạ Khẩn cấp 2 chiều (`p1..p5`)** | Đã đọc `contacts.p1..p5` từ `/helmets/helmet01/config` và gửi trạng thái đang dùng lên `/status/contacts`. | ⚠️ Cần tinh chỉnh | Cho phép cập nhật `configVersion` độc lập với danh bạ, và hỗ trợ xóa/thay đổi số mặc định ngay từ Web. |

---

## 2. Chi Tiết 5 Hạng Mục Cần Cập Nhật Trong `SmartHelmet_V2_1.ino`

### Hạng mục 1: Điều chỉnh chu kỳ gửi Heartbeat (`SERVICE_SYNC_PERIOD_MS`) cho khớp Timeout 16 giây
- **Vị trí trong file:** Dòng `94` của [SmartHelmet_V2_1.ino](file:///d:/anhc_ws/Web_helmet/SmartHelmet_V2_1.ino#L94)
- **Nguyên nhân:** Website quy định nếu quá **16 giây** không nhận được gói tin mới (`lastSeen` không đổi), giao diện sẽ tự động chuyển từ **Online** sang **Offline**. Hiện tại Firmware đặt `SERVICE_SYNC_PERIOD_MS = 15000` (15 giây), cộng thêm thời gian bắt tay TLS + HTTP `GET`/`PATCH` (~1.5 – 2.5 giây) sẽ làm tổng chu kỳ lên tới **16.5 – 17.5 giây**, khiến Website bị nhấp nháy **Offline**.
- **Cách sửa:**

```cpp
// Thay dòng 94:
// static constexpr uint32_t SERVICE_SYNC_PERIOD_MS = 15000;
// Thành (đồng bộ mỗi 4 giây khi đang thức):
static constexpr uint32_t SERVICE_SYNC_PERIOD_MS = 4000;
```

---

### Hạng mục 2: Khai báo 4 Chế độ hoạt động (`helmet`, `wheelchair`, `motorbike`, `backpack`) & Bộ ngưỡng động
- **Vị trí trong file:** Khu vực cấu hình ngưỡng MPU6050 (Dòng `128–164` và Dòng `363–368` của [SmartHelmet_V2_1.ino](file:///d:/anhc_ws/Web_helmet/SmartHelmet_V2_1.ino#L128-L164))
- **Yêu cầu đồng bộ với Website:**
  Website sử dụng 4 chế độ với bộ ngưỡng chuẩn như sau:
  1. **`helmet` (Mũ bảo hiểm):** Va chạm `≥ 3.2 g`, Góc nghiêng `≥ 60°`, Vận tốc góc `≥ 180 °/s`, Chờ hủy SOS `15 giây`
  2. **`wheelchair` (Xe lăn):** Va chạm `≥ 1.8 g`, Góc nghiêng `≥ 35°`, Vận tốc góc `≥ 95 °/s`, Chờ hủy SOS `12 giây`
  3. **`motorbike` (Xe máy):** Va chạm `≥ 4.5 g`, Góc nghiêng `≥ 65°`, Vận tốc góc `≥ 240 °/s`, Chờ hủy SOS `15 giây`
  4. **`backpack` (Balo):** Va chạm `≥ 2.6 g`, Góc nghiêng `≥ 55°`, Vận tốc góc `≥ 140 °/s`, Chờ hủy SOS `15 giây`

- **Cần bổ sung vào phần biến toàn cục (sau dòng `367`):**

```cpp
// ---- Cấu hình 4 Chế độ hoạt động & Bộ ngưỡng động (Đồng bộ với CAS-BOX Web) ----
struct RuntimeModeThresholds {
  String mode;                  // "helmet" | "wheelchair" | "motorbike" | "backpack"
  float impactThresholdG;       // Ngưỡng gia tốc va chạm G-Shock (g)
  float tiltAngleThresholdDeg;  // Ngưỡng góc nghiêng phát hiện ngã (độ)
  float gyroThresholdDps;       // Ngưỡng vận tốc góc con quay (°/s)
  uint32_t cancelWindowSec;     // Thời gian đếm ngược chờ nhấn nút hủy SOS (giây)
  uint8_t motionThrReg;         // Thanh ghi R_MOT_THR đánh thức MPU6050 khỏi Deep Sleep
};

RuntimeModeThresholds activeModeCfg = {
  "helmet",
  3.2f,
  60.0f,
  180.0f,
  15,
  20
};

// Hàm áp dụng bộ ngưỡng mặc định theo tên Mode
void applyPresetThresholdsForMode(const String &modeId, RuntimeModeThresholds &cfg) {
  if (modeId == "wheelchair") {
    cfg.mode                  = "wheelchair";
    cfg.impactThresholdG      = 1.8f;
    cfg.tiltAngleThresholdDeg = 35.0f;
    cfg.gyroThresholdDps      = 95.0f;
    cfg.cancelWindowSec       = 12;
    cfg.motionThrReg          = 12;
  } else if (modeId == "motorbike") {
    cfg.mode                  = "motorbike";
    cfg.impactThresholdG      = 4.5f;
    cfg.tiltAngleThresholdDeg = 65.0f;
    cfg.gyroThresholdDps      = 240.0f;
    cfg.cancelWindowSec       = 15;
    cfg.motionThrReg          = 28;
  } else if (modeId == "backpack") {
    cfg.mode                  = "backpack";
    cfg.impactThresholdG      = 2.6f;
    cfg.tiltAngleThresholdDeg = 55.0f;
    cfg.gyroThresholdDps      = 140.0f;
    cfg.cancelWindowSec       = 15;
    cfg.motionThrReg          = 16;
  } else {
    cfg.mode                  = "helmet";
    cfg.impactThresholdG      = 3.2f;
    cfg.tiltAngleThresholdDeg = 60.0f;
    cfg.gyroThresholdDps      = 180.0f;
    cfg.cancelWindowSec       = 15;
    cfg.motionThrReg          = 20;
  }
}
```

---

### Hạng mục 3: Lưu và Khôi phục Mode từ Bộ nhớ NVS Flash (Test Persistence sau khi mất nguồn / Deep Sleep)
- **Vị trí trong file:** Khu vực NVS `loadContacts()` / `saveContacts()` (Dòng `1372–1407` và `setup()` Dòng `2535` của [SmartHelmet_V2_1.ino](file:///d:/anhc_ws/Web_helmet/SmartHelmet_V2_1.ino#L1372-L1407))
- **Yêu cầu:** Khi người dùng chuyển sang chế độ `motorbike` trên Web, sau đó tắt nguồn ESP32 hoặc cho vào Deep Sleep rồi bật lại, ESP32 phải tự động nạp lại chế độ `motorbike` cùng bộ ngưỡng từ NVS Flash thay vì bị reset về `helmet`.
- **Code cần thêm ngay dưới hàm `saveContacts()`:**

```cpp
void saveModeConfigToNVS(const RuntimeModeThresholds &cfg, uint32_t version) {
  prefs.begin("helmet4", false);
  if (prefs.getString("mode", "") != cfg.mode)
    prefs.putString("mode", cfg.mode);
  if (prefs.getFloat("impG", 0) != cfg.impactThresholdG)
    prefs.putFloat("impG", cfg.impactThresholdG);
  if (prefs.getFloat("tiltD", 0) != cfg.tiltAngleThresholdDeg)
    prefs.putFloat("tiltD", cfg.tiltAngleThresholdDeg);
  if (prefs.getFloat("gyroD", 0) != cfg.gyroThresholdDps)
    prefs.putFloat("gyroD", cfg.gyroThresholdDps);
  if (prefs.getUInt("alrtS", 0) != cfg.cancelWindowSec)
    prefs.putUInt("alrtS", cfg.cancelWindowSec);
  if (prefs.getUInt("cver", 0) != version)
    prefs.putUInt("cver", version);
  prefs.end();
  contactsVersion = version;
}

void loadModeConfigFromNVS() {
  prefs.begin("helmet4", true);
  String savedMode = prefs.getString("mode", "helmet");
  contactsVersion  = prefs.getUInt("cver", 0);
  applyPresetThresholdsForMode(savedMode, activeModeCfg);

  activeModeCfg.impactThresholdG      = prefs.getFloat("impG", activeModeCfg.impactThresholdG);
  activeModeCfg.tiltAngleThresholdDeg = prefs.getFloat("tiltD", activeModeCfg.tiltAngleThresholdDeg);
  activeModeCfg.gyroThresholdDps      = prefs.getFloat("gyroD", activeModeCfg.gyroThresholdDps);
  activeModeCfg.cancelWindowSec       = prefs.getUInt("alrtS", activeModeCfg.cancelWindowSec);
  prefs.end();

  Serial.printf("[MODE NVS] Restored mode='%s' (v%lu) | G>=%.1f | Tilt>=%.0f deg | Gyro>=%.0f dps | Cancel=%lu s\n",
                activeModeCfg.mode.c_str(),
                (unsigned long)contactsVersion,
                activeModeCfg.impactThresholdG,
                activeModeCfg.tiltAngleThresholdDeg,
                activeModeCfg.gyroThresholdDps,
                (unsigned long)activeModeCfg.cancelWindowSec);
}
```
> **Lưu ý trong `setup()` (Dòng `2535`):** Ngay dưới lệnh `loadContacts();`, gọi thêm `loadModeConfigFromNVS();` để mọi chu kỳ khởi động hoặc thức dậy từ Deep Sleep đều khôi phục đúng Mode đã lưu.

---

### Hạng mục 4: Nâng cấp `applyRemoteConfig()` & `buildStatusJson()` để đồng bộ Cấu hình và gửi ACK lên Website
- **Vị trí trong file:** Dòng `1444–1502` (`applyRemoteConfig`) và Dòng `1632–1717` (`buildStatusJson`) của [SmartHelmet_V2_1.ino](file:///d:/anhc_ws/Web_helmet/SmartHelmet_V2_1.ino#L1444-L1502).
- **Vấn đề hiện tại:**
  1. Website đẩy cấu hình Mode xuống `/helmets/helmet01/config` với cấu trúc:
     ```json
     {
       "mode": "wheelchair",
       "modeLabel": "Xe lăn",
       "configVersion": 4,
       "thresholds": {
         "impactThresholdG": 1.8,
         "tiltAngleThresholdDeg": 35,
         "gyroThresholdDps": 95,
         "cancelWindowSec": 12
       },
       "contacts": {
         "p1": "+84947426157",
         "p2": "+84376087754"
       },
       "updatedAt": 1795400000000
     }
     ```
  2. Hàm `applyRemoteConfig()` hiện tại chỉ đọc `cd["version"]` (không đọc `cd["configVersion"]`) và **bắt buộc phải có `contacts` khác rỗng mới chịu lưu `contactsVersion`**. Nếu người dùng đổi Mode từ `helmet` → `wheelchair` khi chưa có nhánh `contacts` trong `/config`, ESP32 sẽ báo `"empty list ignored"` và không tăng `configVersion`, khiến Website đứng ở trạng thái `"Đang đồng bộ..."`.

- **Code thay thế hoàn chỉnh cho `applyRemoteConfig()` (Dòng `1444–1502`):**

```cpp
bool applyRemoteConfig(const String &json) {
  JsonDocument d;
  DeserializationError err = deserializeJson(d, json);
  if (err) {
    Serial.printf("[CONFIG] JSON error: %s\n", err.c_str());
    lastConfigNote = "config JSON error";
    return false;
  }
  if (d.isNull()) {
    Serial.println("[CONFIG] No config node on the server yet; keeping local NVS state.");
    lastConfigNote = "no config on server";
    return true;
  }

  const JsonDocument &cd = d;
  // Hỗ trợ cả "configVersion" (chuẩn mới trên Web) và "version" (chuẩn cũ)
  uint32_t ver = cd["configVersion"] | (cd["version"] | contactsVersion);
  bool changed = false;

  // 1. Đọc & Áp dụng Chế độ hoạt động (helmet | wheelchair | motorbike | backpack) + Bộ ngưỡng
  const char *remoteModeCStr = cd["mode"] | "";
  String remoteMode = String(remoteModeCStr);
  remoteMode.trim();

  if (remoteMode == "helmet" || remoteMode == "wheelchair" ||
      remoteMode == "motorbike" || remoteMode == "backpack") {
    RuntimeModeThresholds nextCfg = activeModeCfg;
    applyPresetThresholdsForMode(remoteMode, nextCfg);

    JsonVariantConst th = cd["thresholds"];
    if (!th.isNull()) {
      nextCfg.impactThresholdG      = th["impactThresholdG"] | nextCfg.impactThresholdG;
      nextCfg.tiltAngleThresholdDeg = th["tiltAngleThresholdDeg"] | nextCfg.tiltAngleThresholdDeg;
      nextCfg.gyroThresholdDps      = th["gyroThresholdDps"] | nextCfg.gyroThresholdDps;
      nextCfg.cancelWindowSec       = th["cancelWindowSec"] | nextCfg.cancelWindowSec;
    }

    bool modeDiff = (nextCfg.mode != activeModeCfg.mode) ||
                    (fabsf(nextCfg.impactThresholdG - activeModeCfg.impactThresholdG) > 0.01f) ||
                    (fabsf(nextCfg.tiltAngleThresholdDeg - activeModeCfg.tiltAngleThresholdDeg) > 0.1f) ||
                    (fabsf(nextCfg.gyroThresholdDps - activeModeCfg.gyroThresholdDps) > 0.1f) ||
                    (nextCfg.cancelWindowSec != activeModeCfg.cancelWindowSec);

    if (modeDiff || ver != contactsVersion) {
      activeModeCfg = nextCfg;
      saveModeConfigToNVS(activeModeCfg, ver);
      changed = true;
      Serial.printf("[CONFIG] Applied mode='%s' (v%lu) to NVS.\n",
                    activeModeCfg.mode.c_str(), (unsigned long)ver);
    }
  }

  // 2. Đọc & Áp dụng Danh bạ Khẩn cấp (nếu có nhánh contacts trong /config)
  JsonVariantConst cn = cd["contacts"];
  if (!cn.isNull()) {
    String list[MAX_CONTACTS];
    uint8_t n = 0;
    for (uint8_t i = 0; i < MAX_CONTACTS; ++i) {
      JsonVariantConst node;
      if (cn.is<JsonArrayConst>()) node = cn[i];
      else {
        char k[4];
        snprintf(k, sizeof(k), "p%u", (unsigned)(i + 1));
        node = cn[k];
      }
      String raw;
      if (node.is<const char *>()) raw = String(node.as<const char *>());
      else raw = String(node["phone"] | "");
      raw.trim();
      if (raw.length() == 0) continue;
      String p = normalizePhone(raw);
      if (!phoneOk(p)) continue;

      bool dup = false;
      for (uint8_t j = 0; j < n; ++j)
        if (list[j] == p) dup = true;
      if (!dup && n < MAX_CONTACTS) list[n++] = p;
    }

    if (n > 0) {
      bool sameContacts = (n == contactCount);
      for (uint8_t i = 0; sameContacts && i < n; ++i)
        if (list[i] != contacts[i]) sameContacts = false;

      if (!sameContacts || ver != contactsVersion) {
        saveContacts(list, n, ver);
        changed = true;
      }
    }
  }

  // Cập nhật version để gửi ACK về Web kể cả khi chỉ thay đổi version
  if (ver != contactsVersion) {
    saveModeConfigToNVS(activeModeCfg, ver);
    changed = true;
  }

  if (changed) {
    logEvent(EV_CONFIG_APPLIED, (int16_t)ver);
    lastConfigNote = "applied";
  } else {
    lastConfigNote = "up to date";
  }
  return true;
}
```

- **Cập nhật trong `buildStatusJson()` (Dòng `1642` & `1686–1709`):**
  1. Gửi trường `d["mode"] = activeModeCfg.mode;` để Website biết chính xác chế độ hiện tại đang nạp trong ESP32.
  2. Gửi `d["deepSleep"] = false;` khi đang thức gửi gói tin (và chỉ gửi `deepSleep: true` trước khi ngủ).
  3. Gửi `g["sats"]` và `g["hdop"]` ngay cả khi `gpsCurrent() == false` để Website hiển thị tiến độ bắt vệ tinh.

```cpp
  // Trong buildStatusJson(const char *reason):
  d["mode"] = activeModeCfg.mode;               // BỔ SUNG: Mode hiện tại đang chạy trên ESP32
  d["deepSleep"] = (strcmp(reason, "entering_sleep") == 0); // SỬA DÒNG 1642: false khi đang thức
  d["configVersion"] = contactsVersion;         // ACK version để Web chuyển sang "Đã áp dụng"
  d["configNote"] = String("applied:") + activeModeCfg.mode + "_v" + String(contactsVersion);

  // Phần GPS (Dòng 1695-1709):
  JsonObject g = d["gps"].to<JsonObject>();
  bool cur = gpsCurrent();
  g["valid"] = cur;
  if (gps.satellites.isValid()) g["sats"] = gps.satellites.value();
  if (gps.hdop.isValid()) g["hdop"] = gps.hdop.hdop();
  if (cur) {
    g["lat"] = gps.location.lat();
    g["lon"] = gps.location.lng();
    g["ageMs"] = gps.location.age();
  } else if (hasPreviousFix) {
    g["lat"] = previousFix.latitude;
    g["lon"] = previousFix.longitude;
    g["lastLat"] = previousFix.latitude;
    g["lastLon"] = previousFix.longitude;
    g["lastUtcYMD"] = previousFix.utcDateYMD;
    g["lastUtcHMS"] = previousFix.utcTimeHMS;
  }
```

---

### Hạng mục 5: Kết nối Bộ ngưỡng động (`activeModeCfg`) vào Thuật toán Phát hiện Ngã & Báo động SOS
- **Vị trí trong file:**
  1. Hàm `imuArmMotionWake()` (Dòng `610`):
     - Thay `writeReg(R_MOT_THR, MOTION_THR_REG);` bằng `writeReg(R_MOT_THR, activeModeCfg.motionThrReg);`
  2. Hàm `filterAfterWake()` (Dòng `2258` & `2271–2272`):
     - Thay các hằng số cứng `PRECHECK_TILT_DEG`, `IMPACT_G`, `IMPACT_ROTATION_DPS` bằng ngưỡng của Mode hiện tại:
       ```cpp
       if (lastTilt >= activeModeCfg.tiltAngleThresholdDeg) {
         if (!tiltedSince) tiltedSince = now;
         if (now - tiltedSince >= POSTURE_HOLD_MS) persistentTilt = true;
       }
       // ...
       bool possiblePostureFall = persistentTilt && lastTilt >= activeModeCfg.tiltAngleThresholdDeg;
       bool possibleImpact = maxG >= activeModeCfg.impactThresholdG &&
                             maxGyro >= activeModeCfg.gyroThresholdDps &&
                             lastTilt >= IMPACT_POST_TILT_DEG;
       ```
  3. Hàm `runAlert()` (Dòng `2149` & `2194`):
     - Thay thời gian chờ hủy báo động cố định `ALERT_MS` (`15000 ms`) bằng `uint32_t alertWindowMs = activeModeCfg.cancelWindowSec * 1000UL;` (ví dụ: chế độ Xe lăn `wheelchair` sẽ đếm ngược `12 giây`, các chế độ khác `15 giây`).

---

## 3. Sơ Đồ Luồng Đồng Bộ Dữ Liệu Firebase Realtime Database Chuẩn

```
https://smart-helmet-iot-efc7e-default-rtdb.firebaseio.com/
└── helmets/
    └── helmet01/
        ├── status/                  <-- ESP32 ghi (PATCH mỗi 4 giây) | Website lắng nghe Real-time
        │   ├── online: true
        │   ├── lastSeen: { ".sv": "timestamp" }   (UTC Epoch ms -> Web tự đổi sang UTC+7)
        │   ├── fw: "5.0"
        │   ├── mode: "motorbike"                  (ACK chế độ hiện tại đang nạp trong NVS)
        │   ├── configVersion: 4                   (ACK khớp với config/configVersion -> Web báo "Đã áp dụng")
        │   ├── configNote: "applied:motorbike_v4"
        │   ├── deepSleep: false
        │   ├── imuFault: false
        │   ├── ip: "10.83.253.146"
        │   ├── wifiRssi: -54
        │   ├── uptimeS: 120
        │   ├── simMode: "REAL"
        │   ├── sosPending: false
        │   ├── contacts/
        │   │   ├── p1: "+84947426157"
        │   │   └── p2: "+84376087754"
        │   ├── gps/
        │   │   ├── valid: true
        │   │   ├── lat: 15.958122
        │   │   ├── lon: 108.255669
        │   │   ├── sats: 12
        │   │   ├── hdop: 0.69
        │   │   └── ageMs: 850
        │   └── mpu/
        │       ├── valid: true
        │       ├── accel: { x, y, z }
        │       ├── gyro:  { x, y, z }
        │       ├── raw:   { x, y, z }
        │       ├── totalG: 0.998
        │       ├── gyroMagnitudeDps: 0.48
        │       ├── tiltDeg: 6.46
        │       └── sampleUptimeMs: 120450
        │
        ├── config/                  <-- Website ghi khi đổi Mode / Danh bạ | ESP32 đọc (GET mỗi chu kỳ)
        │   ├── mode: "motorbike"
        │   ├── modeLabel: "Xe máy"
        │   ├── configVersion: 4
        │   ├── thresholds: { impactThresholdG: 4.5, tiltAngleThresholdDeg: 65, gyroThresholdDps: 240, cancelWindowSec: 15 }
        │   ├── contacts: { p1: "+84947426157", p2: "+84376087754" }
        │   └── updatedAt: 1795400000000
        │
        ├── emergencyContacts/       <-- Website lưu chi tiết tên, quan hệ, cờ SMS/Call của người thân
        ├── sos/                     <-- ESP32 ghi (PUT) bản ghi SOS mới nhất
        └── events/                  <-- ESP32 ghi (PUT) lịch sử các lần phát tín hiệu SOS
```
