import nodemailer from 'nodemailer';

export async function sendMail(toEmail, toName, subject, htmlBody) {
  const smtpHost = process.env.SMTP_HOST || '';
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'nexxskill39@gmail.com';
  const fromName = process.env.SMTP_FROM_NAME || 'NexxSkill';

  if (!smtpHost || !smtpPass) {
    console.log(`[MailService Mock Send] To: ${toEmail} (${toName}) | Subject: ${subject}`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${toName}" <${toEmail}>`,
      subject,
      html: htmlBody
    });

    return true;
  } catch (error) {
    console.error(`[MailService Error] Failed to send email to ${toEmail}:`, error.message);
    return false;
  }
}
