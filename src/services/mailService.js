import nodemailer from 'nodemailer';

export async function sendMail(toEmail, toName, subject, htmlBody) {
  const smtpHost = process.env.SMTP_HOST || '';
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'nexxskill39@gmail.com';
  const fromName = process.env.SMTP_FROM_NAME || 'NexxSkill Technical Academy';

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
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${toName || 'Learner'}" <${toEmail}>`,
      subject,
      html: htmlBody
    });

    console.log(`[MailService] Email sent successfully to ${toEmail} [${subject}]`);
    return true;
  } catch (error) {
    console.error(`[MailService Error] Failed to send email to ${toEmail}:`, error.message);
    return false;
  }
}

/**
 * Send 6-digit OTP verification email for account registration
 */
export async function sendOtpEmail(toEmail, toName, otpCode) {
  const subject = `${otpCode} is your NexxSkill verification code`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NexxSkill Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
              
              <!-- Brand Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0b172a 0%, #1153aa 100%); padding: 36px 30px; text-align: center;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                    Nexx<span style="color: #2daee8;">Skill</span>
                  </h1>
                  <p style="margin: 8px 0 0; color: #93c5fd; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
                    Technical Academy
                  </p>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 36px 32px 30px;">
                  <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #0f172a;">
                    Verify your email address
                  </h2>
                  <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; color: #475569;">
                    Hi <strong>${toName || 'Learner'}</strong>,<br>
                    Thank you for signing up for NexxSkill. Use the 6-digit verification code below to complete your registration and activate your student account:
                  </p>

                  <!-- OTP Code Box -->
                  <div style="background-color: #f0f7ff; border: 2px dashed #2daee8; border-radius: 14px; padding: 22px; text-align: center; margin: 28px 0;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0284c7; letter-spacing: 1.5px; margin-bottom: 8px;">
                      Verification Code
                    </span>
                    <span style="display: inline-block; font-family: 'Courier New', monospace; font-size: 34px; font-weight: 800; color: #0b172a; letter-spacing: 8px;">
                      ${otpCode}
                    </span>
                  </div>

                  <p style="margin: 0 0 16px; font-size: 13px; line-height: 20px; color: #64748b;">
                    ⏱️ This code is valid for <strong>10 minutes</strong>. For your security, please do not share this code with anyone.
                  </p>
                  <p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8;">
                    If you did not request this verification, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 16px;">
                    © 2026 NexxSkill Technical Academy · All rights reserved.<br>
                    Need assistance? Contact <a href="mailto:nexxskill39@gmail.com" style="color: #0284c7; text-decoration: none;">nexxskill39@gmail.com</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendMail(toEmail, toName, subject, htmlBody);
}

/**
 * Send purchase confirmation & enrollment activated email
 */
export async function sendPurchaseSuccessEmail({
  email,
  name,
  courseTitle,
  courseDuration = 'Cohort / Self-Paced',
  amountRupees,
  orderId,
  paymentId,
  date
}) {
  const subject = `🎉 Enrollment Confirmed: ${courseTitle} - NexxSkill`;
  const formattedDate = date || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Enrollment Confirmed</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
              
              <!-- Brand Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0b172a 0%, #1153aa 100%); padding: 36px 30px; text-align: center;">
                  <span style="display: inline-block; background-color: rgba(45, 174, 232, 0.2); border: 1px solid rgba(45, 174, 232, 0.4); color: #7dd3fc; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 14px; border-radius: 20px; margin-bottom: 12px;">
                    Payment Confirmed
                  </span>
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                    Welcome to the Cohort! 🎓
                  </h1>
                  <p style="margin: 8px 0 0; color: #bae6fd; font-size: 13px;">
                    Your enrollment has been successfully activated.
                  </p>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 36px 32px 28px;">
                  <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #1e293b;">
                    Hi <strong>${name || 'Learner'}</strong>,
                  </p>
                  <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; color: #475569;">
                    Congratulations! Your payment for <strong>${courseTitle}</strong> was successfully verified via Cashfree Payments. You now have full access to course curriculum, interactive modules, and lab sessions.
                  </p>

                  <!-- Receipt Summary Card -->
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; margin-bottom: 28px;">
                    <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #334155;">
                      <tr>
                        <td style="padding-bottom: 10px; color: #64748b;">Course:</td>
                        <td align="right" style="padding-bottom: 10px; font-weight: 700; color: #0f172a;">${courseTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #64748b;">Duration:</td>
                        <td align="right" style="padding-bottom: 10px; font-weight: 600; color: #0f172a;">${courseDuration}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #64748b;">Instructor:</td>
                        <td align="right" style="padding-bottom: 10px; font-weight: 600; color: #0f172a;">Jahangir Alom Bakul (Ex-IBM)</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #64748b;">Amount Paid:</td>
                        <td align="right" style="padding-bottom: 10px; font-weight: 800; color: #059669; font-size: 16px;">₹${amountRupees}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #64748b;">Payment Ref:</td>
                        <td align="right" style="padding-bottom: 10px; font-family: monospace; font-size: 12px; color: #0f172a;">${paymentId || orderId}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #64748b;">Order ID:</td>
                        <td align="right" style="padding-bottom: 10px; font-family: monospace; font-size: 12px; color: #0f172a;">${orderId}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Date:</td>
                        <td align="right" style="color: #0f172a;">${formattedDate}</td>
                      </tr>
                    </table>
                  </div>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://nexxskill.com/student/dashboard" style="display: inline-block; background: linear-gradient(135deg, #1153aa 0%, #2daee8 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(45, 174, 232, 0.4);">
                      Access My Student Dashboard →
                    </a>
                  </div>

                  <!-- Support info -->
                  <div style="border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 18px;">
                    <p style="margin: 0 0 6px;">
                      <strong>Have questions?</strong> You can reach out directly to our academic team at <a href="mailto:nexxskill39@gmail.com" style="color: #0284c7; text-decoration: none;">nexxskill39@gmail.com</a> or WhatsApp at <strong>+91 60028 60802</strong>.
                    </p>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 16px;">
                    © 2026 NexxSkill Technical Academy · Empowering Engineers for Enterprise Tech<br>
                    Official receipt for your online course enrollment.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendMail(email, name, subject, htmlBody);
}

/**
 * Send welcome email to newly registered student
 */
export async function sendWelcomeEmail(toEmail, toName) {
  const subject = `Welcome to NexxSkill Technical Academy! 🚀`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to NexxSkill</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
              
              <!-- Brand Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0b172a 0%, #1153aa 100%); padding: 36px 30px; text-align: center;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">
                    Welcome to Nexx<span style="color: #2daee8;">Skill</span>!
                  </h1>
                  <p style="margin: 8px 0 0; color: #93c5fd; font-size: 13px;">
                    Enterprise Engineering & Technical Mastery
                  </p>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 36px 32px 30px;">
                  <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">
                    Hi <strong>${toName || 'Learner'}</strong>,
                  </p>
                  <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #475569;">
                    Your account has been verified and registered successfully! You are now part of our learning community mentored by IBM & Societe Generale veterans.
                  </p>
                  <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; color: #475569;">
                    Explore our programs in <strong>Mainframe Systems (COBOL, JCL, DB2)</strong>, <strong>Data Science</strong>, and <strong>Full-Stack Engineering</strong>.
                  </p>

                  <div style="text-align: center; margin: 28px 0;">
                    <a href="https://nexxskill.com/courses" style="display: inline-block; background: linear-gradient(135deg, #1153aa 0%, #2daee8 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px;">
                      Explore Available Courses →
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #64748b;">
                    © 2026 NexxSkill Technical Academy · <a href="https://nexxskill.com" style="color: #0284c7; text-decoration: none;">nexxskill.com</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendMail(toEmail, toName, subject, htmlBody);
}

