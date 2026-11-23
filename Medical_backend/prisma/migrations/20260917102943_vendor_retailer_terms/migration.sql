-- CreateTable
CREATE TABLE `vendor_retailer_terms` (
    `id` CHAR(36) NOT NULL,
    `vendorId` CHAR(36) NOT NULL,
    `retailerId` CHAR(36) NOT NULL,
    `creditLimit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paymentTermsDays` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendor_retailer_terms_vendorId_retailerId_key`(`vendorId`, `retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendor_retailer_terms` ADD CONSTRAINT `vendor_retailer_terms_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_retailer_terms` ADD CONSTRAINT `vendor_retailer_terms_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
