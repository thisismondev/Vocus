const { db } = require('../../config/supabase.config');

exports.editMateri = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idMateri } = req.params;
    const { title, subject, paket } = req.body;
    const file = req.file;

    // Cek role user
    const { data: userData, error: userError } = await db.from('users').select('role').eq('idUser', userId).single();
    if (userError) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (userData.role !== 'Pengajar') return res.status(403).json({ error: 'Hanya Pengajar yang bisa edit materi.' });

    // Cek apakah materi diinsert oleh user ini
    const { data: materiData, error: materiError } = await db.from('materi').select('idUser').eq('idMateri', idMateri).single();
    if (materiError || !materiData) return res.status(404).json({ error: 'Materi tidak ditemukan.' });
    if (materiData.idUser !== userId) return res.status(403).json({ error: 'Hanya pemilik materi yang bisa mengedit materi.' });

    let urlMateri;
    if (file) {
      // Validasi file
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)) {
        console.error('Validasi mimetype gagal:', file.mimetype);
        return res.status(400).json({ error: 'File harus berupa PDF atau Word' });
      }
      // Nama file unik berdasarkan paket dan subject
      const path = `${paket}/${subject}/${Date.now()}-${file.originalname}`;
      // Upload file baru
      const { error: uploadError } = await db.storage.from('Materi').upload(path, file.buffer, {
        contentType: file.mimetype,
      });
      if (uploadError) {
        console.error('Upload file gagal:', uploadError.message);
        return res.status(500).json({ error: 'Upload file gagal: ' + uploadError.message });
      }
      // Ambil public URL
      const { data: urlData, error: urlError } = db.storage.from('Materi').getPublicUrl(path);
      if (urlError) {
        console.error('Ambil public URL gagal:', urlError.message);
        return res.status(500).json({ error: 'Ambil public URL gagal: ' + urlError.message });
      }
      urlMateri = urlData.publicUrl;
    }

    // Update materi
    const updateData = { title, subject, paket };
    if (urlMateri) updateData.url_materi = urlMateri;
    const { error: updateError } = await db.from('materi').update(updateData).eq('idMateri', idMateri);
    if (updateError) {
      console.error('Update materi gagal:', updateError.message);
      return res.status(500).json({ error: 'Update materi gagal: ' + updateError.message });
    }
    // Ambil data materi yang baru diupdate
    const { data: updatedMateri, error: getError } = await db.from('materi').select().eq('idMateri', idMateri).single();
    if (getError) {
      console.error('Ambil data materi gagal:', getError.message);
      return res.status(500).json({ error: 'Ambil data materi gagal: ' + getError.message });
    }
    res.json({ message: 'Materi berhasil diupdate.', data: updatedMateri });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.deleteMateri = async (req, res) => {
  try {
    const userId = req.user.id;
    const { idMateri } = req.params;

    // Cek role user
    const { data: userData, error: userError } = await db.from('users').select('role').eq('idUser', userId).single();
    if (userError) {
      console.error('User tidak ditemukan:', userError.message);
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }
    if (userData.role !== 'Pengajar') {
      console.error('Role bukan Pengajar:', userData.role);
      return res.status(403).json({ error: 'Hanya Pengajar yang bisa hapus materi.' });
    }

    // Cek apakah materi diinsert oleh user ini
    const { data: materiData, error: materiError } = await db.from('materi').select().eq('idMateri', idMateri).single();
    if (materiError || !materiData) {
      console.error('Materi tidak ditemukan:', materiError?.message);
      return res.status(404).json({ error: 'Materi tidak ditemukan.' });
    }
    if (materiData.idUser !== userId) {
      console.error('Pengajar hanya bisa hapus materi miliknya sendiri:', userId, materiData.idUser);
      return res.status(403).json({ error: 'Pengajar hanya bisa hapus materi yang diinsert sendiri.' });
    }

    // Hapus materi
    const { error: deleteError } = await db.from('materi').delete().eq('idMateri', idMateri);
    if (deleteError) {
      console.error('Delete materi gagal:', deleteError.message);
      return res.status(500).json({ error: 'Delete materi gagal: ' + deleteError.message });
    }
    res.json({ message: 'Materi berhasil dihapus.', data: materiData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.getAllMateriByPaket = async (req, res) => {
  try {
    const userId = req.user.id;
    // Ambil data user dari database
    const { data: userData, error: userError } = await db.from('users').select('role, paket').eq('idUser', userId).single();
    if (userError) return res.status(404).json({ error: 'User tidak ditemukan.' });

    let materiData, materiError;
    if (userData.role === 'Pengajar') {
      // Pengajar: ambil semua materi
      ({ data: materiData, error: materiError } = await db.from('materi').select());
    } else if (userData.role === 'Peserta') {
      // Peserta: ambil materi sesuai paket user
      ({ data: materiData, error: materiError } = await db.from('materi').select().eq('paket', userData.paket));
    } else {
      return res.status(400).json({ error: 'Role tidak valid.' });
    }
    if (materiError) return res.status(500).json({ error: materiError.message });
    res.json(materiData);
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
    // Upload ke storage
    const { error: uploadError } = await db.storage.from('Materi').upload(path, file.buffer, {
      contentType: file.mimetype,
    });
    if (uploadError) {
      console.error('Upload ke storage gagal:', uploadError.message);
      return res.status(500).json({ error: 'Upload ke storage gagal: ' + uploadError.message });
    }

    // Ambil public URL
    const { data: urlData, error: urlError } = db.storage.from('Materi').getPublicUrl(path);
    if (urlError) {
      console.error('Ambil public URL gagal:', urlError.message);
      return res.status(500).json({ error: 'Ambil public URL gagal: ' + urlError.message });
    }
    urlMateri = urlData.publicUrl;

    // Insert ke tabel materi
    const insertPayload = {
      idMateri: idMateri,
      idUser: userId,
      subjects: subject,
      paket: paket,
      title: title,
      url_materi: urlMateri,
    };
    const { error: insertError } = await db.from('materi').insert([insertPayload]);
    if (insertError) {
      console.error('Insert ke tabel materi gagal:', insertError.message);
      return res.status(500).json({ error: 'Insert ke tabel materi gagal: ' + insertError.message });
    }

    res.json({ message: 'Materi berhasil diupload', url: urlMateri });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
