import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../../service/email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('nodemailer');
jest.mock('fs');

describe('EmailService', () => {
  let emailService: EmailService;
  let configService: ConfigService;
  let sendMailMock: jest.Mock;
  let verifyMock: jest.Mock;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const fakeConfig = {
    get: jest.fn((key: string) => {
      const configMap = {
        EMAIL_HOST: 'smtp.example.com',
        EMAIL_PORT: 587,
        EMAIL_SECURE: 'false',
        EMAIL_USER: 'user@example.com',
        EMAIL_PASS: 'password',
        EMAIL_FROM: 'noreply@example.com',
        CLIENT_URL: 'http://localhost:3000',
      };
      return configMap[key];
    }),
  };

  const fakeTemplate = 'Hello {{name}}, your password is {{password}}. Login at {{loginUrl}}. Year: {{year}}';

  beforeEach(async () => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: '123' });
    verifyMock = jest.fn().mockResolvedValue(true);

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
      verify: verifyMock,
    });

    (fs.readFileSync as jest.Mock).mockImplementation((templatePath: string, encoding: string) => {
      return fakeTemplate;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: fakeConfig }],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);

    loggerLogSpy = jest.spyOn(emailService['logger'], 'log').mockImplementation(() => {});
    loggerErrorSpy = jest.spyOn(emailService['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('verifyConnection', () => {
    it('deve logar quando a conexão for bem-sucedida', async () => {
      await emailService['verifyConnection']();
      expect(verifyMock).toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith('Email service ready');
    });

    it('deve logar erro quando a conexão falhar', async () => {
      verifyMock.mockRejectedValueOnce(new Error('connection error'));
      await emailService['verifyConnection']();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to connect to email server', expect.any(Error));
    });
  });

  describe('sendWelcomeEmail', () => {
    it('deve enviar o email de boas-vindas e retornar true', async () => {
      const to = 'test@example.com';
      const name = 'Test User';
      const password = 'secret';

      const result = await emailService.sendWelcomeEmail(to, name, password);

      const expectedTemplatePath = path.resolve(__dirname, '../../templates/welcome.hbs');
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedTemplatePath, 'utf-8');

      expect(sendMailMock).toHaveBeenCalledWith({
        from: `"Meu Pet Club" <${configService.get('EMAIL_FROM')}>`,
        to,
        subject: 'Bem-vindo ao Meu Pet Club - Suas Credenciais de Acesso',
        html: expect.stringContaining(name),
      });
      expect(loggerLogSpy).toHaveBeenCalledWith(`Email sent to ${to}: 123`);
      expect(result).toBe(true);
    });

    it('deve retornar false e logar erro se o envio do email falhar', async () => {
      sendMailMock.mockRejectedValueOnce(new Error('send error'));
      const to = 'fail@example.com';
      const name = 'Fail User';
      const password = 'fail';

      const result = await emailService.sendWelcomeEmail(to, name, password);

      expect(loggerErrorSpy).toHaveBeenCalledWith(`Failed to send email to ${to}`, expect.any(Error));
      expect(result).toBe(false);
    });
  });
});
