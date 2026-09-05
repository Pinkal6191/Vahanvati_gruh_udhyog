import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { CreateCustomerInput, UpdateCustomerInput, CustomerQueryInput } from './customers.validation.js';

export class CustomersService {
  static async list(query: CustomerQueryInput) {
    const { search, type, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (type) {
      where.customerType = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
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

  static async create(data: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        name: data.name,
        customerType: data.customerType,
        mobile: data.mobile || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || 'India',
        notes: data.notes || null,
      },
    });
  }

  static async update(id: string, data: UpdateCustomerInput) {
    await this.getById(id);

    return prisma.customer.update({
      where: { id },
      data,
    });
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
