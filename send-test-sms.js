require('dotenv').config();
const sms = require('./services/smsService');

const to = process.env.ADMIN_PHONE || '+255626522599';
const message = 'JengaPlus mock payment verification SMS. Umetumwa kama ombi la B.';

sms.sendSMS(to, message, 'UniMessage')
  .then((result) => {
    console.log('SMS send response:', JSON.stringify(result));
    process.exit(0);
  })
  .catch((err) => {
    console.error('SMS send failed:', err.message);
    process.exit(1);
  });
