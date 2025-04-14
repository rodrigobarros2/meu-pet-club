import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../modules/auth/auth.module';
import { UsersModule } from '../../modules/users/users.module';
import { PetsModule } from '../../modules/pets/pets.module';
import { EmailModule } from '../../modules/email/email.module';
import { RedisModule } from '../../modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.test',
    }),
    AuthModule,
    UsersModule,
    PetsModule,
    EmailModule,
    RedisModule,
  ],
})
export class TestAppModule {}
