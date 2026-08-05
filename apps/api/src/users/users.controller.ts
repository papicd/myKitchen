import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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

  @Get('me/following')
  findFollowing(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.usersService.getFollowingUsers(userId);
  }

  @Get('me/feed')
  findFeed(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.usersService.getActivityFeed(userId);
  }

  @Get('me/collections')
  findCollections(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.usersService.getRecipeCollections(userId);
  }

  @Post('me/collections')
  createCollection(
    @Body() body: { name?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.usersService.createRecipeCollection(userId, body.name);
  }

  @Patch('me/collections/:collectionId')
  renameCollection(
    @Param('collectionId') collectionId: string,
    @Body() body: { name?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.usersService.renameRecipeCollection(userId, collectionId, body.name);
  }

  @Delete('me/collections/:collectionId')
  @HttpCode(HttpStatus.OK)
  deleteCollection(
    @Param('collectionId') collectionId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.usersService.deleteRecipeCollection(userId, collectionId);
  }

  @Post('me/collections/:collectionId/recipes')
  addRecipeToCollection(
    @Param('collectionId') collectionId: string,
    @Body() body: { recipeId?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.usersService.addRecipeToCollection(userId, collectionId, String(body.recipeId ?? ''));
  }

  @Delete('me/collections/:collectionId/recipes/:recipeId')
  @HttpCode(HttpStatus.OK)
  removeRecipeFromCollection(
    @Param('collectionId') collectionId: string,
    @Param('recipeId') recipeId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.usersService.removeRecipeFromCollection(userId, collectionId, recipeId);
  }

  @Get('me/notifications')
  findNotifications(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.usersService.getNotifications(userId);
  }

  @Patch('me/notifications/read-all')
  readAllNotifications(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.usersService.markAllNotificationsAsRead(userId);
  }

  @Patch('me/notifications/:notificationId/read')
  readNotification(
    @Param('notificationId') notificationId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.usersService.markNotificationAsRead(userId, notificationId);
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

  @Post(':id/follow')
  toggleFollow(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.usersService.toggleFollow(userId, id);
  }

  @Get(':id')
  findOnePublic(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = this.tryGetUser(authorization);
    return this.usersService.findPublicProfile(id, user?.userId);
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

  private tryGetUser(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    try {
      return this.getUser(authorization);
    } catch {
      return null;
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
    avatarUrl?: string | null;
  }) {
    const token = this.jwtService.sign({
      sub: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isRecommended: user.isRecommended,
      avatarUrl: user.avatarUrl ?? null,
    });

    return { token, user };
  }
}
