# SMART HELMET – IoT Safety Monitoring Website

Hệ thống Website IoT Dashboard giám sát an toàn và cảnh báo khẩn cấp SOS cho **Smart Helmet (Mũ bảo hiểm thông minh phát hiện té ngã)**.

## 1. Cấu Hình Phần Cứng Mục Tiêu
- **MCU trung tâm:** ESP32-S3 Mini
- **Cảm biến va chạm & tư thế:** MPU6050 (6-Axis Accelerometer & Gyroscope)
- **Kết nối 4G LTE / SMS / SOS Call:** SIMCom A7680C V2
- **Định vị GNSS:** GPS u-blox NEO-M10N
- **Ngoại vi trên mũ:** Active Buzzer, High-Lumen LED, Physical Cancel Button, Li-Po Battery

## 2. Cấu Trúc Thư Mục Dự Án
```text
d:\anhc_ws\Web_helmet\
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/
    │   └── helmet.ts               # Định nghĩa kiểu dữ liệu Telemetry, SOS, Event, Contact, Config, RBAC
    ├── mocks/
    │   └── mockData.ts             # Tách biệt hoàn toàn dữ liệu mô phỏng (Mock Data)
    ├── services/
    │   └── helmetApiService.ts     # Tầng API Service & Đặc tả JSON Payload / PostgreSQL Schema cho ESP32
    └── components/
        ├── DashboardView.tsx       # Tổng quan trạng thái, MPU6050 live, biểu đồ & thanh mô phỏng phần cứng
        ├── SOSEmergencyCenterView.tsx # Trung tâm tiếp nhận, người thân xác nhận & xử lý sự cố SOS
        ├── GPSTrackingView.tsx     # Bản đồ Leaflet + OpenStreetMap định vị mũ & điểm tai nạn + Google Maps
        ├── EventHistoryView.tsx    # Lịch sử 6 nhóm sự kiện, tìm kiếm, lọc và xem chi tiết snapshot cảm biến
        ├── EmergencyContactsView.tsx  # Quản lý danh bạ người thân, cờ SMS/Call và thứ tự ưu tiên
        ├── DeviceSettingsView.tsx  # Cấu hình Cancel Window (10-15s), ngưỡng va chạm, tiết kiệm pin & Sync OTA
        └── AuthProfileView.tsx     # Đăng nhập/Đăng ký, hồ sơ y tế khẩn cấp & phân quyền Owner/Contact/Admin
```

## 3. Hướng Dẫn Chạy Dự Án
```bash
npm install
npm run dev
```
