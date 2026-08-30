import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Remove all test orders + related rows so launch starts from zero.
const orders = await p.order.findMany({ select: { id: true } });
for (const o of orders.map((x) => x.id)) {
  await p.orderStatusEvent.deleteMany({ where: { orderId: o } });
  await p.payment.deleteMany({ where: { orderId: o } });
  await p.orderItem.deleteMany({ where: { orderId: o } });
}
await p.stockMovement.deleteMany({});
const delOrders = await p.order.deleteMany({});
await p.notification.deleteMany({ where: { type: 'ORDER_UPDATE' } });

// Reset every variant's stock to the seed baseline.
const inv = await p.inventoryLevel.updateMany({ data: { onHand: 25, reserved: 0 } });

// Drop test accounts + newsletter rows.
const testUsers = await p.user.findMany({ where: { email: { contains: 'testmail.dev' } }, select: { id: true } });
for (const u of testUsers.map((x) => x.id)) {
  await p.wishlistItem.deleteMany({ where: { userId: u } });
  await p.refreshToken.deleteMany({ where: { userId: u } });
  await p.cart.deleteMany({ where: { userId: u } });
  await p.loyaltyTransaction.deleteMany({ where: { account: { userId: u } } });
  await p.loyaltyAccount.deleteMany({ where: { userId: u } });
  await p.user.delete({ where: { id: u } });
}
const delSubs = await p.newsletterSubscriber.deleteMany({ where: { email: { contains: 'testmail.dev' } } });
// also clear any stray guest carts
await p.cartItem.deleteMany({ where: { cart: { userId: null } } });
await p.cart.deleteMany({ where: { userId: null } });

console.log({ ordersDeleted: delOrders.count, variantsReset: inv.count, testUsers: testUsers.length, subscribers: delSubs.count });
await p.$disconnect();
