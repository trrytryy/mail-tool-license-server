const fs = require('fs').promises;
const path = require('path');

const STORAGE_DIR = path.join(require('os').homedir(), '.mail-pro-tool');
const SMTP_FILE = path.join(STORAGE_DIR, 'smtp.json');
const LICENSE_FILE = path.join(STORAGE_DIR, 'license.json');
const CONTENT_FILE = path.join(STORAGE_DIR, 'content.json');
const CAMPAIGNS_FILE = path.join(STORAGE_DIR, 'campaigns.json');
const LOGS_FILE = path.join(STORAGE_DIR, 'logs.txt');

class Storage {
  async ensureDir() {
    try {
      await fs.access(STORAGE_DIR);
    } catch {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
  }

  async read(key) {
    await this.ensureDir();

    let filePath;
    switch (key) {
      case 'smtp':
        filePath = SMTP_FILE;
        break;
      case 'license':
        filePath = LICENSE_FILE;
        break;
      case 'content':
        filePath = CONTENT_FILE;
        break;
      case 'campaigns':
        filePath = CAMPAIGNS_FILE;
        break;
      default:
        throw new Error(`Unknown storage key: ${key}`);
    }

    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  async write(key, data) {
    await this.ensureDir();

    let filePath;
    switch (key) {
      case 'smtp':
        filePath = SMTP_FILE;
        break;
      case 'license':
        filePath = LICENSE_FILE;
        break;
      case 'content':
        filePath = CONTENT_FILE;
        break;
      case 'campaigns':
        filePath = CAMPAIGNS_FILE;
        break;
      default:
        throw new Error(`Unknown storage key: ${key}`);
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async appendLog(message) {
    await this.ensureDir();
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    await fs.appendFile(LOGS_FILE, logEntry, 'utf8');
  }

  async readLogs() {
    try {
      return await fs.readFile(LOGS_FILE, 'utf8');
    } catch {
      return '';
    }
  }
}

module.exports = new Storage();