-- CreateTable
CREATE TABLE `provider_credentials` (
    `id` CHAR(36) NOT NULL,
    `provider` ENUM('SMS', 'EMAIL', 'PAYMENT_GATEWAY') NOT NULL,
    `encryptedConfig` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `updatedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `provider_credentials_provider_key`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
