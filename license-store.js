const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mail-tool';

// Connect to MongoDB
async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }
}

// Activated Machine Schema
const activatedMachineSchema = new mongoose.Schema({
  machineId: { type: String, required: true, unique: true },
  activatedAt: { type: Date, default: Date.now },
  notes: String
});

const ActivatedMachine = mongoose.model('ActivatedMachine', activatedMachineSchema);

async function activateMachine(machineId, notes = '') {
  await connectDB();
  try {
    const activated = new ActivatedMachine({
      machineId,
      notes
    });
    await activated.save();
    return { success: true, activated: activated.toObject() };
  } catch (error) {
    if (error.code === 11000) { // Duplicate key
      return { success: false, message: 'Machine already activated' };
    }
    throw error;
  }
}

async function isMachineActivated(machineId) {
  await connectDB();
  const activated = await ActivatedMachine.findOne({ machineId });
  return !!activated;
}

async function listActivatedMachines() {
  await connectDB();
  return await ActivatedMachine.find({}).sort({ activatedAt: -1 }).lean();
}

async function deactivateMachine(machineId) {
  await connectDB();
  const result = await ActivatedMachine.deleteOne({ machineId });
  return { success: result.deletedCount > 0, message: result.deletedCount > 0 ? 'Machine deactivated' : 'Machine not found' };
}

module.exports = {
  activateMachine,
  isMachineActivated,
  listActivatedMachines,
  deactivateMachine
};
