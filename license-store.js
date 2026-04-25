const mongoose = require('mongoose');
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mail-tool'; // User needs to set this

const SECRET = 'mail-pro-tool-secret-key-2024';

// Connect to MongoDB
async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }
}

// License Schema
const licenseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  machineId: String,
  active: { type: Boolean, default: false },
  revoked: { type: Boolean, default: false },
  owner: String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  activatedAt: Date
});

const License = mongoose.model('License', licenseSchema);

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
  await connectDB();
  const normalized = normalizeKey(key);
  return await License.findOne({ key: normalized }).lean();
}

async function createLicense({ machineId = null, owner = null, notes = null } = {}) {
  await connectDB();
  const key = generateLicenseKey();
  const license = new License({
    key,
    active: true,
    owner,
    notes,
    machineId,
    activatedAt: new Date()
  });
  await license.save();
  return license.toObject();
}

async function activateLicense(key, machineId) {
  await connectDB();
  const normalized = normalizeKey(key);
  const license = await License.findOne({ key: normalized });

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
  license.activatedAt = new Date();
  await license.save();
  return { valid: true, message: 'License activated', license: license.toObject() };
}

async function revokeLicense(key) {
  await connectDB();
  const normalized = normalizeKey(key);
  const license = await License.findOne({ key: normalized });

  if (!license) {
    return { success: false, message: 'License key not found' };
  }

  license.revoked = true;
  license.active = false;
  await license.save();
  return { success: true, message: 'License revoked', license: license.toObject() };
}

async function listLicenses() {
  await connectDB();
  return await License.find({}).sort({ createdAt: -1 }).lean();
}

module.exports = {
  getLicense,
  createLicense,
  activateLicense,
  revokeLicense,
  listLicenses,
  generateLicenseKey
};
