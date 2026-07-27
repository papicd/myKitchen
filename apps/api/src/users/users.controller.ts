import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UpdateOwnProfileInput, UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  findAll(
    @Headers('authorization') authorization?: string,
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.getAdminUser(authorization);
    return this.usersService.findAllPublic({
      query,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOnePublic(@Param('id') id: string) {
    return this.usersService.findPublicById(id);
  }

  @Patch('me')
  async updateMe(
    @Body() body: UpdateOwnProfileInput,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    const user = await this.usersService.updateOwnProfile(userId, body);
    return this.createAuthResponse(user);
  }

  @Patch(':id/recommendation')
  updateRecommendation(
    @Param('id') id: string,
    @Body() body: { isRecommended?: boolean },
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getAdminUser(authorization);
    return this.usersService.setRecommendationStatus(id, userId, Boolean(body.isRecommended));
  }

  @Patch(':id/admin')
  updateAdmin(
    @Param('id') id: string,
    @Body() body: { isAdmin?: boolean },
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getAdminUser(authorization);
    return this.usersService.setAdminStatus(id, userId, Boolean(body.isAdmin));
  }

  private getAdminUser(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Morate biti prijavljeni');
    }

    try {
      const payload = this.jwtService.verify(token);

      if (!payload.isAdmin) {
        throw new UnauthorizedException('Samo admin ima pristup ovoj akciji');
      }

      return {
        userId: String(payload.sub),
        isAdmin: Boolean(payload.isAdmin),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        error instanceof Error && error.name === 'TokenExpiredError'
          ? 'Token je istekao'
          : 'Neispravan token',
      );
    }
  }

  private getUser(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Morate biti prijavljeni');
    }

    try {
      const payload = this.jwtService.verify(token);
      return { userId: String(payload.sub), isAdmin: Boolean(payload.isAdmin) };
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
