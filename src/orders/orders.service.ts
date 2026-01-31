import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaService } from 'src/prisma.service';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';

type ProductValidationResult = {
  id: number;
  price: number;
  name: string;
};
@Injectable()
export class OrdersService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(NATS_SERVICE) private readonly productClient: ClientProxy,
  ) {}
  async create(createOrderDto: CreateOrderDto) {
    try {
      // Validate products via microservice
      const productIds: number[] = createOrderDto.items.map(
        (item) => item.productId,
      );
      // Send product IDs to product microservice for validation
      const products = await firstValueFrom<ProductValidationResult[]>(
        this.productClient.send({ cmd: 'validate_products' }, productIds),
      );
      //Calculate total amount and total items
      const totalAmount = createOrderDto.items.reduce((sum, orderItem) => {
        const item = products.find(
          (product) => product.id === orderItem.productId,
        );
        const price = item ? item.price : 0;
        return sum + price * orderItem.quantity;
      }, 0);
      //Calculate total items
      const totalItems = createOrderDto.items.reduce(
        (sum, orderItem) => sum + orderItem.quantity,
        0,
      );
      const order = await this.prismaService.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                price:
                  products.find((product) => product.id === orderItem.productId)
                    ?.price || 0,
                productId: orderItem.productId,
                quantity: orderItem.quantity,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              productId: true,
              quantity: true,
            },
          },
        },
      });
      return {
        ...order,

        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name:
            products.find((product) => product.id === orderItem.productId)
              ?.name || '',
        })),
      };
    } catch {
      throw new RpcException({
        message: 'Could not validate products',
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalPages = await this.prismaService.order.count({
      where: { status: orderPaginationDto.status },
    });
    const currentPage = orderPaginationDto.page || 1;
    const limit = orderPaginationDto.limit || 10;

    return {
      data: await this.prismaService.order.findMany({
        where: { status: orderPaginationDto.status },
        skip: (currentPage - 1) * limit,
        take: limit,
      }),
      total: totalPages,
      page: currentPage,
      lastPage: Math.ceil(totalPages / limit),
    };
  }

  async findOne(id: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            productId: true,
            quantity: true,
          },
        },
      },
    });
    if (!order) {
      throw new RpcException({
        message: `Order with id ${id} not found`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const productIds = order.OrderItem.map((item) => item.productId);
    // Send product IDs to product microservice for validation
    const products = await firstValueFrom<ProductValidationResult[]>(
      this.productClient.send({ cmd: 'validate_products' }, productIds),
    );

    return {
      ...order,

      OrderItem: order.OrderItem.map((orderItem) => ({
        ...orderItem,
        name:
          products.find((product) => product.id === orderItem.productId)
            ?.name || '',
      })),
    };
  }
  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;
    const order = await this.findOne(id);
    if (order.status == status) {
      return order;
    }
    const updatedOrder = await this.prismaService.order.update({
      where: { id: order.id },
      data: { status },
    });
    return updatedOrder;
  }
}
