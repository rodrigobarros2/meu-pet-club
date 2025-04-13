import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ConfigService } from '@nestjs/config';
import { User } from './src/modules/users/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserRole } from './src/common/enums/role..enum';

async function bootstrap() {
  // Cria um ApplicationContext para seed sem iniciar o HTTP
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const configService = appContext.get(ConfigService);

  // Obter o modelo do usuário diretamente
  const userModel = appContext.get<Model<User>>(getModelToken('User'));

  const adminEmail = configService.get<string>('ADMIN_EMAIL');
  const adminName = configService.get<string>('ADMIN_NAME');
  const adminPassword = configService.get<string>('ADMIN_PASSWORD');
  const adminRole = configService.get<string>('ADMIN_ROLE');

  if (!adminEmail || !adminName || !adminPassword || !adminRole) {
    console.error('Variáveis de ambiente ADMIN_* não definidas');
    await appContext.close();
    process.exit(1);
  }

  try {
    // Verificar se o usuário já existe
    const existingUser = await userModel.findOne({ email: adminEmail }).exec();

    if (existingUser) {
      console.log('Usuário ADMIN já existe.');
    } else {
      // Hash a senha uma única vez
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Criar o usuário diretamente no MongoDB
      const admin = await userModel.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: adminRole as UserRole,
      });

      console.log('Usuário ADMIN criado com sucesso:', {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      });
    }
  } catch (error) {
    console.error('Erro ao criar usuário ADMIN:', error);
  } finally {
    await appContext.close();
    process.exit();
  }
}

bootstrap();
