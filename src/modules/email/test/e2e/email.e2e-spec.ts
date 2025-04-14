import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { EmailService } from '../../service/email.service';
import { closeInMemoryMongoConnection, MongoMemoryModule } from '../../../../config/tests/mongo-memory-server.module';

describe('EmailService (e2e)', () => {
  let app: INestApplication;
  let emailService: EmailService;
  let configService: ConfigService;

  const TEMPLATE_DIR = path.resolve(__dirname, '../../templates');
  const TEMPLATE_PATH = path.resolve(TEMPLATE_DIR, 'welcome.hbs');

  beforeAll(async () => {
    process.env.EMAIL_HOST = 'sandbox.smtp.mailtrap.io';
    process.env.EMAIL_PORT = '2525';
    process.env.EMAIL_SECURE = 'false';
    process.env.EMAIL_USER = '190a9c1ccc9e83';
    process.env.EMAIL_PASS = '9e068a57340a79';
    process.env.EMAIL_FROM = 'test@meupetclub.com';
    process.env.CLIENT_URL = 'http://localhost:3000';

    const mongoModule = await MongoMemoryModule.forRoot();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [mongoModule, ConfigModule.forRoot({ isGlobal: true })],
      providers: [EmailService],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    emailService = moduleFixture.get<EmailService>(EmailService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    await app.close();
    await closeInMemoryMongoConnection();

    ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_SECURE', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'CLIENT_URL'].forEach(
      (key) => delete process.env[key],
    );
  });

  describe('sendWelcomeEmail', () => {
    it('deve enviar um email de boas-vindas com sucesso', async () => {
      const sendMailSpy = jest.spyOn((emailService as any).transporter, 'sendMail');
      sendMailSpy.mockResolvedValue({ messageId: 'mock-id-123' });

      const to = 'test@example.com';
      const name = 'Test User';
      const password = 'Test@123';

      const result = await emailService.sendWelcomeEmail(to, name, password);

      expect(result).toBe(true);
      expect(sendMailSpy).toHaveBeenCalled();

      const mailOptions = sendMailSpy.mock.calls[0][0] as nodemailer.SendMailOptions;
      expect(mailOptions.to).toBe(to);
      expect(mailOptions.subject).toBe('Bem-vindo ao Meu Pet Club - Suas Credenciais de Acesso');
      expect(mailOptions.from).toBe(`"Meu Pet Club" <${configService.get('EMAIL_FROM')}>`);
      expect(mailOptions.html).toContain(name);
      expect(mailOptions.html).toContain(to);
      expect(mailOptions.html).toContain(password);
    });
  });
});
