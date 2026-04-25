const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const STORE_FILE = path.join(process.cwd(), 'license-data.json');

async function ensureStore() {
  try {
    await fs.access(STORE_FILE);
  } catch {
    await writeStore({ activatedMachines: [] });
  }
}

async function readStore() {
  await ensureStore();
  const content = await fs.readFile(STORE_FILE, 'utf8');
  return JSON.parse(content || '{"activatedMachines":[]}');
}

async function writeStore(data) {
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function activateMachine(machineId, notes = '') {
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
  const store = await readStore();
  return store.activatedMachines.some(m => m.machineId === machineId);
}

async function listActivatedMachines() {
  const store = await readStore();
  return store.activatedMachines;
}

async function deactivateMachine(machineId) {
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
