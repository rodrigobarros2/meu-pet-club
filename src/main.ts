import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Meu Pet Club API')
    .setDescription('API para gerenciamento de pets e usuários')
    .setVersion('1.0')
    .addTag('auth', 'Autenticação')
    .addTag('users', 'Gerenciamento de usuários')
    .addTag('pets', 'Gerenciamento de pets')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3333);
}

bootstrap().catch((error) => {
  console.error('Error during application bootstrap:', error);
});
