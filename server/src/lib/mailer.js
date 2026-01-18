import nodemailer from 'nodemailer'
import { readConfig } from './config.js'

let transporter

export function resetTransporter() {
  transporter = null
}

function parseEnvSecure() {
  const env = process.env.SMTP_SECURE
  if (env === 'true' || env === '1') return true
  if (env === 'false' || env === '0') return false
  const port = Number(process.env.SMTP_PORT)
  return port === 465
}

function getSmtpSettings() {
  const cfg = readConfig()
  const smtp = cfg.smtp || {}
  const host = smtp.host || process.env.SMTP_HOST
  const port = smtp.port || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null)
  const secure =
    smtp.secure !== null && smtp.secure !== undefined ? smtp.secure : parseEnvSecure()
  const user = smtp.user || process.env.SMTP_USER
  const pass = smtp.password || process.env.SMTP_PASS
  const from = smtp.from || process.env.SMTP_FROM
  return { host, port, secure, user, pass, from }
}

function buildTransportOptions() {
  const { host, port, secure, user, pass } = getSmtpSettings()
  if (!host || !port) {
    throw new Error('SMTP configuration is missing')
  }
  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  }
}

function ensureTransporter() {
  if (transporter) return transporter
  transporter = nodemailer.createTransport(buildTransportOptions())
  return transporter
}

export async function verifySmtpConfig() {
  const transport = nodemailer.createTransport(buildTransportOptions())
  try {
    await transport.verify()
  } finally {
    transport.close?.()
  }
}

export async function sendMail({ to, subject, text, html }) {
  if (!to) throw new Error('Missing recipient')
  const { from } = getSmtpSettings()
  if (!from) throw new Error('SMTP from address is missing')
  const tx = ensureTransporter()
  await tx.sendMail({
    from,
    to,
    subject,
    text,
    html,
  })
}
