const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const STORE_FILE = process.env.LICENSE_STORE_FILE || path.join(os.tmpdir(), 'mail-tool-license-data.json');
const SECRET = 'mail-pro-tool-secret-key-2024';

async function ensureStore() {
  try {
    await fs.access(STORE_FILE);
  } catch {
    await writeStore({ licenses: [] });
  }
}

async function readStore() {
  await ensureStore();
  const content = await fs.readFile(STORE_FILE, 'utf8');
  return JSON.parse(content || '{"licenses":[]}');
}

async function writeStore(data) {
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeKey(key) {
  return String(key || '').trim().toUpperCase();
}

function generateHash(payload) {
  return crypto.createHash('sha256').update(payload + SECRET).digest('hex').toUpperCase();
}

function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i += 1) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const payload = `${part1}${part2}`;
  const hash = generateHash(payload);
  const signature = hash.substring(8, 12);
  return `${part1}-${part2}-${signature}`;
}

async function getLicense(key) {
  const normalized = normalizeKey(key);
  const store = await readStore();
  return store.licenses.find(item => normalizeKey(item.key) === normalized) || null;
}

async function createLicense({ machineId = null, owner = null, notes = null } = {}) {
  const key = generateLicenseKey();
  const license = {
    key,
    active: true,
    owner: owner || null,
    notes: notes || null,
    machineId: machineId || null,
    createdAt: new Date().toISOString(),
    activatedAt: new Date().toISOString(),
    revoked: false
  };
  const store = await readStore();
  store.licenses.push(license);
  await writeStore(store);
  return license;
}

async function activateLicense(key, machineId) {
  const store = await readStore();
  const normalized = normalizeKey(key);
  let license = store.licenses.find(item => normalizeKey(item.key) === normalized);

  if (!license) {
    return { valid: false, message: 'License key not found' };
  }

  if (license.revoked) {
    return { valid: false, message: 'License has been revoked' };
  }

  if (license.machineId && license.machineId !== machineId) {
    return { valid: false, message: 'License is bound to another machine' };
  }

  license.machineId = machineId;
  license.active = true;
  license.revoked = false;
  license.activatedAt = new Date().toISOString();
  await writeStore(store);
  return { valid: true, message: 'License activated', license };
}

async function revokeLicense(key) {
  const store = await readStore();
  const normalized = normalizeKey(key);
  const license = store.licenses.find(item => normalizeKey(item.key) === normalized);

  if (!license) {
    return { success: false, message: 'License key not found' };
  }

  license.revoked = true;
  license.active = false;
  await writeStore(store);
  return { success: true, message: 'License revoked', license };
}

async function listLicenses() {
  const store = await readStore();
  return store.licenses;
}

module.exports = {
  getLicense,
  createLicense,
  activateLicense,
  revokeLicense,
  listLicenses,
  generateLicenseKey
};
