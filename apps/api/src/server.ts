import { startDelivery } from './automation/delivery.ts';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { connectDatabase, disconnectDatabase } from './database.ts';

const config = readConfig();

if (config.mongoUri) {
  try {
    await connectDatabase(config.mongoUri);
  } catch (error) {
    console.error('Database connection failed:', error instanceof Error ? error.name : 'Unknown');
    await disconnectDatabase();
    process.exit(1);
  }
}

let stopDelivery = () => {};
const server = createApp(config).listen(config.port, config.host, (error) => {
  if (error) {
    console.error('API listen failed:', error.message);
    void disconnectDatabase().finally(() => { process.exitCode = 1; });
    return;
  }

  stopDelivery = startDelivery(config);
  console.log(`Zestora API listening on ${config.host}:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    stopDelivery();
    server.close(() => void disconnectDatabase());
  });
}
