import app, { startServer } from './src/index.js';

startServer().catch((err) => {
  console.error('Fatal Server Startup Error:', err);
});

export default app;
