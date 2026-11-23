import { app } from './app.ts';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

app.listen(port, host, (error) => {
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Zestora API listening on ${host}:${port}`);
});
