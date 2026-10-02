import type { IMiddleware, MessageContext } from '@/types/index.js';

export abstract class Middleware implements IMiddleware {
  abstract name: string;
  abstract execute(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}
