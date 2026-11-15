import type { IncomingMessage, ServerResponse } from 'http';
import type { Express } from 'express';
import { createApiApp } from './app';

let cachedApp: Express | null = null;

function getApp(): Express {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}

export default function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse,
) {
  try {
    if (req.url) {
      const urlObj = new URL(req.url, 'http://localhost');
      const rewrittenPath = urlObj.searchParams.get('__path');
      if (rewrittenPath !== null) {
        urlObj.searchParams.delete('__path');
        const qs = urlObj.searchParams.toString();
        const normalized = rewrittenPath.replace(/^\/+/, '');
        req.url = `/api/${normalized}${qs ? `?${qs}` : ''}`;
      }
    }

    const app = getApp();
    return app(
      req as unknown as Parameters<typeof app>[0],
      res as unknown as Parameters<typeof app>[1],
    );
  } catch (err) {
    console.error('[Vercel API Handler Error]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Serverless API handler error',
        }),
      );
    }
    return undefined;
  }
}
