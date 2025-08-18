
import 'zone.js/node';

import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import * as express from 'express';
import * as cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppServerModule as bootstrap } from './src/main.server';
import { REQUEST, RESPONSE } from './src/express.tokens';
import { environment  } from './src/environments/environment';
import fetch from 'node-fetch';

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/srm/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? join(distFolder, 'index.original.html')
    : join(distFolder, 'index.html');

  const commonEngine = new CommonEngine();

  server.use(cors());
  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  server.get('/sitemap.xml', (req, res) => {
    fetch(environment.sitemapUrl)
      .then(sm => sm.body?.pipe(
        res.contentType('application/xml')
      )
    )
  });
  server.get('/sitemap1.xml', (req, res) => {
    fetch(environment.sitemapUrl1)
      .then(sm => sm.body?.pipe(
        res.contentType('application/xml')
      )
    )
  });

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: distFolder,
        providers: [
          { provide: APP_BASE_HREF, useValue: baseUrl },
          { provide: RESPONSE, useValue: res },
          { provide: REQUEST, useValue: req }
],
      })
      .then((html) => {
        console.log(`${new Date().toISOString()} | ${res.statusCode} | OK | ${req.url} | ${req.headers['user-agent']}}`);
        return res.send(html);
      })
      .catch((err) => {
        console.log(`${new Date().toISOString()} | ${res.statusCode} | ${err?.name || 'ERROR'} | ${req.url} | ${req.headers['user-agent']}}`);
        return next(err);
      });
  });

  server.use((err: any, res: express.Response) => {
    console.error('Unhandled error:', err);
    if (!res?.headersSent) {
      res.status(500).send('An unexpected error occurred');
    }
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}


// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export default bootstrap;
