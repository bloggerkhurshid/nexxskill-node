import { query } from '../config/db.js';
import { sendMail } from './mailService.js';

/**
 * Checks for upcoming live webinars scheduled to begin in ~30 minutes
 * and automatically emails all registered participants with the direct meeting room link.
 */
export async function checkAndSendWebinarReminders() {
  try {
    const registrations = await query(`
      SELECT 
        wr.id AS registration_id,
        wr.webinar_id,
        wr.name,
        wr.email,
        wr.selected_date,
        wr.reminder_sent,
        w.title AS webinar_title,
        w.meeting_url,
        w.scheduled_at,
        w.type AS webinar_type
      FROM webinar_registrations wr
      JOIN webinars w ON wr.webinar_id = w.id
      WHERE (wr.reminder_sent IS NULL OR wr.reminder_sent = 0)
        AND w.type = 'live'
    `);

    if (!registrations || registrations.length === 0) {
      return { success: true, count: 0, message: 'No pending reminders found.' };
    }

    const now = new Date();
    let sentCount = 0;

    for (const reg of registrations) {
      let sessionTime = null;
      if (reg.scheduled_at) {
        sessionTime = new Date(reg.scheduled_at);
      } else if (reg.selected_date) {
        const parsed = new Date(reg.selected_date);
        if (!isNaN(parsed.getTime())) {
          sessionTime = parsed;
        }
      }

      if (!sessionTime || isNaN(sessionTime.getTime())) {
        continue;
      }

      const diffMs = sessionTime.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      // Trigger if session starts within 0 to 35 minutes
      if (diffMinutes >= 0 && diffMinutes <= 35) {
        const meetingUrl = reg.meeting_url || 'https://meet.google.com/nexxskill-mainframe-demo';
        
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #1153aa 0%, #2daee8 100%); padding: 36px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">NexxSkill Masterclass</h1>
              <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: 500; opacity: 0.95;">⚡ Starting in Approximately 30 Minutes!</p>
            </div>
            <div style="padding: 32px 28px; color: #1e293b;">
              <p style="font-size: 16px; line-height: 1.5; margin-top: 0;">Hi <strong>${reg.name}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                Your live masterclass session for <strong style="color: #1153aa;">${reg.webinar_title}</strong> will start in <strong>30 minutes</strong>.
              </p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #2daee8; padding: 18px 20px; border-radius: 10px; margin: 24px 0; border-top: 1px solid #edf2f7; border-right: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7;">
                <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Session Information</p>
                <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a;">${reg.webinar_title}</p>
                <p style="margin: 0; font-size: 13px; color: #475569;">📅 Scheduled: <strong>${reg.selected_date || sessionTime.toLocaleString()}</strong></p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${meetingUrl}" target="_blank" style="background: linear-gradient(135deg, #1153aa 0%, #2daee8 100%); color: #ffffff; padding: 14px 34px; border-radius: 12px; font-size: 15px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 15px rgba(45, 174, 232, 0.4);">
                  🚀 Join Live Room Now
                </a>
              </div>

              <div style="background-color: #eff6ff; border-radius: 10px; padding: 14px 18px; margin-top: 20px;">
                <p style="font-size: 12px; color: #1e40af; margin: 0; font-weight: 500;">
                  💡 <strong>Tip:</strong> Join 5 minutes early to test your audio & video. Keep your questions ready for the live Q&A!
                </p>
              </div>

              <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; margin-bottom: 0;">
                Direct Meeting Link:<br/>
                <a href="${meetingUrl}" style="color: #1153aa; word-break: break-all; font-weight: 600;">${meetingUrl}</a>
              </p>
            </div>
            <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              NexxSkill EdTech • Transforming Careers Through Live Mentorship
            </div>
          </div>
        `;

        await sendMail(
          reg.email,
          reg.name,
          `⚡ Starting in 30 Minutes: ${reg.webinar_title} | Join Room Link`,
          html
        );

        await query(
          'UPDATE webinar_registrations SET reminder_sent = 1 WHERE id = ?',
          [reg.registration_id]
        );
        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(`[WebinarReminder] Successfully dispatched ${sentCount} 30-min reminder email(s).`);
    }
    return { success: true, count: sentCount };
  } catch (error) {
    console.error('[WebinarReminder] Error checking reminders:', error.message);
    return { success: false, error: error.message };
  }
}

let reminderInterval = null;

export function startWebinarReminderScheduler() {
  if (reminderInterval) return;

  setTimeout(() => {
    checkAndSendWebinarReminders().catch((err) => {
      console.error('[WebinarReminder] Initial check error:', err.message);
    });
  }, 5000);

  reminderInterval = setInterval(() => {
    checkAndSendWebinarReminders().catch((err) => {
      console.error('[WebinarReminder] Periodic check error:', err.message);
    });
  }, 60 * 1000);

  console.log('[WebinarReminder] Automated 30-minute webinar reminder service started.');
}
