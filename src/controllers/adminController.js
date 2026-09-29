import { query } from '../config/db.js';

export async function getOverview(req, res, next) {
  try {
    const revRows = await query(`SELECT COALESCE(SUM(amount_paise), 0) as total_revenue FROM enrollments WHERE status = 'paid'`);
    const totalRevenue = parseInt(revRows[0]?.total_revenue || 0, 10) / 100;

    const enrRows = await query(`SELECT COUNT(*) as total_enrollments FROM enrollments WHERE status = 'paid'`);
    const totalEnrollments = parseInt(enrRows[0]?.total_enrollments || 0, 10);

    const leadRows = await query(`SELECT COUNT(*) as total_leads FROM leads`);
    const totalLeads = parseInt(leadRows[0]?.total_leads || 0, 10);

    const studRows = await query(`SELECT COUNT(*) as total_students FROM users WHERE role = 'student'`);
    const totalStudents = parseInt(studRows[0]?.total_students || 0, 10);

    const recentEnrollmentsRaw = await query(`
      SELECT e.id, e.amount_paise, e.status, e.created_at, u.name as user_name, u.email as user_email, c.title as course_title
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      ORDER BY e.id DESC LIMIT 5
    `);

    const recentEnrollments = recentEnrollmentsRaw.map((enr) => ({
      ...enr,
      amount_rupees: (enr.amount_paise || 0) / 100
    }));

    const recentLeads = await query(`SELECT * FROM leads ORDER BY id DESC LIMIT 5`);

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          total_revenue: totalRevenue,
          total_enrollments: totalEnrollments,
          total_leads: totalLeads,
          total_students: totalStudents
        },
        recent_activity: {
          enrollments: recentEnrollments,
          leads: recentLeads
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getEnrollments(req, res, next) {
  try {
    // Auto-delete stale pending orders older than 1 hour
    await query(`DELETE FROM enrollments WHERE status = 'created' AND created_at < NOW() - INTERVAL 1 HOUR`);

    const rows = await query(`
      SELECT e.*, u.name as student_name, u.email as student_email, u.phone as student_phone, c.title as course_title
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      ORDER BY e.id DESC
    `);

    const enrollments = rows.map((r) => ({
      ...r,
      amount_rupees: (r.amount_paise || 0) / 100
    }));

    return res.status(200).json({
      success: true,
      data: { enrollments }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEnrollmentStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const status = req.body?.status || 'refunded';

    await query('UPDATE enrollments SET status = ? WHERE id = ?', [status, id]);

    return res.status(200).json({
      success: true,
      message: `Enrollment status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteEnrollment(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM enrollments WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Enrollment order deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function getLeads(req, res, next) {
  try {
    const leads = await query('SELECT * FROM leads ORDER BY id DESC');
    return res.status(200).json({
      success: true,
      data: { leads }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLeadStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const status = req.body?.status || 'contacted';

    await query('UPDATE leads SET status = ? WHERE id = ?', [status, id]);

    return res.status(200).json({
      success: true,
      message: 'Lead status updated'
    });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const messages = await query('SELECT * FROM contact_messages ORDER BY id DESC');
    return res.status(200).json({
      success: true,
      data: { messages }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMessageStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const status = req.body?.status || 'resolved';

    await query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, id]);

    return res.status(200).json({
      success: true,
      message: 'Message status updated'
    });
  } catch (error) {
    next(error);
  }
}

export async function getStudents(req, res, next) {
  try {
    const students = await query(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
             COUNT(e.id) as enrollments_count
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id AND e.status = 'paid'
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.id DESC
    `);

    return res.status(200).json({
      success: true,
      data: { students }
    });
  } catch (error) {
    next(error);
  }
}

export async function getWebinarRegistrations(req, res, next) {
  try {
    const registrations = await query(`
      SELECT r.*, w.title as webinar_title 
      FROM webinar_registrations r 
      JOIN webinars w ON r.webinar_id = w.id 
      ORDER BY r.id DESC
    `);

    return res.status(200).json({
      success: true,
      data: { registrations }
    });
  } catch (error) {
    next(error);
  }
}

export async function saveWebinar(req, res, next) {
  try {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    const input = req.body || {};
    const title = (input.title || '').trim();
    const description = (input.description || '').trim();
    const type = input.type || 'live';
    const meetingUrl = (input.meeting_url || '').trim();
    const scheduledAt = input.scheduled_at || null;
    const availableDates = JSON.stringify(input.available_dates || []);
    const quota = parseInt(input.quota || 50, 10);

    if (!title) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Webinar title is required' }
      });
    }

    if (id) {
      await query(
        `UPDATE webinars SET title=?, description=?, type=?, meeting_url=?, scheduled_at=?, available_dates=?, quota=? WHERE id=?`,
        [title, description, type, meetingUrl, scheduledAt, availableDates, quota, id]
      );
      return res.status(200).json({
        success: true,
        message: 'Webinar updated'
      });
    } else {
      const result = await query(
        `INSERT INTO webinars (title, description, type, meeting_url, scheduled_at, available_dates, quota) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description, type, meetingUrl, scheduledAt, availableDates, quota]
      );
      return res.status(200).json({
        success: true,
        message: 'Webinar created',
        data: { id: result.insertId }
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function deleteWebinar(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM webinars WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Webinar deleted'
    });
  } catch (error) {
    next(error);
  }
}

export async function saveFaq(req, res, next) {
  try {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    const input = req.body || {};
    const question = (input.question || '').trim();
    const answer = (input.answer || '').trim();
    const category = (input.category || 'General').trim();
    const sortOrder = parseInt(input.sort_order || 0, 10);

    if (id) {
      await query(
        'UPDATE faqs SET question=?, answer=?, category=?, sort_order=? WHERE id=?',
        [question, answer, category, sortOrder, id]
      );
      return res.status(200).json({
        success: true,
        message: 'FAQ updated'
      });
    } else {
      const result = await query(
        'INSERT INTO faqs (question, answer, category, sort_order) VALUES (?, ?, ?, ?)',
        [question, answer, category, sortOrder]
      );
      return res.status(200).json({
        success: true,
        message: 'FAQ created',
        data: { id: result.insertId }
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function deleteFaq(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM faqs WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted'
    });
  } catch (error) {
    next(error);
  }
}

export function handleUploadResponse(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'No file was uploaded' }
    });
  }

  const protocol = req.protocol;
  const host = req.get('host');
  const publicUrl = `${protocol}://${host}/uploads/videos/${req.file.filename}`;

  return res.status(200).json({
    success: true,
    data: {
      url: publicUrl,
      filename: req.file.filename
    }
  });
}
