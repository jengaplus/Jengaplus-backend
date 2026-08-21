const axios = require('axios');

const NEXTSMS_USERNAME = String(process.env.NEXTSMS_USERNAME || '').trim();
const NEXTSMS_PASSWORD = String(process.env.NEXTSMS_PASSWORD || '').trim();
const NEXTSMS_API_KEY = String(process.env.NEXTSMS_API_KEY || '').trim();
const NEXTSMS_TEST_MODE = String(process.env.NEXTSMS_TEST_MODE || 'false').toLowerCase() === 'true';
const NEXTSMS_BASE_URL = String(process.env.NEXTSMS_BASE_URL || 'https://messaging-service.co.tz');
const NEXTSMS_API_VERSION = String(process.env.NEXTSMS_API_VERSION || 'v2');
const NEXTSMS_ENDPOINT = NEXTSMS_TEST_MODE
  ? `${NEXTSMS_BASE_URL}/api/sms/${NEXTSMS_API_VERSION}/test/text/single`
  : `${NEXTSMS_BASE_URL}/api/sms/${NEXTSMS_API_VERSION}/text/single`;
const NEXTSMS_AUTH_MODE = NEXTSMS_API_KEY ? 'bearer' : 'basic';
const DEFAULT_SENDER = String(process.env.NEXTSMS_SENDER || 'UniMessage');
const BRAND_FOOTER = 'JENGANASI#PAMOJATUNAWEZA';

function buildSMSPayload(to, message, sender = DEFAULT_SENDER) {
  return {
    to: String(to),
    from: String(sender),
    text: String(message)
  };
}

function getDefaultRecipient(to) {
  const normalized = to && String(to).trim();
  if (normalized) return normalized;
  return process.env.ADMIN_PHONE ? String(process.env.ADMIN_PHONE).trim() : null;
}

function safeString(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function buildMessage(template, values = {}) {
  const message = template.replace(/\{\{(\w+)\}\}/g, (_, key) => safeString(values[key]));
  return `${message.trim()} ${BRAND_FOOTER}`.replace(/\s+/g, ' ').trim();
}

function newOrderMessage(orderId, itemsDescription) {
  const template = 'JENGA PLUS: Oda yako #{{orderId}} imepokelewa kwa mafanikio. Vifaa: {{items}}.';
  return buildMessage(template, { orderId, items: itemsDescription || 'vifaa vyenye Maelezo' });
}

function deliveryUpdateMessage(projectName) {
  const template = 'JENGA PLUS: Habari! Vifaa vyako vya ujenzi kwa ajili ya mradi wa {{projectName}} vimeshapakiwa kwenye gari na viko njiani.';
  return buildMessage(template, { projectName: projectName || 'mradi wako' });
}

function staffWelcomeMessage() {
  const template = 'JENGA PLUS: Karibu kwenye mfumo. Akaunti yako ya usimamizi imekamilika. Ingia kwa email yako kuanza kazi.';
  return buildMessage(template);
}

function paymentConfirmationMessage(orderId, amount) {
  const template = 'JENGA PLUS: Malipo yako ya TZS {{amount}} kwa ajili ya Oda #{{orderId}} yamethibitishwa. Asante sana!';
  return buildMessage(template, { orderId, amount });
}

function otpMessage(otpCode) {
  const template = 'JENGA PLUS: Namba yako ya uthibitisho (OTP) ni {{otp}}. Usimpe mtu yeyote.';
  return buildMessage(template, { otp: otpCode });
}

async function sendSMS(to, message, sender = DEFAULT_SENDER) {
  if (!to) throw new Error('Recipient phone number is required');
  const dryRun = String(process.env.NEXTSMS_DRYRUN || 'false').toLowerCase() === 'true';
  if (dryRun) {
    console.log('[smsService] DRY-RUN: would send SMS', { to, sender, message });
    return { status: 'dry-run', to, message };
  }
  if (!NEXTSMS_PASSWORD && !NEXTSMS_API_KEY) {
    throw new Error('NEXTSMS_PASSWORD or NEXTSMS_API_KEY is required to send SMS');
  }

  const payload = buildSMSPayload(to, message, sender);
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  const authConfig = {};
  if (NEXTSMS_API_KEY) {
    headers.Authorization = `Bearer ${NEXTSMS_API_KEY}`;
  } else {
    authConfig.auth = {
      username: NEXTSMS_USERNAME,
      password: NEXTSMS_PASSWORD
    };
  }

  if (process.env.NEXTSMS_DEBUG === 'true') {
    console.log('[smsService] sending SMS', {
      endpoint: NEXTSMS_ENDPOINT,
      authMode: NEXTSMS_AUTH_MODE,
      payload
    });
  }

  try {
    const res = await axios.post(NEXTSMS_ENDPOINT, payload, {
      ...authConfig,
      headers,
      timeout: 10000
    });
    return res.data;
  } catch (err) {
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`NextSMS send failed: ${msg}`);
  }
}

async function sendNewOrderSMS(to, orderId, itemsDescription) {
  const recipient = getDefaultRecipient(to);
  if (!recipient) throw new Error('Recipient phone number is required for new order SMS');
  const message = newOrderMessage(orderId, itemsDescription);
  return sendSMS(recipient, message);
}

async function sendDeliveryUpdateSMS(to, projectName) {
  const recipient = getDefaultRecipient(to);
  if (!recipient) throw new Error('Recipient phone number is required for delivery update SMS');
  const message = deliveryUpdateMessage(projectName);
  return sendSMS(recipient, message);
}

async function sendStaffWelcomeSMS(to) {
  const recipient = getDefaultRecipient(to);
  if (!recipient) throw new Error('Recipient phone number is required for staff welcome SMS');
  const message = staffWelcomeMessage();
  return sendSMS(recipient, message);
}

async function sendPaymentConfirmationSMS(to, orderId, amount) {
  const recipient = getDefaultRecipient(to);
  if (!recipient) throw new Error('Recipient phone number is required for payment confirmation SMS');
  const message = paymentConfirmationMessage(orderId, amount);
  return sendSMS(recipient, message);
}

async function sendOTPMessage(to, otpCode) {
  const recipient = getDefaultRecipient(to);
  if (!recipient) throw new Error('Recipient phone number is required for OTP SMS');
  const message = otpMessage(otpCode);
  return sendSMS(recipient, message);
}

module.exports = {
  buildSMSPayload,
  sendSMS,
  sendNewOrderSMS,
  sendDeliveryUpdateSMS,
  sendStaffWelcomeSMS,
  sendPaymentConfirmationSMS,
  sendOTPMessage
};
