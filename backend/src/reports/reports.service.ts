import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Category } from '../menu/entities/category.entity';
import { PosShift } from '../pos/entities/pos-shift.entity';
import { CashMovementDirection, PosCashMovement } from '../pos/entities/pos-cash-movement.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(PosShift) private readonly shiftRepository: Repository<PosShift>,
    @InjectRepository(PosCashMovement) private readonly cashMovementRepository: Repository<PosCashMovement>,
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
        `SUM(CASE
          WHEN inv."paymentMethod" = 'cash' THEN inv.total
          WHEN inv."paymentMethod" = 'mixed' THEN COALESCE((inv."paymentDetails"->>'cash')::numeric, 0)
          ELSE 0 END) AS cash_sales`,
        `SUM(CASE
          WHEN inv."paymentMethod" = 'card' THEN inv.total
          WHEN inv."paymentMethod" = 'mixed' THEN COALESCE((inv."paymentDetails"->>'card')::numeric, 0)
          ELSE 0 END) AS card_sales`,
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
        'SUM(CASE WHEN order.pointsDiscount > 0 THEN 1 ELSE 0 END) AS invoices_with_points',
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
      invoicesWithPoints: parseInt(r.invoices_with_points ?? '0', 10),
    }));

    const totals = dailyBreakdown.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        tax: acc.tax + r.tax,
        pointsDiscount: acc.pointsDiscount + r.pointsDiscount,
        orders: acc.orders + r.orderCount,
        invoicesWithPoints: acc.invoicesWithPoints + r.invoicesWithPoints,
      }),
      { total: 0, tax: 0, pointsDiscount: 0, orders: 0, invoicesWithPoints: 0 },
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

  /** Clientes con más compras en el periodo */
  async topCustomers(branchId: string, from: Date, to: Date, limit = 10) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const rows = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.customer', 'customer')
      .select([
        'customer.id AS customer_id',
        'customer.name AS customer_name',
        'customer.code AS customer_code',
        'COUNT(order.id) AS purchase_count',
        'SUM(order.total) AS total_spent',
        'MAX(order.createdAt) AS last_purchase_at',
      ])
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.customerId IS NOT NULL')
      .andWhere('order.createdAt >= :from', { from: fromStart })
      .andWhere('order.createdAt < :to', { to: toExclusive })
      .groupBy('customer.id, customer.name, customer.code')
      .orderBy('purchase_count', 'DESC')
      .addOrderBy('total_spent', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerCode: r.customer_code,
      purchaseCount: parseInt(r.purchase_count, 10),
      totalSpent: parseFloat(r.total_spent ?? '0'),
      lastPurchaseAt: r.last_purchase_at,
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

  /** Ventas por categoría de producto */
  async salesByCategory(branchId: string, from: Date, to: Date) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const rows = await this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.items', 'item')
      .innerJoin('item.product', 'product')
      .innerJoin('product.category', 'category')
      .select([
        'category.id AS category_id',
        'category.name AS category_name',
        'COUNT(DISTINCT order.id) AS order_count',
        'SUM(item.quantity) AS total_quantity',
        'SUM(item.subtotal) AS total_revenue',
      ])
      .where('order.branchId = :branchId', { branchId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.createdAt >= :from', { from: fromStart })
      .andWhere('order.createdAt < :to', { to: toExclusive })
      .groupBy('category.id, category.name')
      .orderBy('total_revenue', 'DESC')
      .getRawMany();

    const grandTotal = rows.reduce((sum, r) => sum + parseFloat(r.total_revenue ?? '0'), 0);

    return rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      orderCount: parseInt(r.order_count, 10),
      totalQuantity: parseInt(r.total_quantity, 10),
      totalRevenue: parseFloat(r.total_revenue ?? '0'),
      percentage: grandTotal > 0
        ? +((parseFloat(r.total_revenue ?? '0') / grandTotal) * 100).toFixed(1)
        : 0,
    }));
  }

  async cashMovements(branchId: string, from: Date, to: Date) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const movements = await this.cashMovementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.createdBy', 'createdBy')
      .leftJoinAndSelect('movement.shift', 'shift')
      .where('movement.branchId = :branchId', { branchId })
      .andWhere('movement.createdAt >= :from', { from: fromStart })
      .andWhere('movement.createdAt < :to', { to: toExclusive })
      .orderBy('movement.createdAt', 'DESC')
      .getMany();

    return movements.map((movement) => ({
      id: movement.id,
      createdAt: movement.createdAt,
      shiftId: movement.shiftId,
      direction: movement.direction,
      category: movement.category,
      amount: Number(movement.amount),
      reason: movement.reason,
      notes: movement.notes,
      createdBy: movement.createdBy ? { id: movement.createdBy.id, name: movement.createdBy.name } : null,
    }));
  }

  async cashShifts(branchId: string, from: Date, to: Date) {
    const { fromStart, toExclusive } = this.normalizeDateRange(from, to);

    const shifts = await this.shiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.openedBy', 'openedBy')
      .leftJoinAndSelect('shift.closedBy', 'closedBy')
      .where('shift.branchId = :branchId', { branchId })
      .andWhere('shift.openedAt >= :from', { from: fromStart })
      .andWhere('shift.openedAt < :to', { to: toExclusive })
      .orderBy('shift.openedAt', 'DESC')
      .getMany();

    const movementRows = await this.cashMovementRepository
      .createQueryBuilder('movement')
      .select('movement.shiftId', 'shiftId')
      .addSelect('movement.direction', 'direction')
      .addSelect('COALESCE(SUM(movement.amount), 0)', 'total')
      .where('movement.branchId = :branchId', { branchId })
      .andWhere('movement.createdAt >= :from', { from: fromStart })
      .andWhere('movement.createdAt < :to', { to: toExclusive })
      .groupBy('movement.shiftId')
      .addGroupBy('movement.direction')
      .getRawMany();

    return shifts.map((shift) => {
      const totalCashIn = parseFloat(movementRows.find((row) => row.shiftId === shift.id && row.direction === CashMovementDirection.IN)?.total ?? '0');
      const totalCashOut = parseFloat(movementRows.find((row) => row.shiftId === shift.id && row.direction === CashMovementDirection.OUT)?.total ?? '0');

      return {
        id: shift.id,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openingCash: Number(shift.openingCash),
        closingCash: shift.closingCash != null ? Number(shift.closingCash) : null,
        expectedCash: shift.expectedCash != null ? Number(shift.expectedCash) : null,
        cashDifference: shift.cashDifference != null ? Number(shift.cashDifference) : null,
        manualCashIn: totalCashIn,
        manualCashOut: totalCashOut,
        closingNotes: shift.closingNotes,
        openedBy: shift.openedBy ? { id: shift.openedBy.id, name: shift.openedBy.name } : null,
        closedBy: shift.closedBy ? { id: shift.closedBy.id, name: shift.closedBy.name } : null,
      };
    });
  }
}
