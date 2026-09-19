// Vercel serverless entry: the same Express app, seeded on cold start.
// Vercel's filesystem is read-only except /tmp, so the demo DB lives there and is rebuilt per instance.
import { app } from '../server/index.js';
import { ensureSeeded } from '../server/seed.js';

ensureSeeded();
export default app;
