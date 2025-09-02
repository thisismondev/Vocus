const express = require('express');
const router = express.Router();
const auth = require('../controllers/Auth/auth');
const learning = require('../controllers/Materi/learning');
const task = require('../controllers/Quiz/task');
const authMiddleware = require('../../middlewares/authMiddleware');
const upload = require('../../middlewares/uploadMiddleware');

// Auth
router.post('/login', auth.login);
router.post('/logout', authMiddleware, auth.logout);
router.post('/regist', authMiddleware, auth.register);

// materi
router.get('/materi', authMiddleware, learning.getAllMateriByPaket);
router.post('/materi/create', authMiddleware, upload.single('url_materi'), learning.uploadMateri);
router.put('/materi/edit/:idMateri', authMiddleware, upload.single('url_materi'), learning.editMateri);
router.delete('/materi/delete/:idMateri', authMiddleware, learning.deleteMateri);

//  quiz
router.get('/quiz', authMiddleware, task.getAllQuiz);
router.get('/quiz/:idQuiz', authMiddleware, task.getQuizById);
router.post('/quiz/create', authMiddleware, task.createQuiz);
router.put('/quiz/update/:idQuiz', authMiddleware, task.updateQuiz);
router.delete('/quiz/delete/:idQuiz', authMiddleware, task.deleteQuiz);

// question
router.post('/quiz/:idQuiz/questions/add', authMiddleware, task.addQuestions);
router.put('/quiz/question/update/:idQuestion', authMiddleware, task.updateQuestion);
router.delete('/quiz/question/delete/:idQuestion', authMiddleware, task.deleteQuestion);

// choice
router.put('/quiz/choice/update/:idChoice', authMiddleware, task.updateChoice);

module.exports = router;
