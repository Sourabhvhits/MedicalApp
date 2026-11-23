-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(20) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NULL,
    `userType` ENUM('SUPER_ADMIN', 'ADMIN_STAFF', 'VENDOR', 'RETAILER', 'CUSTOMER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `avatarUrl` VARCHAR(500) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `phoneVerifiedAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_userType_status_idx`(`userType`, `status`),
    INDEX `users_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NULL,
    `scope` ENUM('SUPER_ADMIN', 'ADMIN_STAFF', 'VENDOR', 'RETAILER', 'CUSTOMER') NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    UNIQUE INDEX `roles_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `module` VARCHAR(60) NOT NULL,
    `description` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_code_key`(`code`),
    INDEX `permissions_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `roleId` CHAR(36) NOT NULL,
    `permissionId` CHAR(36) NOT NULL,

    INDEX `role_permissions_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `userId` CHAR(36) NOT NULL,
    `roleId` CHAR(36) NOT NULL,

    INDEX `user_roles_roleId_idx`(`roleId`),
    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `refreshTokenHash` VARCHAR(255) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `ipAddress` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_sessions_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `user_sessions_userId_idx`(`userId`),
    INDEX `user_sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_tokens` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(255) NOT NULL,
    `purpose` ENUM('REGISTRATION', 'LOGIN', 'FORGOT_PASSWORD', 'PHONE_VERIFICATION', 'EMAIL_VERIFICATION') NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_tokens_identifier_purpose_idx`(`identifier`, `purpose`),
    INDEX `otp_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_vendors` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `businessName` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(120) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `alternatePhone` VARCHAR(20) NULL,
    `gstNumber` VARCHAR(20) NULL,
    `panNumber` VARCHAR(20) NULL,
    `drugLicenseNumber` VARCHAR(60) NULL,
    `drugLicenseExpiry` DATETIME(3) NULL,
    `logoUrl` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `addressLine1` VARCHAR(255) NULL,
    `addressLine2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(12) NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'India',
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `minOrderValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `approvalStatus` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `rejectionReason` VARCHAR(500) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` CHAR(36) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `medical_vendors_userId_key`(`userId`),
    UNIQUE INDEX `medical_vendors_code_key`(`code`),
    INDEX `medical_vendors_approvalStatus_idx`(`approvalStatus`),
    INDEX `medical_vendors_city_state_idx`(`city`, `state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_documents` (
    `id` CHAR(36) NOT NULL,
    `vendorId` CHAR(36) NOT NULL,
    `type` ENUM('DRUG_LICENSE', 'GST_CERTIFICATE', 'PAN_CARD', 'AADHAAR', 'TRADE_LICENSE', 'SHOP_ESTABLISHMENT', 'BANK_PROOF', 'OWNER_PHOTO', 'STORE_PHOTO', 'OTHER') NOT NULL,
    `documentNo` VARCHAR(100) NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `fileName` VARCHAR(255) NULL,
    `mimeType` VARCHAR(100) NULL,
    `sizeBytes` INTEGER NULL,
    `issueDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `remarks` VARCHAR(500) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifiedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendor_documents_vendorId_type_idx`(`vendorId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_shops` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `storeName` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `ownerName` VARCHAR(120) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `alternatePhone` VARCHAR(20) NULL,
    `gstNumber` VARCHAR(20) NULL,
    `panNumber` VARCHAR(20) NULL,
    `drugLicenseNumber` VARCHAR(60) NULL,
    `drugLicenseExpiry` DATETIME(3) NULL,
    `logoUrl` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `addressLine1` VARCHAR(255) NULL,
    `addressLine2` VARCHAR(255) NULL,
    `landmark` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(12) NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'India',
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `approvalStatus` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `rejectionReason` VARCHAR(500) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` CHAR(36) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isTemporarilyClosed` BOOLEAN NOT NULL DEFAULT false,
    `closureReason` VARCHAR(255) NULL,
    `ratingAvg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `ratingCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `medical_shops_userId_key`(`userId`),
    UNIQUE INDEX `medical_shops_code_key`(`code`),
    INDEX `medical_shops_approvalStatus_isActive_idx`(`approvalStatus`, `isActive`),
    INDEX `medical_shops_city_state_idx`(`city`, `state`),
    INDEX `medical_shops_pincode_idx`(`pincode`),
    INDEX `medical_shops_latitude_longitude_idx`(`latitude`, `longitude`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shop_documents` (
    `id` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `type` ENUM('DRUG_LICENSE', 'GST_CERTIFICATE', 'PAN_CARD', 'AADHAAR', 'TRADE_LICENSE', 'SHOP_ESTABLISHMENT', 'BANK_PROOF', 'OWNER_PHOTO', 'STORE_PHOTO', 'OTHER') NOT NULL,
    `documentNo` VARCHAR(100) NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `fileName` VARCHAR(255) NULL,
    `mimeType` VARCHAR(100) NULL,
    `sizeBytes` INTEGER NULL,
    `issueDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `remarks` VARCHAR(500) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifiedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `shop_documents_retailerId_type_idx`(`retailerId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_images` (
    `id` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `store_images_retailerId_idx`(`retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_business_hours` (
    `id` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `isClosed` BOOLEAN NOT NULL DEFAULT false,
    `openTime` VARCHAR(5) NULL,
    `closeTime` VARCHAR(5) NULL,
    `breakStart` VARCHAR(5) NULL,
    `breakEnd` VARCHAR(5) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_business_hours_retailerId_dayOfWeek_key`(`retailerId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_holidays` (
    `id` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `title` VARCHAR(191) NULL,
    `isFullDay` BOOLEAN NOT NULL DEFAULT true,
    `openTime` VARCHAR(5) NULL,
    `closeTime` VARCHAR(5) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `store_holidays_retailerId_date_key`(`retailerId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pickup_slot_configs` (
    `id` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `slotDurationMins` INTEGER NOT NULL DEFAULT 30,
    `maxOrdersPerSlot` INTEGER NOT NULL DEFAULT 10,
    `bufferMins` INTEGER NOT NULL DEFAULT 60,
    `advanceDays` INTEGER NOT NULL DEFAULT 7,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pickup_slot_configs_retailerId_key`(`retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pickup_slots` (
    `id` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 10,
    `bookedCount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('AVAILABLE', 'DISABLED', 'FULL') NOT NULL DEFAULT 'AVAILABLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pickup_slots_retailerId_date_idx`(`retailerId`, `date`),
    UNIQUE INDEX `pickup_slots_retailerId_date_startTime_key`(`retailerId`, `date`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `gender` VARCHAR(20) NULL,
    `dateOfBirth` DATE NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `customers_userId_key`(`userId`),
    UNIQUE INDEX `customers_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_addresses` (
    `id` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `label` VARCHAR(50) NULL,
    `contactName` VARCHAR(120) NULL,
    `contactPhone` VARCHAR(20) NULL,
    `addressLine1` VARCHAR(255) NOT NULL,
    `addressLine2` VARCHAR(255) NULL,
    `landmark` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(12) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customer_addresses_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `description` VARCHAR(500) NULL,
    `imageUrl` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_categories` (
    `id` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `description` VARCHAR(500) NULL,
    `imageUrl` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `sub_categories_slug_key`(`slug`),
    INDEX `sub_categories_categoryId_status_idx`(`categoryId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturers` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `contactPerson` VARCHAR(120) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(20) NULL,
    `licenseNumber` VARCHAR(60) NULL,
    `addressLine1` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(12) NULL,
    `logoUrl` VARCHAR(500) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `manufacturers_code_key`(`code`),
    INDEX `manufacturers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_units` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_units_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL,
    `sku` VARCHAR(40) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `genericName` VARCHAR(191) NULL,
    `brandName` VARCHAR(191) NULL,
    `manufacturerId` CHAR(36) NULL,
    `categoryId` CHAR(36) NOT NULL,
    `subCategoryId` CHAR(36) NULL,
    `unitId` CHAR(36) NULL,
    `medicineType` VARCHAR(80) NULL,
    `composition` TEXT NULL,
    `strength` VARCHAR(80) NULL,
    `dosageForm` VARCHAR(80) NULL,
    `packSize` VARCHAR(80) NULL,
    `mrp` DECIMAL(12, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `hsnCode` VARCHAR(20) NULL,
    `prescriptionRequired` BOOLEAN NOT NULL DEFAULT false,
    `imageUrl` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `isRecalled` BOOLEAN NOT NULL DEFAULT false,
    `recallReason` VARCHAR(500) NULL,
    `searchKeywords` VARCHAR(500) NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `products_sku_key`(`sku`),
    INDEX `products_name_idx`(`name`),
    INDEX `products_genericName_idx`(`genericName`),
    INDEX `products_brandName_idx`(`brandName`),
    INDEX `products_categoryId_status_idx`(`categoryId`, `status`),
    INDEX `products_manufacturerId_idx`(`manufacturerId`),
    INDEX `products_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_products` (
    `id` CHAR(36) NOT NULL,
    `vendorId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `purchasePrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sellingPrice` DECIMAL(12, 2) NOT NULL,
    `mrp` DECIMAL(12, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `minOrderQty` INTEGER NOT NULL DEFAULT 1,
    `packQty` INTEGER NOT NULL DEFAULT 1,
    `minStockAlert` INTEGER NOT NULL DEFAULT 10,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `vendor_products_productId_status_idx`(`productId`, `status`),
    UNIQUE INDEX `vendor_products_vendorId_productId_key`(`vendorId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retailer_products` (
    `id` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `sellingPrice` DECIMAL(12, 2) NOT NULL,
    `mrp` DECIMAL(12, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `minStockAlert` INTEGER NOT NULL DEFAULT 10,
    `maxOrderQty` INTEGER NOT NULL DEFAULT 50,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `retailer_products_productId_status_idx`(`productId`, `status`),
    UNIQUE INDEX `retailer_products_retailerId_productId_key`(`retailerId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_history` (
    `id` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `ownerId` CHAR(36) NOT NULL,
    `field` VARCHAR(40) NOT NULL,
    `oldValue` DECIMAL(12, 2) NULL,
    `newValue` DECIMAL(12, 2) NOT NULL,
    `changedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_history_ownerType_ownerId_productId_idx`(`ownerType`, `ownerId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouses` (
    `id` CHAR(36) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `addressLine1` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(12) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `warehouses_vendorId_idx`(`vendorId`),
    INDEX `warehouses_retailerId_idx`(`retailerId`),
    UNIQUE INDEX `warehouses_ownerType_vendorId_retailerId_code_key`(`ownerType`, `vendorId`, `retailerId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` CHAR(36) NOT NULL,
    `warehouseId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `totalQty` INTEGER NOT NULL DEFAULT 0,
    `reservedQty` INTEGER NOT NULL DEFAULT 0,
    `availableQty` INTEGER NOT NULL DEFAULT 0,
    `minStockAlert` INTEGER NOT NULL DEFAULT 10,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `inventory_productId_idx`(`productId`),
    UNIQUE INDEX `inventory_warehouseId_productId_key`(`warehouseId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_batches` (
    `id` CHAR(36) NOT NULL,
    `warehouseId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `batchNumber` VARCHAR(80) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `freeQuantity` INTEGER NOT NULL DEFAULT 0,
    `reservedQty` INTEGER NOT NULL DEFAULT 0,
    `purchasePrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sellingPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `mrp` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `manufacturingDate` DATE NULL,
    `expiryDate` DATE NOT NULL,
    `supplierName` VARCHAR(191) NULL,
    `supplierVendorId` CHAR(36) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'BLOCKED', 'DEPLETED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `inventory_batches_productId_expiryDate_idx`(`productId`, `expiryDate`),
    INDEX `inventory_batches_expiryDate_status_idx`(`expiryDate`, `status`),
    INDEX `inventory_batches_retailerId_productId_idx`(`retailerId`, `productId`),
    INDEX `inventory_batches_vendorId_productId_idx`(`vendorId`, `productId`),
    UNIQUE INDEX `inventory_batches_warehouseId_productId_batchNumber_key`(`warehouseId`, `productId`, `batchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_transactions` (
    `id` CHAR(36) NOT NULL,
    `warehouseId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `batchId` CHAR(36) NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `type` ENUM('OPENING_STOCK', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT', 'DAMAGE', 'EXPIRED', 'TRANSFER', 'ORDER_RESERVATION', 'ORDER_RELEASE') NOT NULL,
    `direction` ENUM('IN', 'OUT', 'RESERVE', 'RELEASE') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `balanceAfter` INTEGER NULL,
    `unitCost` DECIMAL(12, 2) NULL,
    `totalCost` DECIMAL(12, 2) NULL,
    `referenceType` VARCHAR(40) NULL,
    `referenceId` CHAR(36) NULL,
    `notes` VARCHAR(500) NULL,
    `performedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_transactions_warehouseId_productId_createdAt_idx`(`warehouseId`, `productId`, `createdAt`),
    INDEX `inventory_transactions_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    INDEX `inventory_transactions_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carts` (
    `id` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `carts_customerId_isActive_idx`(`customerId`, `isActive`),
    INDEX `carts_retailerId_idx`(`retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `id` CHAR(36) NOT NULL,
    `cartId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `retailerProductId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `mrp` DECIMAL(12, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cart_items_productId_idx`(`productId`),
    INDEX `cart_items_retailerProductId_idx`(`retailerProductId`),
    UNIQUE INDEX `cart_items_cartId_retailerProductId_key`(`cartId`, `retailerProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` CHAR(36) NOT NULL,
    `orderNumber` VARCHAR(32) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `pickupSlotId` CHAR(36) NULL,
    `pickupDate` DATE NULL,
    `pickupStart` VARCHAR(5) NULL,
    `pickupEnd` VARCHAR(5) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `cgstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sgstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `igstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paymentStatus` ENUM('PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentMode` ENUM('CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE') NOT NULL DEFAULT 'CASH',
    `prescriptionUrl` VARCHAR(500) NULL,
    `customerNote` VARCHAR(500) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `cancelledBy` VARCHAR(20) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `readyAt` DATETIME(3) NULL,
    `pickedUpAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_orderNumber_key`(`orderNumber`),
    INDEX `orders_customerId_status_idx`(`customerId`, `status`),
    INDEX `orders_retailerId_status_idx`(`retailerId`, `status`),
    INDEX `orders_createdAt_idx`(`createdAt`),
    INDEX `orders_pickupDate_idx`(`pickupDate`),
    INDEX `orders_pickupSlotId_idx`(`pickupSlotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `packSize` VARCHAR(80) NULL,
    `quantity` INTEGER NOT NULL,
    `fulfilledQty` INTEGER NOT NULL DEFAULT 0,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `mrp` DECIMAL(12, 2) NOT NULL,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_orderId_idx`(`orderId`),
    INDEX `order_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_allocations` (
    `id` CHAR(36) NOT NULL,
    `orderItemId` CHAR(36) NOT NULL,
    `batchId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `released` BOOLEAN NOT NULL DEFAULT false,
    `consumed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_item_allocations_orderItemId_idx`(`orderItemId`),
    INDEX `order_item_allocations_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_history` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `fromStatus` ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED') NULL,
    `toStatus` ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL,
    `notes` VARCHAR(500) NULL,
    `changedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_status_history_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` CHAR(36) NOT NULL,
    `poNumber` VARCHAR(32) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `vendorId` CHAR(36) NOT NULL,
    `status` ENUM('DRAFT', 'PLACED', 'ACCEPTED', 'REJECTED', 'PROCESSING', 'READY_FOR_DELIVERY', 'DISPATCHED', 'DELIVERED', 'RECEIVED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLACED',
    `expectedDate` DATE NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `cgstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sgstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `igstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paymentStatus` ENUM('PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` VARCHAR(500) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `dispatchNumber` VARCHAR(80) NULL,
    `dispatchDate` DATETIME(3) NULL,
    `courierName` VARCHAR(120) NULL,
    `trackingNumber` VARCHAR(120) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_orders_poNumber_key`(`poNumber`),
    INDEX `purchase_orders_retailerId_status_idx`(`retailerId`, `status`),
    INDEX `purchase_orders_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `purchase_orders_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` CHAR(36) NOT NULL,
    `purchaseOrderId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `acceptedQty` INTEGER NOT NULL DEFAULT 0,
    `receivedQty` INTEGER NOT NULL DEFAULT 0,
    `freeQty` INTEGER NOT NULL DEFAULT 0,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `mrp` DECIMAL(12, 2) NOT NULL,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `batchNumber` VARCHAR(80) NULL,
    `manufacturingDate` DATE NULL,
    `expiryDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchase_order_items_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `purchase_order_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` CHAR(36) NOT NULL,
    `saleNumber` VARCHAR(32) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NULL,
    `customerId` CHAR(36) NULL,
    `customerName` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(20) NULL,
    `saleDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `costAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paymentMode` ENUM('CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE') NOT NULL DEFAULT 'CASH',
    `paymentStatus` ENUM('PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PAID',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_saleNumber_key`(`saleNumber`),
    UNIQUE INDEX `sales_orderId_key`(`orderId`),
    INDEX `sales_retailerId_saleDate_idx`(`retailerId`, `saleDate`),
    INDEX `sales_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` CHAR(36) NOT NULL,
    `saleId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `batchNumber` VARCHAR(80) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `costPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sale_items_saleId_idx`(`saleId`),
    INDEX `sale_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_returns` (
    `id` CHAR(36) NOT NULL,
    `returnNumber` VARCHAR(32) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `vendorId` CHAR(36) NOT NULL,
    `purchaseOrderId` CHAR(36) NULL,
    `reason` VARCHAR(500) NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `returnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_returns_returnNumber_key`(`returnNumber`),
    INDEX `purchase_returns_retailerId_idx`(`retailerId`),
    INDEX `purchase_returns_vendorId_idx`(`vendorId`),
    INDEX `purchase_returns_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_return_items` (
    `id` CHAR(36) NOT NULL,
    `purchaseReturnId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `batchNumber` VARCHAR(80) NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    INDEX `purchase_return_items_purchaseReturnId_idx`(`purchaseReturnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_returns` (
    `id` CHAR(36) NOT NULL,
    `returnNumber` VARCHAR(32) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NULL,
    `customerName` VARCHAR(191) NULL,
    `reason` VARCHAR(500) NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `returnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_returns_returnNumber_key`(`returnNumber`),
    INDEX `sales_returns_retailerId_idx`(`retailerId`),
    INDEX `sales_returns_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_return_items` (
    `id` CHAR(36) NOT NULL,
    `salesReturnId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `batchNumber` VARCHAR(80) NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    INDEX `sales_return_items_salesReturnId_idx`(`salesReturnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` CHAR(36) NOT NULL,
    `invoiceNumber` VARCHAR(32) NOT NULL,
    `type` ENUM('SALES', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN') NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `orderId` CHAR(36) NULL,
    `purchaseOrderId` CHAR(36) NULL,
    `billToName` VARCHAR(191) NULL,
    `billToGst` VARCHAR(20) NULL,
    `billToAddress` VARCHAR(500) NULL,
    `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxableAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `cgstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sgstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `igstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `pdfUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `invoices_orderId_key`(`orderId`),
    UNIQUE INDEX `invoices_purchaseOrderId_key`(`purchaseOrderId`),
    INDEX `invoices_ownerType_vendorId_retailerId_idx`(`ownerType`, `vendorId`, `retailerId`),
    INDEX `invoices_invoiceDate_idx`(`invoiceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `paymentNumber` VARCHAR(32) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `invoiceId` CHAR(36) NULL,
    `orderId` CHAR(36) NULL,
    `purchaseOrderId` CHAR(36) NULL,
    `direction` ENUM('IN', 'OUT') NOT NULL,
    `mode` ENUM('CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE') NOT NULL DEFAULT 'CASH',
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PAID',
    `referenceNo` VARCHAR(120) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_paymentNumber_key`(`paymentNumber`),
    INDEX `payments_ownerType_vendorId_retailerId_idx`(`ownerType`, `vendorId`, `retailerId`),
    INDEX `payments_paidAt_idx`(`paidAt`),
    INDEX `payments_invoiceId_idx`(`invoiceId`),
    INDEX `payments_orderId_idx`(`orderId`),
    INDEX `payments_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` CHAR(36) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `category` VARCHAR(80) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `expenseDate` DATE NOT NULL,
    `paymentMode` ENUM('CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE') NOT NULL DEFAULT 'CASH',
    `notes` VARCHAR(500) NULL,
    `attachmentUrl` VARCHAR(500) NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `expenses_ownerType_vendorId_retailerId_expenseDate_idx`(`ownerType`, `vendorId`, `retailerId`, `expenseDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `finance_transactions` (
    `id` CHAR(36) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `type` ENUM('SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN', 'PAYMENT_IN', 'PAYMENT_OUT', 'EXPENSE', 'ADJUSTMENT') NOT NULL,
    `direction` ENUM('IN', 'OUT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `referenceType` VARCHAR(40) NULL,
    `referenceId` CHAR(36) NULL,
    `partyName` VARCHAR(191) NULL,
    `description` VARCHAR(500) NULL,
    `txnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `finance_transactions_ownerType_vendorId_retailerId_txnDate_idx`(`ownerType`, `vendorId`, `retailerId`, `txnDate`),
    INDEX `finance_transactions_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'SMS', 'PUSH') NOT NULL DEFAULT 'IN_APP',
    `event` VARCHAR(60) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `data` JSON NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED', 'READ') NOT NULL DEFAULT 'QUEUED',
    `readAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `error` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_status_idx`(`userId`, `status`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorites` (
    `id` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NULL,
    `productId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `favorites_retailerId_idx`(`retailerId`),
    INDEX `favorites_productId_idx`(`productId`),
    UNIQUE INDEX `favorites_customerId_retailerId_productId_key`(`customerId`, `retailerId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` CHAR(36) NOT NULL,
    `customerId` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(1000) NULL,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `reviews_retailerId_isVisible_idx`(`retailerId`, `isVisible`),
    INDEX `reviews_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `userType` ENUM('SUPER_ADMIN', 'ADMIN_STAFF', 'VENDOR', 'RETAILER', 'CUSTOMER') NULL,
    `action` VARCHAR(80) NOT NULL,
    `module` VARCHAR(60) NOT NULL,
    `recordId` VARCHAR(64) NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_module_recordId_idx`(`module`, `recordId`),
    INDEX `audit_logs_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `value` TEXT NOT NULL,
    `group` VARCHAR(60) NOT NULL DEFAULT 'general',
    `dataType` VARCHAR(20) NOT NULL DEFAULT 'string',
    `label` VARCHAR(191) NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    INDEX `settings_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_tokens` ADD CONSTRAINT `otp_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_vendors` ADD CONSTRAINT `medical_vendors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_documents` ADD CONSTRAINT `vendor_documents_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_shops` ADD CONSTRAINT `medical_shops_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shop_documents` ADD CONSTRAINT `shop_documents_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_images` ADD CONSTRAINT `store_images_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_business_hours` ADD CONSTRAINT `store_business_hours_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_holidays` ADD CONSTRAINT `store_holidays_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pickup_slot_configs` ADD CONSTRAINT `pickup_slot_configs_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pickup_slots` ADD CONSTRAINT `pickup_slots_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_categories` ADD CONSTRAINT `sub_categories_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_manufacturerId_fkey` FOREIGN KEY (`manufacturerId`) REFERENCES `manufacturers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `sub_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `product_units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_products` ADD CONSTRAINT `vendor_products_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_products` ADD CONSTRAINT `vendor_products_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `retailer_products` ADD CONSTRAINT `retailer_products_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `retailer_products` ADD CONSTRAINT `retailer_products_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `inventory_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_retailerProductId_fkey` FOREIGN KEY (`retailerProductId`) REFERENCES `retailer_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_pickupSlotId_fkey` FOREIGN KEY (`pickupSlotId`) REFERENCES `pickup_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_allocations` ADD CONSTRAINT `order_item_allocations_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_allocations` ADD CONSTRAINT `order_item_allocations_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `inventory_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_purchaseReturnId_fkey` FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_salesReturnId_fkey` FOREIGN KEY (`salesReturnId`) REFERENCES `sales_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_transactions` ADD CONSTRAINT `finance_transactions_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_transactions` ADD CONSTRAINT `finance_transactions_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

