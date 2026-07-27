import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RecipesService } from './recipes.service';

const authorId = new Types.ObjectId();
const commenterId = new Types.ObjectId();

function createRecipe(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    title: 'Test recept',
    shortDescription: 'Kratak opis',
    description: 'Detaljan opis',
    ingredients: ['brasno'],
    steps: ['Pomesaj'],
    preparationTime: '30 minuta',
    servings: '2 porcije',
    ratings: [],
    comments: [],
    postedByRecommendedUser: false,
    createdBy: authorId,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('RecipesService comments', () => {
  let recipeModel: { findById: jest.Mock };
  let recipeTypeModel: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; updateOne: jest.Mock };
  let usersService: {
    findById: jest.Mock;
    findPublicByIds: jest.Mock;
  };
  let service: RecipesService;

  beforeEach(() => {
    recipeModel = {
      findById: jest.fn(),
    };
    recipeTypeModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
    };
    usersService = {
      findById: jest.fn(),
      findPublicByIds: jest.fn((ids: string[]) =>
        Promise.resolve(
          ids.map((id) => ({
            id,
            firstName: id === String(authorId) ? 'Autor' : 'Komentator',
            lastName: 'Test',
            username: id === String(authorId) ? 'autor' : 'komentator',
            email: '',
            isAdmin: false,
            isRecommended: false,
          })),
        ),
      ),
    };
    service = new RecipesService(
      recipeModel as never,
      recipeTypeModel as never,
      usersService as never,
    );
  });

  it('adds a trimmed comment and marks recipe-owner comments', async () => {
    const recipe = createRecipe({ createdBy: commenterId });
    recipeModel.findById.mockResolvedValueOnce(recipe);
    recipeModel.findById.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(recipe),
    });
    usersService.findById.mockResolvedValue({ _id: commenterId });

    const details = await service.addComment(String(recipe._id), String(commenterId), {
      text: '  Odlican recept!  ',
    });

    expect(recipe.save).toHaveBeenCalledTimes(1);
    expect(recipe.comments).toHaveLength(1);
    expect(recipe.comments[0]).toMatchObject({
      userId: commenterId,
      text: 'Odlican recept!',
    });
    expect(details.comments[0]).toMatchObject({
      text: 'Odlican recept!',
      isRecipeOwner: true,
      author: expect.objectContaining({ id: String(commenterId) }),
    });
  });

  it('rejects empty comments', async () => {
    await expect(
      service.addComment(String(new Types.ObjectId()), String(commenterId), { text: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(recipeModel.findById).not.toHaveBeenCalled();
  });
});

