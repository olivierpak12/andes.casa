interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using Resend or fallback SMTP service
 * Configure environment variables:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: For SMTP (checked first)
 * - RESEND_API_KEY: For Resend service (fallback)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Try SMTP first if configured (takes priority)
    if (process.env.SMTP_HOST) {
      return await sendViaSMTP(options);
    }

    // Fallback to Resend if API key is available
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(options);
    }

    // If neither is configured, log a warning
    console.warn(
      '[EMAIL SERVICE] No email service configured. Configure SMTP_HOST or RESEND_API_KEY.',
      `Email to ${options.to} was not sent.`
    );
    return false;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send email via Resend
 */
async function sendViaResend(options: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.SENDER_EMAIL || 'noreply@andes.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[EMAIL SERVICE - RESEND] Error:', error);
      return false;
    }

    console.log(`[EMAIL SERVICE - RESEND] Email sent to ${options.to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL SERVICE - RESEND] Error:', error);
    return false;
  }
}

/**
 * Send email via SMTP (Gmail, Outlook, custom SMTP)
 */
async function sendViaSMTP(options: EmailOptions): Promise<boolean> {
  try {
    // Use Nodemailer-like logic through Node.js built-in modules
    // For production, install nodemailer: npm install nodemailer
    
    // Construct SMTP URL for debugging
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;

    // Try to send via API endpoint if available
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-email-smtp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (response.ok) {
      console.log(`[EMAIL SERVICE - SMTP] Email sent to ${options.to}`);
      return true;
    } else {
      console.error('[EMAIL SERVICE - SMTP] Error:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('[EMAIL SERVICE - SMTP] Error:', error);
    return false;
  }
}

/**
 * Generates a secure reset token
 */
export function generateResetToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token + '-' + Date.now().toString(36);
}

/**
 * Generates a password reset email template
 */
export function generatePasswordResetEmail(
  resetLink: string,
  userName?: string,
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { font-size: 12px; color: #6b7280; text-align: center; padding: 20px; }
          .warning { color: #dc2626; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello${userName ? ` ${userName}` : ''},</p>
            <p>We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
            <p>To reset your password, click the button below:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p>Or copy and paste this link in your browser:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p class="warning">This link will expire in 24 hours for security reasons.</p>
          </div>
          <div class="footer">
            <p>If you didn't request this, please ignore this email. Your account remains secure.</p>
            <p>&copy; 2024 Andes. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates a transaction password reset email template
 */
export function generateTransactionPasswordResetEmail(
  resetLink: string,
  userName?: string,
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f97316; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { font-size: 12px; color: #6b7280; text-align: center; padding: 20px; }
          .warning { color: #dc2626; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Transaction Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello${userName ? ` ${userName}` : ''},</p>
            <p>We received a request to reset your transaction password. If you didn't make this request, you can ignore this email.</p>
            <p>To reset your transaction password, click the button below:</p>
            <a href="${resetLink}" class="button">Reset Transaction Password</a>
            <p>Or copy and paste this link in your browser:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p class="warning">This link will expire in 24 hours for security reasons.</p>
          </div>
          <div class="footer">
            <p>If you didn't request this, please ignore this email. Your account remains secure.</p>
            <p>&copy; 2024 Andes. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
