const { db } = require('../../config/supabase.config');

exports.getAllMateri = async (req, res) => {
  try {
    const { data, error } = await db.from('materi').select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.uploadMateri = async (req, res) => {
  try {
    const { title, subject, paket } = req.body;
    const file = req.file;
    const userId = req.user.id; // Otomatis terisi dari middleware

    console.log('File upload:', file);

    if (!userId) return res.status(401).json({ error: 'User belum login.' });
    if (!title || !subject || !paket) return res.status(400).json({ error: 'Title, subjects, paket wajib diisi.' });

    // Validasi file
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)) {
      return res.status(400).json({ error: 'File harus berupa PDF atau Word' });
    }

    // Generate idMateri otomatis: M + 4 digit angka acak
    const idMateri = 'M' + Math.floor(1000 + Math.random() * 9000);

    // Nama file unik berdasarkan paket dan subject
    const path = `${paket}/${subject}/${Date.now()}-${file.originalname}`;
    console.log('Path upload:', path);

    // Proses upload dan insert dibungkus try-catch, jika salah satu gagal, tidak ada data yang diinput
    let urlMateri;
    try {
      const { error: uploadError } = await db.storage.from('Materi').upload(path, file.buffer, {
        contentType: file.mimetype,
      });
      if (uploadError) throw new Error(uploadError.message);

      // Ambil public URL
      const { data: urlData } = db.storage.from('Materi').getPublicUrl(path);
      urlMateri = urlData.publicUrl;

      const { error: insertError } = await db.from('materi').insert([
        {
          idMateri: idMateri,
          idUser: userId,
          subjects: subject,
          paket: paket,
          title: title,
          url_materi: urlMateri,
        },
      ]);
      if (insertError) throw new Error(insertError.message);
    } catch (err) {
      console.error('Proses upload/insert gagal:', err.message);
      return res.status(500).json({ error: 'Proses upload/insert gagal: ' + err.message });
    }

    res.json({ message: 'Materi berhasil diupload', url: urlMateri });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
