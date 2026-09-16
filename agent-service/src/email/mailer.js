import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || GMAIL_USER

let transporter = null
function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  }
  return transporter
}

/** Manda un email de texto plano + una versión HTML simple. Nunca tira si falla: solo loguea. */
export async function sendEmail({ subject, text, html, to }) {
  const t = getTransporter()
  if (!t) { console.warn('[email] GMAIL_USER/GMAIL_APP_PASSWORD no configurados, no se envía:', subject); return false }
  try {
    await t.sendMail({
      from: `"Agente Mateo Estudio" <${GMAIL_USER}>`,
      to: to || ALERT_EMAIL_TO,
      subject,
      text,
      html: html || `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    })
    return true
  } catch (err) {
    console.error('[email] error al enviar:', err.message)
    return false
  }
}

function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
