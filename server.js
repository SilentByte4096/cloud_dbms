// server.js (ESM)
// Serves static files + provides secure AI proxy endpoint
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CORS first, so preflights (OPTIONS) are handled before other routes
app.use(cors({
  origin: true,               // reflect request origin in dev; restrict in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Explicit preflight handler for AI endpoint
app.options('/api/gemini', cors());

app.use(express.json());

// Serve static files from the current directory
app.use(express.static('.'));

// Serve index.html as the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// AI proxy endpoint: POST /api/gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash-exp';

app.post('/api/gemini', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server API key not configured' });
    }
    const { prompt, systemPrompt = null } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    const url = `${BASE_URL}/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const body = {
      contents: [
        {
          parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.5,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 4096
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || 'Unknown error';
      return res.status(resp.status).json({ error: `API Error: ${resp.status} - ${msg}` });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text, raw: data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Start server on PORT from .env or default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`StudyHub server running at http://localhost:${PORT}`);
  console.log(`AI proxy available at http://localhost:${PORT}/api/gemini`);
});
