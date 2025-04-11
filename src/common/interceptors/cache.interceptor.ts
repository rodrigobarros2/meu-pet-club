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

    // Apenas cacheamos requisições GET
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Gerar chave de cache baseada na URL e parâmetros de consulta
    const cacheKey = `${request.url}:${JSON.stringify(request.query)}`;

    // Tenta obter dados do cache
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    // Se não houver cache, executa o handler e armazena o resultado
    return next.handle().pipe(
      tap(async (data) => {
        await this.redisService.set(cacheKey, data);
      }),
    );
  }
}
