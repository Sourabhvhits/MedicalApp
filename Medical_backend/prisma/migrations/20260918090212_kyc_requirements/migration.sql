-- CreateTable
CREATE TABLE `kyc_requirements` (
    `id` CHAR(36) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `documentType` ENUM('DRUG_LICENSE', 'GST_CERTIFICATE', 'PAN_CARD', 'AADHAAR', 'TRADE_LICENSE', 'SHOP_ESTABLISHMENT', 'BANK_PROOF', 'OWNER_PHOTO', 'STORE_PHOTO', 'OTHER') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kyc_requirements_ownerType_documentType_key`(`ownerType`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
