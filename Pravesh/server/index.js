require('dotenv').config();
const express = require('express');

const { whatsappRoutes, webhookRoutes } = require('./whatsapp');
const { smtpRoutes } = require('./smtp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'API is running. Check GET /health' });
});

app.use('/whatsapp', whatsappRoutes);
app.use('/smtp', smtpRoutes);
app.use('/', webhookRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
