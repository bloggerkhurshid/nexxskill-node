import { query } from '../config/db.js';

export async function validateCoupon(req, res, next) {
  try {
    const input = req.body || {};
    const code = (input.code || '').trim().toUpperCase();
    const courseId = parseInt(input.courseId || 0, 10);

    if (!code || !courseId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Coupon code and course ID are required' }
      });
    }

    // 1. Get Course Price
    const courses = await query(
      'SELECT id, price_paise FROM courses WHERE id = ? AND is_published = 1',
      [courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'COURSE_NOT_FOUND', message: 'Course not found' }
      });
    }

    const course = courses[0];

    // 2. Fetch Coupon
    const coupons = await query(
      'SELECT * FROM coupons WHERE code = ? AND is_active = 1',
      [code]
    );

    if (coupons.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COUPON', message: 'Invalid or expired coupon code' }
      });
    }

    const coupon = coupons[0];

    // 3. Check Usage Type & Limits
    if (coupon.usage_type === 'single') {
      const existing = await query(
        `SELECT id FROM enrollments 
         WHERE user_id = ? AND LOWER(TRIM(CONVERT(coupon_code USING utf8mb4))) = LOWER(TRIM(?)) AND status = 'paid'`,
        [req.user.id, code]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'COUPON_ALREADY_USED', message: 'You have already used this single-use coupon code' }
        });
      }
    }

    const usedCount = parseInt(coupon.used_count || 0, 10);
    const maxUses = parseInt(coupon.max_uses || 0, 10);
    if (maxUses > 0 && usedCount >= maxUses) {
      return res.status(400).json({
        success: false,
        error: { code: 'COUPON_EXHAUSTED', message: 'This coupon code usage limit has been reached' }
      });
    }

    // 4. Calculate Discount
    const originalPricePaise = parseInt(course.price_paise, 10);
    const discountPercent = parseInt(coupon.discount_percent, 10);
    const discountAmountPaise = Math.round((originalPricePaise * discountPercent) / 100);
    const finalAmountPaise = Math.max(0, originalPricePaise - discountAmountPaise);

    return res.status(200).json({
      success: true,
      message: `${discountPercent}% discount coupon applied successfully`,
      data: {
        code: coupon.code,
        discountPercent,
        originalAmount: originalPricePaise,
        discountAmount: discountAmountPaise,
        finalAmount: finalAmountPaise,
        isFree: finalAmountPaise === 0
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCoupons(req, res, next) {
  try {
    const coupons = await query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM enrollments e 
              WHERE LOWER(TRIM(CONVERT(e.coupon_code USING utf8mb4))) = LOWER(TRIM(CONVERT(c.code USING utf8mb4))) 
                AND e.status = 'paid') as used_count
      FROM coupons c 
      ORDER BY c.id DESC
    `);

    return res.status(200).json({
      success: true,
      data: { coupons }
    });
  } catch (error) {
    next(error);
  }
}

export async function saveCoupon(req, res, next) {
  try {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    const input = req.body || {};
    const code = (input.code || '').trim().toUpperCase();
    const discountPercent = Math.min(100, Math.max(1, parseInt(input.discount_percent || 10, 10)));
    const usageType = ['single', 'multiple'].includes(input.usage_type) ? input.usage_type : 'multiple';
    const maxUses = parseInt(input.max_uses || 0, 10);
    const isActive = input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Coupon code is required' }
      });
    }

    if (id) {
      await query(
        'UPDATE coupons SET code=?, discount_percent=?, usage_type=?, max_uses=?, is_active=? WHERE id=?',
        [code, discountPercent, usageType, maxUses, isActive, id]
      );
      return res.status(200).json({
        success: true,
        message: 'Coupon updated successfully'
      });
    } else {
      await query(
        'INSERT INTO coupons (code, discount_percent, usage_type, max_uses, is_active) VALUES (?, ?, ?, ?, ?)',
        [code, discountPercent, usageType, maxUses, isActive]
      );
      return res.status(200).json({
        success: true,
        message: 'Coupon created successfully'
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function deleteCoupon(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM coupons WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}
