/**
 * End-to-end smoke test for the marketplace.
 *
 * Exercises the real HTTP API against a running server and seeded demo data:
 * store discovery, cart rules, pickup-slot validation, checkout with FEFO
 * stock reservation, the full order lifecycle, cancellation refunds of stock,
 * the wholesale purchase-order flow and tenant isolation.
 *
 *   npm run seed && npm run seed:demo
 *   npm run dev            # in another terminal
 *   npm run test:e2e
 */
const BASE = 'http://localhost:5000/api/v1';
let failures = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function login(identifier) {
  const { json } = await call('POST', '/auth/login', {
    body: { identifier, password: 'Demo@12345' },
  });
  return json.data?.tokens?.accessToken;
}

const customerToken = await login('customer1@medsaas.test');
const retailerToken = await login('shop1@medsaas.test');
const vendorToken = await login('vendor1@medsaas.test');
check('logins', customerToken && retailerToken && vendorToken);

console.log('\n--- Store discovery ---');
const nearby = await call('GET', '/customers/stores/nearby?latitude=18.5314&longitude=73.8446&radius=10', { token: customerToken });
check('nearby stores returns results', nearby.json.data?.length > 0, JSON.stringify(nearby.json).slice(0, 200));
const store = nearby.json.data?.[0];
console.log(`       nearest: ${store?.storeName} @ ${store?.distanceKm} km, open=${store?.isOpen}, products=${store?.productCount}`);

const tooFar = await call('GET', '/customers/stores/nearby?latitude=28.6139&longitude=77.2090&radius=5', { token: customerToken });
check('far-away location returns nothing', tooFar.json.data?.length === 0);

console.log('\n--- Store products ---');
const products = await call('GET', `/customers/stores/${store.id}/products?limit=5`, { token: customerToken });
check('store products in stock', products.json.data?.length > 0);
const item = products.json.data?.[0];
console.log(`       ${item?.product?.name} — ₹${item?.sellingPrice} (MRP ₹${item?.mrp}), available ${item?.availableQty}`);

const search = await call('GET', '/customers/products/search?search=paracetamol&latitude=18.5314&longitude=73.8446&radius=15', { token: customerToken });
check('cross-store product search', search.json.data?.length > 0);

console.log('\n--- Cart ---');
await call('DELETE', '/customers/cart', { token: customerToken });
const add = await call('POST', '/customers/cart/items', {
  token: customerToken,
  body: { retailerProductId: item.id, quantity: 3 },
});
check('add to cart', add.status === 201, JSON.stringify(add.json).slice(0, 200));
console.log(`       cart total ₹${add.json.data?.totals?.totalAmount} (tax ₹${add.json.data?.totals?.taxAmount})`);

// Different store must trigger the one-store-per-cart rule
const otherStore = nearby.json.data.find((s) => s.id !== store.id);
if (otherStore) {
  const otherProducts = await call('GET', `/customers/stores/${otherStore.id}/products?limit=1`, { token: customerToken });
  const otherItem = otherProducts.json.data?.[0];
  if (otherItem) {
    const conflict = await call('POST', '/customers/cart/items', {
      token: customerToken,
      body: { retailerProductId: otherItem.id, quantity: 1 },
    });
    check('cart rejects a second store', conflict.status === 409 && conflict.json.code === 'CART_STORE_CONFLICT', JSON.stringify(conflict.json).slice(0, 160));
  }
}

const overQty = await call('PUT', `/customers/cart/items/${add.json.data.items[0].id}`, {
  token: customerToken,
  body: { quantity: 9999 },
});
check('cart rejects quantity above stock/limit', overQty.status >= 400);

console.log('\n--- Pickup slots ---');
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const slots = await call('GET', `/customers/stores/${store.id}/pickup-slots?date=${tomorrow}`, { token: customerToken });
const openSlot = slots.json.data?.find((s) => s.available);
check('pickup slots generated', slots.json.data?.length > 0);
check('an available slot exists', Boolean(openSlot));
console.log(`       ${slots.json.data?.length} slots, first available ${openSlot?.startTime}-${openSlot?.endTime}`);

const pastOrder = await call('POST', '/customers/orders', {
  token: customerToken,
  body: { pickupDate: '2020-01-01', pickupStartTime: openSlot.startTime, paymentMode: 'CASH' },
});
check('past pickup date rejected', pastOrder.status >= 400, JSON.stringify(pastOrder.json).slice(0, 140));

const badSlot = await call('POST', '/customers/orders', {
  token: customerToken,
  body: { pickupDate: tomorrow, pickupStartTime: '03:00', paymentMode: 'CASH' },
});
check('slot outside business hours rejected', badSlot.status >= 400, JSON.stringify(badSlot.json).slice(0, 140));

console.log('\n--- Checkout & stock reservation ---');
const before = await call('GET', `/customers/stores/${store.id}/products?limit=100`, { token: customerToken });
const beforeQty = before.json.data.find((p) => p.id === item.id)?.availableQty;

const cartNow = await call('GET', '/customers/cart', { token: customerToken });
const needsRx = cartNow.json.data?.requiresPrescription;
console.log(`       cart requires prescription: ${needsRx}`);

if (needsRx) {
  const withoutRx = await call('POST', '/customers/orders', {
    token: customerToken,
    body: { pickupDate: tomorrow, pickupStartTime: openSlot.startTime, paymentMode: 'CASH' },
  });
  check('Rx order blocked without a prescription', withoutRx.status === 400, JSON.stringify(withoutRx.json).slice(0, 140));
}

const order = await call('POST', '/customers/orders', {
  token: customerToken,
  body: {
    pickupDate: tomorrow,
    pickupStartTime: openSlot.startTime,
    paymentMode: 'CASH',
    customerNote: 'E2E test order',
    ...(needsRx ? { prescriptionUrl: 'http://localhost:5000/uploads/prescriptions/e2e-test.pdf' } : {}),
  },
});
check('order placed', order.status === 201, JSON.stringify(order.json).slice(0, 300));
const orderId = order.json.data?.id;
console.log(`       ${order.json.data?.orderNumber} total ₹${order.json.data?.totalAmount} pickup ${order.json.data?.pickupStart}`);
const allocs = order.json.data?.items?.[0]?.allocations ?? [];
console.log(`       FEFO allocation: ${allocs.map((a) => `${a.batch.batchNumber} x${a.quantity} (exp ${String(a.batch.expiryDate).slice(0, 10)})`).join(', ')}`);
check('stock allocated batch-wise', allocs.length > 0);

const after = await call('GET', `/customers/stores/${store.id}/products?limit=100`, { token: customerToken });
const afterQty = after.json.data.find((p) => p.id === item.id)?.availableQty;
check('available stock dropped by ordered qty', beforeQty - afterQty === 3, `before=${beforeQty} after=${afterQty}`);

console.log('\n--- Retailer order lifecycle ---');
const retailerOrders = await call('GET', '/retailer/orders?active=true', { token: retailerToken });
check('store sees the order', retailerOrders.json.data?.some((o) => o.id === orderId));

for (const status of ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED']) {
  const res = await call('PATCH', `/retailer/orders/${orderId}/status`, { token: retailerToken, body: { status } });
  check(`status -> ${status}`, res.status === 200, JSON.stringify(res.json).slice(0, 160));
}

const badTransition = await call('PATCH', `/retailer/orders/${orderId}/status`, { token: retailerToken, body: { status: 'ACCEPTED' } });
check('invalid status transition rejected', badTransition.status >= 400);

const finalOrder = await call('GET', `/retailer/orders/${orderId}`, { token: retailerToken });
check('order completed', finalOrder.json.data?.status === 'COMPLETED');
check('fulfilled qty recorded', finalOrder.json.data?.items?.[0]?.fulfilledQty === 3);

const txns = await call('GET', `/retailer/inventory/transactions?referenceId=${orderId}`, { token: retailerToken });
const types = txns.json.data?.map((t) => t.type) ?? [];
check('reservation + sale transactions written', types.includes('ORDER_RESERVATION') && types.includes('SALE'), types.join(','));

console.log('\n--- Cancellation releases stock ---');
const products2 = await call('GET', `/customers/stores/${store.id}/products?limit=100`, { token: customerToken });
const item2 = products2.json.data.find((p) => p.availableQty > 5);
const qtyBeforeCancel = item2.availableQty;
await call('POST', '/customers/cart/items', { token: customerToken, body: { retailerProductId: item2.id, quantity: 2, replaceCart: true } });
const slots2 = await call('GET', `/customers/stores/${store.id}/pickup-slots?date=${tomorrow}`, { token: customerToken });
const slot2 = slots2.json.data.find((s) => s.available);
const cart2 = await call('GET', '/customers/cart', { token: customerToken });
const order2 = await call('POST', '/customers/orders', {
  token: customerToken,
  body: {
    pickupDate: tomorrow,
    pickupStartTime: slot2.startTime,
    paymentMode: 'CASH',
    ...(cart2.json.data?.requiresPrescription
      ? { prescriptionUrl: 'http://localhost:5000/uploads/prescriptions/e2e-test.pdf' }
      : {}),
  },
});
check('second order placed', order2.status === 201, JSON.stringify(order2.json).slice(0, 200));

const cancel = await call('POST', `/customers/orders/${order2.json.data.id}/cancel`, {
  token: customerToken,
  body: { reason: 'Changed my mind' },
});
check('customer cancelled the order', cancel.status === 200, JSON.stringify(cancel.json).slice(0, 160));

const products3 = await call('GET', `/customers/stores/${store.id}/products?limit=100`, { token: customerToken });
const qtyAfterCancel = products3.json.data.find((p) => p.id === item2.id)?.availableQty;
check('stock released back', qtyAfterCancel === qtyBeforeCancel, `before=${qtyBeforeCancel} after=${qtyAfterCancel}`);

console.log('\n--- Wholesale: retailer -> vendor ---');
const vendorProducts = await call('GET', '/retailer/vendor-products?limit=3', { token: retailerToken });
check('retailer browses vendor products', vendorProducts.json.data?.length > 0);

const vendorId = vendorProducts.json.data[0].vendorId;
const sameVendor = vendorProducts.json.data.filter((vp) => vp.vendorId === vendorId).slice(0, 2);

// Below the vendor's minimum order value the platform must refuse the order.
const tooSmall = await call('POST', '/retailer/purchases', {
  token: retailerToken,
  body: { vendorId, items: [{ vendorProductId: sameVendor[0].id, quantity: 10 }] },
});
check('minimum order value enforced', tooSmall.status === 400, JSON.stringify(tooSmall.json).slice(0, 140));

const belowMoq = await call('POST', '/retailer/purchases', {
  token: retailerToken,
  body: { vendorId, items: [{ vendorProductId: sameVendor[0].id, quantity: 1 }] },
});
check('minimum order quantity enforced', belowMoq.status === 400, JSON.stringify(belowMoq.json).slice(0, 140));

const poItems = sameVendor.map((vp) => ({ vendorProductId: vp.id, quantity: 100 }));
const po = await call('POST', '/retailer/purchases', {
  token: retailerToken,
  body: { vendorId, items: poItems },
});
check('purchase order placed', po.status === 201, JSON.stringify(po.json).slice(0, 250));
const poId = po.json.data?.id;
console.log(`       ${po.json.data?.poNumber} total ₹${po.json.data?.totalAmount}`);

const accept = await call('POST', `/vendor/orders/${poId}/accept`, { token: vendorToken, body: {} });
check('vendor accepted', accept.status === 200, JSON.stringify(accept.json).slice(0, 160));

await call('PATCH', `/vendor/orders/${poId}/status`, { token: vendorToken, body: { status: 'PROCESSING' } });
await call('PATCH', `/vendor/orders/${poId}/status`, { token: vendorToken, body: { status: 'READY_FOR_DELIVERY' } });

const expiry = new Date();
expiry.setFullYear(expiry.getFullYear() + 2);
const dispatch = await call('POST', `/vendor/orders/${poId}/dispatch`, {
  token: vendorToken,
  body: {
    courierName: 'BlueDart',
    trackingNumber: 'BD123456',
    items: accept.json.data.items.map((i) => ({
      itemId: i.id,
      batchNumber: `DISP-${i.id.slice(0, 4)}`,
      expiryDate: expiry.toISOString().slice(0, 10),
    })),
  },
});
check('vendor dispatched (stock out + invoice)', dispatch.status === 200, JSON.stringify(dispatch.json).slice(0, 200));

const receive = await call('POST', `/retailer/purchases/${poId}/receive`, {
  token: retailerToken,
  body: {
    items: accept.json.data.items.map((i) => ({
      itemId: i.id,
      receivedQty: i.acceptedQty,
      freeQty: 0,
      batchNumber: `RCV-${i.id.slice(0, 4)}`,
      expiryDate: expiry.toISOString().slice(0, 10),
      purchasePrice: Number(i.unitPrice),
      mrp: Number(i.mrp),
      sellingPrice: Number(i.mrp),
    })),
  },
});
check('retailer received stock', receive.status === 200, JSON.stringify(receive.json).slice(0, 250));

const payment = await call('POST', `/retailer/purchases/${poId}/payments`, {
  token: retailerToken,
  body: { amount: Number(po.json.data.totalAmount), mode: 'BANK_TRANSFER', referenceNo: 'NEFT-001' },
});
check('payment recorded', payment.status === 201, JSON.stringify(payment.json).slice(0, 160));

const poAfter = await call('GET', `/retailer/purchases/${poId}`, { token: retailerToken });
check('purchase order marked paid', poAfter.json.data?.paymentStatus === 'PAID');

console.log('\n--- Inventory & expiry reporting ---');
const expirySummary = await call('GET', '/retailer/inventory/expiry-summary', { token: retailerToken });
const buckets = expirySummary.json.data?.buckets ?? [];
check('expiry buckets returned', buckets.length === 3, JSON.stringify(expirySummary.json.data));
console.log(`       expired=${expirySummary.json.data?.expired?.batches} 30d=${buckets[0]?.batches} 60d=${buckets[1]?.batches} 90d=${buckets[2]?.batches} value at risk ₹${expirySummary.json.data?.stockValueAtRisk}`);

const valuation = await call('GET', '/retailer/inventory/valuation', { token: retailerToken });
check('stock valuation computed', valuation.json.data?.costValue > 0);
console.log(`       units=${valuation.json.data?.totalUnits} cost=₹${valuation.json.data?.costValue} mrp=₹${valuation.json.data?.mrpValue}`);

const dashRetailer = await call('GET', '/retailer/dashboard', { token: retailerToken });
check('retailer dashboard', dashRetailer.status === 200 && dashRetailer.json.data?.cards?.todaysSales >= 0);
console.log(`       today's sales ₹${dashRetailer.json.data?.cards?.todaysSales}, orders ${dashRetailer.json.data?.cards?.todaysOrders}`);

const dashVendor = await call('GET', '/vendor/dashboard', { token: vendorToken });
check('vendor dashboard', dashVendor.status === 200);

console.log('\n--- Access control ---');
const crossTenant = await call('GET', '/retailer/profile', { token: vendorToken });
check('vendor cannot use retailer endpoints', crossTenant.status === 403);

const noAuth = await call('GET', '/admin/dashboard');
check('unauthenticated admin access blocked', noAuth.status === 401);

const customerToAdmin = await call('GET', '/admin/users', { token: customerToken });
check('customer cannot reach admin endpoints', customerToAdmin.status === 403);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
