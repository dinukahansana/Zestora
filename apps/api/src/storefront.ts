import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';

const directory = fileURLToPath(new URL('../../web/dist/', import.meta.url));
const indexFile = join(directory, 'index.html');

export function mountStorefront(app: Express) {
  if (!existsSync(indexFile)) throw new Error('Storefront build missing. Run npm run build before starting.');
  app.use('/assets', express.static(join(directory, 'assets'), { immutable: true, maxAge: '1y', index: false }));
  app.use(express.static(directory, { maxAge: '1d', index: false, redirect: false, setHeaders: (response, file) => {
    if (extname(file) === '.html') response.setHeader('Cache-Control', 'no-cache');
  } }));
  app.get('/{*path}', (request, response, next) => {
    if (!request.accepts('html') || request.path.startsWith('/assets/') || request.path.startsWith('/images/') || extname(request.path)) {
      next();
      return;
    }
    response.sendFile(indexFile, { headers: { 'Cache-Control': 'no-cache' } });
  });
}
