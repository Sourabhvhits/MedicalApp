/* eslint-disable no-console */
/**
 * Demo data: one approved vendor, two approved medical shops, one customer,
 * catalogues, batch-wise stock and pickup configuration.
 *
 * Run with: npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const PASSWORD = 'Demo@12345';

const STORES = [
  {
    email: 'shop1@medsaas.test',
    phone: '9800000001',
    storeName: 'Apollo Medical Store',
    owner: 'Rahul Sharma',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    latitude: 18.5204,
    longitude: 73.8567,
    gst: '27AABCU9603R1ZX',
  },
  {
    email: 'shop2@medsaas.test',
    phone: '9800000002',
    storeName: 'LifeCare Chemists',
    owner: 'Priya Patil',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411014',
    latitude: 18.5626,
    longitude: 73.9165,
    gst: '27AACCL1234M1Z5',
  },
];

function futureDate(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function main(): Promise<void> {
  console.log('Seeding demo marketplace data...');
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const roles = await prisma.role.findMany({ select: { id: true, slug: true } });
  const roleBySlug = new Map(roles.map((role) => [role.slug, role.id]));

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, mrp: true, gstRate: true },
    take: 20,
  });
  if (products.length === 0) throw new Error('Run `npm run seed` first — no master products found');

  // -------------------------------------------------------------------------
  // Vendor
  // -------------------------------------------------------------------------
  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor1@medsaas.test' },
    update: {},
    create: {
      email: 'vendor1@medsaas.test',
      phone: '9700000001',
      passwordHash,
      firstName: 'Vikram',
      lastName: 'Mehta',
      userType: 'VENDOR',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      roles: { create: { roleId: roleBySlug.get('vendor')! } },
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: { approvalStatus: 'APPROVED', isActive: true },
    create: {
      userId: vendorUser.id,
      code: 'VEN-DEMO01',
      businessName: 'MediSupply Wholesale Pvt Ltd',
      legalName: 'MediSupply Wholesale Private Limited',
      contactPerson: 'Vikram Mehta',
      email: 'vendor1@medsaas.test',
      phone: '9700000001',
      gstNumber: '27AAACM1234A1Z7',
      drugLicenseNumber: 'MH-PUN-20B-123456',
      drugLicenseExpiry: futureDate(24),
      addressLine1: 'Plot 42, MIDC Industrial Area',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411019',
      latitude: 18.6298,
      longitude: 73.7997,
      minOrderValue: 2000,
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      isActive: true,
    },
  });

  const vendorWarehouse = await prisma.warehouse.upsert({
    where: { vendorId_code: { vendorId: vendor.id, code: 'MAIN' } },
    update: {},
    create: {
      ownerType: 'VENDOR',
      vendorId: vendor.id,
      name: 'MediSupply — Main Warehouse',
      code: 'MAIN',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411019',
      isDefault: true,
    },
  });

  let vendorBatches = 0;
  for (const [index, product] of products.entries()) {
    const mrp = Number(product.mrp);
    const purchasePrice = Number((mrp * 0.6).toFixed(2));
    const sellingPrice = Number((mrp * 0.75).toFixed(2));

    await prisma.vendorProduct.upsert({
      where: { vendorId_productId: { vendorId: vendor.id, productId: product.id } },
      update: { sellingPrice, purchasePrice, mrp, gstRate: product.gstRate },
      create: {
        vendorId: vendor.id,
        productId: product.id,
        purchasePrice,
        sellingPrice,
        mrp,
        gstRate: product.gstRate,
        minOrderQty: 10,
        packQty: 10,
        status: 'ACTIVE',
      },
    });

    // Two batches with different expiries so FEFO has something to choose.
    for (const [batchIndex, months] of [14, 26].entries()) {
      const batchNumber = `VB${String(index + 1).padStart(3, '0')}-${batchIndex + 1}`;
      const quantity = 500 - batchIndex * 200;

      await prisma.inventoryBatch.upsert({
        where: {
          warehouseId_productId_batchNumber: {
            warehouseId: vendorWarehouse.id,
            productId: product.id,
            batchNumber,
          },
        },
        update: { quantity },
        create: {
          warehouseId: vendorWarehouse.id,
          productId: product.id,
          ownerType: 'VENDOR',
          vendorId: vendor.id,
          batchNumber,
          quantity,
          purchasePrice,
          sellingPrice,
          mrp,
          gstRate: product.gstRate,
          expiryDate: futureDate(months),
          status: 'ACTIVE',
        },
      });
      vendorBatches += 1;
    }

    const total = await prisma.inventoryBatch.aggregate({
      where: { warehouseId: vendorWarehouse.id, productId: product.id },
      _sum: { quantity: true, freeQuantity: true, reservedQty: true },
    });
    const totalQty = (total._sum.quantity ?? 0) + (total._sum.freeQuantity ?? 0);

    await prisma.inventory.upsert({
      where: { warehouseId_productId: { warehouseId: vendorWarehouse.id, productId: product.id } },
      update: { totalQty, availableQty: totalQty - (total._sum.reservedQty ?? 0) },
      create: {
        warehouseId: vendorWarehouse.id,
        productId: product.id,
        totalQty,
        availableQty: totalQty - (total._sum.reservedQty ?? 0),
      },
    });
  }
  console.log(`  vendor: ${vendor.businessName} (${products.length} products, ${vendorBatches} batches)`);

  // -------------------------------------------------------------------------
  // Retailers
  // -------------------------------------------------------------------------
  for (const [storeIndex, store] of STORES.entries()) {
    const user = await prisma.user.upsert({
      where: { email: store.email },
      update: {},
      create: {
        email: store.email,
        phone: store.phone,
        passwordHash,
        firstName: store.owner.split(' ')[0],
        lastName: store.owner.split(' ')[1],
        userType: 'RETAILER',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        roles: { create: { roleId: roleBySlug.get('retailer')! } },
      },
    });

    const retailer = await prisma.retailer.upsert({
      where: { userId: user.id },
      update: { approvalStatus: 'APPROVED', isActive: true },
      create: {
        userId: user.id,
        code: `RET-DEMO0${storeIndex + 1}`,
        storeName: store.storeName,
        ownerName: store.owner,
        email: store.email,
        phone: store.phone,
        gstNumber: store.gst,
        drugLicenseNumber: `MH-PUN-21B-00${storeIndex + 1}`,
        drugLicenseExpiry: futureDate(30),
        description: `${store.storeName} — trusted neighbourhood pharmacy`,
        addressLine1: `Shop ${storeIndex + 1}, Main Road`,
        city: store.city,
        state: store.state,
        pincode: store.pincode,
        latitude: store.latitude,
        longitude: store.longitude,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        isActive: true,
      },
    });

    await prisma.pickupSlotConfig.upsert({
      where: { retailerId: retailer.id },
      update: { isEnabled: true, slotDurationMins: 30, maxOrdersPerSlot: 10, bufferMins: 60, advanceDays: 7 },
      create: {
        retailerId: retailer.id,
        slotDurationMins: 30,
        maxOrdersPerSlot: 10,
        bufferMins: 60,
        advanceDays: 7,
      },
    });

    for (let day = 0; day < 7; day += 1) {
      await prisma.storeBusinessHour.upsert({
        where: { retailerId_dayOfWeek: { retailerId: retailer.id, dayOfWeek: day } },
        update: {},
        create: {
          retailerId: retailer.id,
          dayOfWeek: day,
          isClosed: false,
          openTime: day === 0 ? '10:00' : '09:00',
          closeTime: day === 0 ? '18:00' : '22:00',
        },
      });
    }

    const warehouse = await prisma.warehouse.upsert({
      where: { retailerId_code: { retailerId: retailer.id, code: 'STORE' } },
      update: {},
      create: {
        ownerType: 'RETAILER',
        retailerId: retailer.id,
        name: `${store.storeName} — Store`,
        code: 'STORE',
        city: store.city,
        state: store.state,
        pincode: store.pincode,
        isDefault: true,
      },
    });

    // Each store stocks a different, overlapping slice of the catalogue.
    const storeProducts = products.filter((_, index) => index % 2 === storeIndex % 2 || index < 8);

    for (const [index, product] of storeProducts.entries()) {
      const mrp = Number(product.mrp);
      const sellingPrice = Number((mrp * (storeIndex === 0 ? 0.92 : 0.95)).toFixed(2));

      await prisma.retailerProduct.upsert({
        where: { retailerId_productId: { retailerId: retailer.id, productId: product.id } },
        update: { sellingPrice, mrp, gstRate: product.gstRate },
        create: {
          retailerId: retailer.id,
          productId: product.id,
          sellingPrice,
          mrp,
          gstRate: product.gstRate,
          discountPct: 0,
          minStockAlert: 15,
          maxOrderQty: 20,
          status: 'ACTIVE',
        },
      });

      // A near-expiry batch on a few lines so expiry reports have data.
      const batches =
        index % 5 === 0
          ? [
              { suffix: 'A', months: 1, qty: 12 },
              { suffix: 'B', months: 18, qty: 60 },
            ]
          : [{ suffix: 'A', months: 20, qty: 80 }];

      for (const batch of batches) {
        const batchNumber = `RB${String(index + 1).padStart(3, '0')}${batch.suffix}`;
        await prisma.inventoryBatch.upsert({
          where: {
            warehouseId_productId_batchNumber: {
              warehouseId: warehouse.id,
              productId: product.id,
              batchNumber,
            },
          },
          update: { quantity: batch.qty },
          create: {
            warehouseId: warehouse.id,
            productId: product.id,
            ownerType: 'RETAILER',
            retailerId: retailer.id,
            batchNumber,
            quantity: batch.qty,
            purchasePrice: Number((mrp * 0.7).toFixed(2)),
            sellingPrice,
            mrp,
            gstRate: product.gstRate,
            expiryDate: futureDate(batch.months),
            supplierName: vendor.businessName,
            supplierVendorId: vendor.id,
            status: 'ACTIVE',
          },
        });
      }

      const total = await prisma.inventoryBatch.aggregate({
        where: { warehouseId: warehouse.id, productId: product.id, status: 'ACTIVE' },
        _sum: { quantity: true, freeQuantity: true, reservedQty: true },
      });
      const totalQty = (total._sum.quantity ?? 0) + (total._sum.freeQuantity ?? 0);

      await prisma.inventory.upsert({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
        update: { totalQty, availableQty: totalQty - (total._sum.reservedQty ?? 0), minStockAlert: 15 },
        create: {
          warehouseId: warehouse.id,
          productId: product.id,
          totalQty,
          availableQty: totalQty - (total._sum.reservedQty ?? 0),
          minStockAlert: 15,
        },
      });
    }

    console.log(`  store: ${store.storeName} (${storeProducts.length} products)`);
  }

  // -------------------------------------------------------------------------
  // Customer
  // -------------------------------------------------------------------------
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer1@medsaas.test' },
    update: {},
    create: {
      email: 'customer1@medsaas.test',
      phone: '9600000001',
      passwordHash,
      firstName: 'Aarti',
      lastName: 'Desai',
      userType: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      roles: { create: { roleId: roleBySlug.get('customer')! } },
    },
  });

  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: {
      userId: customerUser.id,
      code: 'CUS-DEMO01',
      latitude: 18.5314,
      longitude: 73.8446,
    },
  });

  await prisma.customerAddress.createMany({
    data: [
      {
        customerId: customer.id,
        label: 'Home',
        contactName: 'Aarti Desai',
        contactPhone: '9600000001',
        addressLine1: 'Flat 302, Sunrise Residency',
        landmark: 'Near City Hospital',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411004',
        latitude: 18.5314,
        longitude: 73.8446,
        isDefault: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log('  customer: Aarti Desai (customer1@medsaas.test)');

  console.log('\nDemo accounts (password for all: Demo@12345)');
  console.log('  vendor   : vendor1@medsaas.test');
  console.log('  retailer : shop1@medsaas.test / shop2@medsaas.test');
  console.log('  customer : customer1@medsaas.test');
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
