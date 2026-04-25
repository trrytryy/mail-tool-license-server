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

async function writeLocalLicense() {
  return storage.write('license', {
    activated: true,
    activatedAt: new Date().toISOString(),
    machineId: getMachineId()
  });
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
    if (!config.useRemoteLicense) {
      return { valid: true, message: 'License validation disabled' };
    }

    // Only remote activation by machine ID is supported now.
    return { valid: false, message: 'Please activate via Machine ID with admin bot.' };
  }

  async isActivated() {
    try {
      const license = await storage.read('license');
      if (config.useRemoteLicense) {
        const remoteResult = await remoteValidate();
        if (remoteResult.valid) {
          return true;
        }
        if (license && license.activated === true && !config.verifyOnStartup) {
          return true;
        }
        return false;
      }

      if (license && license.activated === true) {
        return true;
      }
      return false;
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