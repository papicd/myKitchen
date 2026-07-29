import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { RecipeType } from './schemas/recipe-type.schema';
import { Recipe } from './schemas/recipe.schema';

export type CreateRecipeInput = {
  title: string;
  shortDescription: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  preparationTime?: string;
  servings?: string;
  typeIds?: string[];
  media?: Array<{ type: 'image' | 'video' | 'pdf'; url: string }>;
  links?: Array<{ label: string; url: string }>;
};

export type CreateRecipeTypeInput = {
  name?: string;
  color?: string;
};

export type CreateCommentInput = {
  text?: string;
};

export type BrowseRecipesInput = {
  query?: string;
  groceries?: string;
  typeIds?: string[];
  minRating?: number;
  maxPreparationMinutes?: number;
  recommendedOnly?: boolean;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'rating' | 'quickest';
};

export type RecipeTypeOutput = {
  id: string;
  name: string;
  color: string;
};

@Injectable()
export class RecipesService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Recipe.name) private readonly recipeModel: Model<Recipe>,
    @InjectModel(RecipeType.name) private readonly recipeTypeModel: Model<RecipeType>,
    private readonly usersService: UsersService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRecipeTypes();
    await this.seedRecipes();
    await this.ensureRecipesHaveDefaultType();
    await this.enrichRecipesWithMedia();
    await this.syncRecommendedAuthorFlags();
  }

  async findAll() {
    const recipes = await this.recipeModel
      .find()
      .sort({ createdAt: -1 })
      .populate({ path: 'typeIds', select: 'name color' });
    return this.attachAuthors(recipes.map((recipe) => this.toListItem(recipe)));
  }

  async browse(input: BrowseRecipesInput = {}) {
    const normalizedQuery = (input.query ?? '').trim();
    const groceryTerms = this.parseTerms(input.groceries ?? '');
    const typeObjectIds = this.normalizeTypeIds(input.typeIds ?? []);
    const page = this.normalizePage(input.page);
    const limit = this.normalizeLimit(input.limit);
    const minRating = this.normalizeMinRating(input.minRating);
    const maxPreparationMinutes = this.normalizeMaxPreparationMinutes(input.maxPreparationMinutes);
    const sort = input.sort ?? 'newest';

    const filter: {
      postedByRecommendedUser?: boolean;
      $and?: Array<Record<string, unknown>>;
      $expr?: Record<string, unknown>;
    } = {};

    const andClauses: Array<Record<string, unknown>> = [];

    if (normalizedQuery) {
      andClauses.push({ title: new RegExp(this.escapeRegExp(normalizedQuery), 'i') });
    }

    if (groceryTerms.length > 0) {
      andClauses.push(
        ...groceryTerms.map((term) => {
          const pattern = new RegExp(this.escapeRegExp(term), 'i');
          return {
            $or: [{ ingredients: pattern }, { title: pattern }, { description: pattern }],
          };
        }),
      );
    }

    if (input.recommendedOnly === true) {
      filter.postedByRecommendedUser = true;
    }

    if (typeObjectIds.length > 0) {
      andClauses.push({ typeIds: { $in: typeObjectIds } });
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    if (typeof minRating === 'number') {
      filter.$expr = {
        $gte: [{ $ifNull: [{ $avg: '$ratings.value' }, 0] }, minRating],
      };
    }

    const hasQuery = Boolean(normalizedQuery);
    const hasGroceries = groceryTerms.length > 0;
    const hasTypeFilter = typeObjectIds.length > 0;
    const hasMinRating = typeof minRating === 'number';
    const hasMaxPreparation = typeof maxPreparationMinutes === 'number';
    const hasRecommendedOnly = input.recommendedOnly === true;

    // Fastest path: no filters and newest order.
    if (!hasQuery && !hasGroceries && !hasTypeFilter && !hasMinRating && !hasMaxPreparation && !hasRecommendedOnly && sort === 'newest') {
      const total = await this.recipeModel.countDocuments({});
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;

      const recipes = await this.recipeModel
        .find({})
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate({ path: 'typeIds', select: 'name color' });

      const items = await this.attachAuthors(recipes.map((recipe) => this.toListItem(recipe)));

      return {
        items,
        total,
        page: safePage,
        limit,
        totalPages,
        hasMore: safePage < totalPages,
      };
    }

    // Fast path: Mongo can handle newest-sorted paging when advanced in-memory scoring is not needed.
    if (sort === 'newest' && !hasGroceries && !hasMaxPreparation) {
      const total = await this.recipeModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;

      const recipes = await this.recipeModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate({ path: 'typeIds', select: 'name color' });

      const items = await this.attachAuthors(recipes.map((recipe) => this.toListItem(recipe)));

      return {
        items,
        total,
        page: safePage,
        limit,
        totalPages,
        hasMore: safePage < totalPages,
      };
    }

    const recipes = await this.recipeModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: 'typeIds', select: 'name color' });

    const filteredByPreparation = recipes.filter((recipe) => {
      if (typeof maxPreparationMinutes !== 'number') {
        return true;
      }

      const minutes = this.parsePreparationTimeToMinutes(recipe.preparationTime);
      if (minutes === null) {
        return false;
      }

      return minutes <= maxPreparationMinutes;
    });

    const prepared = filteredByPreparation.map((recipe) => {
      const listItem = this.toListItem(recipe);
      const preparationMinutes = this.parsePreparationTimeToMinutes(recipe.preparationTime);
      const ingredientValues = recipe.ingredients.map((ingredient) => ingredient.toLowerCase());
      const createdAtValue = (recipe as unknown as { createdAt?: Date }).createdAt;
      const matchedGroceries =
        groceryTerms.length === 0
          ? undefined
          : groceryTerms.reduce((total, term) => {
              const normalizedTerm = term.toLowerCase();
              const matched = ingredientValues.some((ingredient) => ingredient.includes(normalizedTerm));
              return total + (matched ? 1 : 0);
            }, 0);

      return {
        ...listItem,
        matchedGroceries,
        createdAtMs: createdAtValue instanceof Date ? createdAtValue.getTime() : 0,
        preparationMinutes,
      };
    });

    prepared.sort((a, b) => {
      if (sort === 'rating') {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.ratingsCount - a.ratingsCount;
      }

      if (sort === 'quickest') {
        const aMinutes = a.preparationMinutes ?? Number.MAX_SAFE_INTEGER;
        const bMinutes = b.preparationMinutes ?? Number.MAX_SAFE_INTEGER;

        if (aMinutes !== bMinutes) {
          return aMinutes - bMinutes;
        }
      }

      if (groceryTerms.length > 0) {
        const aScore = a.matchedGroceries ?? 0;
        const bScore = b.matchedGroceries ?? 0;
        if (bScore !== aScore) {
          return bScore - aScore;
        }
      }

      return b.createdAtMs - a.createdAtMs;
    });

    const total = prepared.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const pageItems = prepared.slice(offset, offset + limit).map(({ createdAtMs, preparationMinutes, ...item }) => item);
    const items = await this.attachAuthors(pageItems);

    return {
      items,
      total,
      page: safePage,
      limit,
      totalPages,
      hasMore: safePage < totalPages,
    };
  }

  async findOne(id: string, currentUserId?: string) {
    const recipe = await this.recipeModel
      .findById(id)
      .populate({ path: 'typeIds', select: 'name color' });

    if (!recipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    return this.toDetailsResponse(recipe, currentUserId);
  }

  async findByUser(userId: string) {
    const recipes = await this.recipeModel
      .find({ createdBy: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .populate({ path: 'typeIds', select: 'name color' });

    return this.attachAuthors(recipes.map((recipe) => this.toListItem(recipe)));
  }

  async findSavedByUser(userId: string) {
    const savedRecipeIds = await this.usersService.getSavedRecipeIds(userId);

    if (savedRecipeIds.length === 0) {
      return [];
    }

    const recipes = await this.recipeModel
      .find({ _id: { $in: savedRecipeIds.map((id) => new Types.ObjectId(id)) } })
      .sort({ createdAt: -1 })
      .populate({ path: 'typeIds', select: 'name color' });

    return this.attachAuthors(recipes.map((recipe) => this.toListItem(recipe, userId)));
  }

  async findRatedByUser(userId: string) {
    const recipes = await this.recipeModel
      .find({ 'ratings.userId': new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .populate({ path: 'typeIds', select: 'name color' });

    return this.attachAuthors(recipes.map((recipe) => this.toListItem(recipe, userId)));
  }

  async findAllTypes() {
    const types = await this.recipeTypeModel.find().sort({ name: 1 });
    return types.map((type) => this.toRecipeType(type));
  }

  async createType(input: CreateRecipeTypeInput) {
    const name = (input.name ?? '').trim();
    const color = this.normalizeColor(input.color ?? '');

    if (!name) {
      throw new BadRequestException('Naziv tipa recepta je obavezan');
    }

    const existing = await this.recipeTypeModel.findOne({
      name: { $regex: `^${this.escapeRegExp(name)}$`, $options: 'i' },
    });

    if (existing) {
      throw new BadRequestException('Tip recepta sa ovim nazivom vec postoji');
    }

    const created = await this.recipeTypeModel.create({ name, color });
    return this.toRecipeType(created);
  }

  async create(input: CreateRecipeInput, userId: string) {
    const author = await this.usersService.findById(userId);
    const title = this.normalizeRequiredText(input.title, 'Naziv recepta je obavezan');
    const shortDescription = this.normalizeRequiredText(
      input.shortDescription,
      'Kratak opis je obavezan',
    );
    const ingredients = this.cleanRequiredList(input.ingredients, 'Recept mora imati bar jedan sastojak');
    const steps = this.cleanRequiredList(input.steps, 'Recept mora imati bar jedan korak pripreme');
    const typeIds = await this.validateAndMapTypeIds(input.typeIds ?? []);
    const recipe = await this.recipeModel.create({
      ...input,
      title,
      shortDescription,
      description: this.normalizeOptionalText(input.description),
      ingredients,
      steps,
      preparationTime: this.normalizeOptionalText(input.preparationTime),
      servings: this.normalizeOptionalText(input.servings),
      typeIds,
      postedByRecommendedUser: Boolean(author?.isRecommended),
      createdBy: new Types.ObjectId(userId),
    });

    return this.toDetailsResponse(recipe, userId);
  }

  async delete(id: string, userId: string, isAdmin: boolean) {
    const recipe = await this.recipeModel.findById(id);

    if (!recipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    if (!isAdmin && String(recipe.createdBy) !== userId) {
      throw new ForbiddenException('Nemate dozvolu za brisanje ovog recepta');
    }

    await this.recipeModel.findByIdAndDelete(id);
    return { success: true };
  }

  async update(
    id: string,
    input: CreateRecipeInput,
    userId: string,
    isAdmin: boolean,
  ) {
    const recipe = await this.recipeModel.findById(id);

    if (!recipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    if (!isAdmin && String(recipe.createdBy) !== userId) {
      throw new ForbiddenException('Nemate dozvolu za izmenu ovog recepta');
    }

    const typeIds = await this.validateAndMapTypeIds(input.typeIds ?? []);
    const title = this.normalizeRequiredText(input.title, 'Naziv recepta je obavezan');
    const shortDescription = this.normalizeRequiredText(
      input.shortDescription,
      'Kratak opis je obavezan',
    );
    const ingredients = this.cleanRequiredList(input.ingredients, 'Recept mora imati bar jedan sastojak');
    const steps = this.cleanRequiredList(input.steps, 'Recept mora imati bar jedan korak pripreme');

    const updated = await this.recipeModel.findByIdAndUpdate(
      id,
      {
        title,
        shortDescription,
        description: this.normalizeOptionalText(input.description),
        ingredients,
        steps,
        typeIds,
        preparationTime: this.normalizeOptionalText(input.preparationTime),
        servings: this.normalizeOptionalText(input.servings),
        ...(input.media ? { media: input.media } : {}),
        ...(input.links ? { links: input.links } : {}),
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Recept nije moguce izvrsiti');
    }

    return this.toDetailsResponse(updated, userId);
  }

  async rateRecipe(id: string, userId: string, value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new BadRequestException('Ocena mora biti broj od 1 do 5');
    }

    const recipe = await this.recipeModel.findById(id);

    if (!recipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    if (String(recipe.createdBy) === userId) {
      throw new ForbiddenException('Ne mozete oceniti sopstveni recept');
    }

    const ratings = recipe.ratings ?? [];
    const existingRating = ratings.find((rating) => String(rating.userId) === userId);

    if (existingRating) {
      existingRating.value = value;
    } else {
      ratings.push({ userId: new Types.ObjectId(userId), value });
    }

    recipe.ratings = ratings;
    await recipe.save();

    return this.toDetailsResponse(recipe, userId);
  }

  async addComment(id: string, userId: string, input: CreateCommentInput) {
    const text = (input.text ?? '').trim();

    if (!text) {
      throw new BadRequestException('Komentar ne moze biti prazan');
    }

    if (text.length > 1000) {
      throw new BadRequestException('Komentar moze imati najvise 1000 karaktera');
    }

    const [recipe, user] = await Promise.all([
      this.recipeModel.findById(id),
      this.usersService.findById(userId),
    ]);

    if (!recipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    recipe.comments = [
      ...(recipe.comments ?? []),
      {
        userId: new Types.ObjectId(userId),
        text,
        createdAt: new Date(),
      },
    ];

    await recipe.save();

    return this.toDetailsResponse(recipe, userId);
  }

  async toggleSavedRecipe(userId: string, recipeId: string) {
    const recipe = await this.recipeModel.findById(recipeId, { _id: 1 });

    if (!recipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    return this.usersService.toggleSavedRecipe(userId, recipeId);
  }

  async searchByGroceries(query: string, typeIds: string[] = []) {
    const terms = query
      .split(/[,\n ]+/)
      .map((term) => term.trim())
      .filter(Boolean);
    const typeObjectIds = this.normalizeTypeIds(typeIds);

    if (terms.length === 0 && typeObjectIds.length === 0) {
      return [];
    }

    const andClauses: Array<Record<string, unknown>> = [];

    if (terms.length > 0) {
      andClauses.push({
        $or: terms.flatMap((term) => {
          const pattern = new RegExp(this.escapeRegExp(term), 'i');
          return [{ ingredients: pattern }, { title: pattern }, { description: pattern }];
        }),
      });
    }

    if (typeObjectIds.length > 0) {
      andClauses.push({ typeIds: { $in: typeObjectIds } });
    }

    const searchFilter = andClauses.length > 1 ? { $and: andClauses } : andClauses[0] ?? {};

    const recipes = await this.recipeModel
      .find(searchFilter)
      .sort({ createdAt: -1 })
      .populate({ path: 'typeIds', select: 'name color' });

    const scoredRecipes = recipes
      .map((recipe) => {
        const ingredients = recipe.ingredients.map((ingredient) =>
          ingredient.toLowerCase(),
        );
        const score = terms.reduce((total, term) => {
          const normalizedTerm = term.toLowerCase();
          const hasMatch = ingredients.some((ingredient) =>
            ingredient.includes(normalizedTerm),
          );
          return total + (hasMatch ? 1 : 0);
        }, 0);

        return { ...this.toListItem(recipe), matchedGroceries: score };
      })
      .sort((a, b) => b.matchedGroceries - a.matchedGroceries);

    return this.attachAuthors(scoredRecipes);
  }

  private async seedRecipes() {
    const admin = await this.usersService.findByEmail('dragan.papic1996@gmail.com');
    const defaultType = await this.recipeTypeModel.findOne({
      name: { $regex: '^glavno jelo$', $options: 'i' },
    });

    if (!admin?._id) {
      return;
    }

    const recipes: Array<Omit<CreateRecipeInput, 'media' | 'links'> & {
      title: string;
      media?: Array<{ type: 'image' | 'video' | 'pdf'; url: string }>;
      links?: Array<{ label: string; url: string }>;
    }> = [
      {
        title: 'Sarma sa kiselim kupusom i dimljenim mesom',
        shortDescription:
          'Spora sarma sa svinjskim mesom, suvim rebrima i bogatim ukusom zaprske.',
        description:
          'Tradicionalna sarma za porodicni rucak, idealna kada zelis dubok i pun ukus. Recept sadrzi tacne korake, balans masti i mesa, kao i savet kako da sarma bude meka ali da se ne raspada. Najbolji rezultat se dobija kada jelo odstoji bar 20 minuta nakon kuvanja.',
        ingredients: [
          '1 veca glavica kiselog kupusa (oko 1.8 kg)',
          '700 g mesanog mlevenog mesa (svinjetina i junetina)',
          '120 g pirinca',
          '2 glavice crnog luka sitno seckane',
          '2 cena belog luka',
          '1 jaje',
          '1 kasicica mlevene paprike',
          '1/2 kasicice bibera',
          '1 kasicica soli (po ukusu)',
          '2 lovorova lista',
          '250 g dimljenih rebara ili suvog mesa',
          '2 kasike svinjske masti ili ulja',
          '1 puna kasika brasna za zaprsku',
          '1 kasicica aleve paprike za zaprsku',
          '1.5 l tople vode ili blage supe',
        ],
        steps: [
          'Listove kupusa pazljivo odvojiti i zadebljanja na korenu istanjiti nozem da mogu da se savijaju bez pucanja.',
          'Na masti proprziti crni luk 6 do 8 minuta dok ne postane staklast, dodati beli luk i skloniti sa vatre.',
          'U ciniji sjediniti mleveno meso, proprzen luk, opran pirinac, jaje, so, biber i mlevenu papriku.',
          'Na svaki list staviti 1 do 2 kasike fila i uviti cvrsto u sarmu, ivice uvuceci unutra.',
          'Na dno dublje serpe staviti nekoliko listova kupusa, pa redjati sarmu u krugovima, izmedju redova ubaciti suvo meso i lovor.',
          'Naliti toplom vodom tek da prekrije sarmu, poklopiti i kuvati na tihoj vatri oko 2.5 sata.',
          'Za zaprsku zagrejati mast, dodati brasno i kratko proprziti 30 sekundi, zatim skloniti i umesati alevu papriku.',
          'Pred kraj kuvanja dodati zaprsku razmucenu u malo tecnosti iz serpe, lagano promesati i kuvati jos 15 minuta.',
          'Ostaviti sarmu da odmori 20 minuta pre sluzenja, servirati uz domaci hleb i kiselo mleko.',
        ],
        preparationTime: '3 sata i 30 minuta',
        servings: '8 porcija',
        media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d' }],
      },
      {
        title: 'Moussaka od krompira i junetine iz rerne',
        shortDescription:
          'Slojevito jelo sa krompirom, mlevenom junetinom i kremastim prelivom od jaja i pavlake.',
        description:
          'Moussaka je jedan od najtrazenijih porodicnih ruckova jer moze unapred da se pripremi i odlicna je i sutradan. U ovom receptu dobijas detaljan odnos krompira i mesa, tacno vreme pecenja po fazama i trik kako preliv ostaje vazdusast, a ne gumast.',
        ingredients: [
          '1.2 kg krompira',
          '700 g mlevene junetine',
          '2 glavice crnog luka',
          '2 cena belog luka',
          '2 kasike ulja',
          '1 kasicica soli',
          '1/2 kasicice bibera',
          '1 kasicica mlevene paprike',
          '1/2 kasicice suvog origana',
          '4 jaja',
          '300 ml pavlake za kuvanje',
          '150 ml mleka',
          '80 g trapista (opciono)',
        ],
        steps: [
          'Krompir oljustiti, iseci na tanke kolutove debljine oko 3 mm i posoliti blago.',
          'Na ulju proprziti crni luk 5 minuta, dodati beli luk i mlevenu junetinu pa prziti dok meso ne promeni boju.',
          'U meso dodati so, biber, mlevenu papriku i origano, zatim dinstati jos 10 minuta na slaboj vatri.',
          'Vatrostalnu posudu podmazati, rasporediti polovinu krompira, zatim sav fil od mesa i preko toga drugu polovinu krompira.',
          'Pokriti folijom i peci 35 minuta na 200 stepeni.',
          'Umutiti jaja sa pavlakom i mlekom, po zelji dodati rendani trapist.',
          'Izvaditi posudu, ravnomerno preliti preliv preko moussake i vratiti u rernu bez folije jos 25 do 30 minuta.',
          'Pre secenja ostaviti moussaku 15 minuta da se stegne i sacuva slojeve.',
        ],
        preparationTime: '1 sat i 30 minuta',
        servings: '6 porcija',
        media: [{ type: 'video', url: 'https://www.youtube.com/watch?v=ZJy1ajvMU1k' }],
      },
      {
        title: 'Leskovacka pljeskavica sa domacim lepinjama',
        shortDescription:
          'Socna pljeskavica od dve vrste mesa sa lukom, alevom paprikom i blagim dimljenim ukusom.',
        description:
          'Ovaj recept daje pouzdanu pljeskavicu koja ostaje socna i posle pecenja. Ukljuceuje odlezavanje smese, ispravno formiranje i pecenje na tiganju ili rostilju. Uz recept su dodati i predlozi serviranja sa urnebesom i ajvarom.',
        ingredients: [
          '500 g mlevene junetine',
          '300 g mlevene svinjetine',
          '1 veca glavica crnog luka sitno seckana',
          '2 cena belog luka',
          '1 kasicica soli',
          '1/2 kasicice bibera',
          '1 kasicica aleve paprike',
          '1/2 kasicice sode bikarbone',
          '50 ml hladne gazirane vode',
          '1 kasika ulja za ruke i tiganj',
          '4 do 6 lepinja',
          'urnebes, ajvar i luk za serviranje',
        ],
        steps: [
          'U velikoj ciniji sjediniti oba mesa, luk, beli luk, so, biber, alevu papriku i sodu bikarbonu.',
          'Dodavati postepeno gaziranu vodu i mesiti rukom 5 minuta dok smesa ne postane kompaktna i lepljiva.',
          'Pokriti ciniju i ostaviti smesu najmanje 2 sata u frizideru da se ukusi povezu.',
          'Odvojiti porcije od po 180 do 220 g i oblikovati pljeskavice debljine oko 1.5 cm.',
          'Zagrejati tiganj ili rostilj na jacu temperaturu, premazati tankim slojem ulja.',
          'Peci pljeskavice 4 do 5 minuta po strani, bez pritiskanja lopaticom da ne izgube sok.',
          'Lepinje kratko zagrejati, preseci i napuniti pljeskavicom, lukom, urnebesom i ajvarom.',
        ],
        preparationTime: '2 sata i 30 minuta',
        servings: '4 porcije',
      },
      {
        title: 'Riblja corba sa smudjem i povrcem',
        shortDescription:
          'Mirisna corba od recne ribe sa celerom, sargarepom i blagom pikantnoscu.',
        description:
          'Riblja corba je sjajna za sve koji vole lagan, ali aromatizan obrok. U receptu su dati detalji kako da se izbegne mutna corba, kada se dodaje paprika i kako da ukus bude dubok bez preterane ljutine.',
        ingredients: [
          '800 g smudja ili druge recne ribe',
          '1 glavica crnog luka',
          '2 sargarepe',
          '1 manji koren celera',
          '1 crvena paprika',
          '2 kasike ulja',
          '1 kasicica soli',
          '1/2 kasicice bibera',
          '1 kasicica slatke aleve paprike',
          'prstohvat ljute paprike (opciono)',
          '1 lovorov list',
          '1.8 l vode',
          'svez persun za kraj',
        ],
        steps: [
          'Ribu ocistiti, oprati i iseci na krupnije komade, glavu i kosti sacuvati za jacinu ukusa.',
          'Na ulju proprziti seckani luk, sargarepu, celer i papriku oko 7 minuta.',
          'Dodati glave i kosti ribe, naliti vodom i kuvati 25 minuta na srednjoj vatri.',
          'Procediti osnovu corbe kroz gusce sito i vratiti tecnost u cist lonac.',
          'Dodati komade fileta, lovor, so, biber i alevu papriku, kuvati jos 12 minuta bez jakog vrenja.',
          'Po potrebi prilagoditi gustinu sa malo tople vode i proveriti zacine.',
          'Servirati toplo, uz seckani persun i limun sa strane.',
        ],
        preparationTime: '1 sat',
        servings: '5 porcija',
      },
      {
        title: 'Teleca corba sa knedlama od griza',
        shortDescription:
          'Kremasta teleca corba sa povrcem i laganim knedlama koje se ne raspadaju.',
        description:
          'Klasicna teleca corba za nedeljni rucak. Recept detaljno objasnjava kako se pravi osnova, kada se dodaje zaprska i na koji nacin se kuvaju knedle od griza da ostanu mekane i vazdusaste.',
        ingredients: [
          '500 g teleceg mesa od plecke',
          '1 glavica crnog luka',
          '2 sargarepe',
          '1 manji koren persuna',
          '2 kasike ulja',
          '1 kasicica soli',
          '1/2 kasicice bibera',
          '1 kasika brasna',
          '100 ml pavlake za kuvanje',
          '1.6 l vode',
          'Za knedle: 1 jaje, 3 kasike griza, prstohvat soli',
        ],
        steps: [
          'Telece meso iseci na male kocke i kratko zapeci na ulju da dobije boju.',
          'Dodati sitno seckan luk i rendanu sargarepu, pa dinstati 6 minuta.',
          'Naliti vodom, dodati so i biber, pa kuvati poklopljeno 50 minuta na blagoj vatri.',
          'U tiganju proprziti kasiku brasna na malo ulja, razmutiti sa nekoliko kasika corbe i vratiti u lonac.',
          'Umutiti jaje sa grizom i solju, ostaviti smesu 5 minuta da upije.',
          'Kasicicom spustati male knedle u lagano vrelu corbu, kuvati 8 do 10 minuta bez mesanja.',
          'Na kraju umesati pavlaku za kuvanje i skloniti sa vatre pre kljucanja.',
        ],
        preparationTime: '1 sat i 20 minuta',
        servings: '6 porcija',
      },
      {
        title: 'Pecena butkica sa medom i senfom',
        shortDescription:
          'Hrskava butkica sa glazurom od meda i senfa, uz krompir iz iste tepsije.',
        description:
          'Recept je idealan kada zelis impresivno glavno jelo bez komplikacije. Sporo pecenje omeksava meso, a glazura pravi karamelizovanu koricu. U receptu je ukljucen i prilog od krompira koji upija sokove od mesa.',
        ingredients: [
          '2 svinjske butkice (ukupno oko 1.6 kg)',
          '1 kg mladog krompira',
          '3 kasike senfa',
          '2 kasike meda',
          '2 kasike ulja',
          '4 cena belog luka',
          '1 kasicica soli',
          '1/2 kasicice bibera',
          '1 kasicica suvog ruzmarina',
          '250 ml vode ili piva',
        ],
        steps: [
          'Butkice zasici nozem po kozi, utrljati so, biber i polovinu belog luka.',
          'Pomesati senf, med, ulje i ruzmarin, premazati meso i ostaviti 30 minuta.',
          'Krompir prepoloviti, pomesati sa ostatkom belog luka i malo soli, rasporediti po tepsiji.',
          'Butkice staviti preko krompira, naliti vodu ili pivo, pokriti folijom.',
          'Peci 90 minuta na 180 stepeni, zatim skinuti foliju i peci jos 35 minuta na 210 stepeni.',
          'Tokom poslednjih 20 minuta 2 puta premazati meso sokovima iz tepsije.',
          'Ostaviti 10 minuta pre secenja i servirati sa pecenim krompirom.',
        ],
        preparationTime: '2 sata i 30 minuta',
        servings: '6 porcija',
      },
      {
        title: 'Domace lazanje sa bolonjez i besamel sosom',
        shortDescription:
          'Slojevite lazanje sa bogatim mesnim sosom i kremastim besamelom.',
        description:
          'Lazanje su savrsene za vikend ruccak i odlicne su i podgrejane. Ovaj recept vodi kroz svaki sloj, pravilnu gustinu sosova i vreme odmora nakon pecenja, sto je kljuc za lepo secenje bez raspadanja.',
        ingredients: [
          '12 listova kora za lazanje',
          '600 g mlevene junetine',
          '1 glavica crnog luka',
          '2 cena belog luka',
          '400 ml pasiranog paradajza',
          '2 kasike ulja',
          '1 kasicica soli',
          '1/2 kasicice bibera',
          '1 kasicica suvog bosiljka',
          'Za besamel: 60 g putera, 2 kasike brasna, 700 ml mleka, prstohvat muskatnog orascica, so',
          '250 g mocarele ili trapista',
        ],
        steps: [
          'Za bolonjez na ulju proprziti luk i beli luk, dodati meso i prziti dok ne postane mrviasto.',
          'Dodati pasirani paradajz, so, biber i bosiljak, pa kuvati 20 minuta da se sos zgusne.',
          'Za besamel otopiti puter, dodati brasno i mesati 1 minut, zatim postepeno dodavati mleko uz neprekidno mesanje.',
          'Kuvati besamel 5 do 7 minuta dok se ne zgusne, zaciniti solju i muskatnim orascicem.',
          'U podmazanu tepsiju staviti tanak sloj besamela, pa kore, bolonjez, besamel i sir. Ponavljati slojeve.',
          'Zavrsiti besamelom i sirom, pa peci 35 do 40 minuta na 200 stepeni.',
          'Posle pecenja ostaviti lazanje 15 minuta da odmore pre secenja.',
        ],
        preparationTime: '1 sat i 40 minuta',
        servings: '8 porcija',
      },
      {
        title: 'Orasnice sa medom i cimetom',
        shortDescription:
          'Mekani kolacici od mlevenih oraha, savrseni uz kafu ili caj.',
        description:
          'Detaljan desert recept koji je pogodan i za pocetnike. Dobijas proverene mere za testo koje se lako oblikuje, kao i savet kako da orasnice ostanu mekane i posle dva dana. Kombinacija meda i cimeta daje toplu aromu.',
        ingredients: [
          '250 g mlevenih oraha',
          '180 g brasna',
          '120 g putera sobne temperature',
          '100 g secera',
          '1 jaje',
          '1 kasika meda',
          '1 kasicica cimeta',
          '1 prasak za pecivo',
          'prstohvat soli',
          '50 g secera u prahu za valjanje',
        ],
        steps: [
          'Umutiti puter i secer 3 minuta dok smesa ne postane svetla i kremasta.',
          'Dodati jaje i med, pa kratko umutiti da se sjedini.',
          'U posebnoj ciniji pomesati brasno, mlevene orahe, cimet, prasak za pecivo i so.',
          'Suve sastojke dodati u mokre i umesiti mekano testo koje se ne lepi za ruke.',
          'Od testa praviti kuglice velicine oraha i redjati ih na pleh oblozen papirom.',
          'Peci 12 do 14 minuta na 180 stepeni, bez prepecenja.',
          'Jos tople uvaljati u secer u prahu i ostaviti da se potpuno ohlade.',
        ],
        preparationTime: '40 minuta',
        servings: '30 kolacica',
      },
    ];

    for (const recipe of recipes) {
      await this.recipeModel.updateOne(
        { title: recipe.title, createdBy: admin._id },
        {
          $setOnInsert: {
            ...recipe,
            ingredients: this.cleanList(recipe.ingredients),
            steps: this.cleanList(recipe.steps),
            ...(defaultType?._id ? { typeIds: [defaultType._id] } : {}),
            createdBy: admin._id,
          },
        },
        { upsert: true },
      );
    }
  }

  private cleanList(items: string[]) {
    return items.map((item) => item.trim()).filter(Boolean);
  }

  private cleanRequiredList(items: string[] | undefined, message: string) {
    const normalized = this.cleanList(items ?? []);

    if (normalized.length === 0) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private normalizeRequiredText(value: string | undefined, message: string) {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private normalizeOptionalText(value?: string) {
    return value?.trim() ?? '';
  }

  private async validateAndMapTypeIds(typeIds: string[]) {
    const normalizedIds = Array.from(
      new Set(typeIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (normalizedIds.length === 0) {
      throw new BadRequestException('Recept mora imati bar jedan tip');
    }

    if (normalizedIds.some((id) => !Types.ObjectId.isValid(id))) {
      throw new BadRequestException('Prosledjen je neispravan tip recepta');
    }

    const objectIds = normalizedIds.map((id) => new Types.ObjectId(id));
    const existingTypes = await this.recipeTypeModel.find(
      { _id: { $in: objectIds } },
      { _id: 1 },
    );

    if (existingTypes.length !== objectIds.length) {
      throw new BadRequestException('Jedan ili vise tipova recepta ne postoji');
    }

    return objectIds;
  }

  private normalizeColor(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(normalized)) {
      throw new BadRequestException('Boja mora biti HEX kod, na primer #22C55E');
    }
    return normalized;
  }

  private toRecipeType(type: RecipeType & { _id?: unknown }): RecipeTypeOutput {
    return {
      id: String(type._id),
      name: type.name,
      color: type.color,
    };
  }

  private async seedRecipeTypes() {
    const defaults: Array<{ name: string; color: string }> = [
      { name: 'dorucak', color: '#F59E0B' },
      { name: 'glavno jelo', color: '#EF4444' },
      { name: 'predjelo', color: '#8B5CF6' },
      { name: 'pasta', color: '#F97316' },
      { name: 'pizze', color: '#DC2626' },
      { name: 'slatka jela', color: '#EC4899' },
      { name: 'vegetarijanska hrana', color: '#10B981' },
      { name: 'veganska hrana', color: '#14B8A6' },
    ];

    for (const item of defaults) {
      await this.recipeTypeModel.updateOne(
        { name: { $regex: `^${this.escapeRegExp(item.name)}$`, $options: 'i' } },
        { $setOnInsert: item },
        { upsert: true },
      );
    }
  }

  private async ensureRecipesHaveDefaultType() {
    const defaultType = await this.recipeTypeModel.findOne({
      name: { $regex: '^glavno jelo$', $options: 'i' },
    });

    if (!defaultType?._id) {
      return;
    }

    await this.recipeModel.updateMany(
      {
        $or: [{ typeIds: { $exists: false } }, { typeIds: { $size: 0 } }],
      },
      {
        $set: { typeIds: [defaultType._id] },
      },
    );
  }

  private async enrichRecipesWithMedia() {
    const imagePool = [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
      'https://images.unsplash.com/photo-1466637574441-749b8f19452f',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
      'https://images.unsplash.com/photo-1473093295043-cdd812d0e601',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
      'https://images.unsplash.com/photo-1482049016688-2d3e1b311543',
      'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17',
    ];

    const videoPool = [
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
      'https://samplelib.com/lib/preview/mp4/sample-10s.mp4',
      'https://samplelib.com/lib/preview/mp4/sample-15s.mp4',
    ];

    const videoLinkPool = [
      'https://www.youtube.com/watch?v=5MgBikgcWnY',
      'https://www.youtube.com/watch?v=F-o8A4L9r4M',
      'https://www.youtube.com/watch?v=iM_KMYulI_s',
      'https://www.youtube.com/watch?v=R-H1n2q7X7M',
    ];

    const recipes = await this.recipeModel.find().sort({ createdAt: 1 });

    for (let index = 0; index < recipes.length; index += 1) {
      const recipe = recipes[index];
      const media = [...(recipe.media ?? [])];
      const links = [...(recipe.links ?? [])];
      let changed = false;

      const hasImage = media.some((entry) => entry.type === 'image');
      if (!hasImage) {
        media.push({
          type: 'image',
          url: `${imagePool[index % imagePool.length]}?auto=format&fit=crop&w=1200&q=80`,
        });
        changed = true;
      }

      // Add video to a subset of recipes.
      const hasVideo = media.some((entry) => entry.type === 'video');
      if (!hasVideo && index % 3 === 0) {
        media.push({ type: 'video', url: videoPool[index % videoPool.length] });
        changed = true;
      }

      // Add external video link to a subset of recipes.
      if (links.length === 0 && index % 4 === 0) {
        links.push({
          label: 'Video priprema',
          url: videoLinkPool[(index + 1) % videoLinkPool.length],
        });
        changed = true;
      }

      if (changed) {
        await this.recipeModel.updateOne(
          { _id: recipe._id },
          {
            $set: {
              media,
              links,
            },
          },
        );
      }
    }
  }

  private async attachAuthors<
    T extends {
      author: { id: string };
    },
  >(items: T[]) {
    const authors = await this.usersService.findPublicByIds(
      Array.from(new Set(items.map((item) => item.author.id))),
    );
    const authorMap = new Map(authors.map((author) => [author.id, author]));

    return items.map((item) => ({
      ...item,
      author: authorMap.get(item.author.id) ?? { id: item.author.id, firstName: 'Nepoznat', lastName: '', username: 'korisnik', email: '', isAdmin: false, isRecommended: false },
    }));
  }

  private async attachCommentAuthors<
    T extends {
      comments: Array<{ author: { id: string } }>;
    },
  >(item: T) {
    const authors = await this.usersService.findPublicByIds(
      Array.from(new Set(item.comments.map((comment) => comment.author.id))),
    );
    const authorMap = new Map(authors.map((author) => [author.id, author]));

    return {
      ...item,
      comments: item.comments.map((comment) => ({
        ...comment,
        author: authorMap.get(comment.author.id) ?? { id: comment.author.id, firstName: 'Nepoznat', lastName: '', username: 'korisnik', email: '', isAdmin: false, isRecommended: false },
      })),
    };
  }

  private async toDetailsResponse(
    recipe: Recipe & { _id?: unknown; createdBy?: unknown },
    currentUserId?: string,
  ) {
    const populatedRecipe = await this.recipeModel
      .findById(String(recipe._id))
      .populate({ path: 'typeIds', select: 'name color' });

    if (!populatedRecipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    const [details] = await this.attachAuthors([this.toDetails(populatedRecipe, currentUserId)]);
    return this.attachCommentAuthors(details);
  }

  private async syncRecommendedAuthorFlags() {
    const recommendedUserIds = await this.usersService.getRecommendedUserIds();

    await this.recipeModel.updateMany({}, { $set: { postedByRecommendedUser: false } });

    if (recommendedUserIds.length === 0) {
      return;
    }

    await this.recipeModel.updateMany(
      { createdBy: { $in: recommendedUserIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { postedByRecommendedUser: true } },
    );
  }

  private getRatingSummary(
    recipe: Recipe & {
      ratings?: Array<{ userId: Types.ObjectId; value: number }>;
    },
  ) {
    const ratings = recipe.ratings ?? [];
    const ratingsCount = ratings.length;
    const averageRating =
      ratingsCount === 0
        ? 0
        : Number(
            (ratings.reduce((total, rating) => total + rating.value, 0) / ratingsCount).toFixed(1),
          );

    return { averageRating, ratingsCount };
  }

  private toListItem(recipe: Recipe & { _id?: unknown; createdBy?: unknown }, currentUserId?: string) {
    const { averageRating, ratingsCount } = this.getRatingSummary(recipe);
    const currentUserRating = (recipe.ratings ?? []).find(
      (rating) => String(rating.userId) === currentUserId,
    );

    return {
      id: String(recipe._id),
      title: recipe.title,
      shortDescription: recipe.shortDescription,
      ingredients: recipe.ingredients,
      preparationTime: recipe.preparationTime,
      servings: recipe.servings,
      averageRating,
      ratingsCount,
      types: this.extractRecipeTypes(recipe),
      postedByRecommendedUser: Boolean(recipe.postedByRecommendedUser),
      currentUserRating: currentUserRating?.value,
      author: {
        id: String(recipe.createdBy),
      },
    };
  }

  private toDetails(
    recipe: Recipe & { _id?: unknown; createdBy?: unknown },
    currentUserId?: string,
  ) {
    const currentUserRating = (recipe.ratings ?? []).find(
      (rating) => String(rating.userId) === currentUserId,
    );

    return {
      ...this.toListItem(recipe),
      description: recipe.description,
      steps: recipe.steps,
      createdBy: String(recipe.createdBy),
      currentUserRating: currentUserRating?.value ?? null,
      comments: (recipe.comments ?? []).map((comment) => ({
        id: String(comment._id),
        text: comment.text,
        createdAt: (comment.createdAt ?? new Date()).toISOString(),
        isRecipeOwner: String(comment.userId) === String(recipe.createdBy),
        author: {
          id: String(comment.userId),
        },
      })),
      ...(recipe.media && recipe.media.length > 0 ? { media: recipe.media } : {}),
      ...(recipe.links && recipe.links.length > 0 ? { links: recipe.links } : {}),
    };
  }

  private extractRecipeTypes(recipe: Recipe & { typeIds?: unknown }) {
    if (!Array.isArray(recipe.typeIds)) {
      return [];
    }

    return recipe.typeIds
      .map((entry) => {
        if (
          entry &&
          typeof entry === 'object' &&
          '_id' in entry &&
          'name' in entry &&
          'color' in entry
        ) {
          const record = entry as { _id: unknown; name: unknown; color: unknown };
          if (typeof record.name === 'string' && typeof record.color === 'string') {
            return {
              id: String(record._id),
              name: record.name,
              color: record.color,
            };
          }
        }

        return null;
      })
      .filter((entry): entry is RecipeTypeOutput => entry !== null);
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private parseTerms(value: string) {
    return value
      .split(/[\n,]+/)
      .flatMap((group) => group.split(/\s+/))
      .map((term) => term.trim())
      .filter(Boolean);
  }

  private normalizeTypeIds(typeIds: string[]) {
    const uniqueIds = Array.from(new Set(typeIds.map((id) => id.trim()).filter(Boolean)));
    return uniqueIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  }

  private normalizePage(page?: number) {
    if (!Number.isFinite(page)) {
      return 1;
    }

    return Math.max(1, Math.floor(page ?? 1));
  }

  private normalizeLimit(limit?: number) {
    if (!Number.isFinite(limit)) {
      return 12;
    }

    return Math.min(24, Math.max(1, Math.floor(limit ?? 12)));
  }

  private normalizeMinRating(value?: number) {
    if (!Number.isFinite(value)) {
      return undefined;
    }

    const rounded = Number((value ?? 0).toFixed(1));
    if (rounded <= 0) {
      return undefined;
    }

    return Math.min(5, rounded);
  }

  private normalizeMaxPreparationMinutes(value?: number) {
    if (!Number.isFinite(value)) {
      return undefined;
    }

    const normalized = Math.floor(value ?? 0);
    return normalized > 0 ? normalized : undefined;
  }

  private parsePreparationTimeToMinutes(value: string) {
    const normalized = value.toLowerCase();
    const hourMatch = normalized.match(/(\d+)\s*(h|hr|hour|hours|sat|sata)/i);
    const minuteMatch = normalized.match(/(\d+)\s*(m|min|minute|minutes|minut|minuta)/i);

    const hours = hourMatch ? Number.parseInt(hourMatch[1], 10) : 0;
    const minutes = minuteMatch ? Number.parseInt(minuteMatch[1], 10) : 0;

    if (!hours && !minutes) {
      const plainNumber = normalized.match(/\d+/);
      if (!plainNumber) {
        return null;
      }

      return Number.parseInt(plainNumber[0], 10);
    }

    return hours * 60 + minutes;
  }
}
