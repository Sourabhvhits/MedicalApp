-- CreateTable
CREATE TABLE `staff_members` (
    `id` CHAR(36) NOT NULL,
    `ownerType` ENUM('VENDOR', 'RETAILER') NOT NULL,
    `vendorId` CHAR(36) NULL,
    `retailerId` CHAR(36) NULL,
    `userId` CHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `invitedById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `staff_members_userId_key`(`userId`),
    INDEX `staff_members_vendorId_idx`(`vendorId`),
    INDEX `staff_members_retailerId_idx`(`retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `medical_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `medical_shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
