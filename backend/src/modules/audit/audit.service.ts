import { prisma } from '../../config/database.js';

export interface AuditLogEntry {
  userId?: string | null;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
}

export class AuditService {
  static async log(entry: AuditLogEntry) {
    try {
      const isValidUuid =
        entry.userId &&
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(entry.userId);

      await prisma.auditLog.create({
        data: {
          userId: isValidUuid ? entry.userId : null,
          userRole: entry.userRole,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          oldValues: entry.oldValues ?? undefined,
          newValues: entry.newValues ?? undefined,
          ipAddress: entry.ipAddress || null,
        },
      });
    } catch (err) {
      console.error('⚠️ Failed to write audit log:', err);
    }
  }

  static async list(query: { entityType?: string; entityId?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, fullName: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
