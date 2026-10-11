import { beforeAll, describe, expect, it, vi } from 'vitest';

// OrdersService reads env at import time via @slay/config.
process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(32);
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';

let OrdersService: typeof import('./orders.service.js').OrdersService;

beforeAll(async () => {
  ({ OrdersService } = await import('./orders.service.js'));
});

/** OrdersService with stubbed collaborators; only what each test touches is real. */
function makeService(opts: { order?: unknown; payment?: unknown; claimCount?: number } = {}) {
  const tx = {
    order: { updateMany: vi.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }), update: vi.fn() },
    payment: { update: vi.fn() },
    inventoryLevel: { findUnique: vi.fn(), upsert: vi.fn() },
    stockMovement: { create: vi.fn() },
    product: { update: vi.fn() },
    cart: { updateMany: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    notification: { create: vi.fn() },
  };
  const prisma = {
    order: { findUnique: vi.fn().mockResolvedValue(opts.order) },
    payment: { findUnique: vi.fn().mockResolvedValue(opts.payment) },
    warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'wh1' }) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const payments = { verify: vi.fn().mockResolvedValue({ ok: true, providerPaymentId: 'pay_1' }) };
  const shipping = { autoCreateForOrder: vi.fn().mockResolvedValue(undefined) };
  const email = { configured: false };
  const svc = new OrdersService(
    prisma as never,
    {} as never,
    {} as never,
    payments as never,
    email as never,
    {} as never,
    shipping as never,
  );
  return { svc, prisma, tx, payments, shipping };
}

const guestOrder = (payment: Record<string, unknown>) => ({
  id: 'o1',
  orderNumber: 'SJ-2026-000001',
  userId: null,
  guestEmail: 'a@b.com',
  payments: [{ id: 'p1', status: 'PENDING', amount: 100, ...payment }],
});

describe('OrdersService.verifyFromClient', () => {
  it('refuses to re-verify a Cash on Delivery order (would commit stock twice)', async () => {
    const { svc, payments } = makeService({ order: guestOrder({ method: 'COD', gateway: 'cod' }) });
    await expect(
      svc.verifyFromClient({ email: 'a@b.com' }, { orderNumber: 'SJ-2026-000001' }),
    ).rejects.toThrow(/Cash on Delivery/);
    expect(payments.verify).not.toHaveBeenCalled();
  });

  it('rejects a gateway order id that is not the one stored for this payment', async () => {
    const { svc, payments } = makeService({
      order: guestOrder({ method: 'RAZORPAY', gateway: 'razorpay', gatewayOrderId: 'order_REAL' }),
    });
    await expect(
      svc.verifyFromClient(
        { email: 'a@b.com' },
        { orderNumber: 'SJ-2026-000001', providerOrderId: 'order_CHEAP', providerPaymentId: 'pay_1', signature: 's' },
      ),
    ).rejects.toThrow(/does not belong/);
    expect(payments.verify).not.toHaveBeenCalled();
  });

  it('verifies against the server-stored gateway order id', async () => {
    const { svc, payments } = makeService({
      order: guestOrder({ method: 'RAZORPAY', gateway: 'razorpay', gatewayOrderId: 'order_REAL' }),
      payment: { id: 'p1', status: 'PAID' }, // finalizePayment then returns early
    });
    await svc.verifyFromClient(
      { email: 'a@b.com' },
      { orderNumber: 'SJ-2026-000001', providerPaymentId: 'pay_1', signature: 's' },
    );
    expect(payments.verify).toHaveBeenCalledWith(
      'razorpay',
      expect.objectContaining({ providerOrderId: 'order_REAL' }),
    );
  });
});

describe('OrdersService.finalizePayment', () => {
  const pendingPayment = {
    id: 'p1',
    status: 'PENDING',
    method: 'COD',
    gatewayResponse: {},
    order: { id: 'o1', orderNumber: 'SJ-2026-000001', items: [], couponId: null, userId: null, user: null },
  };

  it('does nothing when the order was already finalised (repeat / concurrent call)', async () => {
    const { svc, tx, shipping } = makeService({ payment: pendingPayment, claimCount: 0 });
    await svc.finalizePayment('p1', { source: 'client-verify' });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', confirmedAt: null },
      data: { confirmedAt: expect.any(Date) },
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(shipping.autoCreateForOrder).not.toHaveBeenCalled();
  });

  it('confirms the order on the first call', async () => {
    const { svc, tx, shipping } = makeService({ payment: pendingPayment, claimCount: 1 });
    await svc.finalizePayment('p1', { source: 'immediate', codPending: true });
    expect(tx.payment.update).toHaveBeenCalledOnce();
    expect(tx.order.update).toHaveBeenCalledOnce();
    expect(shipping.autoCreateForOrder).toHaveBeenCalledWith('o1');
  });
});
