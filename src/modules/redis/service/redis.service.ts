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
      keyPrefix: 'pet_club:', // Prefixo para todas as chaves
    });

    this.defaultTTL = this.configService.get<number>('CACHE_TTL', 300); // 5 minutos por padrão

    this.redisClient.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(`Error parsing Redis data for key ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      const data = JSON.stringify(value);
      await this.redisClient.set(key, data, 'EX', ttl);
    } catch (error) {
      this.logger.error(`Error setting Redis data for key ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redisClient.keys(`pet_club:${pattern}`);

    if (keys.length > 0) {
      await this.redisClient.del(...keys);
      this.logger.debug(`Deleted ${keys.length} keys matching pattern ${pattern}`);
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
      this.logger.log('Disconnected from Redis');
    }
  }
}
