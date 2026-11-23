-- CreateTable
CREATE TABLE `notification_templates` (
    `id` CHAR(36) NOT NULL,
    `event` VARCHAR(60) NOT NULL,
    `scope` ENUM('PLATFORM', 'VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `titleTemplate` VARCHAR(191) NOT NULL,
    `bodyTemplate` VARCHAR(1000) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notification_templates_event_scope_idx`(`event`, `scope`),
    INDEX `notification_templates_vendorId_idx`(`vendorId`),
    INDEX `notification_templates_retailerId_idx`(`retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification_templates` ADD CONSTRAINT `notification_templates_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_templates` ADD CONSTRAINT `notification_templates_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
