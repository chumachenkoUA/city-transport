import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthSessionMiddleware implements NestMiddleware {
  constructor(
    private readonly sessionService: SessionService,
    private readonly contextService: RequestContextService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    const session = token
      ? await this.sessionService.getSession(token)
      : null;

    (req as Request & { session?: typeof session }).session = session ?? undefined;

    return this.contextService.run(session, () => next());
  }
}
