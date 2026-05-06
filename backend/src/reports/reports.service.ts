import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>,
  ) {}

  private normalizeDateRange(from: Date, to: Date): { fromStart: Date; toExclusive: Date } {
    const fromStart = new Date(from);
    fromStart.setHours(0, 0, 0, 0);

    const toExclusive = new Date(to);
    toExclusive.setDate(toExclusive.getDate() + 1);
    toExclusive.setHours(0, 0, 0, 0);

    return { fromStart, toExclusive };
  }

  /** Resumen diario de ventas */
  async dailySales(branchId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const raw = await this.invoiceRepository
      .createQueryBuilder('inv')
      .leftJoin('inv.order', 'order')
      .select([
        'COUNT(inv.id) AS order_count',
        'SUM(inv.subtotal) AS subtotal',
        'SUM(inv.taxAmount) AS tax_amount',
        'SUM(inv.tipAmount) AS tip_amount',
        'SUM(inv.discountAmount) AS discount_amount',
        'SUM(order.pointsDiscount) AS points_discount',
        'SUM(inv.total) AS total_sales',
        "SUM(CASE WHEN inv.paymentMethod = 'cash' THEN inv.total ELSE 0 END) AS cash_sales",
        "SUM(CASE WHEN inv.paymentMethod = 'card' THEN inv.total ELSE 0 END) AS card_sales",
      ])
      .where('order.branchId = :branchId', { branchId })
      .andWhere('inv.createdAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .andWhere("inv.status = 'issued'")
      .getRawOne();

    const orderCount = parseInt(raw?.order_count ?? '0', 10);
    const totalSales = parseFloat(raw?.total_sales ?? '0');
    return {
      orderCount,
      totalSales,
      avgTicket: orderCount > 0 ? +(totalSales / orderCount).toFixed(2) : 0,
      totalTax: parseFloat(raw?.tax_amount ?? '0'),
      totalTip: parseFloat(raw?.tip_amount ?? '0'),
      totalDiscount: parseFloat(raw?.discount_amount ?? '0'),
      pointsDiscount: parseFloat(raw?.points_discount ?? '0'),
      cashSales: parseFloat(raw?.cash_sales ?? '0'),
      cardSales: parseFloat(raw?.card_sales ?? '0'),
    };
  }

  /** Ventas por rango de fechas con desglose diario */
  async salesByRange(branchId: string, from: Date, to: Date) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const rows = await this.invoiceRepository
      .createQueryBuilder('inv')
      .leftJoin('inv.order', 'order')
      .select([
        "DATE(inv.createdAt) AS date",
        'COUNT(inv.id) AS invoices',
        'SUM(inv.total) AS total',
        'SUM(inv.taxAmount) AS tax',
        'SUM(order.pointsDiscount) AS points_discount',
      ])
      .where('order.branchId = :branchId', { branchId })
      .andWhere('inv.createdAt >= :from', { from: fromStart })
      .andWhere('inv.createdAt < :to', { to: toExclusive })
      .andWhere("inv.status = 'issued'")
      .groupBy("DATE(inv.createdAt)")
      .orderBy("DATE(inv.createdAt)", 'ASC')
      .getRawMany();

    const dailyBreakdown = rows.map((r) => ({
      date: r.date,
      orderCount: parseInt(r.invoices, 10),
      total: parseFloat(r.total ?? '0'),
      tax: parseFloat(r.tax ?? '0'),
      pointsDiscount: parseFloat(r.points_discount ?? '0'),
    }));

    const totals = dailyBreakdown.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        tax: acc.tax + r.tax,
        pointsDiscount: acc.pointsDiscount + r.pointsDiscount,
        orders: acc.orders + r.orderCount,
      }),
      { total: 0, tax: 0, pointsDiscount: 0, orders: 0 },
    );

    return { dailyBreakdown, ...totals };
  }

  /** Productos más vendidos */
  async topProducts(branchId: string, from: Date, to: Date, limit = 10) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const rows = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.items', 'item')
      .select([
        'item.productId AS product_id',
        'item.productName AS product_name',
        'SUM(item.quantity) AS total_quantity',
        'SUM(item.subtotal) AS total_revenue',
      ])
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.createdAt >= :from', { from: fromStart })
      .andWhere('order.createdAt < :to', { to: toExclusive })
      .groupBy('item.productId, item.productName')
      .orderBy('total_quantity', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      totalQuantity: parseInt(r.total_quantity, 10),
      totalRevenue: parseFloat(r.total_revenue ?? '0'),
    }));
  }

  /** Horas pico — cantidad de órdenes por hora del día */
  async peakHours(branchId: string, from: Date, to: Date) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const rows = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        "EXTRACT(HOUR FROM order.createdAt) AS hour",
        'COUNT(order.id) AS order_count',
        'SUM(order.total) AS revenue',
      ])
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.createdAt >= :from', { from: fromStart })
      .andWhere('order.createdAt < :to', { to: toExclusive })
      .groupBy("EXTRACT(HOUR FROM order.createdAt)")
      .orderBy('hour', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      hour: parseInt(r.hour, 10),
      orderCount: parseInt(r.order_count, 10),
      revenue: parseFloat(r.revenue || '0'),
    }));
  }

  /** Gastos vs ingresos — P&G simplificado */
  async profitLoss(branchId: string, from: Date, to: Date) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const [salesData, expensesData] = await Promise.all([
      this.invoiceRepository
        .createQueryBuilder('inv')
        .leftJoin('inv.order', 'order')
        .select(['SUM(inv.total) AS total_sales', 'SUM(inv.taxAmount) AS total_tax'])
        .where('order.branchId = :branchId', { branchId })
        .andWhere('inv.createdAt >= :from', { from: fromStart })
        .andWhere('inv.createdAt < :to', { to: toExclusive })
        .andWhere("inv.status = 'issued'")
        .getRawOne(),
      this.expenseRepository
        .createQueryBuilder('exp')
        .select(['SUM(exp.amount) AS total_expenses', 'exp.category AS category'])
        .where('exp.branchId = :branchId', { branchId })
        .andWhere('exp.date >= :from', { from: fromStart })
        .andWhere('exp.date < :to', { to: toExclusive })
        .groupBy('exp.category')
        .getRawMany(),
    ]);

    const totalExpenses = expensesData.reduce(
      (sum, e) => sum + parseFloat(e.total_expenses || '0'),
      0,
    );

    return {
      totalSales: parseFloat(salesData?.total_sales || '0'),
      totalTax: parseFloat(salesData?.total_tax || '0'),
      totalExpenses,
      expensesByCategory: expensesData.map((e) => ({
        category: e.category,
        total: parseFloat(e.total_expenses || '0'),
      })),
      grossProfit: parseFloat(salesData?.total_sales || '0') - totalExpenses,
    };
  }
}
