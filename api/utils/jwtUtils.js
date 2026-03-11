import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && typeof secret === 'string' && secret.trim()) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return 'dev_jwt_secret_change_me';
}

export function signAccessToken(payload, options = {}) {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: '14d', ...options });
}

export function verifyAccessToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}
