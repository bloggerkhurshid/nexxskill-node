import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { generateTokens } from '../services/jwtService.js';
import { sendOtpEmail, sendWelcomeEmail } from '../services/mailService.js';
import { verifyFirebaseIdToken } from '../config/firebaseAdmin.js';

export async function sendRegisterOtp(req, res, next) {
  try {
    const { email, name = '' } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedName = (name || '').trim();

    if (!trimmedEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email address is required' }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Invalid email address format' }
      });
    }

    // Check if account already exists
    const existingUsers = await query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists. Please sign in instead.' }
      });
    }

    // Rate-limiting check: 45 seconds cooldown
    const recentOtps = await query(
      `SELECT id FROM email_otps 
       WHERE email = ? AND purpose = 'register' AND created_at > DATE_SUB(NOW(), INTERVAL 45 SECOND) 
       ORDER BY id DESC LIMIT 1`,
      [trimmedEmail]
    );

    if (recentOtps.length > 0) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Please wait 45 seconds before requesting another verification code.' }
      });
    }

    // Generate secure 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any old unverified OTPs for this email to keep table clean
    try {
      await query(`DELETE FROM email_otps WHERE email = ? AND purpose = 'register'`, [trimmedEmail]);
    } catch (_) {}

    await query(
      `INSERT INTO email_otps (email, otp_code, purpose, expires_at) VALUES (?, ?, 'register', ?)`,
      [trimmedEmail, otpCode, expiresAt]
    );

    // Send verification email
    console.log(`[Auth] Generated OTP for ${trimmedEmail}: ${otpCode}`);
    const emailSent = await sendOtpEmail(trimmedEmail, trimmedName, otpCode);

    if (!emailSent) {
      if (!process.env.SMTP_PASS) {
        console.warn(`[Auth Warning] SMTP_PASS is not set. Real email cannot be sent.`);
        return res.status(200).json({
          success: true,
          message: `Verification code generated. (Note: Real email delivery requires SMTP_PASS Google App Password on server)`,
          data: {
            email: trimmedEmail,
            devOtp: otpCode
          }
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'EMAIL_SEND_FAILED',
          message: 'Unable to deliver verification code to your email. Please verify your email address or try again shortly.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${trimmedEmail}`,
      data: {
        email: trimmedEmail
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function register(req, res, next) {
  try {
    const { name, email, phone = '', password, otp = '' } = req.body || {};

    const trimmedName = (name || '').trim();
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedPhone = (phone || '').trim();
    const trimmedOtp = (otp || '').toString().trim();

    if (!trimmedName || !trimmedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, email and password are required' }
      });
    }

    if (!trimmedOtp) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_REQUIRED', message: 'Verification code (OTP) is required. Please verify your email.' }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Invalid email format' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters long' }
      });
    }

    const existingUsers = await query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' }
      });
    }

    // Verify OTP against database
    const validOtps = await query(
      `SELECT id FROM email_otps 
       WHERE email = ? AND otp_code = ? AND purpose = 'register' AND expires_at > NOW() 
       ORDER BY id DESC LIMIT 1`,
      [trimmedEmail, trimmedOtp]
    );

    if (validOtps.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid or expired verification code. Please check your email or request a new code.'
        }
      });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [trimmedName, trimmedEmail, trimmedPhone, passwordHash, 'student']
    );

    // Clean up OTP record
    try {
      await query(`DELETE FROM email_otps WHERE email = ? AND purpose = 'register'`, [trimmedEmail]);
    } catch (_) {}

    const user = {
      id: result.insertId,
      name: trimmedName,
      email: trimmedEmail,
      role: 'student',
      phone: trimmedPhone
    };

    // Send Welcome Email asynchronously
    sendWelcomeEmail(trimmedEmail, trimmedName).catch((err) => {
      console.error('[Auth Error] Failed to send welcome email:', err.message);
    });

    const tokens = generateTokens(user);

    return res.status(200).json({
      success: true,
      message: 'Email verified and account registered successfully',
      data: {
        user,
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();

    if (!trimmedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' }
      });
    }

    const users = await query('SELECT id, name, email, phone, password_hash, role FROM users WHERE email = ?', [trimmedEmail]);
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    const userRecord = users[0];
    const isPasswordValid = await bcrypt.compare(password, userRecord.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    const user = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      phone: userRecord.phone,
      role: userRecord.role
    };

    const tokens = generateTokens(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
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

    return res.status(200).json({
      success: true,
      data: { user: users[0] }
    });
  } catch (error) {
    next(error);
  }
}

export async function googleAuth(req, res, next) {
  try {
    const { idToken, email, name, photoUrl = '', uid } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedName = (name || '').trim();

    if (!trimmedEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Google account email is required' }
      });
    }

    // Verify token with Firebase Admin SDK or Google OAuth tokeninfo API
    if (idToken) {
      let verifiedEmail = null;
      try {
        const decoded = await verifyFirebaseIdToken(idToken);
        if (decoded && decoded.email) {
          verifiedEmail = decoded.email.toLowerCase();
        }
      } catch (_) {}

      if (!verifiedEmail) {
        try {
          const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
          if (resp.ok) {
            const payload = await resp.json();
            if (payload.email) {
              verifiedEmail = payload.email.toLowerCase();
            }
          }
        } catch (err) {
          console.warn('[Google Auth Token Check Warning]', err.message);
        }
      }

      if (verifiedEmail && verifiedEmail !== trimmedEmail) {
        return res.status(401).json({
          success: false,
          error: { code: 'TOKEN_EMAIL_MISMATCH', message: 'Google token does not match provided email' }
        });
      }
    }

    // Check if user already exists
    const existingUsers = await query(
      'SELECT id, name, email, phone, role FROM users WHERE email = ?',
      [trimmedEmail]
    );

    let user;
    if (existingUsers.length > 0) {
      // Existing user: sign them in
      user = existingUsers[0];
    } else {
      // New user: register them
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const studentName = trimmedName || trimmedEmail.split('@')[0];

      const result = await query(
        'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [studentName, trimmedEmail, '', passwordHash, 'student']
      );

      user = {
        id: result.insertId,
        name: studentName,
        email: trimmedEmail,
        phone: '',
        role: 'student'
      };

      // Send Welcome Email asynchronously
      sendWelcomeEmail(trimmedEmail, studentName).catch(() => {});
    }

    const tokens = generateTokens(user);

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user,
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
}

