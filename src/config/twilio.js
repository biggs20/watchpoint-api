const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Send SMS helper function
const sendSMS = async ({ to, message }) => {
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    
    console.log(`📱 SMS sent to ${to}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('❌ Twilio error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  twilioClient: client,
  sendSMS,
};
