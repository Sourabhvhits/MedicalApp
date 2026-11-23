-- AlterTable
ALTER TABLE `orders` ADD COLUMN `prescriptionRejectionReason` VARCHAR(500) NULL,
    ADD COLUMN `prescriptionReviewedAt` DATETIME(3) NULL,
    ADD COLUMN `prescriptionReviewedById` CHAR(36) NULL,
    ADD COLUMN `prescriptionStatus` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED';
