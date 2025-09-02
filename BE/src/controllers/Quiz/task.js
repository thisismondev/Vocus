const { db } = require('../../../config/supabase.config');

function generateId(prefix) {
  return prefix + Math.floor(1000 + Math.random() * 9000);
}

// ================== CREATE QUIZ (KOSONG) ==================
exports.createQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subjects, paket, title } = req.body;

    if (!userId) return res.status(401).json({ error: 'User belum login.' });
    if (!subjects || !paket || !title) return res.status(400).json({ error: 'Subjects, paket, dan title wajib diisi.' });

    // Cek role user
    const { data: userData, error: userError } = await db.from('users').select('role').eq('idUser', userId).single();
    if (userError) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (userData.role !== 'Pengajar') return res.status(403).json({ error: 'Hanya Pengajar yang bisa membuat quiz.' });

    const idQuiz = generateId('Q');
    const quizPayload = { idQuiz, idUser: userId, subjects, paket, title };

    const { error: quizError } = await db.from('quiz').insert([quizPayload]);
    if (quizError) {
      console.error('Insert ke tabel quiz gagal:', quizError.message);
      return res.status(500).json({ error: 'Insert ke tabel quiz gagal: ' + quizError.message });
    }

    const { data: newQuiz, error: getQuizError } = await db.from('quiz').select().eq('idQuiz', idQuiz).single();
    if (getQuizError) {
      console.error('Ambil data quiz gagal:', getQuizError.message);
      return res.status(500).json({ error: 'Ambil data quiz gagal: ' + getQuizError.message });
    }

    res.json({
      message: 'Quiz berhasil dibuat. Silakan tambahkan questions.',
      quiz: newQuiz,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================== ADD MULTIPLE QUESTIONS ==================
exports.addQuestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idQuiz } = req.params;
    const { questions } = req.body;

    if (!idQuiz) return res.status(400).json({ error: 'idQuiz wajib diisi.' });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Questions wajib diisi dan berupa array.' });
    }

    // Cek kepemilikan quiz
    const { data: quizData, error: quizError } = await db.from('quiz').select('idUser').eq('idQuiz', idQuiz).single();
    if (quizError || !quizData) return res.status(404).json({ error: 'Quiz tidak ditemukan.' });
    if (quizData.idUser !== userId) return res.status(403).json({ error: 'Anda tidak memiliki akses ke quiz ini.' });

    const insertedQuestions = [];
    const insertedChoices = [];

    // Loop untuk setiap question
    for (const q of questions) {
      if (!q.question || !q.type) {
        return res.status(400).json({ error: 'Setiap question harus memiliki field question dan type.' });
      }

      const idQuestion = generateId('QST');
      const questionPayload = { idQuestion, idQuiz, question: q.question, type: q.type };

      const { error: questionError } = await db.from('question').insert([questionPayload]);
      if (questionError) {
        console.error('Insert question gagal:', questionError.message);
        return res.status(500).json({ error: 'Insert question gagal: ' + questionError.message });
      }
      insertedQuestions.push(questionPayload);

      // Jika tipe Pilihan Ganda dan ada choices, insert choices
      if (q.type === 'Pilihan Ganda' && Array.isArray(q.choices) && q.choices.length > 0) {
        const choicesData = q.choices.map((c) => ({
          idQuestion,
          choice: c.choice,
          is_correct: !!c.is_correct,
        }));

        const { error: choiceError } = await db.from('choice').insert(choicesData);
        if (choiceError) {
          console.error('Insert choices gagal:', choiceError.message);
          return res.status(500).json({ error: 'Insert choices gagal: ' + choiceError.message });
        }
        insertedChoices.push(...choicesData);
      }
    }

    res.json({
      message: `${questions.length} questions berhasil ditambahkan ke quiz.`,
      questions: insertedQuestions,
      choices: insertedChoices,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================== GET QUIZ ==================
exports.getAllQuiz = async (req, res) => {
  try {
    const userId = req.user.id;

    // Ambil data user dari database
    const { data: userData, error: userError } = await db.from('users').select('role, paket, created_by').eq('idUser', userId).single();
    if (userError) return res.status(404).json({ error: 'User tidak ditemukan.' });

    let quizData, quizError;
    if (userData.role === 'Pengajar') {
      // Pengajar: ambil hanya quiz yang dia upload sendiri
      ({ data: quizData, error: quizError } = await db.from('quiz').select().eq('idUser', userId));
    } else if (userData.role === 'Peserta') {
      // Peserta: ambil quiz sesuai paket user DAN dibuat oleh pengajar yang mendaftarkannya
      if (!userData.created_by) {
        return res.status(400).json({ error: 'Akun peserta tidak memiliki pengajar yang terdaftar.' });
      }
      ({ data: quizData, error: quizError } = await db.from('quiz').select().eq('paket', userData.paket).eq('idUser', userData.created_by));
    } else {
      return res.status(400).json({ error: 'Role tidak valid.' });
    }

    if (quizError) return res.status(500).json({ error: quizError.message });
    res.json(quizData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.getQuizById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idQuiz } = req.params;

    if (!idQuiz) return res.status(400).json({ error: 'idQuiz wajib diisi.' });

    // Ambil data user dari database
    const { data: userData, error: userError } = await db.from('users').select('role, paket, created_by').eq('idUser', userId).single();
    if (userError) return res.status(404).json({ error: 'User tidak ditemukan.' });

    // Ambil quiz dengan questions dan choices
    const { data: quizData, error: quizError } = await db.from('quiz').select().eq('idQuiz', idQuiz).single();
    if (quizError || !quizData) return res.status(404).json({ error: 'Quiz tidak ditemukan.' });

    // Validasi akses berdasarkan role
    if (userData.role === 'Pengajar') {
      // Pengajar: hanya bisa akses quiz yang dia upload sendiri
      if (quizData.idUser !== userId) {
        return res.status(403).json({ error: 'Anda tidak memiliki akses ke quiz ini.' });
      }
    } else if (userData.role === 'Peserta') {
      // Peserta: hanya bisa akses quiz sesuai paket DAN dibuat oleh pengajar yang mendaftarkannya
      if (!userData.created_by) {
        return res.status(400).json({ error: 'Akun peserta tidak memiliki pengajar yang terdaftar.' });
      }
      if (quizData.paket !== userData.paket || quizData.idUser !== userData.created_by) {
        return res.status(403).json({ error: 'Anda tidak memiliki akses ke quiz ini.' });
      }
    } else {
      return res.status(400).json({ error: 'Role tidak valid.' });
    }

    // Ambil questions
    const { data: questionsData, error: questionsError } = await db.from('question').select().eq('idQuiz', idQuiz);
    if (questionsError) return res.status(500).json({ error: questionsError.message });

    // Ambil choices untuk setiap question
    for (const question of questionsData) {
      const { data: choicesData, error: choicesError } = await db.from('choice').select().eq('idQuestion', question.idQuestion);
      if (choicesError) return res.status(500).json({ error: choicesError.message });
      question.choices = choicesData;
    }

    res.json({
      quiz: quizData,
      questions: questionsData,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ================== UPDATE QUESTION ==================
exports.updateQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idQuestion } = req.params;
    const { question, type } = req.body;

    if (!idQuestion) return res.status(400).json({ error: 'idQuestion wajib diisi.' });

    // Cek kepemilikan question
    const { data: questionData, error: questionError } = await db.from('question').select('idQuiz').eq('idQuestion', idQuestion).single();
    if (questionError || !questionData) return res.status(404).json({ error: 'Pertanyaan tidak ditemukan.' });
    const { data: quizData } = await db.from('quiz').select('idUser').eq('idQuiz', questionData.idQuiz).single();
    if (quizData.idUser !== userId) return res.status(403).json({ error: 'Anda tidak memiliki akses ke pertanyaan ini.' });

    // Build updateData
    const updateData = { question, type };
    const { error: updateError } = await db.from('question').update(updateData).eq('idQuestion', idQuestion);
    if (updateError) {
      console.error('Update question gagal:', updateError.message);
      return res.status(500).json({ error: 'Update question gagal: ' + updateError.message });
    }
    res.json({ message: 'Pertanyaan berhasil diupdate.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================== UPDATE CHOICE ==================
exports.updateChoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idChoice } = req.params;
    const { choice, is_correct } = req.body;

    if (!idChoice) return res.status(400).json({ error: 'idChoice wajib diisi.' });

    // Cek kepemilikan choice
    const { data: choiceData, error: choiceError } = await db.from('choice').select('idQuestion').eq('idChoice', idChoice).single();
    if (choiceError || !choiceData) return res.status(404).json({ error: 'Pilihan tidak ditemukan.' });
    const { data: questionData } = await db.from('question').select('idQuiz').eq('idQuestion', choiceData.idQuestion).single();
    const { data: quizData } = await db.from('quiz').select('idUser').eq('idQuiz', questionData.idQuiz).single();
    if (quizData.idUser !== userId) return res.status(403).json({ error: 'Anda tidak memiliki akses ke pilihan ini.' });

    // Build updateData
    const updateData = { choice, is_correct };

    const { error: updateError } = await db.from('choice').update(updateData).eq('idChoice', idChoice);
    if (updateError) {
      console.error('Update choice gagal:', updateError.message);
      return res.status(500).json({ error: 'Update choice gagal: ' + updateError.message });
    }
    res.json({ message: 'Pilihan berhasil diupdate.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================== UPDATE QUIZ ==================
exports.updateQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idQuiz } = req.params;
    const { subjects, paket, title } = req.body;

    if (!idQuiz) return res.status(400).json({ error: 'idQuiz wajib diisi.' });

    // Cek kepemilikan quiz
    const { data: quizData, error: quizError } = await db.from('quiz').select('idUser').eq('idQuiz', idQuiz).single();
    if (quizError || !quizData) return res.status(404).json({ error: 'Quiz tidak ditemukan.' });
    if (quizData.idUser !== userId) return res.status(403).json({ error: 'Hanya pemilik quiz yang bisa edit.' });

    const updateData = { subjects, paket, title };
    const { error: updateError } = await db.from('quiz').update(updateData).eq('idQuiz', idQuiz);
    if (updateError) {
      console.error('Update quiz gagal:', updateError.message);
      return res.status(500).json({ error: 'Update quiz gagal: ' + updateError.message });
    }

    res.json({ message: 'Quiz berhasil diupdate.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================== DELETE QUIZ ==================
exports.deleteQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idQuiz } = req.params;

    if (!idQuiz) return res.status(400).json({ error: 'ID Quiz wajib diisi.' });

    // Cek kepemilikan quiz terlebih dahulu
    const { data: quizData, error: quizError } = await db.from('quiz').select('idUser').eq('idQuiz', idQuiz).single();
    if (quizError || !quizData) return res.status(404).json({ error: 'Quiz tidak ditemukan.' });
    if (quizData.idUser !== userId) return res.status(403).json({ error: 'Hanya pemilik quiz yang bisa menghapus quiz ini.' });

    // Ambil ID pertanyaan untuk menghapus pilihan
    const { data: questions, error: getQuestionError } = await db.from('question').select('idQuestion').eq('idQuiz', idQuiz);
    if (getQuestionError) {
      console.error('Gagal mengambil pertanyaan:', getQuestionError.message);
      return res.status(500).json({ error: 'Gagal mengambil pertanyaan: ' + getQuestionError.message });
    }

    const questionIds = questions.map((q) => q.idQuestion);

    if (questionIds.length > 0) {
      const { error: deleteChoicesError } = await db.from('choice').delete().in('idQuestion', questionIds);
      if (deleteChoicesError) {
        console.error('Gagal menghapus pilihan:', deleteChoicesError.message);
        return res.status(500).json({ error: 'Gagal menghapus pilihan: ' + deleteChoicesError.message });
      }
    }

    // Hapus pertanyaan
    const { error: deleteQuestionsError } = await db.from('question').delete().eq('idQuiz', idQuiz);
    if (deleteQuestionsError) {
      console.error('Gagal menghapus pertanyaan:', deleteQuestionsError.message);
      return res.status(500).json({ error: 'Gagal menghapus pertanyaan: ' + deleteQuestionsError.message });
    }

    // Hapus quiz
    const { error: deleteQuizError } = await db.from('quiz').delete().eq('idQuiz', idQuiz);
    if (deleteQuizError) {
      console.error('Gagal menghapus quiz:', deleteQuizError.message);
      return res.status(500).json({ error: 'Gagal menghapus quiz: ' + deleteQuizError.message });
    }

    res.json({ message: 'Quiz berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idQuestion } = req.params;

    if (!idQuestion) return res.status(400).json({ error: 'idQuestion wajib diisi.' });

    // Cek pertanyaan ada atau tidak
    const { data: question, error: questionError } = await db.from('question').select('idQuiz').eq('idQuestion', idQuestion).single();
    if (questionError || !question) {
      return res.status(404).json({ error: 'Pertanyaan tidak ditemukan.' });
    }

    // Cek kepemilikan quiz
    const { data: quiz, error: quizError } = await db.from('quiz').select('idUser').eq('idQuiz', question.idQuiz).single();
    if (quizError || !quiz) {
      return res.status(404).json({ error: 'Quiz tidak ditemukan.' });
    }
    if (quiz.idUser !== userId) {
      return res.status(403).json({ error: 'Hanya pemilik quiz yang bisa menghapus pertanyaan ini.' });
    }

    // Hapus choices terlebih dahulu
    const { error: deleteChoicesError } = await db.from('choice').delete().eq('idQuestion', idQuestion);
    if (deleteChoicesError) {
      console.error('Gagal menghapus choices:', deleteChoicesError.message);
      return res.status(500).json({ error: 'Gagal menghapus choices: ' + deleteChoicesError.message });
    }

    // Hapus pertanyaan
    const { error: deleteQuestionError } = await db.from('question').delete().eq('idQuestion', idQuestion);
    if (deleteQuestionError) {
      console.error('Gagal menghapus pertanyaan:', deleteQuestionError.message);
      return res.status(500).json({ error: 'Gagal menghapus pertanyaan: ' + deleteQuestionError.message });
    }

    return res.status(200).json({ message: 'Pertanyaan berhasil dihapus.' });
  } catch (error) {
    console.error('Gagal menghapus pertanyaan:', error);
    return res.status(500).json({ error: error.message });
  }
};
