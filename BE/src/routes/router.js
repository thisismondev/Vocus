const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth');
const learning = require('../controllers/learning');
const authMiddleware = require('../../middlewares/authMiddleware');
const upload = require('../../middlewares/uploadMiddleware');


// Auth
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/regist', auth.register);

// materi
router.get('/', learning.getAllMateri);
router.post('/materi/upload', authMiddleware, upload.single('url_materi'), learning.uploadMateri)


module.exports = router;
