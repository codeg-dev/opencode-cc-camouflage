# opencode-cc-camouflage

Plugin bao trì đồng hành cho OpenCode, hỗ trợ xác minh, áp dụng và hoàn tác
các bản vá liên quan đến plugin xác thực Anthropic. Gói này không phải là bản fork
của các dự án upstream. Nó cung cấp công cụ rõ ràng mà không có hook tự động.

## Đây là gì

`opencode-cc-camouflage` là một plugin bảo trì có các chức năng:

- Xác minh tính an toàn của bản vá trước khi thực hiện bất kỳ thay đổi nào
- Áp dụng các bản vá vào plugin peer khi bạn yêu cầu một cách rõ ràng
- Hoàn tác các bản vá khi bạn cần quay lại trạng thái trước đó
- Báo cáo trạng thái và cung cấp hướng dẫn chẩn đoán

Nó không tự động vá trong quá trình cài đặt. Mọi thay đổi đều yêu cầu lệnh gọi công cụ rõ ràng.

## Các yêu cầu và thứ tự cài đặt

Thứ tự cài đặt rất quan trọng. Bạn cần có các thành phần sau trước khi plugin này hoạt động:

1. **`not-claude-code-emulator`** (commit `5541e5c`)
   - Runtime tin nhắn cung cấp các giao diện tương thích với Anthropic
   - Clone vào `~/github/not-claude-code-emulator`

2. **`opencode-anthropic-auth`** (commit `6594dd1`)
   - Plugin peer xử lý OAuth Anthropic
   - Cài đặt như một plugin OpenCode cùng với gói này

3. **`opencode-cc-camouflage`** (gói này)
   - Cài đặt cuối cùng, sau khi emulator và plugin peer đã có mặt

Xem [docs/install.md](docs/install.md) để biết các bước chi tiết.

## Các công cụ có sẵn

Plugin này cung cấp bốn công cụ rõ ràng. Chúng không phải là hook tự động.

### `status`

Báo cáo trạng thái hiện tại của cài đặt peer.

```bash
bun run status
```

Định dạng đầu ra có thể đọc được bằng máy:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

Mã thoát 0 có nghĩa là trạng thái tốt. Mã thoát 1 có nghĩa là có điều gì đó cần chú ý.

### `doctor`

Cung cấp hướng dẫn chẩn đoán dựa trên trạng thái hiện tại.

```bash
bun run doctor
```

Lệnh này kiểm tra các tệp và báo cáo các bước hành động cụ thể. Nó không cài đặt,
vá, hoặc sửa đổi bất cứ điều gì. Nó chỉ đọc và báo cáo.

### `patch_apply`

Áp dụng bản vá đã ghim vào plugin peer.

```bash
bun run patch:apply
```

Yêu cầu:
- Plugin peer phải có mặt
- Các kiểm tra trước khi vá phải vượt qua
- Thư mục gốc peer có quyền ghi

Nó tạo các điểm đánh dấu hoàn tác trước khi sửa đổi các tệp.

### `patch_revert`

Hoàn tác bản vá đã áp dụng trước đó.

```bash
bun run patch:revert
```

Lệnh này sử dụng các điểm đánh dấu hoàn tác để khôi phục trạng thái trước khi vá. Các điểm đánh dấu phải khớp với hash bản vá hiện tại để quá trình hoàn tác tiến hành.

## Tại sao các hook tự động chỉ xác minh

Các hook tự động (`command.execute.before`, `tool.execute.after`) trong plugin này
chỉ giới hạn ở việc xác minh và metadata. Chúng không tự động áp dụng bản vá vì:

1. Thay đổi một plugin peer mà không có ý định rõ ràng của người dùng vi phạm nguyên tắc
   ít gây ngạc nhiên nhất
2. Các lỗi vá cần được xem xét bởi con người, không phải thử lại âm thầm
3. Hoàn tác yêu cầu sự đồng ý rõ ràng để khôi phục trạng thái

Các hook cảnh báo khi phát hiện sự khác biệt. Bạn quyết định xem có nên áp dụng, hoàn tác, hay
giữ nguyên môi trường.

## Hỗ trợ nền tảng

| Nền tảng | Trạng thái | Ghi chú |
|----------|------------|---------|
| macOS    | Được hỗ trợ | Môi trường desktop chính |
| Linux    | Được hỗ trợ | Các fixture upstream đã ghim tương tự |
| Windows  | Không được hỗ trợ | Không có cam kết v1 |

Xem [docs/support-matrix.md](docs/support-matrix.md) để biết các phiên bản fixture đã khóa.

## Hoàn tác

Nếu bạn cần hoàn tác việc áp dụng bản vá:

```bash
bun run patch:revert
```

Xem [docs/rollback.md](docs/rollback.md) để biết các bước cụ thể và khắc phục sự cố.

## Kiểm tra tương thích (canary)

Để kiểm tra sự khác biệt của upstream so với các mục tiêu đã ghim:

```bash
bun run compat:canary
```

Đây là kiểm tra chỉ đọc xác nhận tính toàn vẹn của fixture và các tham chiếu upstream
mà không sửa đổi gì cả. Nó thoát với mã 0 trên các mục tiêu được hỗ trợ đã ghim.

Xem [docs/next-release.md](docs/next-release.md) để biết chi tiết về quy trình canary.

## Tài liệu

- [docs/install.md](docs/install.md) - Các yêu cầu và bước cài đặt
- [docs/rollback.md](docs/rollback.md) - Các bước hoàn tác cụ thể
- [docs/compatibility.md](docs/compatibility.md) - Ranh giới tương thích
- [docs/next-release.md](docs/next-release.md) - Kiểm tra sự khác biệt upstream
- [docs/support-matrix.md](docs/support-matrix.md) - Các phiên bản fixture đã khóa
- [docs/non-goals.md](docs/non-goals.md) - Các mục nằm ngoài phạm vi rõ ràng
- [docs/patch-inventory.md](docs/patch-inventory.md) - Phân loại tài sản bản vá
- [docs/upstream-locks.md](docs/upstream-locks.md) - Các tham chiếu fixture dev

## Phát triển

```bash
# Cài đặt các phụ thuộc
bun install

# Kiểm tra kiểu
bun run typecheck

# Chạy kiểm thử
bun run test:unit
bun run test:integration

# Xác minh các bản vá so với fixtures
bun run verify:patches

# Kiểm tra an toàn khi xuất bản
bun run check:publish-safety
```

## Giấy phép

MIT
