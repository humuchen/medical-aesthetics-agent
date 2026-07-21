import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', diagnostic: true });
});

app.get('/api/check-login', (req, res) => {
  res.json({ isLoggedIn: false, method: 'none', note: 'diagnostic mode' });
});

export default app;
