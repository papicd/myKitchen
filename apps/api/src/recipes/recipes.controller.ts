import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  BrowseRecipesInput,
  CreateRecipeTypeInput,
  CreateCommentInput,
  CreateRecipeInput,
  RecipesService,
} from './recipes.service';

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  findAll() {
    return this.recipesService.findAll();
  }

  @Get('browse')
  browse(
    @Query('query') query?: string,
    @Query('groceries') groceries?: string,
    @Query('minRating') minRating?: string,
    @Query('maxPreparationMinutes') maxPreparationMinutes?: string,
    @Query('recommendedOnly') recommendedOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: BrowseRecipesInput['sort'],
  ) {
    return this.recipesService.browse({
      query,
      groceries,
      minRating: minRating ? Number.parseFloat(minRating) : undefined,
      maxPreparationMinutes: maxPreparationMinutes
        ? Number.parseInt(maxPreparationMinutes, 10)
        : undefined,
      recommendedOnly: recommendedOnly === 'true',
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      sort,
    });
  }

  @Get('search')
  search(@Query('q') query = '', @Headers('authorization') authorization?: string) {
    this.getUser(authorization);
    return this.recipesService.searchByGroceries(query);
  }

  @Get('types')
  findAllTypes() {
    return this.recipesService.findAllTypes();
  }

  @Post('types')
  createType(
    @Body() input: CreateRecipeTypeInput,
    @Headers('authorization') authorization?: string,
  ) {
    const { isAdmin } = this.getUser(authorization);

    if (!isAdmin) {
      throw new ForbiddenException('Samo admin moze da doda novi tip recepta');
    }

    return this.recipesService.createType(input);
  }

  @Get('mine')
  findMine(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.findByUser(userId);
  }

  @Get('saved')
  findSaved(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.findSavedByUser(userId);
  }

  @Get('rated')
  findRated(@Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.findRatedByUser(userId);
  }

  @Get('by-user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.recipesService.findByUser(userId);
  }

  @Post()
  create(
    @Body() input: CreateRecipeInput,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.create(input, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() input: CreateRecipeInput,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId, isAdmin } = this.getUser(authorization);
    return this.recipesService.update(id, input, userId, isAdmin);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.findOne(id, userId);
  }

  @Post(':id/rating')
  rate(
    @Param('id') id: string,
    @Body() body: { value?: number },
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.rateRecipe(id, userId, Number(body.value));
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() body: CreateCommentInput,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.addComment(id, userId, body);
  }

  @Post(':id/save')
  saveRecipe(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    const { userId } = this.getUser(authorization);
    return this.recipesService.toggleSavedRecipe(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const { userId, isAdmin } = this.getUser(authorization);
    return this.recipesService.delete(id, userId, isAdmin);
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
}
