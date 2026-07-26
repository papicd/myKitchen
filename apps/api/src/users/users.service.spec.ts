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
  let userModel: { findById: jest.Mock; findOne: jest.Mock };
  let recipeModel: Record<string, jest.Mock>;
  let service: UsersService;

  beforeEach(() => {
    userModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };
    recipeModel = {};
    service = new UsersService(userModel as never, recipeModel as never);
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
});

