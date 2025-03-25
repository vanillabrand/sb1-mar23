import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import emailjs from '@emailjs/browser';

class EmailService extends EventEmitter {
  private static instance: EmailService;
  private readonly EMAILJS_SERVICE_ID = 'service_gigantic';
  private readonly EMAILJS_TEMPLATE_ID = 'template_gigantic';
  private readonly EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  private constructor() {
    super();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    try {
      if (!this.EMAILJS_PUBLIC_KEY) {
        logService.log('warn', 'EmailJS public key not configured', null, 'EmailService');
        return;
      }

      await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        {
          to_email: email,
          to_name: firstName,
          subject: 'Welcome to GIGAntic - Your AI Trading Journey Begins!',
          message: `Hi ${firstName},\n\nWelcome to GIGAntic! We're excited to have you on board. Get ready to revolutionize your trading with AI-powered strategies.\n\nBest regards,\nThe GIGAntic Team`
        },
        this.EMAILJS_PUBLIC_KEY
      );

      logService.log('info', `Welcome email sent to ${email}`, null, 'EmailService');
    } catch (error) {
      logService.log('error', `Failed to send welcome email to ${email}`, error, 'EmailService');
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      if (!this.EMAILJS_PUBLIC_KEY) {
        logService.log('warn', 'EmailJS public key not configured', null, 'EmailService');
        return;
      }

      await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        {
          to_email: email,
          subject: 'GIGAntic Password Reset',
          message: 'Click the link below to reset your password:'
        },
        this.EMAILJS_PUBLIC_KEY
      );

      logService.log('info', `Password reset email sent to ${email}`, null, 'EmailService');
    } catch (error) {
      logService.log('error', `Failed to send password reset email to ${email}`, error, 'EmailService');
    }
  }
}

export const emailService = EmailService.getInstance();