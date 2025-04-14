import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/service/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = `${request.url}:${JSON.stringify(request.query)}`;

    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return next.handle().pipe(
      tap(async (data) => {
        await this.redisService.set(cacheKey, data);
      }),
    );
  }
}
