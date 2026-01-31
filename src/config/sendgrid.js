const sgMail = require('@sendgrid/mail');

// Initialize SendGrid client
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Send email helper function
const sendEmail = async ({ to, subject, text, html }) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject,
    text,
    html: html || text,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid error:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

// Send bulk emails
const sendBulkEmail = async (messages) => {
  try {
    await sgMail.send(messages);
    console.log(`📧 Bulk email sent: ${messages.length} messages`);
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid bulk error:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendBulkEmail,
};
