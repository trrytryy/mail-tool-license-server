// Renderer process - UI logic
let smtpAccounts = [];
let isActivated = false;
let isSending = false;
let isPaused = false;
let totalRecipients = 0;
let sentCount = 0;
let campaigns = [];
let recipientList = [];
let selectedAttachmentPath = null;
let activeContentIndex = 0;
let currentModalContentIndex = 0;

const defaultContentTemplates = [
  {
    name: 'Content 1',
    html: '<h1>Hello {{name}},</h1><p>Your ad account just got updated.</p><p>Please review the latest changes.</p>',
    text: 'Hello {{name}},\n\nYour ad account just got updated. Please review the latest changes.'
  },
  {
    name: 'Content 2',
    html: '<h1>Hello {{name}},</h1><p>We found a new optimization for your campaigns.</p><p>Let us help you increase performance.</p>',
    text: 'Hello {{name}},\n\nWe found a new optimization for your campaigns. Let us help you increase performance.'
  }
];

const contentTemplates = JSON.parse(JSON.stringify(defaultContentTemplates));

// Initialize app
async function init() {
  // Check license activation
  isActivated = await window.electronAPI.licenseIsActivated();

  if (!isActivated) {
    document.getElementById('license-modal').classList.remove('hidden');
    await renderMachineId();
  } else {
    document.getElementById('license-modal').classList.add('hidden');
    loadData();
    refreshAllContentSummaries();
    setDefaultSmtpProvider();
  }

  // Setup log listener
  window.electronAPI.onLogUpdate((event, log) => {
    addLogEntry(log);
    if (log.type === 'success') {
      sentCount++;
      updateProgress();
    }
  });

  // Setup file inputs
  document.getElementById('txt-file').addEventListener('change', handleFileImport);
  document.getElementById('attachment-file').addEventListener('change', handleAttachmentInput);
}

function initEditor() {
  // editor removed; inline content tabs are used instead
}

function getEditorHtmlContent() {
  return document.getElementById('email-content')?.value.trim() || '';
}

function setEditorHtmlContent(html) {
  if (document.getElementById('email-content')) {
    document.getElementById('email-content').value = html;
  }
}

function toggleSmtpSettings() {
  const panel = document.getElementById('smtp-settings-panel');
  panel.classList.toggle('hidden');
}

function setDefaultSmtpProvider() {
  const providerSelect = document.getElementById('smtp-provider');
  if (providerSelect) {
    providerSelect.value = 'seznam';
    applyProviderPreset();
  }
}

function openContentModal(index) {
  currentModalContentIndex = index;
  document.getElementById('content-modal-title').textContent = `Soạn Content ${index + 1}`;
  document.getElementById('modal-html-content').value = contentTemplates[index].html || '';
  document.getElementById('modal-text-content').value = contentTemplates[index].text || '';
  document.getElementById('content-modal').classList.remove('hidden');
  switchModalMode('html');
}

function closeContentModal() {
  document.getElementById('content-modal').classList.add('hidden');
}

function switchModalMode(mode) {
  const htmlGroup = document.getElementById('modal-html-group');
  const previewPanel = document.getElementById('modal-preview');

  if (mode === 'preview') {
    htmlGroup.classList.add('hidden');
    previewPanel.classList.remove('hidden');
    previewPanel.innerHTML = document.getElementById('modal-html-content').value || '<div style="color:#888;">Preview trống</div>';
  } else {
    htmlGroup.classList.remove('hidden');
    previewPanel.classList.add('hidden');
  }
}

function applyTemplatePreset() {
  const index = currentModalContentIndex;
  if (index < 0 || index >= defaultContentTemplates.length) return;
  const preset = defaultContentTemplates[index];
  document.getElementById('modal-html-content').value = preset.html;
  document.getElementById('modal-text-content').value = preset.text;
  switchModalMode('html');
}

function clearContentModal() {
  document.getElementById('modal-html-content').value = '';
  document.getElementById('modal-text-content').value = '';
  document.getElementById('modal-preview').innerHTML = '';
  switchModalMode('html');
}

function saveContentModal() {
  const index = currentModalContentIndex;
  if (index < 0 || index >= contentTemplates.length) return;

  contentTemplates[index].html = document.getElementById('modal-html-content').value;
  contentTemplates[index].text = document.getElementById('modal-text-content').value;
  updateContentSummary(index);
  closeContentModal();
}

function updateContentSummary(index) {
  const summaryEl = document.getElementById(`content-summary-text-${index}`);
  if (!summaryEl) return;

  const content = contentTemplates[index];
  const ready = content.html?.trim() ? 'Ready to send' : 'Body empty';
  summaryEl.textContent = `${content.name}: ${ready}`;
}

function refreshAllContentSummaries() {
  for (let i = 0; i < contentTemplates.length; i += 1) {
    updateContentSummary(i);
  }
}

function updateRecipientTable() {
  const tbody = document.querySelector('#recipient-table tbody');
  tbody.innerHTML = '';

  recipientList.forEach((recipient, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${recipient.email}</td>
      <td>${recipient.name}</td>
      <td class="recipient-status">${recipient.status || 'Ready'}</td>
    `;
    tbody.appendChild(row);
  });
}

function loadRecipientsFromTextarea() {
  const csvText = document.getElementById('csv-recipients').value.trim();
  const { recipients, invalidCount, duplicatesRemoved } = parseRecipients(csvText);
  recipientList = recipients;
  totalRecipients = recipientList.length;
  updateRecipientTable();
  updateRecipientSummary(totalRecipients, invalidCount, duplicatesRemoved);
}

function clearRecipientList() {
  recipientList = [];
  document.getElementById('csv-recipients').value = '';
  updateRecipientTable();
  totalRecipients = 0;
  updateRecipientSummary(0, 0, 0);
}

function updateRecipientSummary(validCount, invalidCount, duplicatesRemoved) {
  const summaryEl = document.getElementById('recipient-summary');
  if (!summaryEl) return;
  summaryEl.textContent = `Valid: ${validCount}, Invalid: ${invalidCount}, Duplicates removed: ${duplicatesRemoved}`;
}

function handleAttachmentInput(event) {
  const file = event.target.files[0];
  selectedAttachmentPath = file ? file.path : null;
  document.getElementById('attachment-label').textContent = file ? `Selected: ${file.name}` : 'No attachment selected';
}

function setTemplate(index) {
  // This function is no longer used - content selection is now via checkboxes
}

// License status display (no activation needed - done by admin)
async function renderMachineId() {
  const machineEl = document.getElementById('license-machine-id');
  if (!machineEl) return;
  try {
    const machineId = await window.electronAPI.licenseGetMachineId();
    const status = isActivated ? '✅ Đã kích hoạt' : '❌ Chưa kích hoạt';
    machineEl.innerHTML = `
      <div>Machine ID: <code>${machineId}</code></div>
      <div>Trạng thái: ${status}</div>
      <div style="font-size: 12px; color: #666; margin-top: 10px;">
        Gửi Machine ID này cho admin để được kích hoạt license.
      </div>
    `;
  } catch (error) {
    machineEl.textContent = 'Machine ID unavailable';
  }
}

// Navigation
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = e.target.dataset.section;
      switchSection(section);
    });
  });
}

function switchSection(section) {
  // Update navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelector(`[data-section="${section}"]`).classList.add('active');

  // Update content
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(`${section}-section`).classList.add('active');

  // Update title
  const titles = {
    smtp: 'SMTP Manager',
    editor: 'HTML Editor',
    sender: 'Email Sender',
    campaigns: 'Campaigns',
    logs: 'Logs'
  };
  document.getElementById('section-title').textContent = titles[section];
  currentSection = section;

  // Auto-populate sender from editor when switching
  if (section === 'sender') {
    autoPopulateSenderFromEditor();
  }

  // Load section-specific data
  if (section === 'campaigns') {
    loadCampaigns();
  }
}

function autoPopulateSenderFromEditor() {
  // No separate editor panel anymore. All content is edited inline via Content 1 / Content 2 tabs.
}

// Data loading
async function loadData() {
  try {
    // Load SMTP accounts
    const smtpData = await window.electronAPI.storageRead('smtp');
    if (smtpData && smtpData.accounts) {
      smtpAccounts = smtpData.accounts;
      renderSmtpList();
    }

    // Load logs
    loadLogs();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

// SMTP Management
function applyProviderPreset() {
  const provider = document.getElementById('smtp-provider').value;
  const hostInput = document.getElementById('smtp-host');
  const portSelect = document.getElementById('smtp-port');

  switch (provider) {
    case 'seznam':
      hostInput.value = 'smtp.seznam.cz';
      portSelect.value = '465';
      break;
    case 'gmail':
      hostInput.value = 'smtp.gmail.com';
      portSelect.value = '587';
      break;
    case 'outlook':
      hostInput.value = 'smtp-mail.outlook.com';
      portSelect.value = '587';
      break;
    case 'manual':
      hostInput.value = '';
      portSelect.value = '587';
      break;
    default:
      hostInput.value = 'smtp.seznam.cz';
      portSelect.value = '465';
      break;
  }
}

async function addSmtpAccount() {
  const email = document.getElementById('smtp-email').value.trim();
  const password = document.getElementById('smtp-password').value.trim();
  const host = document.getElementById('smtp-host').value.trim();
  const port = parseInt(document.getElementById('smtp-port').value);

  if (!email || !password || !host || !port) {
    alert('Please fill in all SMTP fields');
    return;
  }

  const account = { email, password, host, port };
  smtpAccounts.push(account);

  try {
    await window.electronAPI.storageWrite('smtp', { accounts: smtpAccounts });
    renderSmtpList();
    clearSmtpForm();
    alert('SMTP account added successfully');
  } catch (error) {
    alert('Failed to save SMTP account: ' + error.message);
  }
}

function clearSmtpForm() {
  document.getElementById('smtp-email').value = '';
  document.getElementById('smtp-password').value = '';
  document.getElementById('smtp-host').value = '';
  document.getElementById('smtp-port').value = '587';
}

function renderSmtpList() {
  const listEl = document.getElementById('smtp-list');
  listEl.innerHTML = '';

  if (smtpAccounts.length === 0) {
    listEl.innerHTML = '<p>No SMTP accounts configured</p>';
    return;
  }

  smtpAccounts.forEach((account, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'smtp-item';
    itemEl.innerHTML = `
      <div class="info">
        <strong>${account.email}</strong><br>
        ${account.host}:${account.port}
      </div>
      <div class="actions">
        <button class="btn" onclick="testSmtpAccount(${index})">Test</button>
        <button class="btn danger" onclick="removeSmtpAccount(${index})">Remove</button>
      </div>
    `;
    listEl.appendChild(itemEl);
  });
}

async function testSmtpConnection() {
  const email = document.getElementById('smtp-email').value.trim();
  const password = document.getElementById('smtp-password').value.trim();
  const host = document.getElementById('smtp-host').value.trim();
  const port = parseInt(document.getElementById('smtp-port').value);

  if (!email || !password || !host || !port) {
    alert('Please fill in all SMTP fields first');
    return;
  }

  const account = { email, password, host, port };

  try {
    const result = await window.electronAPI.mailerTest(account, account.email);
    alert(result.message);
  } catch (error) {
    alert('Test failed: ' + error.message);
  }
}

async function testSmtpAccount(index) {
  const account = smtpAccounts[index];

  try {
    const result = await window.electronAPI.mailerTest(account, account.email);
    alert(result.message);
  } catch (error) {
    alert('Test failed: ' + error.message);
  }
}

async function removeSmtpAccount(index) {
  if (confirm('Are you sure you want to remove this SMTP account?')) {
    smtpAccounts.splice(index, 1);
    try {
      await window.electronAPI.storageWrite('smtp', { accounts: smtpAccounts });
      renderSmtpList();
    } catch (error) {
      alert('Failed to remove SMTP account: ' + error.message);
    }
  }
}

// Email Sending
async function startSending() {
  if (smtpAccounts.length === 0) {
    alert('Please add at least one SMTP account first');
    return;
  }

  const subject = document.getElementById('email-subject').value.trim();
  const csvRecipients = document.getElementById('csv-recipients').value.trim();
  const delay = parseInt(document.getElementById('delay').value) || 2;
  const rateLimit = parseInt(document.getElementById('rate-limit').value) || 0;
  const maxEmails = parseInt(document.getElementById('max-emails').value) || 0;

  const content1Selected = document.getElementById('content-1-checkbox').checked;
  const content2Selected = document.getElementById('content-2-checkbox').checked;

  if (!subject) {
    alert('Please fill in the email subject');
    return;
  }

  if (!content1Selected && !content2Selected) {
    alert('Please select at least one content to send');
    return;
  }

  const selectedContents = [];
  if (content1Selected) selectedContents.push(contentTemplates[0]);
  if (content2Selected) selectedContents.push(contentTemplates[1]);

  for (const content of selectedContents) {
    if (!content.html || !content.html.trim()) {
      alert(`Please fill HTML content for ${content.name}`);
      return;
    }
  }

  if (!csvRecipients && recipientList.length === 0) {
    alert('Please provide recipients');
    return;
  }

  if (delay < 2) {
    alert('Delay must be at least 2 seconds');
    return;
  }

  // Parse recipients from textarea if list not loaded yet
  if (recipientList.length === 0) {
    const result = parseRecipients(csvRecipients);
    recipientList = result.recipients;
    updateRecipientSummary(recipientList.length, result.invalidCount, result.duplicatesRemoved);
  }

  if (recipientList.length === 0) {
    alert('No valid recipients found');
    return;
  }

  // Create email queue based on content selection
  const emailQueue = [];
  recipientList.forEach(recipient => {
    if (content1Selected) {
      emailQueue.push({
        recipient,
        contentIndex: 0,
        subject,
        htmlContent: contentTemplates[0].html,
        textContent: contentTemplates[0].text
      });
    }
    if (content2Selected) {
      emailQueue.push({
        recipient,
        contentIndex: 1,
        subject,
        htmlContent: contentTemplates[1].html,
        textContent: contentTemplates[1].text
      });
    }
  });

  totalRecipients = emailQueue.length;
  sentCount = 0;

  const senderName = document.getElementById('sender-name').value.trim();
  const attachmentFile = document.getElementById('attachment-file').files[0];
  const attachments = attachmentFile ? [{ path: selectedAttachmentPath, filename: attachmentFile.name }] : [];

  const config = {
    smtpAccounts,
    emailQueue,
    delay,
    maxEmails: maxEmails || null,
    rateLimit,
    senderName,
    attachments
  };

  try {
    isSending = true;
    isPaused = false;
    updateSendUI();
    document.getElementById('send-status').textContent = 'Starting bulk send...';
    document.getElementById('queue-stats').classList.remove('hidden');

    const result = await window.electronAPI.mailerSendBulk(config);

    document.getElementById('send-status').textContent =
      `Completed: ${result.sent} sent, ${result.errors} errors`;

  } catch (error) {
    document.getElementById('send-status').textContent = 'Error: ' + error.message;
    addLogEntry({ type: 'error', message: error.message });
  } finally {
    isSending = false;
    isPaused = false;
    updateSendUI();
    document.getElementById('queue-stats').classList.add('hidden');
  }
}

function parseRecipients(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return { recipients: [], invalidCount: 0, duplicatesRemoved: 0 };
  }

  const lines = csvText.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const recipients = [];
  const seenEmails = new Set();
  let invalidCount = 0;
  let duplicatesRemoved = 0;

  const headerPattern = /^\s*(name\s*,\s*email|email\s*,\s*name)\s*$/i;
  let startIndex = 0;
  if (lines.length > 0 && headerPattern.test(lines[0])) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    const parts = line.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) continue;

    let email = '';
    let name = '';

    if (parts.length === 1) {
      email = parts[0];
      name = email.split('@')[0] || 'Recipient';
    } else {
      email = parts[parts.length - 1];
      name = parts.slice(0, parts.length - 1).join(' ') || email.split('@')[0] || 'Recipient';
    }

    if (!validateEmail(email)) {
      invalidCount += 1;
      continue;
    }

    const normalizedEmail = email.toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      duplicatesRemoved += 1;
      continue;
    }

    seenEmails.add(normalizedEmail);
    recipients.push({ name, email });
  }

  return { recipients, invalidCount, duplicatesRemoved };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function updateSendUI() {
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const stopBtn = document.getElementById('stop-btn');

  if (isSending) {
    startBtn.disabled = true;
    if (isPaused) {
      pauseBtn.disabled = true;
      resumeBtn.disabled = false;
      stopBtn.disabled = false;
    } else {
      pauseBtn.disabled = false;
      resumeBtn.disabled = true;
      stopBtn.disabled = false;
    }
  } else {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    stopBtn.disabled = true;
    document.getElementById('progress-fill').style.width = '0%';
  }
}

function updateProgress() {
  if (totalRecipients > 0) {
    const progress = (sentCount / totalRecipients) * 100;
    document.getElementById('progress-fill').style.width = progress + '%';
  }
}

async function stopSending() {
  try {
    await window.electronAPI.mailerStop();
    document.getElementById('send-status').textContent = 'Sending stopped by user';
  } catch (error) {
    console.error('Failed to stop sending:', error);
  }
}

// Logging
function addLogEntry(log) {
  const logContainer = document.getElementById('log-container');
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${log.type}`;
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${log.message}`;
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

async function loadLogs() {
  // Logs are loaded in real-time via IPC
}

async function clearLogs() {
  document.getElementById('log-container').innerHTML = '';
}

async function exportLogs() {
  // In a real app, this would trigger a save dialog
  alert('Export functionality would save logs to a file');
}

// Queue control functions
async function pauseSending() {
  try {
    await window.electronAPI.mailerPause();
    isPaused = true;
    updateSendUI();
    document.getElementById('send-status').textContent = 'Sending paused';
  } catch (error) {
    console.error('Failed to pause sending:', error);
  }
}

async function resumeSending() {
  try {
    await window.electronAPI.mailerResume();
    isPaused = false;
    updateSendUI();
    document.getElementById('send-status').textContent = 'Sending resumed';
  } catch (error) {
    console.error('Failed to resume sending:', error);
  }
}

// File import handling
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    document.getElementById('csv-recipients').value = content;
    loadRecipientsFromTextarea();
  };
  reader.readAsText(file);
}

// HTML Editor functions
// HTML Editor functions - removed, using predefined templates only
function switchToCode() {}
function switchToPreview() {}
function updatePreview() {}

async function saveContent() {
  // Content saving removed - using predefined templates only
}

async function loadContent() {
  // Content loading removed - using predefined templates only
}

// Campaign functions
async function createCampaign() {
  const campaignName = prompt('Enter campaign name:');
  if (!campaignName) return;

  const subject = document.getElementById('email-subject').value.trim();
  const htmlContent = document.getElementById('email-content').value.trim();
  const textContent = document.getElementById('text-content').value.trim();
  const recipients = document.getElementById('csv-recipients').value.trim();

  if (!subject || !htmlContent || !recipients) {
    alert('Please fill in email configuration first');
    return;
  }

  const campaign = {
    id: Date.now().toString(),
    name: campaignName,
    subject,
    htmlContent,
    textContent,
    recipients,
    smtpAccounts: smtpAccounts,
    createdAt: new Date().toISOString()
  };

  try {
    // Load existing campaigns
    let campaigns = await window.electronAPI.storageRead('campaigns') || [];
    campaigns.push(campaign);

    await window.electronAPI.storageWrite('campaigns', campaigns);
    loadCampaigns();
    alert('Campaign created successfully');
  } catch (error) {
    alert('Failed to create campaign: ' + error.message);
  }
}

async function loadCampaigns() {
  try {
    const campaignsData = await window.electronAPI.storageRead('campaigns') || [];
    campaigns = campaignsData;

    const campaignList = document.getElementById('campaign-list');
    campaignList.innerHTML = '';

    if (campaigns.length === 0) {
      campaignList.innerHTML = '<p>No campaigns created yet</p>';
      return;
    }

    campaigns.forEach(campaign => {
      const itemEl = document.createElement('div');
      itemEl.className = 'campaign-item';
      itemEl.innerHTML = `
        <div class="name">${campaign.name}</div>
        <div class="meta">Created: ${new Date(campaign.createdAt).toLocaleDateString()}</div>
        <div class="meta">Recipients: ${campaign.recipients.split('\n').length}</div>
        <button class="btn" onclick="loadCampaign('${campaign.id}')">Load</button>
        <button class="btn danger" onclick="deleteCampaign('${campaign.id}')">Delete</button>
      `;
      campaignList.appendChild(itemEl);
    });
  } catch (error) {
    console.error('Failed to load campaigns:', error);
  }
}

async function loadCampaign(campaignId) {
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return;

  // Load campaign data into sender form
  document.getElementById('email-subject').value = campaign.subject;
  document.getElementById('email-content').value = campaign.htmlContent;
  document.getElementById('text-content').value = campaign.textContent || '';
  document.getElementById('csv-recipients').value = campaign.recipients;

  // Switch to sender section
  switchSection('sender');
  alert(`Campaign "${campaign.name}" loaded successfully`);
}

async function deleteCampaign(campaignId) {
  if (!confirm('Are you sure you want to delete this campaign?')) return;

  try {
    campaigns = campaigns.filter(c => c.id !== campaignId);
    await window.electronAPI.storageWrite('campaigns', campaigns);
    loadCampaigns();
  } catch (error) {
    alert('Failed to delete campaign: ' + error.message);
  }
}

// Update queue stats periodically
setInterval(async () => {
  if (isSending) {
    try {
      const stats = await window.electronAPI.mailerGetStats();
      document.getElementById('queue-length').textContent = stats.queueLength;
      document.getElementById('queue-status').textContent =
        stats.isPaused ? 'Paused' : (stats.isProcessing ? 'Processing' : 'Idle');
    } catch (error) {
      // Ignore errors
    }
  }
}, 1000);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);