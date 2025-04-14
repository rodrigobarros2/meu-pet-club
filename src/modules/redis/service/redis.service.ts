import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisClient: Redis;
  private readonly logger = new Logger(RedisService.name);
  private readonly defaultTTL: number; // Tempo de vida padrão para chaves (em segundos)

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      keyPrefix: 'pet_club:',
    });

    this.defaultTTL = this.configService.get<number>('CACHE_TTL', 300);

    this.redisClient.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redisClient.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(`Erro ao obter chave do Redis (${key}):`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      const data = JSON.stringify(value);
      await this.redisClient.set(key, data, 'EX', ttl);
      this.logger.debug(`Cache salvo para chave: ${key}`);
    } catch (error) {
      this.logger.error(`Erro ao salvar no Redis (${key}):`, error);
    }
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redisClient.keys(pattern);

    if (keys.length > 0) {
      await this.redisClient.del(...keys);
      this.logger.log(`Excluídas ${keys.length} chaves com o padrão "${pattern}"`);
    } else {
      this.logger.debug(`Nenhuma chave encontrada com o padrão "${pattern}"`);
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
      this.logger.log('Disconnected from Redis');
    }
  }
}
