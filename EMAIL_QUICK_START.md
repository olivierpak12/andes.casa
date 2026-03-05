# Quick Start: Set Up Email (5 minutes)

## The Fastest Way: Use Resend

### Step 1: Sign Up
- Go to https://resend.com (free)
- Sign up with your email
- Verify your email address

### Step 2: Get Your API Key
1. Click your profile icon → **API Keys**
2. Copy the key (starts with `re_...`)

### Step 3: Add to Your App
Create or edit `.env.local` in your project root:

```bash
RESEND_API_KEY=re_paste_your_key_here
SENDER_EMAIL=your-email@example.com
```

### Step 4: Restart Your Dev Server
```bash
npm run dev
```

### Step 5: Test It
1. Go to http://localhost:3000/forgot-password
2. Enter your email
3. Click "Send Reset Link"
4. Check your inbox (or spam folder)

✅ **Done!** You should receive the password reset email instantly.

---

## If You Prefer Gmail Instead

### Step 1: Enable 2FA
- Go to https://myaccount.google.com/security
- Enable 2-Step Verification

### Step 2: Create App Password
- Go to https://myaccount.google.com/apppasswords
- Select Mail → Windows Computer
- Copy the 16-character password (with spaces)

### Step 3: Add to `.env.local`
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SENDER_EMAIL=your-email@gmail.com
```

### Step 4: Install nodemailer
```bash
npm install nodemailer
```

### Step 5: Restart & Test
```bash
npm run dev
```

Then test at http://localhost:3000/forgot-password

---

## Troubleshooting

**Not receiving emails?**
- Check your SPAM/JUNK folder
- Verify email address is correct
- Check server logs for errors: `npm run dev` and look for `[EMAIL SERVICE]` messages

**Getting an error?**
- Make sure `.env.local` is in your project root (same level as `package.json`)
- Restart your dev server after adding environment variables
- Check that your API key or password is correct

**Still stuck?**
- Read the full guide: [EMAIL_SETUP.md](./EMAIL_SETUP.md)
- Check Resend status: https://status.resend.com
