import { query } from '../config/db.js';

export async function getEnrollments(req, res, next) {
  try {
    const rows = await query(
      `SELECT e.id, e.course_id, e.amount_paise, e.coupon_code, e.discount_amount_paise, e.status, e.created_at, e.razorpay_order_id, e.razorpay_payment_id,
              c.title as course_title, c.slug as course_slug, c.duration as course_duration, c.video_url as course_video_url, c.videos as course_videos
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.user_id = ? AND e.status = 'paid'
       ORDER BY e.id DESC`,
      [req.user.id]
    );

    const enrollments = rows.map((row) => {
      let courseVideos = [];
      try {
        courseVideos = typeof row.course_videos === 'string' ? JSON.parse(row.course_videos) : (row.course_videos || []);
      } catch (_) {
        courseVideos = [];
      }

      return {
        ...row,
        amount_rupees: (row.amount_paise || 0) / 100,
        discount_rupees: (row.discount_amount_paise || 0) / 100,
        course_videos: courseVideos
      };
    });

    return res.status(200).json({
      success: true,
      data: { enrollments }
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    const users = await query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    const webinarBookings = await query(
      `SELECT r.id, r.selected_date, r.question, r.created_at, w.title as webinar_title, w.meeting_url
       FROM webinar_registrations r
       JOIN webinars w ON r.webinar_id = w.id
       WHERE r.email = ?
       ORDER BY r.id DESC`,
      [req.user.email]
    );

    return res.status(200).json({
      success: true,
      data: {
        profile: users[0],
        webinar_bookings: webinarBookings
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const input = req.body || {};
    const name = (input.name || '').trim();
    const phone = (input.phone || '').trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name cannot be empty' }
      });
    }

    await query(
      'UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [name, phone, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
}
