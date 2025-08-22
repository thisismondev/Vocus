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
