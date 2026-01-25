import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaService } from 'src/prisma.service';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';
@Injectable()
export class OrdersService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(createOrderDto: CreateOrderDto) {
    const order = await this.prismaService.order.create({
      data: createOrderDto,
    });
    return order;
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
    });
    if (!order) {
      throw new RpcException({
        message: `Order with id ${id} not found`,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return order;
  }
  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;
    console.log('Changing status for order id:', id, 'to status:', status);
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
