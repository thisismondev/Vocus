const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth');
const learning = require('../controllers/learning');

// Auth
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/regist', auth.register);

router.get('/', learning.getAllMateri);



module.exports = router;
