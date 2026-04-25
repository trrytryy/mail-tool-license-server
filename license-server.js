const express = require('express');
const { activateLicense, getLicense, revokeLicense, listLicenses } = require('./license-store');

const ADMIN_TOKEN = process.env.LICENSE_SERVER_ADMIN_TOKEN || null;

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

app.post('/api/activate', async (req, res) => {
  const { key, machineId } = req.body;
  if (!key || !machineId) {
    return res.status(400).json({ valid: false, message: 'Key and machineId are required' });
  }

  try {
    const result = await activateLicense(key, machineId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
});

app.post('/api/check', async (req, res) => {
  const { key, machineId } = req.body;
  if (!key) {
    return res.status(400).json({ valid: false, message: 'Key is required' });
  }

  try {
    const result = await getLicense(key);
    if (!result) {
      return res.json({ valid: false, message: 'License not found' });
    }

    const isValid = result.active && !result.revoked;
    const machineMatch = !result.machineId || result.machineId === machineId;

    res.json({
      valid: isValid && machineMatch,
      message: isValid && machineMatch ? 'License valid' : 'License invalid or expired'
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
});

app.post('/api/revoke', requireAdminToken, async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, message: 'Key is required' });
  }

  try {
    const result = await revokeLicense(key);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/list', requireAdminToken, async (req, res) => {
  try {
    const licenses = await listLicenses();
    res.json({ success: true, licenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// For Vercel serverless
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`License server running on port ${PORT}`);
  });
}

