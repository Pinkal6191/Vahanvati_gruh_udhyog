import { prisma } from '../../config/database.js';
import bcrypt from 'bcryptjs';
import { ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import { Role } from '@prisma/client';

export class UsersService {
  static async list() {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async create(data: {
    username: string;
    password: string;
    fullName: string;
    email?: string;
    role: Role;
  }) {
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictError('Username already in use');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    return prisma.user.create({
      data: {
        username: data.username,
        fullName: data.fullName,
        email: data.email || null,
        passwordHash,
        role: data.role,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  static async update(
    id: string,
    data: { fullName?: string; email?: string; role?: Role; isActive?: boolean; password?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');

    const updatePayload: any = {};
    if (data.fullName !== undefined) updatePayload.fullName = data.fullName;
    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.role !== undefined) updatePayload.role = data.role;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updatePayload.passwordHash = await bcrypt.hash(data.password, salt);
    }

    return prisma.user.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }
}
