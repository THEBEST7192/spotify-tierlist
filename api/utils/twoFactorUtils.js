import { Resend } from 'resend';

const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const CODE_LENGTH = 6;

// Get Resend instance (lazy initialization)
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Generate a random 6-digit code
 */
export function generateTwoFactorCode() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * Store a 2FA code for a user in MongoDB
 */
export async function storeTwoFactorCode(db, userId, code) {
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  const collection = db.collection('two_factor_codes');

  // Delete any existing codes for this user
  await collection.deleteMany({ userId });

  // Insert new code
  await collection.insertOne({
    userId,
    code,
    expiresAt,
    createdAt: new Date()
  });
}

/**
 * Verify a 2FA code for a user from MongoDB
 */
export async function verifyTwoFactorCode(db, userId, code) {
  const collection = db.collection('two_factor_codes');

  const stored = await collection.findOne({ userId });
  if (!stored) {
    return false;
  }

  // Check if code has expired
  if (Date.now() > new Date(stored.expiresAt).getTime()) {
    await collection.deleteOne({ userId });
    return false;
  }

  // Check if code matches
  if (stored.code !== code) {
    return false;
  }

  // Code is valid, remove it from database
  await collection.deleteOne({ userId });
  return true;
}

/**
 * Check if a user has 2FA enabled
 */
export function hasTwoFactorEnabled(user) {
  return user && user.twoFactorEnabled === true && user.email;
}

/**
 * Send a 2FA code via email
 */
export async function sendTwoFactorEmail(email, code, username) {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: 'tunetier@2fa.the-diddy.party',
      to: email,
      subject: 'TuneTier - Two-Factor Authentication Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Two-Factor Authentication Code</h2>
          <p>Hello ${username},</p>
          <p>Your verification code for TuneTier is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p style="color: #666; font-size: 12px;">This is an automated message from TuneTier.</p>
        </div>
      `
    });

    if (error) {
      console.error('Error sending 2FA email:', error);
      throw new Error('Failed to send email');
    }

    return data;
  } catch (error) {
    console.error('Error sending 2FA email:', error);
    throw error;
  }
}

/**
 * Send a 2FA setup confirmation email
 */
export async function sendTwoFactorSetupEmail(email, username) {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: 'tunetier@2fa.the-diddy.party',
      to: email,
      subject: 'TuneTier - Two-Factor Authentication Enabled',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Two-Factor Authentication Enabled</h2>
          <p>Hello ${username},</p>
          <p>Two-factor authentication has been successfully enabled on your TuneTier account.</p>
          <p>From now on, you will need to enter a verification code sent to this email when logging in.</p>
          <p>If you didn't enable this feature, please contact thebest7192 on Discord or <a href="https://github.com/THEBEST7192/spotify-tierlist/issues">create an issue here</a>.</p>
          <p style="color: #666; font-size: 12px;">This is an automated message from TuneTier.</p>
        </div>
      `
    });

    if (error) {
      console.error('Error sending 2FA setup email:', error);
      throw new Error('Failed to send email');
    }

    return data;
  } catch (error) {
    console.error('Error sending 2FA setup email:', error);
    throw error;
  }
}
