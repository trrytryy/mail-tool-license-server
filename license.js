const crypto = require('crypto');
const os = require('os');
const path = require('path');
const storage = require('./storage');

const config = require(path.join(__dirname, 'license-config.json'));
const SECRET = 'mail-pro-tool-secret-key-2024'; // In production, use environment variable

function getMachineId() {
  const data = [os.hostname(), os.platform(), os.arch(), JSON.stringify(os.networkInterfaces())].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}

function validateFormat(key) {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key);
}

function generateHash(key) {
  return crypto.createHash('sha256')
    .update(key + SECRET)
    .digest('hex')
    .substring(0, 16);
}

async function writeLocalLicense(key) {
  return storage.write('license', {
    key,
    activated: true,
    activatedAt: new Date().toISOString(),
    machineId: getMachineId()
  });
}

async function remoteValidate(key) {
  const url = config.licenseServerUrl;
  const machineId = getMachineId();

  try {
    const response = await fetch(`${url}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, machineId })
    });

    const result = await response.json();
    if (result.valid) {
      await writeLocalLicense(key);
    }
    return result;
  } catch (error) {
    return { valid: false, message: `License server error: ${error.message}` };
  }
}

class LicenseManager {
  // Validate license key
  async validate(key) {
    if (!validateFormat(key)) {
      return { valid: false, message: 'Invalid license key format. Use XXXX-XXXX-XXXX' };
    }

    if (config.useRemoteLicense) {
      return remoteValidate(key);
    }

    const [part1, part2, signature] = key.split('-');
    const payload = `${part1}${part2}`;
    const expectedSignature = generateHash(payload).toUpperCase().substring(8, 12);

    if (expectedSignature === signature.toUpperCase()) {
      await writeLocalLicense(key);
      return { valid: true, message: 'License activated successfully' };
    }

    return { valid: false, message: 'Invalid license key' };
  }

  getMachineId() {
    return getMachineId();
  }

  // Check if license is activated
  async isActivated() {
    try {
      const license = await storage.read('license');
      if (license && license.activated === true) {
        if (config.useRemoteLicense && config.verifyOnStartup) {
          const machineId = getMachineId();
          const response = await fetch(`${config.licenseServerUrl}/api/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: license.key, machineId })
          });
          const result = await response.json();
          return result.valid === true;
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Generate a valid license key for testing (development only)
  generateValidKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let part1 = '';
    let part2 = '';

    for (let i = 0; i < 4; i += 1) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const payload = `${part1}${part2}`;
    const hash = generateHash(payload).toUpperCase();
    const signature = hash.substring(8, 12);
    return `${part1}-${part2}-${signature}`;
  }
}

module.exports = new LicenseManager();