-- CreateTable
CREATE TABLE `broadcasts` (
    `id` CHAR(36) NOT NULL,
    `segment` ENUM('ALL_VENDORS', 'ALL_RETAILERS', 'ALL_CUSTOMERS', 'EVERYONE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `channels` JSON NOT NULL,
    `recipientCount` INTEGER NOT NULL DEFAULT 0,
    `sentById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `broadcasts_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
