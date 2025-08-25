const { db } = require('../config/supabase.config');
const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Token tidak ditemukan' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token tidak valid' });

    // Verifikasi token dengan secret Supabase (JWT_SECRET)
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    req.user = {
      id: decoded.sub,
      email: decoded.email || null,
    };

    next();
  } catch (error) {
    console.error('Auth Error:', error.message);
    res.status(401).json({ error: 'Autentikasi gagal, token tidak valid' });
  }
};

module.exports = authMiddleware;
