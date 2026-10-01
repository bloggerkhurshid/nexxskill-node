import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseAdminInitialized = false;
let authInstance = null;

try {
  let credential = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = cert(sa);
    } catch (_) {}
  }

  if (!credential) {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDSHmR+tDXkH2Sv\nqCPDPJemhHWTS3e9x8sNgLRBMyx8OlHt+WneohAQeKQYgT7etg9Og1vfbKmLgaBV\nf9gYXeZGifla5N4mnFmK22eHP4VBocFU0nLYl8vAmns7nJ8yelE00FC7gb3t173n\nljCLxJIUqpwfM9anvqUt5nx2QT730ptv+cD36iNb8UL62mMqwB7awals9G0VSaWj\nVh+qfr1CRXLUQ8BZWy+hiRUGhvLtilCpRuFDmkYUfg9cktxeAcR7uQTOYcPAdwdS\nPZ3l2JRT1YDLvdInXzExVv3WtQXbrXnzxMw0kDP/fl8L5Cc5AYrPU5Fw5fl73GR+\nVpzTPeYFAgMBAAECggEAGUzaDmyeGZYTHliJV9qdqwoDi0UYybP7NejDq58hEeNG\n1rgDwLA0bXtNTPsRCimTXcGQ6C3yG090Mh9W8pYp4l/+M6zft/f3CzKAfIdQQRcc\nS52cgQqEGPCw+nxRKfeS/CBCPFWyvCcQYYiS112Htm/VpScth1y8EHMSlP2lupq8\nQNOXcQP9C9KoJ/FAt8OoyGgnDlNN0x+Nq+sVwlqIrwfqv1w36m7b935+u/EqpgNk\nlpcw2m7iRe6XB9VCvmRQBYxNYohmapJJnzOyzS97EU1iMqAzCTMDbUhis/6BVmJN\nesFMaLIjfU2WK0NiEuG9lYz9KcLPay/kxrNP/ecqkQKBgQDxletxlK0Wfkn1X89Y\nD1r+zISN04oScy65vIEAgKxQER/LVJPeMMgZKo86btzxgK1I2BzN7LXpVfXnlloT\n/5iavTuuhFxlWoJ4qoZwNPMlTBMvM3ddLsAolpUxwm3lv8P23Ck61EXpkgFXsLFG\nJEWjoN4Pr9pH5GN1bue6SDhSEQKBgQDep9WLv65t9bGevMKpjm9NUyt4Hyhx/jvC\nKL6Je4wsod5AMIYlsht7Jm8xk69ncC/wNWoI59a9DSQNQZwbPhLKric1WcUa0xiu\noEayhCzeYgkrfAW/hAjoqCD4rm5BNealPhsrUSOCdpoSi4734N/+qMiU0CwSdekA\nn8CMhM3gtQKBgF9+BBfcTeKzPqa4HWxQfYZz7v1knZIXZ2PRiChbtEDd0/R6VQyh\nuaaA9SaCxeDMHTLLAe+/3lQCP3YwLyDyii64GAwuk5sYgLQTq5pUw7t9a6PfsxHp\nNdmVVBncIbaL63j7o2x2lb/yj4dK93ejRMeeAcivmReLxmiX0w8GFwURAoGAWOIC\n+2CvjzHPkCCmTO2RPPsAlVlK2ga1cFK3jUaGtKKBiHpWcuHg2o6DQPVFxjMgz/Fi\nvN9f9+QxCiGw4acr9UEEYeXOK2EtrzhIQKdHChd0taky2jspG0dSsjNfzCRqSHi8\ne9ROKpyR8OlJT2azxIM4Xz+i+FOdiiQ7x1yUmykCgYB3lA0hbMUpuDERFsdhwLZs\nLnbuXOQaJWc54N+UXprFlnru5qy8fwyapXxQL1658Q43cHW8eBtjy7ji1wawOeSg\nYPno0JROxir3LPQiB//GzwGnbUw1DyJt+6QMedlJqtg2Wk5xp4nE6/+xEpnR1epL\n4OnXHfTx0zmdJrUgtNuhOw==\n-----END PRIVATE KEY-----\n`;

    const privateKey = rawKey.replace(/\\n/g, '\n');

    credential = cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'nexxskills',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@nexxskills.iam.gserviceaccount.com',
      privateKey
    });
  }

  const app = !getApps().length ? initializeApp({ credential }) : getApps()[0];
  authInstance = getAuth(app);
  firebaseAdminInitialized = true;
  console.log('[FirebaseAdmin] Initialized successfully for project nexxskills');
} catch (err) {
  console.error('[FirebaseAdmin Init Warning]', err.message);
}

export async function verifyFirebaseIdToken(idToken) {
  if (!firebaseAdminInitialized || !authInstance || !idToken) return null;
  try {
    return await authInstance.verifyIdToken(idToken);
  } catch (err) {
    console.warn('[FirebaseAdmin Token Verify Warning]', err.message);
    return null;
  }
}
