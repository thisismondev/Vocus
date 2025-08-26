const { db } = require('../../config/supabase.config');

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  }
  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    // Ambil data user dari database
    const uid = data.user.id;
    const { data: userData, error: userError } = await db.from('users').select('idUser, name, role, paket').eq('idUser', uid).single();
    if (userError) return res.status(404).json({ error: 'User tidak ditemukan di database.' });

    res.status(200).json({
      id: userData.idUser,
      name: userData.name,
      role: userData.role,
      paket: userData.paket,
      token: data.session.access_token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { error } = await db.auth.signOut();
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ message: 'Logout berhasil' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

exports.register = async (req, res) => {
  const { name, email, password, role, paket } = req.body;

  try {
    // Validasi input
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Nama, email, password, dan role wajib diisi.' });
    }

    // Validasi role dan paket
    let paketFinal;
    if (role === 'Pengajar') {
      paketFinal = 'None'; // default dari database, bisa dikirim atau dikosongkan
    } else if (role === 'Peserta') {
      if (!paket || !['A', 'B', 'C'].includes(paket)) {
        return res.status(400).json({ error: 'Peserta wajib memilih paket A, B, atau C.' });
      }
      paketFinal = paket;
    } else {
      return res.status(400).json({ error: 'Role harus Pengajar atau Peserta.' });
    }

    // Register di Supabase Auth
    const { data: authData, error: authError } = await db.auth.signUp({ email, password });
    if (authError) {
      console.error('Auth Error:', authError);
      return res.status(400).json({ error: 'Gagal membuat akun: ' + authError.message });
    }

    const uid = authData.user.id;

    // Insert ke tabel user setelah Auth sukses
    const { data: userData, error: userError } = await db
      .from('users')
      .insert([
        {
          idUser: uid,
          name,
          role,
          paket: paketFinal,
        },
      ])
      .select();

    if (userError) {
      // Jika insert ke table user gagal, hapus akun auth agar tidak ada akun "nyangkut"
      await db.auth.admin.deleteUser(uid);
      console.error('DB Insert Error:', userError);
      return res.status(400).json({ error: 'Gagal menyimpan data user: ' + userError.message });
    }

    res.status(201).json({
      message: 'Registrasi berhasil',
      user: userData[0],
    });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};
