import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service';

export type RegisterInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterInput) {
    const user = await this.usersService.create(input);
    return this.createAuthResponse(user);
  }

  async login(input: LoginInput) {
    const user = await this.usersService.findByEmail(input.email);
    const passwordMatches =
      user && (await bcrypt.compare(input.password, user.password));

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthResponse(this.usersService.toPublicUser(user));
  }

  async verifyToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      return {
        user: {
          id: payload.sub,
          firstName: payload.firstName,
          lastName: payload.lastName,
          username: payload.username,
          email: payload.email,
          isAdmin: payload.isAdmin,
          isRecommended: payload.isRecommended,
        },
      };
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error && error.name === 'TokenExpiredError'
          ? 'Token je istekao'
          : 'Neispravan token',
      );
    }
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const email = input.email?.toLowerCase().trim() ?? '';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new BadRequestException('Email nije ispravan');
    }

    const user = await this.usersService.findByEmail(email);

    // Always return the same response to avoid leaking account existence.
    if (!user) {
      return { success: true };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(resetToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const resetUrl = this.buildResetPasswordUrl(resetToken);

    await this.usersService.setPasswordResetToken(String(user._id), tokenHash, expiresAt);
    await this.sendResetPasswordEmail(email, resetUrl);

    const allowDevLinkResponse =
      this.isDevMode() &&
      (this.configService.get<string>('ENABLE_DEV_PASSWORD_RESET_LINK') ?? 'true') !==
        'false';

    if (allowDevLinkResponse) {
      return { success: true, devResetLink: resetUrl };
    }

    return { success: true };
  }

  async resetPassword(input: ResetPasswordInput) {
    const token = input.token?.trim() ?? '';
    const newPassword = input.newPassword ?? '';

    if (!token) {
      throw new BadRequestException('Reset token je obavezan');
    }

    if (newPassword.length < 2) {
      throw new BadRequestException(
        'Nova lozinka mora imati najmanje 2 karaktera',
      );
    }

    const tokenHash = this.hashResetToken(token);
    await this.usersService.resetPasswordWithToken(tokenHash, newPassword);
    return { success: true };
  }

  private createAuthResponse(user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    isAdmin: boolean;
    isRecommended: boolean;
  }) {
    const token = this.jwtService.sign({
      sub: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isRecommended: user.isRecommended,
    });

    return { token, user };
  }

  private hashResetToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private buildResetPasswordUrl(token: string) {
    const baseUrl =
      this.configService.get<string>('PASSWORD_RESET_URL')?.trim() ||
      'http://localhost:3000/reset-password';
    const delimiter = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${delimiter}token=${encodeURIComponent(token)}`;
  }

  private async sendResetPasswordEmail(email: string, resetUrl: string) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? '587');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const isDev = this.isDevMode();

    if (!host || !user || !pass || !Number.isFinite(port)) {
      if (isDev) {
        this.logger.warn(
          `SMTP nije konfigurisan. Reset link za ${email}: ${resetUrl}`,
        );
      } else {
        this.logger.error(
          'SMTP nije konfigurisan. Zaboravljena lozinka ne moze slati email u produkciji.',
        );
      }
      return;
    }

    const from =
      this.configService.get<string>('CONTACT_FROM_EMAIL')?.trim() ??
      user ??
      'no-reply@localhost';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure:
        this.configService.get<string>('SMTP_SECURE') === 'true' || port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Reset lozinke - Šta pojesti',
      text: `Primili smo zahtev za reset lozinke. Otvorite sledeci link:\n\n${resetUrl}\n\nAko niste trazili reset lozinke, ignorisite ovu poruku.`,
      html: `<p>Primili smo zahtev za reset lozinke.</p><p><a href="${resetUrl}">Kliknite ovde da postavite novu lozinku</a></p><p>Ako niste trazili reset lozinke, slobodno ignorisite ovu poruku.</p>`,
    });
  }

  private isDevMode() {
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }
}
