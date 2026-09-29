import { query } from '../config/db.js';
import { sendMail } from '../services/mailService.js';
import { authenticate } from '../middleware/auth.js';

export async function createLead(req, res, next) {
  try {
    const input = req.body || {};
    const fullName = (input.full_name || '').trim();
    const mobile = (input.mobile || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    const courseInterested = (input.course_interested || '').trim();
    const experienceLevel = input.experience_level || 'Beginner';

    if (!fullName || !mobile || !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Full name, mobile and email are required' }
      });
    }

    await query(
      'INSERT INTO leads (full_name, mobile, email, course_interested, experience_level, status) VALUES (?, ?, ?, ?, ?, ?)',
      [fullName, mobile, email, courseInterested, experienceLevel, 'new']
    );

    const adminMailHtml = `<h3>New Lead Submission</h3><p>Name: ${fullName}<br>Email: ${email}<br>Phone: ${mobile}<br>Course: ${courseInterested}<br>Experience: ${experienceLevel}</p>`;
    sendMail('nexxskill39@gmail.com', 'NexxSkill Admin', `New Lead Inquiry: ${courseInterested}`, adminMailHtml);

    return res.status(200).json({
      success: true,
      message: 'Lead inquiry submitted successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function submitContact(req, res, next) {
  try {
    const input = req.body || {};
    const name = (input.name || '').trim();
    const phone = (input.phone || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    const subject = (input.subject || 'General Inquiry').trim();
    const message = (input.message || '').trim();

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, email and message are required' }
      });
    }

    await query(
      'INSERT INTO contact_messages (name, phone, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone, email, subject, message, 'unresolved']
    );

    const replyHtml = `<h3>Thank you for contacting NexxSkill!</h3><p>Hi ${name},</p><p>We have received your message regarding '${subject}' and will get back to you shortly.</p><p>NexxSkill Support</p>`;
    sendMail(email, name, 'NexxSkill Contact Received', replyHtml);

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function registerWebinar(req, res, next) {
  try {
    const input = req.body || {};
    const webinarId = parseInt(input.webinar_id || 0, 10);
    const name = (input.name || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    const phone = (input.phone || '').trim();
    const selectedDate = (input.selected_date || '').trim();
    const question = (input.question || '').trim();

    if (!webinarId || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, email, phone and webinar ID are required' }
      });
    }

    const webinars = await query(
      'SELECT id, title, quota, registrations_count, meeting_url FROM webinars WHERE id = ?',
      [webinarId]
    );

    if (webinars.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'WEBINAR_NOT_FOUND', message: 'Webinar session not found' }
      });
    }

    const webinar = webinars[0];

    const existingRegistrations = await query(
      'SELECT id, selected_date FROM webinar_registrations WHERE webinar_id = ? AND email = ?',
      [webinarId, email]
    );

    if (existingRegistrations.length > 0) {
      await query(
        'UPDATE webinar_registrations SET name = ?, phone = ?, selected_date = ?, question = ? WHERE id = ?',
        [name, phone, selectedDate, question, existingRegistrations[0].id]
      );

      return res.status(200).json({
        success: true,
        message: 'Your booked session timing has been updated successfully!',
        data: { meeting_url: webinar.meeting_url }
      });
    }

    if (webinar.registrations_count >= webinar.quota) {
      return res.status(400).json({
        success: false,
        error: { code: 'QUOTA_FULL', message: 'Seats for this webinar date are fully booked' }
      });
    }

    await query(
      'INSERT INTO webinar_registrations (webinar_id, name, email, phone, selected_date, question) VALUES (?, ?, ?, ?, ?, ?)',
      [webinarId, name, email, phone, selectedDate, question]
    );

    await query(
      'UPDATE webinars SET registrations_count = registrations_count + 1 WHERE id = ?',
      [webinarId]
    );

    const mailHtml = `<h3>Webinar Seat Confirmed!</h3><p>Hi ${name},</p><p>Your seat for <strong>${webinar.title}</strong> on <strong>${selectedDate}</strong> is confirmed.</p><p>NexxSkill Team</p>`;
    sendMail(email, name, `Webinar Seat Confirmed: ${webinar.title}`, mailHtml);

    return res.status(200).json({
      success: true,
      message: 'Webinar seat reserved successfully',
      data: { meeting_url: webinar.meeting_url }
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelWebinarBooking(req, res, next) {
  try {
    const webinarId = parseInt(req.params.id, 10);
    const userEmail = req.user.email;

    const bookings = await query(
      'SELECT id FROM webinar_registrations WHERE webinar_id = ? AND email = ?',
      [webinarId, userEmail]
    );

    if (bookings.length > 0) {
      await query('DELETE FROM webinar_registrations WHERE id = ?', [bookings[0].id]);
      await query('UPDATE webinars SET registrations_count = GREATEST(0, registrations_count - 1) WHERE id = ?', [webinarId]);

      return res.status(200).json({
        success: true,
        message: 'Webinar reservation cancelled successfully'
      });
    }

    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Webinar booking not found' }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicWebinars(req, res, next) {
  try {
    const rows = await query('SELECT * FROM webinars ORDER BY scheduled_at ASC');

    const webinars = rows.map((w) => {
      let availableDates = [];
      try {
        availableDates = typeof w.available_dates === 'string' ? JSON.parse(w.available_dates) : (w.available_dates || []);
      } catch (_) {
        availableDates = [];
      }

      return {
        ...w,
        available_dates: availableDates,
        seats_left: Math.max(0, (w.quota || 0) - (w.registrations_count || 0))
      };
    });

    let userEmail = (req.query.email || '').trim().toLowerCase();
    if (!userEmail) {
      const user = authenticate(req);
      if (user && user.email) {
        userEmail = user.email.toLowerCase();
      }
    }

    const bookedWebinarIds = [];
    const userBookings = {};

    if (userEmail) {
      const userRegs = await query(
        'SELECT webinar_id, selected_date, created_at FROM webinar_registrations WHERE email = ?',
        [userEmail]
      );

      for (const r of userRegs) {
        const wid = parseInt(r.webinar_id, 10);
        bookedWebinarIds.push(wid);
        userBookings[wid] = {
          selected_date: r.selected_date,
          created_at: r.created_at
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        webinars,
        booked_webinar_ids: bookedWebinarIds,
        user_bookings: userBookings
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicFaqs(req, res, next) {
  try {
    const faqs = await query('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC');
    return res.status(200).json({
      success: true,
      data: { faqs }
    });
  } catch (error) {
    next(error);
  }
}
