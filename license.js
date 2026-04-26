const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const storage = require('./storage');

const config = require(path.join(__dirname, 'license-config.json'));
const SECRET = 'mail-pro-tool-secret-key-2024'; // In production, use environment variable

function getMachineId() {
  const data = [os.hostname(), os.platform(), os.arch(), JSON.stringify(os.networkInterfaces())].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function writeLocalLicense(options = {}) {
  return storage.write('license', {
    activated: true,
    activatedAt: new Date().toISOString(),
    machineId: getMachineId(),
    activatedByKey: options.activatedByKey === true
  });
}

function normalizeLicenseKey(key) {
  return String(key || '').trim().toUpperCase();
}

function isValidLicenseKey(key) {
  const match = key.match(/^([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!match) {
    return false;
  }

  const payload = `${match[1]}${match[2]}`;
  const signature = match[3];
  const expectedSignature = crypto.createHash('sha256').update(payload + SECRET).digest('hex').toUpperCase().substring(8, 12);
  return signature === expectedSignature;
}

async function remoteValidate() {
  const url = config.licenseServerUrl;
  const machineId = getMachineId();

  try {
    const response = await fetch(`${url}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId })
    });

    const result = await response.json();
    if (result.valid) {
      await writeLocalLicense();
    }
    return result;
  } catch (error) {
    return { valid: false, message: `License server error: ${error.message}` };
  }
}

class LicenseManager {
  async validate(key) {
    const normalizedKey = normalizeLicenseKey(key);
    if (!normalizedKey) {
      return { valid: false, message: 'Vui lòng nhập License Key.' };
    }

    if (!isValidLicenseKey(normalizedKey)) {
      return { valid: false, message: 'License Key không hợp lệ.' };
    }

    await writeLocalLicense({ activatedByKey: true });
    return { valid: true, message: 'Kích hoạt bằng License Key thành công.' };
  }

  async isActivated() {
    try {
      const license = await storage.read('license');
      if (!license || license.activated !== true) {
        return false;
      }

      if (license.activatedByKey) {
        return true;
      }

      if (config.useRemoteLicense) {
        const remoteResult = await remoteValidate();
        if (remoteResult.valid) {
          return true;
        }
        if (!config.verifyOnStartup) {
          return true;
        }
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  getMachineId() {
    return getMachineId();
  }

  generateValidKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let part1 = '';
    let part2 = '';

    for (let i = 0; i < 4; i += 1) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const payload = `${part1}${part2}`;
    const hash = crypto.createHash('sha256').update(payload + SECRET).digest('hex').toUpperCase();
    const signature = hash.substring(8, 12);
    return `${part1}-${part2}-${signature}`;
  }
}

module.exports = new LicenseManager();