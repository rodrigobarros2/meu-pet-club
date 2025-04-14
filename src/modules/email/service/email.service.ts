import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<string>('EMAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });

    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('Email service ready');
    } catch (error) {
      this.logger.error('Failed to connect to email server', error);
    }
  }

  async sendWelcomeEmail(to: string, name: string, password: string): Promise<boolean> {
    try {
      const templatePath = path.resolve('src/modules/email/templates/welcome.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(templateSource);

      const context = {
        name,
        email: to,
        password,
        loginUrl: this.configService.get<string>('CLIENT_URL') + '/login',
        year: new Date().getFullYear(),
      };

      const html = template(context);

      const result = await this.transporter.sendMail({
        from: `"Meu Pet Club" <${this.configService.get<string>('EMAIL_FROM')}>`,
        to,
        subject: 'Bem-vindo ao Meu Pet Club - Suas Credenciais de Acesso',
        html,
      });

      this.logger.log(`Email sent to ${to}: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      return false;
    }
  }
}
