require('dotenv').config();
const express = require('express');
const cors = require('cors');
const router = require('./src/routes/router');

const app = express();
const PORT = process.env.PORT || 8080;


app.use(cors());
app.use(express.json());

app.use(router);

app.listen(PORT, () => {
  console.log('server running on port', PORT);
});
