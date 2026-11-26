# CAS-BOX — Hệ Thống Giám Sát An Toàn & Cảnh Báo Khẩn Cấp IoT

Nền tảng Website IoT Dashboard phục vụ quản lý, theo dõi trạng thái hoạt động theo thời gian thực và điều phối danh bạ cảnh báo khẩn cấp SOS cho thiết bị **CAS-BOX (Thiết bị giám sát an toàn & phát hiện té ngã thông minh)**.

Hệ thống kết nối đồng bộ hai chiều theo thời gian thực giữa phần cứng nhúng (**ESP32-S3 Super Mini**), nền tảng đám mây (**Firebase Realtime Database & Firebase Authentication**) và giao diện quản trị người dùng (**React + TypeScript**).

---

## Mục Lục

1. [Kiến Trúc Hệ Thống & Công Nghệ](#1-kiến-trúc-hệ-thống--công-nghệ)
2. [Cấu Trúc Thư Mục Dự Án](#2-cấu-trúc-thư-mục-dự-án)
3. [Cấu Trúc Dữ Liệu Cloud (Firebase Realtime Database)](#3-cấu-trúc-dữ-liệu-cloud-firebase-realtime-database)
4. [Yêu Cầu & Cài Đặt Môi Trường Phát Triển](#4-yêu-cầu--cài-đặt-môi-trường-phát-triển)
5. [Cấu Hình Firebase & Biến Môi Trường (.env)](#5-cấu-hình-firebase--biến-môi-trường-env)
6. [Vận Hành Ở Môi Trường Local (Development)](#6-vận-hành-ở-môi-trường-local-development)
7. [Đóng Gói & Triển Khai Sản Phẩm (Production Deployment)](#7-đóng-gói--triển-khai-sản-phẩm-production-deployment)
8. [Hướng Dẫn Kiểm Thử & Khắc Phục Sự Cố](#8-hướng-dẫn-kiểm-thử--khắc-phục-sự-cố)

---

## 1. Kiến Trúc Hệ Thống & Công Nghệ

### 1.1. Thành Phần Phần Cứng (Edge Node)
- **Vi điều khiển trung tâm (MCU):** ESP32-S3 Super Mini
- **Cảm biến quán tính (IMU):** MPU6050 (Gia tốc 3 trục `ax, ay, az`, Con quay hồi chuyển `gx, gy, gz` và Tổng hợp lực `totalG`)
- **Định vị vệ tinh (GNSS):** GPS u-blox NEO-M10N (`latitude`, `longitude`, `satellites`, `hdop`, `fix`)
- **Truyền thông & Cảnh báo:** Wi-Fi / 4G LTE (SIMCom A7680C V2), Còi báo động (Active Buzzer), Đèn cảnh báo (LED) và Nút nhấn hủy báo động vật lý (`cancelPressed`)

### 1.2. Thành Phần Phần Mềm (Web Dashboard & Cloud)
| Phân tầng | Công nghệ sử dụng | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + TypeScript 5 | Xây dựng giao diện SPA có kiểm soát kiểu dữ liệu chặt chẽ |
| **Build Tool** | Vite 5 | Tối ưu hóa tốc độ phát triển (HMR) và đóng gói bundle Production |
| **UI & Styling** | Tailwind CSS 3 + Lucide Icons | Thiết kế giao diện chuẩn Enterprise Dashboard, trực quan, responsive |
| **Bản đồ số & Geocoding** | Leaflet + OpenStreetMap + Nominatim | Hiển thị vị trí thực tế trên bản đồ và tự động phân giải tọa độ GPS sang địa chỉ đường/phường/quận |
| **Realtime Cloud & Auth** | Firebase Realtime Database + Firebase Auth | Đồng bộ dữ liệu cảm biến, trạng thái pin, hồ sơ cá nhân và danh bạ khẩn cấp với độ trễ thấp |
| **Cloud Hosting** | Firebase Hosting | Lưu trữ và phân phối ứng dụng Web qua mạng lưới CDN toàn cầu kèm chứng chỉ SSL |

---

## 2. Cấu Trúc Thư Mục Dự Án

```text
Web_helmet/
├── firmware/
│   └── esp32_emergency_contacts_sync.ino  # Mã nguồn mẫu ESP32-S3 đồng bộ danh bạ từ Firebase & lưu NVS Flash
├── src/
│   ├── components/
│   │   ├── LoginGateView.tsx              # Cổng xác thực người dùng trước khi truy cập Dashboard
│   │   ├── DashboardView.tsx              # Trang Tổng quan: trạng thái thiết bị, Pin, Wi-Fi, GPS, MPU6050
│   │   ├── GPSTrackingView.tsx            # Trang Bản đồ vị trí: định vị trực tiếp & liên kết Google Maps
│   │   ├── EventHistoryView.tsx           # Trang Nhật ký hoạt động: tra cứu, lọc và xem chi tiết sự kiện
│   │   ├── EmergencyContactsView.tsx      # Trang Người thân nhận tin: CRUD & sắp xếp độ ưu tiên real-time
│   │   ├── DeviceSettingsView.tsx         # Cấu hình tham số thiết bị
│   │   └── AuthProfileView.tsx            # Trang Hồ sơ cá nhân: cập nhật thông tin chủ mũ & y tế lên Cloud
│   ├── hooks/
│   │   ├── useHelmetTelemetry.ts          # Hook lắng nghe nhánh telemetry, kiểm tra trễ (>90s) & Reverse Geocoding
│   │   ├── useSmartBatteryEstimator.ts    # Hook tính toán dung lượng Pin Li-Po (Coulomb Counting) & đồng bộ Cloud
│   │   ├── useEmergencyContacts.ts        # Hook đồng bộ thời gian thực danh bạ người thân
│   │   └── useUserProfile.ts              # Hook đồng bộ thông tin hồ sơ người dùng với Cloud
│   ├── services/
│   │   ├── firebaseService.ts             # Khởi tạo kết nối Firebase SDK, Auth và Realtime Listener
│   │   ├── emergencyContactsService.ts    # Xử lý CRUD danh bạ, chuẩn hóa & kiểm tra số điện thoại Việt Nam
│   │   ├── userProfileService.ts          # Đọc/ghi hồ sơ cá nhân trên Firebase
│   │   └── helmetApiService.ts            # Tầng dịch vụ khởi tạo dữ liệu nền
│   ├── types/
│   │   └── helmet.ts                      # Định nghĩa toàn bộ TypeScript Interfaces của hệ thống
│   ├── mocks/
│   │   └── mockData.ts                    # Dữ liệu mẫu phục vụ khởi tạo ban đầu
│   ├── App.tsx                            # Khung bố cục chính (Sidebar cố định, Header và Router điều hướng)
│   ├── main.tsx                           # Điểm khởi chạy ứng dụng React
│   └── index.css                          # Cấu hình Tailwind CSS và tùy chỉnh giao diện bản đồ Leaflet
├── .env.example                           # File mẫu cấu hình biến môi trường Firebase
├── .firebaserc                            # Cấu hình liên kết Firebase Project (smart-helmet-iot-efc7e)
├── firebase.json                          # Cấu hình triển khai Firebase Hosting (SPA rewrites)
├── package.json                           # Danh sách thư viện và kịch bản lệnh (scripts)
├── tailwind.config.js                     # Cấu hình Tailwind CSS
├── tsconfig.json                          # Cấu hình trình biên dịch TypeScript
└── vite.config.ts                         # Cấu hình trình đóng gói Vite
```

---

## 3. Cấu Trúc Dữ Liệu Cloud (Firebase Realtime Database)

Hệ thống tổ chức dữ liệu theo từng mã thiết bị tại nhánh `devices/{deviceId}` (mặc định `devices/helmet-001`), tách biệt rõ nhánh dữ liệu do ESP32 gửi lên (`telemetry`) và các nhánh cấu hình/trạng thái đồng bộ từ Website (`batteryState`, `emergencyContacts`, `profile`):

```json
{
  "devices": {
    "helmet-001": {
      "telemetry": {
        "deviceId": "helmet-001",
        "firmwareVersion": "wifi-telemetry-demo-1.0",
        "updatedAt": 1763689000000,
        "device": {
          "mode": "active",
          "uptimeSeconds": 1420
        },
        "gps": {
          "fix": true,
          "latitude": 15.958106,
          "longitude": 108.255702,
          "satellites": 12,
          "hdop": 0.58
        },
        "mpu": {
          "available": true,
          "ax": 0.32,
          "ay": 0.11,
          "az": 9.81,
          "gx": -0.029,
          "gy": -0.015,
          "gz": -0.043,
          "totalG": 1.02
        },
        "network": {
          "transport": "wifi",
          "wifiConnected": true,
          "wifiRssiDbm": -68
        },
        "battery": {
          "adcMillivolts": 122
        },
        "button": {
          "cancelPressed": false
        }
      },
      "batteryState": {
        "soc": 83.25,
        "percentage": 83,
        "voltageV": 3.99,
        "isCharging": false,
        "lastEspUptimeSec": 1420,
        "lastTimestampMs": 1763689000000
      },
      "contactsUpdatedAt": 1763696300000,
      "emergencyContacts": {
        "contact_1": {
          "id": "contact_1",
          "priority": 1,
          "name": "Huỳnh Minh Tuấn",
          "relationship": "Anh trai",
          "phone": "0909128456",
          "smsEnabled": true,
          "callEnabled": true,
          "updatedAt": 1763696300000
        }
      },
      "profile": {
        "id": "USR-01",
        "fullName": "Huỳnh Công An",
        "email": "device-helmet@email.com",
        "phone": "0938 412 889",
        "role": "OWNER",
        "avatarInitials": "CA",
        "bloodType": "O+",
        "medicalNotes": "Không dị ứng thuốc.",
        "updatedAt": 1763696500000
      }
    }
  }
}
```

---

## 4. Yêu Cầu & Cài Đặt Môi Trường Phát Triển

### 4.1. Phần Mềm Tiên Quyết (Prerequisites)
- **Node.js:** Phiên bản `>= 18.0.0` (Khuyến nghị bản LTS `v20.x` hoặc `v22.x` / `v24.x`).
- **Trình quản lý gói:** `npm` (đi kèm với Node.js, phiên bản `>= 9.x`).
- **Git:** Dùng để quản lý mã nguồn và hỗ trợ CI/CD.
- **Firebase CLI** *(tùy chọn khi triển khai Hosting từ máy cá nhân)*:
  ```powershell
  npm install -g firebase-tools
  ```

### 4.2. Cài Đặt Thư Viện Dự Án
Mở Terminal / PowerShell tại thư mục gốc của dự án và thực thi:

```powershell
# 1. Di chuyển vào thư mục dự án
cd d:\anhc_ws\Web_helmet

# 2. Cài đặt toàn bộ gói thư viện phụ thuộc (Dependencies)
npm install
```

---

## 5. Cấu Hình Firebase & Biến Môi Trường (.env)

### 5.1. Thiết Lập Biến Môi Trường
Dự án sử dụng biến môi trường của Vite (`VITE_*`) để bảo mật thông tin kết nối Firebase.

1. Sao chép file mẫu `.env.example` thành file `.env` tại thư mục gốc:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Mở [Firebase Console](https://console.firebase.google.com/) → chọn project **`smart-helmet-iot-efc7e`** → vào **Project Settings** → mục **Your apps (Web App)** để lấy bộ thông số `firebaseConfig`.
3. Điền đầy đủ thông tin vào file `.env`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSyYourActualApiKeyHere
   VITE_FIREBASE_AUTH_DOMAIN=smart-helmet-iot-efc7e.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://smart-helmet-iot-efc7e-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=smart-helmet-iot-efc7e
   VITE_FIREBASE_STORAGE_BUCKET=smart-helmet-iot-efc7e.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=1:your_app_id:web:abcdef
   VITE_HELMET_DEVICE_ID=helmet-001
   ```
   *(Lưu ý: File `.env` đã được khai báo trong `.gitignore` để không bao giờ bị đẩy lên kho lưu trữ Git công khai).*

### 5.2. Cấu Hình Firebase Authentication & Security Rules
1. Trong **Firebase Console → Build → Authentication → Sign-in method**, kích hoạt phương thức **Email/Password** và tạo tài khoản quản trị trong tab **Users**.
2. Trong **Firebase Console → Build → Realtime Database → Rules**, thiết lập quy tắc phân quyền chỉ cho phép người dùng đã xác thực đọc và ghi dữ liệu:
   ```json
   {
     "rules": {
       "devices": {
         "$deviceId": {
           ".read": "auth != null",
           ".write": "auth != null"
         }
       }
     }
   }
   ```

---

## 6. Vận Hành Ở Môi Trường Local (Development)

### 6.1. Khởi Chạy Máy Chủ Phát Triển (Dev Server)
```powershell
npm run dev
```
- Sau khi lệnh thực thi, mở trình duyệt tại địa chỉ: **`http://localhost:5173`**
- Mọi chỉnh sửa trong thư mục `src/` sẽ được tự động cập nhật tức thời lên trình duyệt thông qua cơ chế Hot Module Replacement (HMR).

### 6.2. Kiểm Tra Bản Đóng Gói Cục Bộ (Local Production Preview)
Trước khi triển khai lên máy chủ thật, bạn có thể biên dịch và chạy thử bản Production ngay trên máy:
```powershell
# Biên dịch kiểm tra kiểu TypeScript và đóng gói ra thư mục dist/
npm run build

# Khởi chạy máy chủ xem thử bản Production
npx vite preview
```

---

## 7. Đóng Gói & Triển Khai Sản Phẩm (Production Deployment)

Dự án đã được cấu hình sẵn file `firebase.json` (trỏ `site` vào `cas-box`, thư mục `public` vào `dist` kèm quy tắc SPA rewrite) và `.firebaserc` (liên kết tới project `CAS_BOX` / `smart-helmet-iot-efc7e`).

### 7.1. Triển Khai Thủ Công Lên Firebase Hosting
Thực hiện tuần tự các lệnh sau trên Terminal:

```powershell
# Bước 1: Đăng nhập tài khoản Google quản lý Firebase (chỉ cần thực hiện lần đầu)
firebase login

# Bước 2: Biên dịch mã nguồn TypeScript và đóng gói tài nguyên tối ưu vào thư mục dist/
npm run build

# Bước 3: Đẩy bản build lên Firebase Hosting (site: cas-box)
firebase deploy --only hosting:cas-box
```

Sau khi lệnh hoàn tất, Firebase CLI sẽ trả về đường dẫn chính thức của Website:
- **Hosting URL:** `https://cas-box.web.app` (hoặc `https://cas-box.firebaseapp.com`)

### 7.2. Triển Khai Tự Động Qua GitHub Actions (CI/CD)
Nếu bạn đã kích hoạt GitHub Actions khi chạy `firebase init hosting`:
1. Truy cập kho mã nguồn trên GitHub → vào **Settings → Secrets and variables → Actions**.
2. Thêm các Repository Secrets tương ứng với các biến trong file `.env` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_HELMET_DEVICE_ID`).
3. Mỗi khi có lệnh `git push` lên nhánh chính (`main` / `master`), GitHub Actions sẽ tự động chạy `npm ci`, `npm run build` và phát hành phiên bản mới lên Firebase Hosting.

---

## 8. Hướng Dẫn Kiểm Thử & Khắc Phục Sự Cố

### 8.1. Quy Trình Kiểm Thử Đồng Bộ Thực Tế
1. **Kiểm thử Xác thực:** Truy cập Website, đăng nhập bằng tài khoản Email/Mật khẩu đã cấp trên Firebase Authentication. Hệ thống mở quyền truy cập vào trang **Tổng quan**.
2. **Kiểm thử Telemetry ESP32-S3:** Cấp nguồn cho mạch ESP32-S3 Super Mini. Kiểm tra các thông số `Uptime`, `Wi-Fi RSSI (dBm)`, `MPU6050 (ax, ay, az, gx, gy, gz, totalG)`, trạng thái `Nút hủy (Cancel)` và tọa độ `GPS` tự động cập nhật trực tiếp không cần tải lại trang.
3. **Kiểm thử Đồng bộ Danh bạ Khẩn cấp 2 chiều:**
   - Vào tab **Người thân nhận tin**, thêm/sửa số điện thoại hoặc bật/tắt cờ `SMS` / `Cuộc gọi` / đổi thứ tự ưu tiên `↑` `↓`.
   - Mở Serial Monitor (baudrate `115200`) của ESP32 chạy firmware `firmware/esp32_emergency_contacts_sync.ino` để xác nhận mạch tự động tải danh bạ mới trong vòng 1–3 giây và lưu vào bộ nhớ NVS Flash.

### 8.2. Xử Lý Một Số Tình Huống Thường Gặp
- **Thông báo *"Chưa có dữ liệu mới (Mất cập nhật)"*:** Xuất hiện khi trường `updatedAt` trên Firebase không có sự thay đổi quá **90 giây** (ví dụ: mạch ESP32 đang tắt nguồn hoặc mất kết nối Wi-Fi). Ngay khi ESP32 gửi gói tin mới, cảnh báo này sẽ tự động biến mất.
- **Thông báo *"GPS chưa có tín hiệu định vị"*:** Module GPS NEO-M10N đang ở trong nhà hoặc chưa khóa được vệ tinh (`gps.fix = false`). Khi đưa thiết bị ra khu vực thoáng ngoài trời và đạt `gps.fix = true`, bản đồ và địa chỉ đường phố cụ thể sẽ tự động hiển thị.
- **Lỗi `permission_denied` khi đọc dữ liệu:** Kiểm tra lại tài khoản đã đăng nhập hợp lệ chưa và đối chiếu cấu hình trong tab **Realtime Database → Rules** trên Firebase Console.
