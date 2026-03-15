import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  return secret.trim();
}

export function signAccessToken(payload, options = {}) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '14d', ...options });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret());
}
