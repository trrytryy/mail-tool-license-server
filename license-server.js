const express = require('express');
const { activateMachine, isMachineActivated, listActivatedMachines, deactivateMachine } = require('./license-store');
const botConfig = require('./telegram-config.json');

const ADMIN_TOKEN = process.env.LICENSE_SERVER_ADMIN_TOKEN || botConfig.adminToken || null;

const app = express();
app.use(express.json());

function requireAdminToken(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(403).json({ success: false, message: 'Admin token not configured' });
  }
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ success: false, message: 'Invalid admin token' });
  }
  next();
}

app.get('/', (req, res) => {
  res.json({ service: 'Mail Pro Tool License Server', version: '1.0.0' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/activate', requireAdminToken, async (req, res) => {
  const { machineId, notes } = req.body;
  if (!machineId) {
    return res.status(400).json({ success: false, message: 'Machine ID is required' });
  }

  try {
    const result = await activateMachine(machineId, notes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/check', (req, res) => {
  res.json({ message: 'Please use POST /api/check with JSON body { machineId: "..." }' });
});

app.post('/api/check', async (req, res) => {
  const { machineId } = req.body;
  if (!machineId) {
    return res.status(400).json({ valid: false, message: 'Machine ID is required' });
  }

  try {
    const activated = await isMachineActivated(machineId);
    res.json({ valid: activated, message: activated ? 'Machine activated' : 'Machine not activated' });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
});

app.get('/api/list', requireAdminToken, async (req, res) => {
  try {
    const machines = await listActivatedMachines();
    res.json({ success: true, machines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/deactivate', requireAdminToken, async (req, res) => {
  const { machineId } = req.body;
  if (!machineId) {
    return res.status(400).json({ success: false, message: 'Machine ID is required' });
  }

  try {
    const result = await deactivateMachine(machineId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// For serverless deployment
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`License server running on port ${PORT}`);
  });
}

