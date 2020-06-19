import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const productsId = products.map(product => ({ id: product.id }));

    const productsFinded = await this.productsRepository.findAllById(
      productsId,
    );

    if (productsId.length !== productsFinded.length) {
      throw new AppError('Your list contains some non-existent products.');
    }

    const productsQuantityUpdeted: Product[] = [];

    const productsToCreateOrder = productsFinded.map(itemProductFinded => {
      const itemProduct = products.find(
        item => itemProductFinded.id === item.id,
      );

      if (!itemProduct) {
        throw new AppError(
          `An error occurred while reading the products in the database.`,
        );
      }

      if (itemProductFinded.quantity < itemProduct.quantity) {
        throw new AppError(
          `The ${itemProductFinded.name} product does not have enough stock.`,
        );
      }

      productsQuantityUpdeted.push({
        ...itemProductFinded,
        quantity: itemProductFinded.quantity - itemProduct.quantity,
      });

      return {
        product_id: itemProductFinded.id,
        price: itemProductFinded.price,
        quantity: itemProduct.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsToCreateOrder,
    });

    await this.productsRepository.updateQuantity(productsQuantityUpdeted);

    return order;
  }
}

export default CreateOrderService;
