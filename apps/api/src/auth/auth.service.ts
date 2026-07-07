import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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
}
