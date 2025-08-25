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
    const { idMateri, title, subject, paket } = req.body;
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

    // Nama file unik
    const path = `materi/${Date.now()}-${file.originalname}`;
    console.log('Path upload:', path);

    const { error: uploadError } = await db.storage.from('materi').upload(path, file.buffer, {
      contentType: file.mimetype,
    });

    if (uploadError) {
      console.error('Upload error:', uploadError.message);
      return res.status(500).json({ error: uploadError.message });
    }

    // Ambil public URL
    const { data: urlMateri } = db.storage.from('materi').getPublicUrl(path);
    console.log('Public URL:', urlMateri.publicUrl);

    const { error: insertError } = await db.from('materi').insert([
      {
        idMateri: idMateri,
        idUser: userId,
        subjects: subject,
        paket: paket,
        title: title,
        url_materi: urlMateri.publicUrl,
      },
    ]);

    if (insertError) {
      console.error('Insert error:', insertError.message);
      throw insertError;
    }

    res.json({ message: 'Materi berhasil diupload', url: urlMateri.publicUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
