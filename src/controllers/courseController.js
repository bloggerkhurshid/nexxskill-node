import { query } from '../config/db.js';

function formatCourse(course) {
  let bullets = [];
  try {
    bullets = typeof course.bullets === 'string' ? JSON.parse(course.bullets) : (course.bullets || []);
  } catch (_) {
    bullets = [];
  }

  let videos = [];
  try {
    videos = typeof course.videos === 'string' ? JSON.parse(course.videos) : (course.videos || []);
  } catch (_) {
    videos = [];
  }

  return {
    ...course,
    bullets,
    videos,
    price_rupees: (course.price_paise || 0) / 100
  };
}

export async function getPublicCourses(req, res, next) {
  try {
    const rows = await query(
      'SELECT id, title, slug, description, bullets, price_paise, duration, type, thumbnail_url, video_url FROM courses WHERE is_published = 1 ORDER BY type ASC, id ASC'
    );

    const courses = rows.map(formatCourse);
    return res.status(200).json({
      success: true,
      data: { courses }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCourseBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const rows = await query(
      'SELECT id, title, slug, description, bullets, price_paise, duration, type, thumbnail_url, video_url, is_published FROM courses WHERE slug = ?',
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'COURSE_NOT_FOUND', message: 'Course not found' }
      });
    }

    return res.status(200).json({
      success: true,
      data: { course: formatCourse(rows[0]) }
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCourses(req, res, next) {
  try {
    const rows = await query('SELECT * FROM courses ORDER BY id DESC');
    const courses = rows.map(formatCourse);

    return res.status(200).json({
      success: true,
      data: { courses }
    });
  } catch (error) {
    next(error);
  }
}

export async function createCourse(req, res, next) {
  try {
    const input = req.body || {};
    const title = (input.title || '').trim();
    const slug = (input.slug || title.toLowerCase().replace(/\s+/g, '-')).trim();
    const description = (input.description || '').trim();
    const bullets = JSON.stringify(input.bullets || []);
    const priceRupees = parseFloat(input.price || 0);
    const pricePaise = Math.round(priceRupees * 100);
    const duration = (input.duration || '').trim();
    const type = input.type || 'available';
    const thumbnailUrl = (input.thumbnail_url || '').trim();
    const videos = JSON.stringify(input.videos || []);

    let firstVideoUrl = '';
    if (Array.isArray(input.videos) && input.videos.length > 0) {
      firstVideoUrl = input.videos[0].url || '';
    }
    const videoUrl = firstVideoUrl || (input.video_url || '').trim();
    const enablePlayer = input.enable_player !== undefined ? (input.enable_player ? 1 : 0) : 1;
    const isPublished = input.is_published !== undefined ? parseInt(input.is_published, 10) : 1;

    if (!title || !slug) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Course title and slug are required' }
      });
    }

    const result = await query(
      `INSERT INTO courses (title, slug, description, bullets, price_paise, duration, type, thumbnail_url, video_url, videos, enable_player, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, description, bullets, pricePaise, duration, type, thumbnailUrl, videoUrl, videos, enablePlayer, isPublished]
    );

    return res.status(200).json({
      success: true,
      message: 'Course created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCourse(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const input = req.body || {};
    const title = (input.title || '').trim();
    const slug = (input.slug || '').trim();
    const description = (input.description || '').trim();
    const bullets = JSON.stringify(input.bullets || []);
    const priceRupees = parseFloat(input.price || 0);
    const pricePaise = Math.round(priceRupees * 100);
    const duration = (input.duration || '').trim();
    const type = input.type || 'available';
    const thumbnailUrl = (input.thumbnail_url || '').trim();
    const videos = JSON.stringify(input.videos || []);

    let firstVideoUrl = '';
    if (Array.isArray(input.videos) && input.videos.length > 0) {
      firstVideoUrl = input.videos[0].url || '';
    }
    const videoUrl = firstVideoUrl || (input.video_url || '').trim();
    const enablePlayer = input.enable_player !== undefined ? (input.enable_player ? 1 : 0) : 1;
    const isPublished = input.is_published !== undefined ? parseInt(input.is_published, 10) : 1;

    await query(
      `UPDATE courses SET title=?, slug=?, description=?, bullets=?, price_paise=?, duration=?, type=?, thumbnail_url=?, video_url=?, videos=?, enable_player=?, is_published=? WHERE id=?`,
      [title, slug, description, bullets, pricePaise, duration, type, thumbnailUrl, videoUrl, videos, enablePlayer, isPublished, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Course updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCourse(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM courses WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}
