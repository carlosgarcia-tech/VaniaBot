/**
 * @fileoverview PanelServer.ts - Express server for VaniaBot web dashboard
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger, logError } from '@/utils/logger.js';
import { env } from '@/config/env.js';
import { createSystemRouter } from './routers/SystemRouter.js';
import { createWebhookRouter } from './routers/WebhookRouter.js';
import { createSlotRouter } from './routers/SlotRouter.js';
import { createModerationRouter } from './routers/ModerationRouter.js';
import { createGroupRouter } from './routers/GroupRouter.js';

export interface PanelConfig {
  port: number;
  host: string;
  webhookToken: string;
  allowedOrigins: string[];
  panelPath: string;
  callbackSecret?: string;
}

const DEFAULT_CONFIG: PanelConfig = {
  port: process.env.PANEL_PORT ? parseInt(process.env.PANEL_PORT) : 3000,
  host: process.env.PANEL_HOST || '0.0.0.0',
  webhookToken: env.PANEL_WEBHOOK_TOKEN || '',
  allowedOrigins: process.env.PANEL_ALLOWED_ORIGINS?.split(',') || ['*'],
  panelPath: process.env.PANEL_PATH || './panel',
  callbackSecret: process.env.PANEL_CALLBACK_SECRET,
};

function loadPanelConfig(): PanelConfig {
  const configPath = './data/panel-config.json';
  if (existsSync(configPath)) {
    try {
      const loaded = JSON.parse(readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...loaded };
    } catch (error) {
      logError('[PanelServer]', error);
    }
  }
  return DEFAULT_CONFIG;
}

export class PanelServer {
  private static instance: PanelServer;
  private app: express.Application;
  private server: ReturnType<express.Application['listen']> | null = null;
  private config: PanelConfig;

  private constructor() {
    this.config = loadPanelConfig();
    // env (zod-validated, reads .env) takes precedence over panel-config.json
    // so the dashboard and the routers always agree on the token.
    if (env.PANEL_WEBHOOK_TOKEN) this.config.webhookToken = env.PANEL_WEBHOOK_TOKEN;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  static getInstance(): PanelServer {
    if (!PanelServer.instance) {
      PanelServer.instance = new PanelServer();
    }
    return PanelServer.instance;
  }

  private setupMiddleware(): void {
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );

    this.app.use(
      cors({
        origin: (
          origin: string | undefined,
          callback: (err: Error | null, allow: boolean) => void,
        ) => {
          if (
            !origin ||
            this.config.allowedOrigins.includes('*') ||
            this.config.allowedOrigins.includes(origin)
          ) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
        credentials: true,
      }),
    );

    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use('/api/', apiLimiter);
  }

  private setupRoutes(): void {
    this.app.use(express.static(this.config.panelPath));

    this.app.get('/', (_req: Request, res: Response) => {
      const indexPath = join(this.config.panelPath, 'index.html');
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send(this.getWelcomePage());
      }
    });

    this.app.use('/api', createSystemRouter(this.config.webhookToken));
    this.app.use('/api/webhook', createWebhookRouter(this.config.webhookToken));
    this.app.use('/api/slot', createSlotRouter(this.config.webhookToken));
    this.app.use('/api/slots', createSlotRouter(this.config.webhookToken));
    this.app.use('/api/moderation', createModerationRouter(this.config.webhookToken));
    this.app.use('/api/groups', createGroupRouter(this.config.webhookToken));
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Panel server error:', err);
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      });
    });
  }

  private getWelcomePage(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VaniaBot Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 500px;
    }
    h1 { color: #333; margin-bottom: 1rem; font-size: 2rem; }
    p { color: #666; margin-bottom: 1.5rem; line-height: 1.6; }
    .emoji { font-size: 4rem; margin-bottom: 1rem; }
    a { color: #667eea; text-decoration: none; font-weight: 600; }
    code {
      background: #f4f4f4;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🌸</div>
    <h1>VaniaBot Panel</h1>
    <p>
      El servidor del panel está funcionando correctamente.<br><br>
      API endpoints disponibles:<br>
      <code>/api/stats</code><br>
      <code>/api/webhook/request</code><br>
      <code>/api/slots</code>
    </p>
  </div>
</body>
</html>
    `;
  }

  async start(): Promise<void> {
    const http = await import('http');

    return new Promise(resolve => {
      this.server = http.createServer(this.app);

      this.server.listen(this.config.port, this.config.host, () => {
        logger.info(`🌸 VaniaBot Panel running at http://${this.config.host}:${this.config.port}`);
        logger.info(`📊 API: http://${this.config.host}:${this.config.port}/api/stats`);
        resolve();
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          logger.warn(`⚠️ Panel port ${this.config.port} in use, trying ${this.config.port + 1}`);
          this.server?.close();
          this.server = http.createServer(this.app);
          // Attach an error handler BEFORE listening: without it, a second
          // EADDRINUSE would surface as an uncaughtException.
          this.server.on('error', (retryError: NodeJS.ErrnoException) => {
            logger.error(
              `❌ Panel server could not bind ${this.config.port} or ${this.config.port + 1}:`,
              retryError,
            );
            resolve(); // keep the bot running even if the panel fails to bind
          });
          this.server.listen(this.config.port + 1, this.config.host, () => {
            logger.info(
              `🌸 VaniaBot Panel running at http://${this.config.host}:${this.config.port + 1}`,
            );
            resolve();
          });
        } else {
          logger.error('Panel server error:', error);
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          logger.info('🌸 VaniaBot Panel stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getConfig(): PanelConfig {
    return { ...this.config };
  }
}

export const panelServer = PanelServer.getInstance();
