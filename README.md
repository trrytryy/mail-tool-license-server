# Mail Pro Tool

A professional desktop application for bulk email sending with SMTP rotation, HTML editor, campaign management, and advanced queue system.

## Features

- **Multi SMTP Rotation**: Configure multiple SMTP accounts with automatic round-robin rotation and failure handling
- **Advanced Queue System**: Non-blocking email sending with pause/resume capabilities
- **HTML Editor**: Rich HTML editor with live preview and plain text fallback
- **Campaign Management**: Create, save, load, and manage email campaigns
- **Bulk Email Sender**: Send personalized HTML emails to CSV/TXT recipient lists
- **File Attachments**: Optional file attachments for emails
- **Custom Sender Name**: Set custom display name in email From header
- **License System**: Offline license validation with secure key generation
- **Professional UI**: Clean, modern interface with dark theme and sidebar navigation
- **Real-time Logging**: Live logs with success/error tracking and file export
- **Safety Features**: Configurable delays, rate limiting, and sending limits

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the application:
```bash
npm start
```

## Build & Distribution

To build the application for distribution:

```bash
npm run build
```

This will create `dist/Mail Pro Tool Setup 1.1.0.exe` - a Windows installer for the application.

## First Run

On first launch, you'll need to enter a license key. For testing purposes, you can generate a valid key using the built-in generator.

From the project root (`c:\Users\Admin\mail-tool`), run:

```bash
npm run gen-key
```

This will print a valid license key in the format `XXXX-XXXX-XXXX`.

If you prefer using Node directly, be sure to run it from the project folder:

```bash
cd c:\Users\Admin\mail-tool
node -e "const license = require('./license'); console.log(license.generateValidKey())"
```

## Configuration

### SMTP Accounts

Add SMTP accounts through the UI:
- Email address
- Password (use app passwords for Gmail)
- SMTP host (e.g., smtp.gmail.com)
- Port (587 for TLS, 465 for SSL)

### Email Content

- **HTML Editor**: Use the built-in HTML editor with live preview
- **Plain Text Fallback**: Optional plain text version for better deliverability
- **Template Variables**: Use `{{name}}` and `{{email}}` for personalization
- **File Attachments**: Optional file attachments (PDF, images, documents)
- **Sender Name**: Custom display name in From header (e.g., "Business Ads Update <email@domain.com>")

### Sending Options

- **Delay**: Minimum 2 seconds between emails
- **Rate Limit**: Emails per minute (0 = no limit)
- **Max Emails**: Limit per session (0 = no limit)
- **Queue Control**: Pause/resume sending at any time

## Architecture

- `main.js`: Electron main process with IPC handlers
- `preload.js`: Secure API exposure to renderer
- `renderer.js`: UI logic with professional interface
- `mailer.js`: Advanced SMTP logic with queue system and rotation
- `license.js`: Offline license validation
- `storage.js`: JSON file storage management

## Key Components

### Queue System
- Non-blocking email processing
- Pause/resume functionality
- Real-time queue status monitoring
- Automatic retry on failure (max 2 retries)

### SMTP Pool Manager
- Active/Dead/Cooldown states
- Automatic account rotation
- Failure detection and recovery
- 5-minute cooldown for failed accounts

### HTML Editor
- Code view with syntax highlighting
- Live preview panel
- Safe HTML rendering
- Content save/load functionality

### Campaign System
- Save complete email configurations
- Load campaigns for re-sending
- Campaign metadata tracking
- Local storage persistence

## Security

- No `nodeIntegration` - secure IPC communication
- Sensitive data stored locally in user directory
- License keys validated with cryptographic hashing
- Safe HTML preview rendering

## Development

To run in development mode:
```bash
npm start
```

If you want to open the app without typing in the terminal each time, double-click `launch-mail-pro-tool.cmd` in the project folder.

To build for production:
```bash
npm run build
```

## Usage Workflow

1. **Setup SMTP**: Add and test multiple SMTP accounts
2. **Create Content**: Use HTML editor to design email content
3. **Import Recipients**: Upload CSV or TXT files with recipient lists
4. **Configure Sending**: Set delays, limits, and rate controls
5. **Save Campaign**: Store configuration for future use
6. **Send Emails**: Monitor progress with queue status and logs
7. **Manage Campaigns**: Load and re-run saved campaigns

## File Formats

### Recipients CSV
```
John Doe,john@example.com
Jane Smith,jane@example.com
```

### Recipients TXT
```
john@example.com
jane@example.com
```

### HTML Content
```html
<h1>Hello {{name}}!</h1>
<p>This email is sent to: {{email}}</p>
<p>Best regards,<br>Mail Pro Team</p>
```

## Logs

All sending activities are logged in real-time and saved to `~/.mail-pro-tool/logs.txt` for review and export.

## License

This application requires a valid license key for activation. Contact the developer for licensing information.

### Remote license activation with Telegram
You can run a simple license backend and manage license activation through Telegram.

1. Start the license server:
```bash
npm run license-server
```
2. Run the Telegram bot from the project root:
```bash
npm run telegram-bot
```
3. Or run both server and bot together on Windows:
```bash
npm run run-all
```
Or double-click `run-all.cmd`.
4. Use the bot to manage activation:
  - `/start` - Hiển thị menu xử lý
  - `/activate <machineId>` - Kích hoạt máy bằng Machine ID
  - `/deactivate <machineId>` - Hủy kích hoạt máy
  - `/list` - Danh sách máy đã kích hoạt
  - `/menu` - Hiển thị lại menu nút nhanh

If you send old commands like `/genkey`, `/info`, or `/revoke`, the bot will tell you to use the new Machine ID flow.

> Note: For Netlify / serverless deployment, the license store may need a writable path.
> If `/var/task` is read-only, the app now uses `/tmp/license-data.json` automatically.
> You can also set `LICENSE_DATA_PATH` to a writable location.

### App activation flow
The Electron client now supports remote activation by calling the license server configured in `license-config.json`.

- The app sends `key` và `machineId` đến server khi người dùng nhập license.
- Server xác minh key và gán key cho máy nếu cần.
- App hiện đúng `Machine ID` trên màn hình activation để bạn có thể yêu cầu khách gửi lại khi bind key.
- `verifyOnStartup` được bật, nên app sẽ kiểm tra license với server mỗi lần khởi động để đảm bảo key chưa bị thu hồi.
- Remote license server URL được cấu hình trong `license-config.json`.
- Sau khi thành công, app vẫn lưu trạng thái activation cục bộ, nhưng tiếp tục kiểm tra lại với server nếu cấu hình yêu cầu.

## Performance

- Queue-based processing prevents UI blocking
- Configurable rate limiting prevents account bans
- Automatic SMTP rotation distributes load
- Real-time monitoring and control

## Changelog

### Version 1.1.0 (2026-04-25)
- ✅ Redesigned UI to single-page layout (removed sidebar navigation)
- ✅ Added file attachment support for emails
- ✅ Added custom sender name in From header
- ✅ Improved recipient table with status tracking
- ✅ Enhanced bulk sending with attachment handling
- ✅ Cleaner, more professional interface similar to spam tools
- ✅ Fixed HTML structure and removed duplicate elements

### Version 1.0.0 (2026-04-XX)
- Initial release with multi-SMTP rotation
- Advanced queue system with pause/resume
- HTML editor with live preview
- Campaign management system
- License validation system
- Professional UI with dark theme