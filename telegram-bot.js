const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const config = require('./telegram-config.json');

const TOKEN = config.telegramBotToken;
const ADMIN_CHAT_ID = config.adminChatId;

if (!TOKEN || !ADMIN_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID in telegram-config.json.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

function buildMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '/activate' }, { text: '/deactivate' }],
        [{ text: '/list' }, { text: '/help' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

function buildHelpMessage() {
  return `Admin Telegram License Bot\n\n` +
    `/activate <machineId> - Kích hoạt máy với Machine ID\n` +
    `/deactivate <machineId> - Hủy kích hoạt máy\n` +
    `/list - Danh sách máy đã kích hoạt\n` +
    `/menu - Hiển thị menu thao tác\n` +
    `/help - Hiển thị hướng dẫn.`;
}

async function activateMachine(machineId, username, chatId) {
  try {
    const response = await fetch(`${config.licenseServerUrl}/api/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': config.adminToken
      },
      body: JSON.stringify({ machineId, notes: `Activated by admin ${username}` })
    });
    const data = await response.json();
    if (data.success) {
      await bot.sendMessage(chatId, `✅ Máy ${machineId} đã được kích hoạt thành công!`);
    } else {
      await bot.sendMessage(chatId, `❌ Lỗi: ${data.message}`);
    }
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Lỗi kết nối: ${error.message}`);
  }
}

async function deactivateMachine(machineId, chatId) {
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
    if (data.success) {
      await bot.sendMessage(chatId, `✅ Máy ${machineId} đã được hủy kích hoạt thành công!`);
    } else {
      await bot.sendMessage(chatId, `❌ Lỗi: ${data.message}`);
    }
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Lỗi kết nối: ${error.message}`);
  }
}

async function sendActivatedList(chatId) {
  try {
    const response = await fetch(`${config.licenseServerUrl}/api/list`, {
      method: 'GET',
      headers: {
        'x-admin-token': config.adminToken
      }
    });
    const data = await response.json();
    if (!data.success) {
      return bot.sendMessage(chatId, `❌ Lỗi: ${data.message}`);
    }

    const machines = data.machines || [];
    if (machines.length === 0) {
      return bot.sendMessage(chatId, 'Chưa có máy nào được kích hoạt.');
    }

    const lines = machines.map((machine, index) => `• ${index + 1}. ${machine.machineId} | ${new Date(machine.activatedAt).toLocaleString()}`);
    const text = `Máy đã kích hoạt (${machines.length}):\n${lines.join('\n')}`;
    const keyboard = machines.slice(-10).map(machine => [{ text: `Hủy ${machine.machineId.slice(0, 10)}...`, callback_data: `deactivate:${machine.machineId}` }]);

    await bot.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Lỗi kết nối: ${error.message}`);
  }
}

bot.onText(/\/start/, async (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Xin chào! Bạn không có quyền sử dụng bot này.');
  }
  await bot.sendMessage(msg.chat.id, buildHelpMessage(), buildMainMenu());
});

bot.onText(/\/help/, async (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền truy cập.');
  }
  await bot.sendMessage(msg.chat.id, buildHelpMessage(), buildMainMenu());
});

bot.onText(/\/menu/, async (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền sử dụng bot này.');
  }
  await bot.sendMessage(msg.chat.id, 'Chọn chức năng:', buildMainMenu());
});

bot.onText(/\/activate\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }
  const machineId = match[1].trim();
  if (!machineId) {
    return bot.sendMessage(msg.chat.id, 'Vui lòng nhập Machine ID sau /activate.');
  }
  await activateMachine(machineId, msg.from.username || 'admin', msg.chat.id);
});

bot.onText(/\/genkey(?:\s+(.+))?/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }
  const machineId = match[1]?.trim();
  if (machineId) {
    return bot.sendMessage(msg.chat.id, `🔑 Hệ thống mới dùng Machine ID để kích hoạt.
Gửi lệnh sau để kích hoạt:
/activate ${machineId}`);
  }
  return bot.sendMessage(msg.chat.id, '🔑 Lệnh cũ /genkey không còn dùng nữa. Hãy gửi /activate <machineId> để kích hoạt.');
});

bot.onText(/\/info\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }
  const key = match[1].trim();
  return bot.sendMessage(msg.chat.id, `ℹ️ Hệ thống hiện tại không dùng key truyền thống.
Nếu bạn có Machine ID của khách hàng, hãy dùng:
/activate ${key}`);
});

bot.onText(/\/revoke\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }
  const machineId = match[1].trim();
  return bot.sendMessage(msg.chat.id, `⚠️ Lệnh cũ /revoke không còn dùng trên cấu hình này.
Để thu hồi license, dùng:
/deactivate ${machineId}`);
});

bot.onText(/\/deactivate\s+(.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }
  const machineId = match[1].trim();
  if (!machineId) {
    return bot.sendMessage(msg.chat.id, 'Vui lòng nhập Machine ID sau /deactivate.');
  }
  await deactivateMachine(machineId, msg.chat.id);
});

bot.onText(/\/list/, async (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, 'Bạn không có quyền thực hiện lệnh này.');
  }
  await sendActivatedList(msg.chat.id);
});

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (!isAdmin(chatId)) {
    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Không có quyền.' });
  }

  if (data && data.startsWith('deactivate:')) {
    const machineId = data.replace('deactivate:', '');
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Đang hủy kích hoạt ${machineId}...` });
    await deactivateMachine(machineId, chatId);
  } else {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Lệnh không hợp lệ.' });
  }
});

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('Telegram license bot started.');
