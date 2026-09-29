import jwt from 'jsonwebtoken';

function getSecret() {
  return process.env.APP_SECRET || 'nexxskill_jwt_super_secret_key_2026_change_me_in_prod';
}

export function generateTokens(user) {
  const secret = getSecret();

  const accessPayload = {
    iss: 'nexxskill-api',
    sub: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name,
    type: 'access'
  };

  const refreshPayload = {
    iss: 'nexxskill-api',
    sub: String(user.id),
    type: 'refresh'
  };

  const accessToken = jwt.sign(accessPayload, secret, { expiresIn: '2h' });
  const refreshToken = jwt.sign(refreshPayload, secret, { expiresIn: '7d' });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 7200
  };
}

export function decodeToken(token) {
  try {
    const secret = getSecret();
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}
