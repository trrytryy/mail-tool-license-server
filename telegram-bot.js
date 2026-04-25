const TelegramBot = require('node-telegram-bot-api');
const { createLicense, getLicense, revokeLicense, listLicenses } = require('./license-store');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '');

if (!TOKEN || !ADMIN_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID environment variables.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

function isAdmin(chatId) {
  return String(chatId) === ADMIN_CHAT_ID;
}

bot.onText(/\/start/, (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Xin chào! Bạn không có quyền sử dụng bot này.');
  }
  const help = `Admin Telegram License Bot\n\n` +
    `/genkey [machineId] - Tạo license mới. Nếu có machineId thì bind máy.\n` +
    `/info <key> - Xem trạng thái license.\n` +
    `/revoke <key> - Thu hồi license.\n` +
    `/list - Danh sách license.\n` +
    `/help - Hiển thị lệnh.`;
  bot.sendMessage(msg.chat.id, help);
});

bot.onText(/\/help/, (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền truy cập.');
  }
  bot.sendMessage(msg.chat.id, 'Dùng /genkey, /info, /revoke, /list để quản lý license.');
});

bot.onText(/\/genkey(?:\s+(.+))?/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }

  const machineId = match[1] ? match[1].trim() : null;
  const license = await createLicense({ machineId, notes: machineId ? 'Bound machine' : 'Unbound license' });
  const message = `License created:\nKey: ${license.key}\nMachine bound: ${license.machineId ? 'Yes' : 'No'}\nActivatedAt: ${license.activatedAt}`;
  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/\/info\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }

  const key = match[1].trim();
  const license = await getLicense(key);
  if (!license) {
    return bot.sendMessage(msg.chat.id, 'License không tồn tại.');
  }

  const status = `Key: ${license.key}\nActive: ${license.active}\nRevoked: ${license.revoked}\nMachineId: ${license.machineId || 'None'}\nOwner: ${license.owner || 'None'}\nNotes: ${license.notes || 'None'}\nCreatedAt: ${license.createdAt}\nActivatedAt: ${license.activatedAt}`;
  bot.sendMessage(msg.chat.id, status);
});

bot.onText(/\/revoke\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }

  const key = match[1].trim();
  const result = await revokeLicense(key);
  bot.sendMessage(msg.chat.id, result.message);
});

bot.onText(/\/list/, async (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }

  const licenses = await listLicenses();
  if (licenses.length === 0) {
    return bot.sendMessage(msg.chat.id, 'Chưa có license nào được tạo.');
  }

  const lines = licenses.slice(-20).map(license => {
    return `• ${license.key} | active=${license.active} | revoked=${license.revoked} | bound=${license.machineId ? 'yes' : 'no'}`;
  });

  bot.sendMessage(msg.chat.id, `License list (max 20):\n${lines.join('\n')}`);
});

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('Telegram license bot started.');
