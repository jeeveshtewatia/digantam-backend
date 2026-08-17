import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as ejs from 'ejs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private sesClient: SESClient;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    this.sesClient = new SESClient({
      region: this.configService.get<string>('AWS_REGION_SES'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.fromEmail = this.configService.get<string>('AWS_SES_FROM_EMAIL');
  }

  async sendEmail(to: string, subject: string, templateName: string, context: any) {
    let html = '';
    try {
      const templatePath = path.join(__dirname, 'templates', `${templateName}.ejs`);
      html = await ejs.renderFile(templatePath, context);

      const command = new SendEmailCommand({
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: html,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: subject,
          },
        },
        Source: this.fromEmail,
      });

      await this.sesClient.send(command);
      this.logger.log(`Email successfully sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);

      if (error.name === 'MessageRejected' && error.message.includes('not verified')) {
        this.logger.warn(`
[SES SANDBOX MODE DETECTED]
To send emails to ${to}, you must:
1. Verify the 'To' address (${to}) in your AWS SES console.
2. Verify the 'From' address (${this.fromEmail}) in your AWS SES console.
3. Or request a production access limit increase to move out of Sandbox mode.
        `);
      }

      // Fallback: Log email content to console for development convenience
      this.logger.log(`
------- DEV FALLBACK: EMAIL CONTENT FOR ${to} -------
Subject: ${subject}
Content snippet: ${html.substring(0, 500)}...
------------------------------------------------------
      `);
    }
  }
}
