import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import gameRouter from './routes/game.js';
import debugRouter from './routes/debug.js';

const app = express();

app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

app.use('/api/game', gameRouter);
app.use('/api/debug', debugRouter);

app.listen(config.port, () => {
  console.log(`[server] running on http://localhost:${config.port} (${config.nodeEnv})`);
  console.log(`[server] endpoints:`);
  console.log(`  POST /api/game/init`);
  console.log(`  POST /api/game/debate/question`);
  console.log(`  POST /api/game/debate/evidence`);
  console.log(`  GET  /api/debug/sessions`);
  console.log(`  GET  /api/debug/session/:id`);
  console.log(`  GET  /api/debug/workflow/:id`);
});
