import Database from 'better-sqlite3';
import { parse } from 'url';

import type { Plugin } from 'vite';

/**
 * # Glyph V2 API Vite Plugin
 *
 * Exposes SQLite V2 glyph API at `/api/glyphs-v2/:fontName`
 * @returns Vite plugin
 */
export function glyphApiV2(): Plugin {
  return {
    name: 'glyph-api-v2',
    /**
     * Modify the server middleware
     * @param server - Vite server
     */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === undefined) {
          next();
          return;
        }

        const { pathname, query } = parse(req.url, true);

        if (pathname === null || !pathname.startsWith('/api/glyphs-v2/')) {
          next();
          return;
        }

        const fontName = pathname.replace('/api/glyphs-v2/', '').split('.')[0];
        const { type, codes } = query as { type?: string; codes?: string };

        if (fontName.length === 0 || (type !== 'metadata' && type !== 'glyph')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ err: 'Invalid parameters' }));
          return;
        }

        const db = new Database('./public/glyphs/GLYPHS_V2.sqlite', { readonly: true });

        try {
          if (type === 'metadata') {
            const row = db.prepare('SELECT data FROM metadata WHERE name = ?').get(fontName) as
              | { data: string }
              | undefined;
            if (row === undefined) {
              res.statusCode = 404;
              res.end(JSON.stringify({ err: 'Metadata not found' }));
              return;
            }
            res.setHeader('Content-Type', 'application/x-protobuf');
            res.end(Buffer.from(row.data, 'base64'));
            return;
          }

          if (type === 'glyph') {
            const pieces = codes?.split(',') ?? [];
            const stmt = db.prepare('SELECT data FROM glyph_multi WHERE name = ? AND code = ?');
            const buffers: Buffer[] = [];

            /**
             * Convert a base36 string to a number
             * @param num - base36 string
             * @returns number
             */
            const base36 = (num: string) => parseInt(num, 36);

            for (const piece of pieces) {
              if (piece.includes('-')) {
                const [from, to] = piece.split('-').map(base36);
                for (let i = from; i <= to; i++) {
                  const row = stmt.get(fontName, String(i)) as { data: string } | undefined;
                  if (row !== undefined) {
                    buffers.push(Buffer.from(row.data, 'base64'));
                  }
                }
              } else {
                const code = piece.includes('.') ? piece : String(base36(piece));
                const row = stmt.get(fontName, code) as { data: string } | undefined;
                if (row !== undefined) {
                  buffers.push(Buffer.from(row.data, 'base64'));
                }
              }
            }

            res.setHeader('Content-Type', 'application/x-protobuf');
            res.end(Buffer.concat(buffers));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ err: 'Unknown request' }));
        } catch (_) {
          res.statusCode = 500;
          res.end(JSON.stringify({ err: 'Internal error' }));
        } finally {
          db.close();
        }
      });
    },
  };
}
