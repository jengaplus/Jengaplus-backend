const assert = require('assert');
const { buildSMSPayload } = require('./smsService');

function testBuildSMSPayload() {
  const to = '+255626522599';
  const message = 'Test SMS payload';
  const sender = 'UniMessage';
  const payload = buildSMSPayload(to, message, sender);

  assert.deepStrictEqual(payload, {
    to,
    from: sender,
    text: message
  });

  console.log('✅ buildSMSPayload returns the expected payload');
}

try {
  testBuildSMSPayload();
  process.exit(0);
} catch (err) {
  console.error('❌ SMS service test failed');
  console.error(err);
  process.exit(1);
}
