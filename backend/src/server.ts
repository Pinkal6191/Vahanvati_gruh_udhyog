import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Vahanvati Backend running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`📡 Health endpoint: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('Database connection cleanly disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database disconnect:', err);
      process.exit(1);
    }
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    console.error('Forcefully terminating process due to shutdown timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
