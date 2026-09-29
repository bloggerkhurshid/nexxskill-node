import { decodeToken } from '../services/jwtService.js';

export function authenticate(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.*)$/i);
  if (!match) return null;

  const token = match[1];
  const decoded = decodeToken(token);

  if (!decoded || decoded.type !== 'access') {
    return null;
  }

  return {
    id: parseInt(decoded.sub, 10),
    email: decoded.email || '',
    role: decoded.role || 'student',
    name: decoded.name || ''
  };
}

export function optionalAuth(req, res, next) {
  req.user = authenticate(req);
  next();
}

export function requireAuth(req, res, next) {
  const user = authenticate(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required or token expired'
      }
    });
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin privileges required'
        }
      });
    }
    next();
  });
}
