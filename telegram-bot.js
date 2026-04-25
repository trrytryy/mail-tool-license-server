const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const config = require('./telegram-config.json');

const TOKEN = config.telegramBotToken;
const ADMIN_CHAT_ID = config.adminChatId;

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
    `/activate <machineId> - Kích hoạt máy với Machine ID\n` +
    `/deactivate <machineId> - Hủy kích hoạt máy\n` +
    `/list - Danh sách máy đã kích hoạt\n` +
    `/help - Hiển thị lệnh.`;
  bot.sendMessage(msg.chat.id, help);
});

bot.onText(/\/help/, (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền truy cập.');
  }
  bot.sendMessage(msg.chat.id, 'Dùng /activate, /deactivate, /list để quản lý license.');
});

bot.onText(/\/activate\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }

  const machineId = match[1].trim();
  try {
    const response = await fetch(`${config.licenseServerUrl}/api/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': config.adminToken
      },
      body: JSON.stringify({ machineId, notes: `Activated by admin ${msg.from.username}` })
    });
    const data = await response.json();
    if (data.success) {
      bot.sendMessage(msg.chat.id, `✅ Máy ${machineId} đã được kích hoạt thành công!`);
    } else {
      bot.sendMessage(msg.chat.id, `❌ Lỗi: ${data.message}`);
    }
  } catch (error) {
    bot.sendMessage(msg.chat.id, `❌ Lỗi kết nối: ${error.message}`);
  }
});

bot.onText(/\/deactivate\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }

  const machineId = match[1].trim();
  try {
    const response = await fetch(`${config.licenseServerUrl}/api/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': config.adminToken
      },
      body: JSON.stringify({ machineId })
    });
    const data = await response.json();
    bot.sendMessage(msg.chat.id, data.success ? `✅ Máy ${machineId} đã được hủy kích hoạt!` : `❌ ${data.message}`);
  } catch (error) {
    bot.sendMessage(msg.chat.id, `❌ Lỗi kết nối: ${error.message}`);
  }
});

bot.onText(/\/list/, async (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }

  try {
    const response = await fetch(`${config.licenseServerUrl}/api/list`, {
      method: 'GET',
      headers: {
        'x-admin-token': config.adminToken
      }
    });
    const data = await response.json();
    if (data.success) {
      const machines = data.machines;
      if (machines.length === 0) {
        return bot.sendMessage(msg.chat.id, 'Chưa có máy nào được kích hoạt.');
      }

      const lines = machines.slice(-20).map(machine => {
        return `• ${machine.machineId} | ${new Date(machine.activatedAt).toLocaleString()}`;
      });

      bot.sendMessage(msg.chat.id, `Máy đã kích hoạt (max 20):\n${lines.join('\n')}`);
    } else {
      bot.sendMessage(msg.chat.id, `❌ Lỗi: ${data.message}`);
    }
  } catch (error) {
    bot.sendMessage(msg.chat.id, `❌ Lỗi kết nối: ${error.message}`);
  }
});

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('Telegram license bot started.');
