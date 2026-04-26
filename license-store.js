const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const config = require('./license-config.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || config.githubToken || null;
const GITHUB_REPO = process.env.GITHUB_REPO || config.githubRepo || 'trrytryy/mail-tool-license-server';
const GITHUB_FILE = process.env.GITHUB_FILE || config.githubFile || 'license-data.json';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;

function getDefaultStorePath() {
  const envPath = process.env.LICENSE_DATA_PATH;
  if (envPath) {
    return envPath;
  }

  const defaultPath = path.join(__dirname, 'license-data.json');
  try {
    fsSync.accessSync(path.dirname(defaultPath), fsSync.constants.W_OK);
    return defaultPath;
  } catch {
    // In serverless environments like Netlify, the function bundle may be read-only.
    // Fallback to /tmp which is writable during runtime.
    return path.join(os.tmpdir(), 'license-data.json');
  }
}

const STORE_FILE = getDefaultStorePath();

function useGitHubStore() {
  return Boolean(GITHUB_TOKEN);
}

async function readGitHubStore() {
  const res = await fetch(GITHUB_API_URL, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw'
    }
  });

  if (res.status === 404) {
    return { activatedMachines: [] };
  }

  if (!res.ok) {
    throw new Error(`GitHub read failed: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

async function writeGitHubStore(data) {
  const readRes = await fetch(GITHUB_API_URL, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  let sha = null;
  if (readRes.ok) {
    const existing = await readRes.json();
    sha = existing.sha;
  }

  const body = {
    message: 'Update license store',
    content: Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64')
  };

  if (sha) {
    body.sha = sha;
  }

  const updateRes = await fetch(GITHUB_API_URL, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(body)
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`GitHub write failed: ${updateRes.status} ${updateRes.statusText} - ${text}`);
  }

  return await updateRes.json();
}

async function ensureStore() {
  if (useGitHubStore()) {
    return;
  }

  try {
    await fs.access(STORE_FILE);
  } catch {
    await writeStore({ activatedMachines: [] });
  }
}

async function readStore() {
  if (useGitHubStore()) {
    return await readGitHubStore();
  }

  await ensureStore();
  const content = await fs.readFile(STORE_FILE, 'utf8');
  return JSON.parse(content || '{"activatedMachines":[]}');
}

async function writeStore(data) {
  if (useGitHubStore()) {
    return await writeGitHubStore(data);
  }

  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeMachineId(machineId) {
  return String(machineId || '').trim();
}

async function activateMachine(machineId, notes = '') {
  machineId = normalizeMachineId(machineId);
  if (!machineId) {
    return { success: false, message: 'Machine ID is required' };
  }

  const store = await readStore();
  const existing = store.activatedMachines.find(m => m.machineId === machineId);
  if (existing) {
    return { success: false, message: 'Machine already activated' };
  }

  const activated = {
    machineId,
    activatedAt: new Date().toISOString(),
    notes
  };
  store.activatedMachines.push(activated);
  await writeStore(store);
  return { success: true, activated };
}

async function isMachineActivated(machineId) {
  machineId = normalizeMachineId(machineId);
  if (!machineId) {
    return false;
  }

  const store = await readStore();
  return store.activatedMachines.some(m => m.machineId === machineId);
}

async function listActivatedMachines() {
  const store = await readStore();
  return store.activatedMachines;
}

async function deactivateMachine(machineId) {
  machineId = normalizeMachineId(machineId);
  if (!machineId) {
    return { success: false, message: 'Machine ID is required' };
  }

  const store = await readStore();
  const index = store.activatedMachines.findIndex(m => m.machineId === machineId);
  if (index === -1) {
    return { success: false, message: 'Machine not found' };
  }

  store.activatedMachines.splice(index, 1);
  await writeStore(store);
  return { success: true, message: 'Machine deactivated' };
}

module.exports = {
  activateMachine,
  isMachineActivated,
  listActivatedMachines,
  deactivateMachine
};
