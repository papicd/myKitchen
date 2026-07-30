import { Types } from 'mongoose';
import { RecipesService } from './recipes.service';

function createRecipe(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    title: 'Test recipe',
    shortDescription: 'Short description',
    ingredients: ['test ingredient'],
    steps: ['step one'],
    preparationTime: '30 minutes',
    servings: '2',
    typeIds: [],
    createdBy: new Types.ObjectId(),
    ratings: [],
    comments: [],
    media: [],
    links: [],
    postedByRecommendedUser: false,
    ...overrides,
  };
}

function createQueryChain<T>(result: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(result),
  };
}

describe('RecipesService search normalization', () => {
  let recipeModel: {
    find: jest.Mock;
    countDocuments: jest.Mock;
    findOne: jest.Mock;
    updateOne: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
  };
  let recipeTypeModel: Record<string, jest.Mock>;
  let usersService: { findPublicByIds: jest.Mock; findById: jest.Mock };
  let service: RecipesService;

  beforeEach(() => {
    recipeModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };
    recipeTypeModel = {};
    usersService = {
      findPublicByIds: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
    };
    service = new RecipesService(recipeModel as never, recipeTypeModel as never, usersService as never);
  });

  it('matches browse queries without distinguishing c, č, or ć', async () => {
    const authorId = new Types.ObjectId();
    const recipe = createRecipe({
      title: 'Čorba od povrća',
      createdBy: authorId,
    });

    recipeModel.countDocuments.mockResolvedValue(1);
    recipeModel.find.mockReturnValue(createQueryChain([recipe]));
    usersService.findPublicByIds.mockResolvedValue([
      {
        id: String(authorId),
        firstName: 'Ana',
        lastName: 'Anić',
        username: 'ana',
        email: 'ana@example.com',
        isAdmin: false,
        isRecommended: false,
      },
    ]);

    const result = await service.browse({ query: 'corba' });

    expect(recipeModel.find).toHaveBeenCalledWith({
      $and: [{ title: /[cčć]orba/i }],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ title: 'Čorba od povrća' });
  });

  it('scores grocery searches without distinguishing dj and đ', async () => {
    const matchAuthorId = new Types.ObjectId();
    const missAuthorId = new Types.ObjectId();
    const matchingRecipe = createRecipe({
      title: 'Đuveč sa mesom',
      ingredients: ['Luk', 'Đuveč zacin'],
      createdBy: matchAuthorId,
    });
    const missingRecipe = createRecipe({
      title: 'Pita od sira',
      ingredients: ['Sir', 'jaja'],
      createdBy: missAuthorId,
    });

    recipeModel.find.mockReturnValue(createQueryChain([matchingRecipe, missingRecipe]));
    usersService.findPublicByIds.mockResolvedValue([
      {
        id: String(matchAuthorId),
        firstName: 'Mika',
        lastName: 'Mikic',
        username: 'mika',
        email: 'mika@example.com',
        isAdmin: false,
        isRecommended: false,
      },
      {
        id: String(missAuthorId),
        firstName: 'Lena',
        lastName: 'Lenic',
        username: 'lena',
        email: 'lena@example.com',
        isAdmin: false,
        isRecommended: false,
      },
    ]);

    const result = await service.searchByGroceries('dj');

    expect(recipeModel.find).toHaveBeenCalledWith({
      $or: [
        { ingredients: /(?:dj|đ)/i },
        { title: /(?:dj|đ)/i },
        { description: /(?:dj|đ)/i },
      ],
    });
    expect(result[0]).toMatchObject({ title: 'Đuveč sa mesom', matchedGroceries: 1 });
    expect(result[1]).toMatchObject({ title: 'Pita od sira', matchedGroceries: 0 });
  });
});
