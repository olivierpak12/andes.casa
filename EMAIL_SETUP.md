# Email Configuration Guide

Your password reset feature is now ready, but you need to configure an email service. Here are your options:

## Option 1: Use Resend (Recommended - Easiest)

Resend is specifically designed for Next.js and is the simplest to set up.

### Setup Steps:

1. **Create a Resend account** (free): https://resend.com
2. **Get your API Key** from the Resend dashboard
3. **Add to your `.env.local` file:**
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   SENDER_EMAIL=noreply@yourdomain.com
   ```

4. **Verify your domain** (if using a custom domain in SENDER_EMAIL)

The email service will automatically detect `RESEND_API_KEY` and use Resend.

---

## Option 2: Use Gmail with App Password

Gmail is free and widely available.

### Setup Steps:

1. **Enable 2FA on your Google Account**: https://myaccount.google.com/security
2. **Generate an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password
3. **Add to your `.env.local` file:**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx
   SENDER_EMAIL=your-email@gmail.com
   ```

4. **Install nodemailer** (required for SMTP):
   ```bash
   npm install nodemailer
   ```

---

## Option 3: Use Outlook/Microsoft Email

Similar to Gmail but uses Outlook SMTP.

### Setup Steps:

1. **Add to your `.env.local` file:**
   ```
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_USER=your-email@outlook.com
   SMTP_PASS=your-password
   SENDER_EMAIL=your-email@outlook.com
   ```

2. **Install nodemailer**:
   ```bash
   npm install nodemailer
   ```

---

## Option 4: Use SendGrid (Enterprise)

For high-volume sending or custom requirements.

### Setup Steps:

Modify `lib/emailService.ts` to uncomment the SendGrid implementation and:

1. **Create SendGrid account**: https://sendgrid.com
2. **Get API Key** from SendGrid dashboard
3. **Add to your `.env.local` file:**
   ```
   SENDGRID_API_KEY=SG.xxxxxxxxxxxx
   SENDER_EMAIL=noreply@yourdomain.com
   ```

---

## Testing

After configuring your email service:

1. Go to the **Forgot Password** page
2. Enter your email address
3. Click **Send Reset Link**
4. Check your Email inbox (or spam folder)
5. You should receive a password reset email within seconds

---

## Environment Variables Summary

```bash
# Choose ONE email service:

# Resend (Recommended)
RESEND_API_KEY=re_xxxxxxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com

# OR SMTP (Gmail, Outlook, custom)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
SENDER_EMAIL=your-email@gmail.com
```

---

## Common Issues

### "Email service not configured"
- You haven't set `RESEND_API_KEY` or `SMTP_*` variables
- Check your `.env.local` file
- Restart your dev server after adding variables

### "Failed to connect to SMTP"
- Check your SMTP credentials are correct
- Make sure your SMTP port is correct (587 or 465)
- Verify you have internet connectivity
- For Gmail: use an App Password, not your regular password

### "Email goes to spam"
- Set up SPF, DKIM, DMARC records for your domain
- Use Resend which handles this automatically
- Check your email provider's spam settings

### "401 Unauthorized for Resend"
- Your API key is incorrect or expired
- Generate a new key in Resend dashboard
- Make sure the key starts with `re_`

---

## Which Option Should I Choose?

| Service | Cost | Setup Time | Best For |
|---------|------|------------|----------|
| **Resend** | Free tier | 5 min | Easy, modern, Next.js apps |
| **Gmail** | Free | 10 min | Testing, small apps |
| **Outlook** | Free | 10 min | Microsoft ecosystem |
| **SendGrid** | Free tier | 15 min | Production, high volume |

**Recommendation**: Start with **Resend** for the easiest setup!
