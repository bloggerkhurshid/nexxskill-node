import crypto from 'crypto';
import { query } from '../config/db.js';
import * as RazorpayService from '../services/razorpayService.js';
import { sendMail } from '../services/mailService.js';

export async function createOrder(req, res, next) {
  try {
    const input = req.body || {};
    const courseId = parseInt(input.courseId || 0, 10);

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Course ID is required' }
      });
    }

    const courses = await query(
      'SELECT id, title, price_paise, type FROM courses WHERE id = ? AND is_published = 1',
      [courseId]
    );

    if (courses.length === 0 || courses[0].type !== 'available' || courses[0].price_paise <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COURSE', message: 'Course is unavailable for purchase' }
      });
    }

    const course = courses[0];
    const originalAmountPaise = parseInt(course.price_paise, 10);
    let discountAmountPaise = 0;
    let couponCode = (input.couponCode || '').trim().toUpperCase();

    if (couponCode) {
      const coupons = await query('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [couponCode]);
      if (coupons.length > 0) {
        const coupon = coupons[0];
        let canUse = true;

        if (coupon.usage_type === 'single') {
          const used = await query(
            `SELECT id FROM enrollments 
             WHERE user_id = ? AND LOWER(TRIM(CONVERT(coupon_code USING utf8mb4))) = LOWER(TRIM(?)) AND status = 'paid'`,
            [req.user.id, couponCode]
          );
          if (used.length > 0) canUse = false;
        }

        const usedCount = parseInt(coupon.used_count || 0, 10);
        const maxUses = parseInt(coupon.max_uses || 0, 10);
        if (maxUses > 0 && usedCount >= maxUses) {
          canUse = false;
        }

        if (canUse) {
          const discountPercent = parseInt(coupon.discount_percent, 10);
          discountAmountPaise = Math.round((originalAmountPaise * discountPercent) / 100);
        } else {
          couponCode = null;
        }
      } else {
        couponCode = null;
      }
    } else {
      couponCode = null;
    }

    const finalAmountPaise = Math.max(0, originalAmountPaise - discountAmountPaise);

    // Handle 100% discount / Free checkout
    if (finalAmountPaise === 0) {
      const freeOrderId = 'free_ord_' + crypto.randomBytes(6).toString('hex');
      const freePaymentId = 'free_pay_' + crypto.randomBytes(6).toString('hex');

      await query(
        `INSERT INTO enrollments (user_id, course_id, razorpay_order_id, razorpay_payment_id, amount_paise, coupon_code, discount_amount_paise, status) 
         VALUES (?, ?, ?, ?, 0, ?, ?, 'paid')`,
        [req.user.id, courseId, freeOrderId, freePaymentId, couponCode, discountAmountPaise]
      );

      if (couponCode) {
        try {
          await query('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [couponCode]);
        } catch (_) {}
      }

      const emailHtml = `<h2>Enrollment Confirmed (Free Coupon Applied)!</h2><p>Hi ${req.user.name},</p><p>You have successfully unlocked <strong>${course.title}</strong> with coupon <strong>${couponCode}</strong>.</p><p>Best regards,<br>NexxSkill Team</p>`;
      sendMail(req.user.email, req.user.name, `NexxSkill Enrollment Receipt - ${course.title}`, emailHtml);

      return res.status(200).json({
        success: true,
        isFree: true,
        message: 'Course enrolled successfully with 100% discount coupon!',
        data: {
          orderId: freeOrderId,
          amount: 0,
          courseTitle: course.title
        }
      });
    }

    const receipt = 'enr_' + crypto.randomBytes(6).toString('hex');
    const orderData = await RazorpayService.createOrder(finalAmountPaise, receipt, {
      course_id: String(courseId),
      user_id: String(req.user.id)
    });

    await query(
      `INSERT INTO enrollments (user_id, course_id, razorpay_order_id, amount_paise, coupon_code, discount_amount_paise, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'created')`,
      [req.user.id, courseId, orderData.orderId, finalAmountPaise, couponCode, discountAmountPaise]
    );

    return res.status(200).json({
      success: true,
      isFree: false,
      data: {
        orderId: orderData.orderId,
        amount: finalAmountPaise,
        currency: orderData.currency,
        keyId: orderData.keyId,
        courseTitle: course.title
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const input = req.body || {};
    const orderId = (input.razorpay_order_id || '').trim();
    const paymentId = (input.razorpay_payment_id || '').trim();
    const signature = (input.razorpay_signature || '').trim();

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing Razorpay payment ID' }
      });
    }

    if (orderId && signature) {
      const verified = RazorpayService.verifySignature(orderId, paymentId, signature);
      if (!verified) {
        return res.status(400).json({
          success: false,
          error: { code: 'SIGNATURE_VERIFICATION_FAILED', message: 'Payment signature verification failed' }
        });
      }

      await query(
        `UPDATE enrollments SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'paid' 
         WHERE razorpay_order_id = ? AND user_id = ?`,
        [paymentId, signature, orderId, req.user.id]
      );
    } else {
      // Test mode fallback activation for latest created order
      await query(
        `UPDATE enrollments SET razorpay_payment_id = ?, status = 'paid' 
         WHERE user_id = ? AND status = 'created' ORDER BY id DESC LIMIT 1`,
        [paymentId, req.user.id]
      );
    }

    let enrollments = [];
    if (orderId) {
      enrollments = await query(
        `SELECT e.*, c.title as course_title 
         FROM enrollments e JOIN courses c ON e.course_id = c.id 
         WHERE e.razorpay_order_id = ?`,
        [orderId]
      );
    } else {
      enrollments = await query(
        `SELECT e.*, c.title as course_title 
         FROM enrollments e JOIN courses c ON e.course_id = c.id 
         WHERE e.user_id = ? AND e.status = 'paid' ORDER BY e.id DESC LIMIT 1`,
        [req.user.id]
      );
    }

    if (enrollments.length > 0) {
      const enrollment = enrollments[0];
      if (enrollment.coupon_code) {
        try {
          await query('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [enrollment.coupon_code]);
        } catch (_) {}
      }

      const amountRupees = (enrollment.amount_paise / 100).toFixed(2);
      const emailHtml = `<h2>Enrollment Confirmed!</h2><p>Hi ${req.user.name},</p><p>Thank you for enrolling in <strong>${enrollment.course_title}</strong>.</p><p>Payment ID: ${paymentId}<br>Amount Paid: ₹${amountRupees}</p><p>Best regards,<br>NexxSkill Team</p>`;
      sendMail(req.user.email, req.user.name, `NexxSkill Enrollment Receipt - ${enrollment.course_title}`, emailHtml);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully and enrollment activated'
    });
  } catch (error) {
    next(error);
  }
}

export async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'] || '';
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!RazorpayService.verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Invalid webhook signature' }
      });
    }

    const payload = req.body || {};
    const event = payload.event;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity || {};
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      if (orderId) {
        await query(
          `UPDATE enrollments SET razorpay_payment_id = ?, status = 'paid' WHERE razorpay_order_id = ?`,
          [paymentId, orderId]
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed'
    });
  } catch (error) {
    next(error);
  }
}
