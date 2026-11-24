# TỔNG QUAN TÍNH NĂNG WEBSITE CAS-BOX

Tài liệu mô tả ngắn gọn các chức năng chính hiện có trên hệ thống Website giám sát thiết bị an toàn hành trình **CAS-BOX** (kết nối thời gian thực với phần cứng **ESP32** qua **Firebase Realtime Database**).

---

## 1. Đăng Nhập Bảo Mật (Login Gate)
- Yêu cầu người dùng đăng nhập bằng **Email & Mật khẩu** trước khi truy cập vào hệ thống quản lý.
- Phân quyền đọc/ghi dữ liệu an toàn với Cloud, không mở công khai dữ liệu của thiết bị.

---

## 2. Trang Tổng Quan (Dashboard)
Hiển thị toàn bộ trạng thái mới nhất của thiết bị tại đường dẫn `/helmets/helmet01/status` mà không cần tải lại trang:
- **Thông tin thiết bị (`CAS-BOX của [Tên chủ sở hữu]`):**
  - Hiển thị mã thiết bị (`helmet01`), phiên bản Firmware (`fw`), thời gian hoạt động (`uptimeS`), phiên bản cấu hình (`configVersion`) và thời điểm cập nhật gần nhất (`lastSeen`).
  - Tự động cảnh báo **"Mất cập nhật"** nếu thiết bị ngừng gửi dữ liệu mới quá 90 giây, hoặc hiển thị **"Deep Sleep"** khi thiết bị ở chế độ ngủ.
- **Pin & Điện áp:**
  - Hiển thị phần trăm dung lượng pin (`%`) và thời lượng sử dụng ước tính còn lại.
  - Tự động tính toán mức tiêu hao theo thời gian thực dựa trên các module đang bật và đồng bộ lên Cloud để giữ nguyên mức pin khi đăng nhập ở thiết bị khác.
- **Kết nối Wi-Fi & IP:**
  - Hiển thị trạng thái kết nối mạng, cường độ sóng Wi-Fi (`wifiRssi` dBm), địa chỉ IP của thiết bị (`ip`) và trạng thái SIM (`simMode`).
- **Định vị GPS Nhanh:**
  - Hiển thị trạng thái định vị (`valid`), số vệ tinh (`sats`), độ chính xác (`hdop`) và độ tuổi mẫu GPS (`ageMs`).
  - Tự động chuyển đổi tọa độ (`lat, lon`) thành **tên đường, phường/xã, quận/huyện, thành phố** cụ thể kèm nút mở nhanh trên **Google Maps**.
- **Giám sát cảm biến MPU6050 (`status/mpu`):**
  - Hiển thị trạng thái phần cứng IMU (`imuFault`), trạng thái chờ SOS (`sosPending`) và chế độ ngủ (`deepSleep`).
  - Hiển thị **Gia tốc 3 trục** (`accel.x, y, z` đơn vị `g`), **Tổng gia tốc** (`totalG`), **Góc nghiêng** (`tiltDeg`).
  - Hiển thị **Vận tốc góc 3 trục** (`gyro.x, y, z` đơn vị `°/s`), **Độ lớn vận tốc góc** (`gyroMagnitudeDps`).
  - Tự động đọc các trường dữ liệu thô (`status/mpu/raw`) và tự thu thập mẫu trực tiếp trong lúc mở trang để vẽ biểu đồ biến thiên.

---

## 3. Bản Đồ Vị Trí (GPS Tracking)
- Tích hợp bản đồ tương tác **OpenStreetMap (Leaflet)** hiển thị vị trí thực tế của thiết bị.
- Hiển thị địa chỉ đường phố chi tiết, tọa độ `lat / lon`, số vệ tinh (`sats`), `hdop` và độ trễ dữ liệu (`ageMs`).
- Hỗ trợ nút **Định tâm vị trí** và nút **Xem trên Google Maps** để chỉ đường đến vị trí thiết bị.
- Khi thiết bị chưa bắt được sóng vệ tinh (`valid = false`), hệ thống thông báo rõ *"GPS chưa có tín hiệu định vị hợp lệ"* (không hiển thị tọa độ giả).

---

## 4. Nhật Ký Hoạt Động (Event History)
- Ghi nhận và phân loại rõ ràng các sự kiện theo màu sắc & biểu tượng:
  - **Hủy bằng nút bấm** (Người đội nhấn nút xác nhận an toàn).
  - **Tự hủy khi đứng thẳng** (Thiết bị trở lại tư thế bình thường).
  - **Nguy cơ ngã / Va chạm** (Cảnh báo nghiêng xe hoặc chấn động mạnh).
  - **Khẩn cấp SOS** (Gửi tín hiệu cầu cứu khi không có phản hồi hủy).
  - **Pin yếu** (Cảnh báo cần sạc pin).
- Hỗ trợ tìm kiếm theo từ khóa/tên đường, lọc theo từng loại trạng thái và bấm vào từng mục để xem chi tiết thông số tại thời điểm xảy ra sự kiện.

---

## 5. Người Thân Nhận Tin (Emergency Contacts)
- Quản lý danh sách số điện thoại người thân nhận cảnh báo khi xảy ra sự cố:
  - **Thêm / Sửa / Xóa** thông tin người thân (Họ tên, Mối quan hệ, Số điện thoại).
  - Tự động kiểm tra định dạng số di động Việt Nam (10 số) và chống trùng lặp.
  - **Bật / Tắt nhanh** chế độ nhận tin nhắn **SMS** hoặc **Cuộc gọi** cho từng người.
  - **Sắp xếp thứ tự ưu tiên (`↑` / `↓`):** Đánh số thứ tự liên hệ từ trên xuống (`1, 2, 3...`).
- **Đồng bộ 2 chiều với thiết bị ESP32:**
  - Số mặc định từ thiết bị (`status/contacts/p1`) có thể được chỉnh sửa hoặc xóa trực tiếp trên Web.
  - Mọi thay đổi trên Web đều tự động cập nhật ngay xuống nhánh `status/contacts` và `config/contacts` trên Firebase để thiết bị nhận số SOS mới tức thì.

---

## 6. Hồ Sơ Cá Nhân (User Profile)
- Quản lý thông tin chủ thiết bị: *Họ và tên*, *Email*, *Số điện thoại*, *Nhóm máu* và *Ghi chú y tế / Thông tin hỗ trợ*.
- Khi bấm **Lưu hồ sơ**, dữ liệu được đồng bộ trực tiếp lên Cloud và tự động cập nhật tên chủ sở hữu trên toàn bộ giao diện (`CAS-BOX của [Tên mới]`).
- Hỗ trợ chuyển đổi nhanh góc nhìn phân quyền (*Chủ thiết bị*, *Người thân gia đình*, *Quản trị viên*) và **Đăng xuất** an toàn.
