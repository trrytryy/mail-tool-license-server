const nodemailer = require('nodemailer');
const storage = require('./storage');

// SMTP Pool Manager
class SMTPPool {
  constructor() {
    this.accounts = [];
    this.states = {}; // 'active', 'dead', 'cooldown'
    this.cooldownTime = 5 * 60 * 1000; // 5 minutes
  }

  setAccounts(accounts) {
    this.accounts = accounts;
    accounts.forEach(account => {
      if (!this.states[account.email]) {
        this.states[account.email] = 'active';
      }
    });
  }

  getNextActive() {
    for (const account of this.accounts) {
      if (this.states[account.email] === 'active') {
        return account;
      }
    }
    // If no active accounts, return first one (will try anyway)
    return this.accounts[0] || null;
  }

  markDead(email) {
    if (this.states[email] !== 'dead') {
      this.states[email] = 'dead';
      console.log(`SMTP ${email} marked as dead`);

      // Auto-reactivate after cooldown
      setTimeout(() => {
        this.states[email] = 'active';
        console.log(`SMTP ${email} reactivated`);
      }, this.cooldownTime);
    }
  }

  markCooldown(email) {
    this.states[email] = 'cooldown';
    setTimeout(() => {
      this.states[email] = 'active';
    }, this.cooldownTime);
  }

  getStats() {
    const stats = {};
    this.accounts.forEach(account => {
      stats[account.email] = this.states[account.email] || 'unknown';
    });
    return stats;
  }
}

// Email Queue System
class EmailQueue {
  constructor(mailer, smtpPool) {
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.mailer = mailer;
    this.smtpPool = smtpPool;
    this.maxRetries = 2;
    this.delayMs = 2000; // Default 2 seconds
    this.rateLimit = 0; // emails per minute, 0 = no limit
    this.lastSendTime = 0;
    this.onLog = null;
  }

  add(emailItem) {
    this.queue.push({
      recipient: emailItem.recipient,
      subject: emailItem.subject,
      htmlContent: emailItem.htmlContent,
      textContent: emailItem.textContent,
      attachments: emailItem.attachments || [],
      senderName: emailItem.senderName || null,
      retries: 0,
      addedAt: Date.now()
    });
  }

  setConfig(delayMs, rateLimit, onLog) {
    this.delayMs = Math.max(delayMs, 2000); // Minimum 2 seconds
    this.rateLimit = rateLimit;
    this.onLog = onLog;
  }

  async start() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.isPaused = false;
    await this.process();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    this.process();
  }

  stop() {
    this.isProcessing = false;
    this.isPaused = false;
    this.queue = [];
  }

  async process() {
    if (!this.isProcessing || this.isPaused || this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    const item = this.queue.shift();
    const smtpAccount = this.smtpPool.getNextActive();

    if (!smtpAccount) {
      this.log('error', 'No active SMTP accounts available');
      this.isProcessing = false;
      return;
    }

    try {
      // Rate limiting
      if (this.rateLimit > 0) {
        const timeSinceLastSend = Date.now() - this.lastSendTime;
        const requiredDelay = (60 / this.rateLimit) * 1000;
        if (timeSinceLastSend < requiredDelay) {
          const waitTime = requiredDelay - timeSinceLastSend;
          await this.sleep(waitTime);
        }
      }

      const personalizedHtml = this.mailer.personalizeContent(item.htmlContent, item.recipient);
      const personalizedText = item.textContent ?
        this.mailer.personalizeContent(item.textContent, item.recipient) : null;

      await this.mailer.sendEmail(smtpAccount, item.recipient.email, item.subject, personalizedHtml, personalizedText, item.attachments, item.senderName);

      this.log('success', `Sent to ${item.recipient.email} using ${smtpAccount.email}`, smtpAccount.email);
      await storage.appendLog(`SUCCESS: ${item.recipient.email} - SMTP: ${smtpAccount.email}`);

      this.lastSendTime = Date.now();

    } catch (error) {
      this.log('error', `Failed to send to ${item.recipient.email}: ${error.message}`, smtpAccount.email);
      await storage.appendLog(`ERROR: ${item.recipient.email} - SMTP: ${smtpAccount.email} - ${error.message}`);

      // Mark SMTP as potentially dead
      this.smtpPool.markCooldown(smtpAccount.email);

      // Retry logic
      if (item.retries < this.maxRetries) {
        item.retries++;
        this.queue.unshift(item); // Put back at front for retry
        this.log('info', `Retrying ${item.recipient.email} (attempt ${item.retries + 1})`);
      } else {
        this.log('error', `Max retries reached for ${item.recipient.email}`);
      }
    }

    // Delay between emails
    if (this.delayMs > 0) {
      await this.sleep(this.delayMs);
    }

    // Continue processing
    setTimeout(() => this.process(), 100); // Small delay to prevent blocking
  }

  log(type, message, smtp = null) {
    if (this.onLog) {
      this.onLog({ type, message, smtp });
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      smtpStats: this.smtpPool.getStats()
    };
  }
}

class Mailer {
  constructor() {
    this.isStopped = false;
    this.smtpPool = new SMTPPool();
    this.emailQueue = new EmailQueue(this, this.smtpPool);
  }

  // Test SMTP connection
  async testConnection(smtpConfig, testEmail) {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465, // true for 465, false for other ports
      auth: {
        user: smtpConfig.email,
        pass: smtpConfig.password
      }
    });

    try {
      await transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      return { success: false, message: `SMTP connection failed: ${error.message}` };
    }
  }

  // Send bulk emails with queue system
  async sendBulk(config, logCallback) {
    const { smtpAccounts, emailQueue, delay, maxEmails, rateLimit, senderName, attachments } = config;

    if (!smtpAccounts || smtpAccounts.length === 0) {
      throw new Error('No SMTP accounts configured');
    }

    if (!emailQueue || emailQueue.length === 0) {
      throw new Error('No emails to send');
    }

    // Setup SMTP pool
    this.smtpPool.setAccounts(smtpAccounts);

    // Setup queue
    this.emailQueue.setConfig(delay * 1000, rateLimit, logCallback);

    // Add emails to queue
    let addedCount = 0;
    for (const emailItem of emailQueue) {
      if (maxEmails && addedCount >= maxEmails) break;
      // Merge global attachments and senderName with item-specific ones
      const itemWithGlobal = {
        ...emailItem,
        attachments: attachments || emailItem.attachments || [],
        senderName: senderName || emailItem.senderName
      };
      this.emailQueue.add(itemWithGlobal);
      addedCount++;
    }

    logCallback({ type: 'info', message: `Added ${addedCount} emails to queue` });

    // Start processing
    await this.emailQueue.start();

    // Wait for completion
    return new Promise((resolve) => {
      const checkComplete = () => {
        const stats = this.emailQueue.getStats();
        if (!stats.isProcessing && stats.queueLength === 0) {
          const finalStats = this.emailQueue.getStats();
          logCallback({ type: 'info', message: 'Bulk send completed' });
          resolve({ sent: addedCount - finalStats.queueLength, errors: 0, duration: 0 });
        } else {
          setTimeout(checkComplete, 1000);
        }
      };
      checkComplete();
    });
  }

  // Send single email with HTML and text fallback
  async sendEmail(smtpConfig, to, subject, htmlContent, textContent = null, attachments = [], senderName = null) {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.email,
        pass: smtpConfig.password
      }
    });

    const fromAddress = smtpConfig.email;
    const fromField = senderName ? `${senderName} <${fromAddress}>` : fromAddress;

    const mailOptions = {
      from: fromField,
      to: to,
      subject: subject,
      html: htmlContent
    };

    if (textContent) {
      mailOptions.text = textContent;
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const result = await transporter.sendMail(mailOptions);
    return result;
  }

  // Parse recipients from CSV text or simple email list
  parseRecipients(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      return [];
    }

    const lines = csvText.trim().split('\n');
    const recipients = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const parts = line.split(',').map(part => part.trim()).filter(Boolean);
      let name = '';
      let email = '';

      if (parts.length === 1) {
        email = parts[0];
      } else if (parts.length >= 2) {
        name = parts[0];
        email = parts[1];
      }

      if (email && email.includes('@')) {
        recipients.push({ name: name || email.split('@')[0], email });
      }
    }

    return recipients;
  }

  // Personalize content with {{name}} placeholder
  personalizeContent(content, recipient) {
    return content.replace(/\{\{name\}\}/g, recipient.name || 'Valued Customer');
  }

  // Stop sending
  stop() {
    this.emailQueue.stop();
  }

  // Pause sending
  pause() {
    this.emailQueue.pause();
  }

  // Resume sending
  resume() {
    this.emailQueue.resume();
  }

  // Get queue stats
  getQueueStats() {
    return this.emailQueue.getStats();
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new Mailer();