const API = 'http://localhost:4000/api/v1';
const j = async (r) => ({ status: r.status, body: await r.text().then((t) => (t ? JSON.parse(t) : null)) });
const H = (extra = {}) => ({ 'content-type': 'application/json', ...extra });

// ---------- CUSTOMER: COD ORDER via API (register -> cart -> checkout -> COD) ----------
const email = `journey-${Date.now()}@testmail.dev`;
const reg = await fetch(`${API}/auth/register`, { method: 'POST', headers: H(), body: JSON.stringify({ email, password: 'Journey!123', firstName: 'Journey' }) }).then(j);
const token = reg.body.accessToken;
const auth = { authorization: `Bearer ${token}` };

// pick a product + in-stock variant
const prod = await fetch(`${API}/products/mom-fit-jeans-vintage-wash`).then(j);
const variant = prod.body.variants.find((v) => v.inventory.reduce((s, i) => s + (i.onHand - i.reserved), 0) > 0);
const addCart = await fetch(`${API}/cart/items`, { method: 'POST', headers: H(auth), body: JSON.stringify({ variantId: variant.id, quantity: 1 }) }).then(j);
console.log('1. add to cart:', addCart.status, 'items:', addCart.body?.items?.length);

const summary = await fetch(`${API}/checkout?pincode=230132`, { headers: H(auth) }).then(j);
console.log('2. checkout summary:', summary.status, 'payment methods:', summary.body?.paymentMethods?.map((m) => m.method), 'shipping opts:', summary.body?.shippingOptions?.length);
const codMethod = summary.body.paymentMethods.find((m) => m.method === 'COD');
const shipRate = summary.body.shippingOptions.find((s) => s.codAvailable) ?? summary.body.shippingOptions[0];

const place = await fetch(`${API}/checkout`, {
  method: 'POST',
  headers: H(auth),
  body: JSON.stringify({
    email,
    paymentMethod: 'COD',
    shippingRateId: shipRate.id,
    shippingAddress: {
      fullName: 'Journey Test', phone: '9336791807',
      line1: '1 Test Street', city: 'Pratapgarh', state: 'Uttar Pradesh', pincode: '230132', country: 'IN',
    },
  }),
}).then(j);
console.log('3. place COD order:', place.status, 'orderNumber:', place.body?.order?.orderNumber, 'status:', place.body?.order?.status, 'paymentStatus:', place.body?.order?.paymentStatus, 'method:', place.body?.order?.payment?.method);
const orderNumber = place.body?.order?.orderNumber;

const myOrders = await fetch(`${API}/orders`, { headers: H(auth) }).then(j);
console.log('4. account orders:', myOrders.status, 'count:', myOrders.body?.length, 'has new order:', myOrders.body?.some((o) => o.orderNumber === orderNumber));

const track = await fetch(`${API}/orders/${orderNumber}`, { headers: H(auth) }).then(j);
console.log('5. order tracking:', track.status, 'items:', track.body?.items?.length, 'grandTotal:', track.body?.totals?.grandTotal);

// ---------- ADMIN JOURNEY ----------
const adminLogin = await fetch(`${API}/auth/login`, { method: 'POST', headers: H(), body: JSON.stringify({ email: 'sumitnnnrealtor@gmail.com', password: 'ChangeMe!2026' }) }).then(j);
const A = { authorization: `Bearer ${adminLogin.body.accessToken}` };
console.log('\nADMIN login:', adminLogin.status);
const aProducts = await fetch(`${API}/admin/catalog/products`, { headers: H(A) }).then(j);
console.log('  products:', aProducts.status, 'total:', aProducts.body?.total);
const aCats = await fetch(`${API}/admin/categories`, { headers: H(A) }).then(j);
console.log('  categories:', aCats.status, 'count:', aCats.body?.length, 'men imageUrl set:', !!aCats.body?.find((c) => c.slug === 'men')?.imageUrl);
const aOrders = await fetch(`${API}/admin/orders`, { headers: H(A) }).then(j);
const adminOrder = aOrders.body?.items?.find((o) => o.orderNumber === orderNumber);
console.log('  orders:', aOrders.status, 'total:', aOrders.body?.total, 'new order visible:', !!adminOrder);
if (adminOrder) {
  const setStatus = await fetch(`${API}/admin/orders/${adminOrder.id}/status`, { method: 'PATCH', headers: H(A), body: JSON.stringify({ status: 'PROCESSING', note: 'Packing' }) }).then(j);
  console.log('  order status -> PROCESSING:', setStatus.status, setStatus.body?.status);
}
const aInv = await fetch(`${API}/admin/inventory?filter=all`, { headers: H(A) }).then(j);
console.log('  inventory:', aInv.status, 'rows:', aInv.body?.items?.length ?? aInv.body?.length);
const aNews = await fetch(`${API}/admin/newsletter?status=all`, { headers: H(A) }).then(j);
console.log('  newsletter:', aNews.status, 'total:', aNews.body?.total);

// order confirmation notification recorded?
console.log('\n(order confirmation email is best-effort; EmailService.configured =', 'check API logs)');
