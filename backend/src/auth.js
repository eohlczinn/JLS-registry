import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import 'dotenv/config';

const key = process.env.JWT_SECRET || 'development-only-change-me';
export const token = user => jwt.sign({ id: user.id, username: user.username }, key, { expiresIn: '15m' });
export const refreshToken = () => crypto.randomBytes(48).toString('base64url');
export const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
export const required = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), key); next(); }
  catch { res.status(401).json({ code: 'JL001', error: 'Autenticação obrigatória.' }); }
};
export const optional = (req, _, next) => {
  try { const value=(req.headers.authorization||'').replace('Bearer ',''); if(value) req.user=jwt.verify(value,key); } catch {}
  next();
};
