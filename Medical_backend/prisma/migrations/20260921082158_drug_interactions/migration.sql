-- CreateTable
CREATE TABLE `drug_interactions` (
    `id` CHAR(36) NOT NULL,
    `compositionA` VARCHAR(191) NOT NULL,
    `compositionB` VARCHAR(191) NOT NULL,
    `severity` ENUM('LOW', 'MODERATE', 'SEVERE') NOT NULL DEFAULT 'MODERATE',
    `description` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `drug_interactions_compositionB_idx`(`compositionB`),
    UNIQUE INDEX `drug_interactions_compositionA_compositionB_key`(`compositionA`, `compositionB`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
