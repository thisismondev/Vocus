const multer = require('multer');

const storage = multer.memoryStorage();
const uploadMateri = multer({ storage: storage });

module.exports = uploadMateri;