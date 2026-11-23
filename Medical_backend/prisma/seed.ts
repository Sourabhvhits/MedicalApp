/* eslint-disable no-console */
import { PrismaClient, type UserType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PERMISSION_LIST, ROLE_PERMISSIONS } from '../src/config/permissions';

dotenv.config();

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@medsaas.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '9000000001';

const ROLES: { name: string; slug: string; scope: UserType; description: string }[] = [
  { name: 'Super Admin', slug: 'super-admin', scope: 'SUPER_ADMIN', description: 'Full platform access' },
  { name: 'Admin Staff', slug: 'admin-staff', scope: 'ADMIN_STAFF', description: 'Platform operations staff' },
  { name: 'Vendor', slug: 'vendor', scope: 'VENDOR', description: 'Wholesaler account' },
  { name: 'Vendor Staff', slug: 'vendor-staff', scope: 'VENDOR', description: 'Invited staff on a wholesaler account' },
  { name: 'Retailer', slug: 'retailer', scope: 'RETAILER', description: 'Medical shop account' },
  { name: 'Retailer Staff', slug: 'retailer-staff', scope: 'RETAILER', description: 'Invited staff on a medical shop account' },
  { name: 'Customer', slug: 'customer', scope: 'CUSTOMER', description: 'End customer account' },
];

const CATEGORIES: { name: string; subCategories: string[] }[] = [
  { name: 'Tablets', subCategories: ['Pain Relief', 'Antibiotics', 'Antacids', 'Vitamins'] },
  { name: 'Capsules', subCategories: ['Antibiotics', 'Supplements'] },
  { name: 'Syrups', subCategories: ['Cough & Cold', 'Digestive', 'Paediatric'] },
  { name: 'Injections', subCategories: ['Antibiotics', 'Insulin', 'Vaccines'] },
  { name: 'Creams', subCategories: ['Antifungal', 'Antiseptic'] },
  { name: 'Ointments', subCategories: ['Pain Relief', 'Wound Care'] },
  { name: 'Drops', subCategories: ['Eye Drops', 'Ear Drops', 'Nasal Drops'] },
  { name: 'Medical Devices', subCategories: ['Thermometers', 'BP Monitors', 'Glucometers', 'Nebulizers'] },
  { name: 'Surgical Products', subCategories: ['Dressings', 'Gloves', 'Syringes', 'Masks'] },
  { name: 'Personal Care', subCategories: ['Skin Care', 'Oral Care', 'Hair Care'] },
  { name: 'Baby Care', subCategories: ['Diapers', 'Baby Food', 'Baby Skin Care'] },
  { name: 'Healthcare Products', subCategories: ['Supplements', 'Ayurvedic', 'Fitness'] },
];

const UNITS = [
  { name: 'Strip', code: 'STRIP' },
  { name: 'Bottle', code: 'BOTTLE' },
  { name: 'Box', code: 'BOX' },
  { name: 'Piece', code: 'PCS' },
  { name: 'Tube', code: 'TUBE' },
  { name: 'Vial', code: 'VIAL' },
  { name: 'Packet', code: 'PACKET' },
  { name: 'Kit', code: 'KIT' },
];

const MANUFACTURERS = [
  { name: 'Sun Pharmaceutical Industries', code: 'SUNPHARMA' },
  { name: 'Cipla Limited', code: 'CIPLA' },
  { name: "Dr. Reddy's Laboratories", code: 'DRREDDY' },
  { name: 'Lupin Limited', code: 'LUPIN' },
  { name: 'Mankind Pharma', code: 'MANKIND' },
  { name: 'Abbott India', code: 'ABBOTT' },
  { name: 'GlaxoSmithKline Pharmaceuticals', code: 'GSK' },
  { name: 'Torrent Pharmaceuticals', code: 'TORRENT' },
  { name: 'Alkem Laboratories', code: 'ALKEM' },
  { name: 'Zydus Lifesciences', code: 'ZYDUS' },
];

const SETTINGS = [
  { key: 'platform.name', value: 'Medical Marketplace', group: 'general', label: 'Platform name', isPublic: true },
  { key: 'platform.support_email', value: 'support@medsaas.test', group: 'general', label: 'Support email', isPublic: true },
  { key: 'platform.support_phone', value: '1800-000-0000', group: 'general', label: 'Support phone', isPublic: true },
  { key: 'order.default_search_radius_km', value: '5', group: 'order', dataType: 'number', label: 'Default store search radius (km)', isPublic: true },
  { key: 'order.max_search_radius_km', value: '50', group: 'order', dataType: 'number', label: 'Maximum store search radius (km)', isPublic: true },
  { key: 'order.auto_expire_hours', value: '24', group: 'order', dataType: 'number', label: 'Auto-expire unaccepted orders after (hours)' },
  { key: 'order.allow_customer_cancel', value: 'true', group: 'order', dataType: 'boolean', label: 'Allow customers to cancel orders' },
  { key: 'inventory.policy', value: 'FEFO', group: 'inventory', label: 'Stock consumption policy' },
  { key: 'inventory.block_expired_sale', value: 'true', group: 'inventory', dataType: 'boolean', label: 'Block sale of expired batches' },
  { key: 'inventory.expiry_alert_days', value: '30,60,90', group: 'inventory', label: 'Expiry alert buckets (days)' },
  { key: 'tax.retail_price_inclusive', value: 'true', group: 'tax', dataType: 'boolean', label: 'Retail selling price includes GST' },
  { key: 'tax.wholesale_price_inclusive', value: 'false', group: 'tax', dataType: 'boolean', label: 'Wholesale selling price includes GST' },
  { key: 'security.rate_limit.global_max', value: '1000', group: 'security', dataType: 'number', label: 'Max requests per 15 min, per IP (all endpoints)' },
  { key: 'security.rate_limit.auth_max', value: '20', group: 'security', dataType: 'number', label: 'Max login/register/reset attempts per 15 min, per IP' },
  { key: 'security.rate_limit.otp_max', value: '5', group: 'security', dataType: 'number', label: 'Max OTP requests per 10 min, per IP' },
  { key: 'security.ip_allow_list', value: '', group: 'security', label: 'IP addresses exempt from rate limiting (comma-separated)' },
];

/** Common Indian GST slabs applied to medicines and devices. */
const PRODUCTS = [
  { name: 'Paracetamol 500mg', generic: 'Paracetamol', brand: 'Calpol', category: 'Tablets', sub: 'Pain Relief', mfr: 'GSK', strength: '500mg', pack: '15 Tablets', unit: 'STRIP', mrp: 30.5, gst: 12, hsn: '30049099', rx: false },
  { name: 'Azithromycin 500mg', generic: 'Azithromycin', brand: 'Azithral', category: 'Tablets', sub: 'Antibiotics', mfr: 'ALKEM', strength: '500mg', pack: '5 Tablets', unit: 'STRIP', mrp: 118.0, gst: 12, hsn: '30042019', rx: true },
  { name: 'Pantoprazole 40mg', generic: 'Pantoprazole', brand: 'Pantocid', category: 'Tablets', sub: 'Antacids', mfr: 'SUNPHARMA', strength: '40mg', pack: '15 Tablets', unit: 'STRIP', mrp: 145.0, gst: 12, hsn: '30049099', rx: true },
  { name: 'Amoxicillin 500mg', generic: 'Amoxicillin', brand: 'Mox', category: 'Capsules', sub: 'Antibiotics', mfr: 'CIPLA', strength: '500mg', pack: '10 Capsules', unit: 'STRIP', mrp: 98.5, gst: 12, hsn: '30041019', rx: true },
  { name: 'Vitamin D3 60000 IU', generic: 'Cholecalciferol', brand: 'Uprise D3', category: 'Capsules', sub: 'Supplements', mfr: 'ALKEM', strength: '60000 IU', pack: '4 Capsules', unit: 'STRIP', mrp: 89.0, gst: 12, hsn: '30045090', rx: false },
  { name: 'Cough Syrup 100ml', generic: 'Dextromethorphan', brand: 'Benadryl', category: 'Syrups', sub: 'Cough & Cold', mfr: 'GSK', strength: '100ml', pack: '100 ml Bottle', unit: 'BOTTLE', mrp: 135.0, gst: 12, hsn: '30049011', rx: false },
  { name: 'ORS Powder', generic: 'Oral Rehydration Salts', brand: 'Electral', category: 'Healthcare Products', sub: 'Supplements', mfr: 'ABBOTT', strength: '21.8g', pack: '21.8 g Sachet', unit: 'PACKET', mrp: 22.0, gst: 12, hsn: '30049099', rx: false },
  { name: 'Insulin Glargine 100IU', generic: 'Insulin Glargine', brand: 'Lantus', category: 'Injections', sub: 'Insulin', mfr: 'ABBOTT', strength: '100 IU/ml', pack: '3 ml Cartridge', unit: 'VIAL', mrp: 850.0, gst: 5, hsn: '30043110', rx: true },
  { name: 'Clotrimazole Cream 15g', generic: 'Clotrimazole', brand: 'Candid', category: 'Creams', sub: 'Antifungal', mfr: 'TORRENT', strength: '1%', pack: '15 g Tube', unit: 'TUBE', mrp: 78.0, gst: 12, hsn: '30049099', rx: false },
  { name: 'Povidone Iodine Ointment 15g', generic: 'Povidone Iodine', brand: 'Betadine', category: 'Ointments', sub: 'Wound Care', mfr: 'ABBOTT', strength: '5%', pack: '15 g Tube', unit: 'TUBE', mrp: 96.0, gst: 12, hsn: '30049099', rx: false },
  { name: 'Moxifloxacin Eye Drops 5ml', generic: 'Moxifloxacin', brand: 'Vigamox', category: 'Drops', sub: 'Eye Drops', mfr: 'ZYDUS', strength: '0.5%', pack: '5 ml Bottle', unit: 'BOTTLE', mrp: 165.0, gst: 12, hsn: '30049099', rx: true },
  { name: 'Digital Thermometer', generic: 'Thermometer', brand: 'Dr Morepen', category: 'Medical Devices', sub: 'Thermometers', mfr: 'MANKIND', strength: '-', pack: '1 Unit', unit: 'PCS', mrp: 199.0, gst: 12, hsn: '90251110', rx: false },
  { name: 'Digital BP Monitor', generic: 'Blood Pressure Monitor', brand: 'Omron', category: 'Medical Devices', sub: 'BP Monitors', mfr: 'MANKIND', strength: '-', pack: '1 Unit', unit: 'PCS', mrp: 2199.0, gst: 12, hsn: '90183090', rx: false },
  { name: 'Glucometer Strips (50)', generic: 'Glucose Test Strips', brand: 'Accu-Chek', category: 'Medical Devices', sub: 'Glucometers', mfr: 'ABBOTT', strength: '-', pack: '50 Strips', unit: 'BOX', mrp: 1150.0, gst: 12, hsn: '38220090', rx: false },
  { name: 'Surgical Face Mask (50)', generic: 'Face Mask', brand: 'MediGuard', category: 'Surgical Products', sub: 'Masks', mfr: 'LUPIN', strength: '3 Ply', pack: '50 Pieces', unit: 'BOX', mrp: 250.0, gst: 5, hsn: '63079090', rx: false },
  { name: 'Disposable Syringe 5ml (100)', generic: 'Syringe', brand: 'Dispo Van', category: 'Surgical Products', sub: 'Syringes', mfr: 'LUPIN', strength: '5 ml', pack: '100 Pieces', unit: 'BOX', mrp: 560.0, gst: 12, hsn: '90183100', rx: false },
  { name: 'Cotton Roll 500g', generic: 'Absorbent Cotton', brand: 'MediCare', category: 'Surgical Products', sub: 'Dressings', mfr: 'LUPIN', strength: '500g', pack: '1 Roll', unit: 'PCS', mrp: 185.0, gst: 12, hsn: '30059090', rx: false },
  { name: 'Examination Gloves (100)', generic: 'Nitrile Gloves', brand: 'SafeTouch', category: 'Surgical Products', sub: 'Gloves', mfr: 'LUPIN', strength: 'Medium', pack: '100 Pieces', unit: 'BOX', mrp: 650.0, gst: 12, hsn: '40151900', rx: false },
  { name: 'Baby Diapers Medium (46)', generic: 'Baby Diapers', brand: 'Pampers', category: 'Baby Care', sub: 'Diapers', mfr: 'ABBOTT', strength: 'Medium', pack: '46 Pieces', unit: 'PACKET', mrp: 799.0, gst: 12, hsn: '96190010', rx: false },
  { name: 'Moisturising Lotion 200ml', generic: 'Moisturiser', brand: 'Cetaphil', category: 'Personal Care', sub: 'Skin Care', mfr: 'DRREDDY', strength: '200ml', pack: '200 ml Bottle', unit: 'BOTTLE', mrp: 545.0, gst: 18, hsn: '33049990', rx: false },
];

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function seedPermissionsAndRoles(): Promise<void> {
  for (const permission of PERMISSION_LIST) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }
  console.log(`  permissions: ${PERMISSION_LIST.length}`);

  for (const role of ROLES) {
    const saved = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description, scope: role.scope },
      create: { ...role, isSystem: true },
    });

    const codes = ROLE_PERMISSIONS[role.slug] ?? [];
    const permissions = await prisma.permission.findMany({
      where: { code: { in: codes as string[] } },
      select: { id: true },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: saved.id, permissionId: p.id })),
      });
    }
  }
  console.log(`  roles: ${ROLES.length}`);
}

async function seedSuperAdmin(): Promise<void> {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { status: 'ACTIVE', userType: 'SUPER_ADMIN' },
    create: {
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      userType: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });

  const role = await prisma.role.findUnique({ where: { slug: 'super-admin' } });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: role.id } },
      update: {},
      create: { userId: admin.id, roleId: role.id },
    });
  }
  console.log(`  super admin: ${ADMIN_EMAIL}`);
}

async function seedMasters(): Promise<void> {
  for (const [index, unit] of UNITS.entries()) {
    await prisma.productUnit.upsert({
      where: { code: unit.code },
      update: { name: unit.name },
      create: { ...unit },
    });
    void index;
  }
  console.log(`  units: ${UNITS.length}`);

  for (const manufacturer of MANUFACTURERS) {
    await prisma.manufacturer.upsert({
      where: { code: manufacturer.code },
      update: { name: manufacturer.name },
      create: { ...manufacturer, status: 'ACTIVE' },
    });
  }
  console.log(`  manufacturers: ${MANUFACTURERS.length}`);

  let subCount = 0;
  for (const [index, category] of CATEGORIES.entries()) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: slugify(category.name) },
      update: { name: category.name, sortOrder: index },
      create: { name: category.name, slug: slugify(category.name), sortOrder: index, status: 'ACTIVE' },
    });

    for (const [subIndex, sub] of category.subCategories.entries()) {
      await prisma.subCategory.upsert({
        where: { slug: slugify(`${category.name}-${sub}`) },
        update: { name: sub, sortOrder: subIndex },
        create: {
          categoryId: savedCategory.id,
          name: sub,
          slug: slugify(`${category.name}-${sub}`),
          sortOrder: subIndex,
          status: 'ACTIVE',
        },
      });
      subCount += 1;
    }
  }
  console.log(`  categories: ${CATEGORIES.length} (sub-categories: ${subCount})`);

  for (const setting of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, label: setting.label ?? null },
      create: {
        key: setting.key,
        value: setting.value,
        group: setting.group,
        dataType: setting.dataType ?? 'string',
        label: setting.label ?? null,
        isPublic: setting.isPublic ?? false,
      },
    });
  }
  console.log(`  settings: ${SETTINGS.length}`);
}

// Today's hardcoded per-page lists (vendor/profile & retailer/store), moved to
// admin-configurable rows (TASKS.md #20a). DRUG_LICENSE/GST_CERTIFICATE are
// seeded required since both businesses already carry dedicated
// drugLicenseNumber/gstNumber identity fields; everything else that was
// already offered is seeded optional so nothing breaks on rollout, and
// document types neither page offered today are seeded inactive.
const KYC_REQUIREMENTS: { ownerType: 'VENDOR' | 'RETAILER'; documentType: string; isRequired: boolean; isActive: boolean }[] = [
  { ownerType: 'VENDOR', documentType: 'DRUG_LICENSE', isRequired: true, isActive: true },
  { ownerType: 'VENDOR', documentType: 'GST_CERTIFICATE', isRequired: true, isActive: true },
  { ownerType: 'VENDOR', documentType: 'PAN_CARD', isRequired: false, isActive: true },
  { ownerType: 'VENDOR', documentType: 'TRADE_LICENSE', isRequired: false, isActive: true },
  { ownerType: 'VENDOR', documentType: 'BANK_PROOF', isRequired: false, isActive: true },
  { ownerType: 'VENDOR', documentType: 'OTHER', isRequired: false, isActive: true },
  { ownerType: 'VENDOR', documentType: 'AADHAAR', isRequired: false, isActive: false },
  { ownerType: 'VENDOR', documentType: 'SHOP_ESTABLISHMENT', isRequired: false, isActive: false },
  { ownerType: 'VENDOR', documentType: 'OWNER_PHOTO', isRequired: false, isActive: false },
  { ownerType: 'VENDOR', documentType: 'STORE_PHOTO', isRequired: false, isActive: false },
  { ownerType: 'RETAILER', documentType: 'DRUG_LICENSE', isRequired: true, isActive: true },
  { ownerType: 'RETAILER', documentType: 'GST_CERTIFICATE', isRequired: true, isActive: true },
  { ownerType: 'RETAILER', documentType: 'SHOP_ESTABLISHMENT', isRequired: false, isActive: true },
  { ownerType: 'RETAILER', documentType: 'PAN_CARD', isRequired: false, isActive: true },
  { ownerType: 'RETAILER', documentType: 'OWNER_PHOTO', isRequired: false, isActive: true },
  { ownerType: 'RETAILER', documentType: 'STORE_PHOTO', isRequired: false, isActive: true },
  { ownerType: 'RETAILER', documentType: 'OTHER', isRequired: false, isActive: true },
  { ownerType: 'RETAILER', documentType: 'AADHAAR', isRequired: false, isActive: false },
  { ownerType: 'RETAILER', documentType: 'TRADE_LICENSE', isRequired: false, isActive: false },
  { ownerType: 'RETAILER', documentType: 'BANK_PROOF', isRequired: false, isActive: false },
];

async function seedKycRequirements(): Promise<void> {
  for (const requirement of KYC_REQUIREMENTS) {
    await prisma.kycRequirement.upsert({
      where: {
        ownerType_documentType: {
          ownerType: requirement.ownerType,
          documentType: requirement.documentType as never,
        },
      },
      update: {},
      create: requirement as never,
    });
  }
  console.log(`  kyc requirements: ${KYC_REQUIREMENTS.length}`);
}

async function seedProducts(): Promise<void> {
  for (const [index, item] of PRODUCTS.entries()) {
    const category = await prisma.category.findUnique({ where: { slug: slugify(item.category) } });
    if (!category) continue;

    const subCategory = await prisma.subCategory.findUnique({
      where: { slug: slugify(`${item.category}-${item.sub}`) },
    });
    const manufacturer = await prisma.manufacturer.findUnique({ where: { code: item.mfr } });
    const unit = await prisma.productUnit.findUnique({ where: { code: item.unit } });

    const sku = `${item.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)}-${String(index + 1).padStart(6, '0')}`;

    await prisma.product.upsert({
      where: { sku },
      update: { mrp: item.mrp, gstRate: item.gst },
      create: {
        sku,
        name: item.name,
        genericName: item.generic,
        brandName: item.brand,
        categoryId: category.id,
        subCategoryId: subCategory?.id ?? null,
        manufacturerId: manufacturer?.id ?? null,
        unitId: unit?.id ?? null,
        medicineType: item.category,
        composition: `${item.generic} ${item.strength}`,
        strength: item.strength,
        dosageForm: item.category,
        packSize: item.pack,
        mrp: item.mrp,
        gstRate: item.gst,
        hsnCode: item.hsn,
        prescriptionRequired: item.rx,
        searchKeywords: `${item.name} ${item.generic} ${item.brand}`,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`  products: ${PRODUCTS.length}`);
}

async function main(): Promise<void> {
  console.log('Seeding database...');
  await seedPermissionsAndRoles();
  await seedSuperAdmin();
  await seedMasters();
  await seedKycRequirements();
  await seedProducts();
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
