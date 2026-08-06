import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UsersService } from './users.service';

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    firstName: 'Test',
    lastName: 'Korisnik',
    username: 'test.korisnik',
    email: 'test@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuuVXGrcRCQSzNypnXKkuwN4BBbMW9k/Pq',
    isAdmin: false,
    isRecommended: false,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('UsersService profile updates', () => {
  let userModel: {
    findById: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
  };
  let recipeModel: {
    aggregate: jest.Mock;
  };
  let notificationsService: {
    findByUser: jest.Mock;
    getUnreadCount: jest.Mock;
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    userModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    recipeModel = {
      aggregate: jest.fn(),
    };
    notificationsService = {
      findByUser: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };
    service = new UsersService(userModel as never, recipeModel as never, notificationsService as never);
  });

  it('updates editable fields with trimming and normalized email/username', async () => {
    const user = createUser();
    userModel.findById.mockResolvedValue(user);
    userModel.findOne.mockResolvedValue(null);

    const result = await service.updateOwnProfile(String(user._id), {
      firstName: '  Pera  ',
      lastName: '  Peric ',
      username: ' Pera.Peric ',
      email: ' PERA@EXAMPLE.COM ',
    });

    expect(userModel.findOne).toHaveBeenCalledWith({
      _id: { $ne: user._id },
      $or: [{ email: 'pera@example.com' }, { username: 'pera.peric' }],
    });
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      firstName: 'Pera',
      lastName: 'Peric',
      username: 'pera.peric',
      email: 'pera@example.com',
    });
  });

  it('rejects duplicate email or username', async () => {
    const user = createUser();
    userModel.findById.mockResolvedValue(user);
    userModel.findOne.mockResolvedValue(createUser({ _id: new Types.ObjectId() }));

    await expect(
      service.updateOwnProfile(String(user._id), { email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(user.save).not.toHaveBeenCalled();
  });

  it('requires current password before changing password', async () => {
    const password = await bcrypt.hash('old-password', 10);
    const user = createUser({ password });
    userModel.findById.mockResolvedValue(user);

    await expect(
      service.updateOwnProfile(String(user._id), {
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(user.save).not.toHaveBeenCalled();
  });

  it('hashes and saves a valid new password', async () => {
    const password = await bcrypt.hash('old-password', 10);
    const user = createUser({ password });
    userModel.findById.mockResolvedValue(user);
    userModel.findOne.mockResolvedValue(null);

    await service.updateOwnProfile(String(user._id), {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(user.password).not.toBe(password);
    await expect(bcrypt.compare('new-password', user.password)).resolves.toBe(true);
  });

  it('searches users accent-insensitively', async () => {
    const user = createUser({
      firstName: 'Đorđe',
      lastName: 'Petrovic',
      username: 'djordje',
    });
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([user]),
    };

    userModel.countDocuments.mockResolvedValue(1);
    userModel.find.mockReturnValue(chain);
    recipeModel.aggregate.mockResolvedValue([{ _id: user._id, count: 2 }]);

    const result = await service.findAllPublic({ query: 'dj' });

    expect(userModel.find).toHaveBeenCalledWith({
      $or: [
        { firstName: { $regex: '(?:dj|đ)', $options: 'i' } },
        { lastName: { $regex: '(?:dj|đ)', $options: 'i' } },
        { username: { $regex: '(?:dj|đ)', $options: 'i' } },
      ],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      firstName: 'Đorđe',
      recipeCount: 2,
    });
  });
});

