import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  })
}

export function resetPasswordEmailHtml(link: string) {
  return `
    <p>Você solicitou a redefinição de senha.</p>
    <p><a href="${link}">Clique aqui para redefinir sua senha</a></p>
    <p>Este link expira em 1 hora.</p>
  `
}

export function inviteEmailHtml(link: string, fullName: string) {
  return `
    <p>Olá ${fullName},</p>
    <p>Você foi convidado para acessar o CRM.</p>
    <p><a href="${link}">Clique aqui para criar sua senha e acessar</a></p>
    <p>Este link expira em 24 horas.</p>
  `
}
