import crypto from 'crypto';
import { query } from '../config/db.js';
import * as CashfreeService from '../services/cashfreeService.js';
import { sendMail, sendPurchaseSuccessEmail } from '../services/mailService.js';

/**
 * Helper to dispatch beautiful branded receipt and confirmation email
 * and ensure each paid enrollment receives exactly one confirmation email.
 */
async function sendPurchaseConfirmation(enrollmentId) {
  try {
    const rows = await query(
      `SELECT e.*, c.title AS course_title, c.duration AS course_duration, u.name AS user_name, u.email AS user_email
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON e.user_id = u.id
       WHERE e.id = ? AND e.status = 'paid'`,
      [enrollmentId]
    );

    if (rows.length === 0) return;
    const item = rows[0];

    // Prevent duplicate emails
    if (item.email_sent) return;

    const amountRupees = (item.amount_paise / 100).toFixed(2);
    const dateFormatted = new Date(item.created_at || Date.now()).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`[PaymentController] Sending enrollment receipt to ${item.user_email} for ${item.course_title}`);
    await sendPurchaseSuccessEmail({
      email: item.user_email,
      name: item.user_name,
      courseTitle: item.course_title,
      courseDuration: item.course_duration || 'Cohort / Guided Labs',
      amountRupees,
      orderId: item.razorpay_order_id || `order_${item.id}`,
      paymentId: item.razorpay_payment_id || 'Cashfree Verified',
      date: dateFormatted
    });

    try {
      await query(`UPDATE enrollments SET email_sent = 1 WHERE id = ?`, [enrollmentId]);
    } catch (_) {}
  } catch (err) {
    console.error('[PaymentController Error] Failed to send purchase confirmation email:', err.message);
  }
}

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
    }

    const finalAmountPaise = Math.max(0, originalAmountPaise - discountAmountPaise);

    // 100% discount / Free Enrollment
    if (finalAmountPaise === 0) {
      const freeOrderId = 'free_' + crypto.randomBytes(6).toString('hex');
      const freePaymentId = 'FREE_COUPON_' + (couponCode || 'PROMO');

      const insResult = await query(
        `INSERT INTO enrollments (user_id, course_id, razorpay_order_id, razorpay_payment_id, amount_paise, coupon_code, discount_amount_paise, status) 
         VALUES (?, ?, ?, ?, 0, ?, ?, 'paid')`,
        [req.user.id, courseId, freeOrderId, freePaymentId, couponCode, discountAmountPaise]
      );

      if (couponCode) {
        try {
          await query('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [couponCode]);
        } catch (_) {}
      }

      if (insResult?.insertId) {
        sendPurchaseConfirmation(insResult.insertId).catch(() => {});
      }

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

    const orderId = 'order_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const orderData = await CashfreeService.createOrder({
      orderId,
      amountRupees: finalAmountPaise / 100,
      customer: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone
      },
      returnUrl: 'https://nexxskill.com/student/dashboard',
      orderNote: `Course: ${course.title}`
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
        cfOrderId: orderData.cfOrderId,
        paymentSessionId: orderData.paymentSessionId,
        amount: finalAmountPaise,
        currency: orderData.orderCurrency || 'INR',
        environment: orderData.environment,
        appId: orderData.appId,
        isDemo: orderData.isDemo,
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
    const orderId = (input.order_id || input.orderId || input.razorpay_order_id || '').trim();
    let paymentId = (input.cf_payment_id || input.payment_id || input.razorpay_payment_id || '').trim();

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Order reference ID is required for verification' }
      });
    }

    // Query Cashfree PG API directly
    const orderInfo = await CashfreeService.getOrder(orderId);

    if (!orderInfo || orderInfo.order_status !== 'PAID') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_COMPLETED',
          message: `Payment is not completed (Current Cashfree status: ${orderInfo?.order_status || 'UNPAID'}). Please complete payment to unlock your course.`
        }
      });
    }

    if (!paymentId) {
      const payments = await CashfreeService.getOrderPayments(orderId);
      paymentId = payments?.[0]?.cf_payment_id || `cf_pay_${Date.now()}`;
    }

    if (orderId) {
      await query(
        `UPDATE enrollments SET razorpay_payment_id = ?, status = 'paid' 
         WHERE razorpay_order_id = ? AND user_id = ?`,
        [paymentId || `cf_pay_${Date.now()}`, orderId, req.user.id]
      );
    } else {
      await query(
        `UPDATE enrollments SET razorpay_payment_id = ?, status = 'paid' 
         WHERE user_id = ? AND status = 'created' ORDER BY id DESC LIMIT 1`,
        [paymentId || `cf_pay_${Date.now()}`, req.user.id]
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

      // Dispatch comprehensive branded enrollment confirmation & receipt email
      sendPurchaseConfirmation(enrollment.id).catch(() => {});
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
    const signature = req.headers['x-webhook-signature'] || '';
    const timestamp = req.headers['x-webhook-timestamp'] || '';
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!CashfreeService.verifyWebhookSignature(rawBody, signature, timestamp)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Invalid webhook signature' }
      });
    }

    const payload = req.body || {};
    const eventType = payload.type || payload.event;
    const orderData = payload.data?.order || {};
    const paymentData = payload.data?.payment || {};

    const orderId = orderData.order_id || payload.order_id;
    const paymentId = paymentData.cf_payment_id || payload.payment_id;
    const paymentStatus = paymentData.payment_status || orderData.order_status;

    if (
      orderId &&
      (eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
        paymentStatus === 'SUCCESS' ||
        paymentStatus === 'PAID')
    ) {
      await query(
        `UPDATE enrollments SET razorpay_payment_id = ?, status = 'paid' WHERE razorpay_order_id = ?`,
        [paymentId || `cf_wh_${Date.now()}`, orderId]
      );

      const whEnrollments = await query(
        `SELECT id FROM enrollments WHERE razorpay_order_id = ? AND status = 'paid'`,
        [orderId]
      );
      if (whEnrollments.length > 0) {
        sendPurchaseConfirmation(whEnrollments[0].id).catch(() => {});
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
