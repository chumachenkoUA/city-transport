import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { StoredSession } from './session.service';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<StoredSession | null>();

  run<T>(context: StoredSession | null, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): StoredSession | null {
    return this.storage.getStore() ?? null;
  }
}
