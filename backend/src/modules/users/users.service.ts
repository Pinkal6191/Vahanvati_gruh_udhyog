import { prisma } from '../../config/database.js';
import bcrypt from 'bcryptjs';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { Role, SaleType } from '@prisma/client';
import { AuthenticatedUser } from '../../middlewares/auth.middleware.js';
import { CreateUserInput, UpdateUserInput } from './users.validation.js';

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
        isMasterAdmin: true,
        allowedBillingSaleTypes: true,
        allowedReportSaleTypes: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async create(data: CreateUserInput, actingUser?: AuthenticatedUser) {
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictError('Username already in use');

    // Anti-privilege escalation guards
    const isMasterAdmin = Boolean(data.isMasterAdmin);
    if (isMasterAdmin && !actingUser?.isMasterAdmin) {
      throw new ForbiddenError('Only Master Admins can grant Master Admin status');
    }

    const allowedBillingSaleTypes = data.allowedBillingSaleTypes && data.allowedBillingSaleTypes.length > 0
      ? data.allowedBillingSaleTypes
      : [SaleType.RETAIL];

    const allowedReportSaleTypes = data.allowedReportSaleTypes && data.allowedReportSaleTypes.length > 0
      ? data.allowedReportSaleTypes
      : [SaleType.RETAIL];

    if (!actingUser?.isMasterAdmin) {
      for (const st of allowedBillingSaleTypes) {
        if (!actingUser?.allowedBillingSaleTypes.includes(st)) {
          throw new ForbiddenError(`Cannot grant billing sale type "${st}" exceeding your own permissions`);
        }
      }
      for (const st of allowedReportSaleTypes) {
        if (!actingUser?.allowedReportSaleTypes.includes(st)) {
          throw new ForbiddenError(`Cannot grant report sale type "${st}" exceeding your own permissions`);
        }
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    return prisma.user.create({
      data: {
        username: data.username,
        fullName: data.fullName,
        email: data.email || null,
        passwordHash,
        role: data.role,
        isMasterAdmin,
        allowedBillingSaleTypes,
        allowedReportSaleTypes,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        isMasterAdmin: true,
        allowedBillingSaleTypes: true,
        allowedReportSaleTypes: true,
        createdAt: true,
      },
    });
  }

  static async update(
    id: string,
    data: UpdateUserInput,
    actingUser?: AuthenticatedUser
  ) {
    return prisma.$transaction(async (tx) => {
      // Serialize concurrent Master Admin mutations using a transaction-scoped advisory lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('master_admin_lock'))`;

      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundError('User not found');

      // Anti-lockout: Prevent demoting or deactivating the last active Master Admin
      if (user.isMasterAdmin && user.isActive) {
        const isDemoting = data.isMasterAdmin === false;
        const isDeactivating = data.isActive === false;

        if (isDemoting || isDeactivating) {
          const activeMasterAdminCount = await tx.user.count({
            where: { isMasterAdmin: true, isActive: true },
          });

          if (activeMasterAdminCount <= 1) {
            throw new BadRequestError('Cannot demote or deactivate the last remaining active Master Admin');
          }
        }
      }

      // Anti-privilege escalation guards
      if (!actingUser?.isMasterAdmin) {
        if (data.isMasterAdmin !== undefined && data.isMasterAdmin !== user.isMasterAdmin) {
          throw new ForbiddenError('Only Master Admins can modify Master Admin status');
        }

        if (user.isMasterAdmin) {
          throw new ForbiddenError('Non-Master Admins cannot modify a Master Admin user account');
        }

        // Self-escalation check
        const isSelf = actingUser?.id === id;

        if (data.allowedBillingSaleTypes !== undefined) {
          for (const st of data.allowedBillingSaleTypes) {
            if (isSelf && !user.allowedBillingSaleTypes.includes(st)) {
              throw new ForbiddenError('Users cannot escalate their own billing sale type permissions');
            }
            if (!actingUser?.allowedBillingSaleTypes.includes(st)) {
              throw new ForbiddenError(`Cannot grant billing sale type "${st}" exceeding your own permissions`);
            }
          }
        }

        if (data.allowedReportSaleTypes !== undefined) {
          for (const st of data.allowedReportSaleTypes) {
            if (isSelf && !user.allowedReportSaleTypes.includes(st)) {
              throw new ForbiddenError('Users cannot escalate their own report sale type permissions');
            }
            if (!actingUser?.allowedReportSaleTypes.includes(st)) {
              throw new ForbiddenError(`Cannot grant report sale type "${st}" exceeding your own permissions`);
            }
          }
        }
      }

      const updatePayload: any = {};
      if (data.fullName !== undefined) updatePayload.fullName = data.fullName;
      if (data.email !== undefined) updatePayload.email = data.email;
      if (data.role !== undefined) updatePayload.role = data.role;
      if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
      if (data.isMasterAdmin !== undefined) updatePayload.isMasterAdmin = data.isMasterAdmin;
      if (data.allowedBillingSaleTypes !== undefined) updatePayload.allowedBillingSaleTypes = data.allowedBillingSaleTypes;
      if (data.allowedReportSaleTypes !== undefined) updatePayload.allowedReportSaleTypes = data.allowedReportSaleTypes;
      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        updatePayload.passwordHash = await bcrypt.hash(data.password, salt);
      }

      return tx.user.update({
        where: { id },
        data: updatePayload,
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          isMasterAdmin: true,
          allowedBillingSaleTypes: true,
          allowedReportSaleTypes: true,
          updatedAt: true,
        },
      });
    });
  }
}
