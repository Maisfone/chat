import nodemailer from 'nodemailer'

let transporter

function ensureTransporter() {
  if (transporter) return transporter
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
    throw new Error('SMTP configuration is missing')
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure:
      SMTP_SECURE === 'true' ||
      Number(SMTP_PORT) === 465 ||
      SMTP_SECURE === '1',
    auth:
      SMTP_USER && SMTP_PASS
        ? {
            user: SMTP_USER,
            pass: SMTP_PASS,
          }
        : undefined,
  })

  return transporter
}

export async function sendMail({ to, subject, text, html }) {
  if (!to) throw new Error('Missing recipient')
  const { SMTP_FROM } = process.env
  const tx = ensureTransporter()
  await tx.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  })
}
