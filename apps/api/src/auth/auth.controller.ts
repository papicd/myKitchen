import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, LoginInput, RegisterInput } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() input: RegisterInput) {
    return this.authService.register(input);
  }

  @Post('login')
  login(@Body() input: LoginInput) {
    return this.authService.login(input);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    return this.authService.verifyToken(token);
  }
}
