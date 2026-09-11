import app from '../netlify/functions/_shared/app.js';

const PORT = process.env.PORT || 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Weather API running on http://localhost:${PORT}`);
});