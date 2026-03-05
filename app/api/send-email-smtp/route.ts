import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * SMTP Email Handler
 * Supports: Gmail, Outlook, custom SMTP servers
 * 
 * Environment variables required:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP port (usually 587 for TLS or 465 for SSL)
 * - SMTP_USER: Gmail address or SMTP username
 * - SMTP_PASS: Gmail app password or SMTP password
 * - SENDER_EMAIL: Email address to send from
 */

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const secure = smtpPort === 465; // TLS vs SSL

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      'SMTP credentials missing. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.'
    );
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      );
    }

    const transporter = getTransporter();
    const senderEmail = process.env.SENDER_EMAIL || 'noreply@andes.com';

    const info = await transporter.sendMail({
      from: senderEmail,
      to: to,
      subject: subject,
      html: html,
    });

    console.log(`[SMTP EMAIL] Sent to ${to} - Message ID: ${info.messageId}`);

    return NextResponse.json(
      { success: true, messageId: info.messageId },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[SMTP EMAIL] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
