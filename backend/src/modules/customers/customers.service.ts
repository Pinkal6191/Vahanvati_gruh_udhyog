import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerQueryInput,
} from './customers.validation.js';

export class CustomersService {
  static async list(query?: Partial<CustomerQueryInput>) {
    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;
    const search = query?.search;
    const type = query?.type;
    const status = query?.status;

    const where: any = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (type) {
      where.customerType = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
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

  static async getById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            billNumber: true,
            finalTotalAmount: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    return customer;
  }

  static async create(data: CreateCustomerInput, userId?: string, userRole = 'OUTLET') {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        customerType: data.customerType,
        mobile: data.mobile || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || 'India',
        gstin: data.gstin || null,
        notes: data.notes || null,
      },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'CUSTOMER_CREATED',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      newValues: customer,
    });

    return customer;
  }

  static async update(id: string, data: UpdateCustomerInput, userId?: string, userRole = 'OUTLET') {
    const oldCustomer = await this.getById(id);

    const updated = await prisma.customer.update({
      where: { id },
      data,
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'CUSTOMER_UPDATED',
      entityType: 'CUSTOMER',
      entityId: id,
      oldValues: oldCustomer,
      newValues: updated,
    });

    return updated;
  }

  static async updateStatus(id: string, isActive: boolean, userId?: string, userRole = 'ADMIN') {
    const oldCustomer = await this.getById(id);

    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'CUSTOMER_STATUS_CHANGED',
      entityType: 'CUSTOMER',
      entityId: id,
      oldValues: { isActive: oldCustomer.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  }

  static async getPurchaseHistory(customerId: string, page = 1, limit = 20) {
    await this.getById(customerId);
    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payments: true,
        },
      }),
      prisma.sale.count({ where: { customerId } }),
    ]);

    return {
      sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
