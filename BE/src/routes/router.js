const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth');
const learning = require('../controllers/learning');
const authMiddleware = require('../../middlewares/authMiddleware');
const upload = require('../../middlewares/uploadMiddleware');

// Auth
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.post('/regist', authMiddleware, auth.register);

// materi
router.get('/materi/', authMiddleware, learning.getAllMateriByPaket);
router.post('/materi/upload', authMiddleware, upload.single('url_materi'), learning.uploadMateri);
router.put('/materi/edit/:idMateri', authMiddleware, upload.single('url_materi'), learning.editMateri);
router.delete('/materi/delete/:idMateri', authMiddleware, learning.deleteMateri);

module.exports = router;
