-- AlterTable
ALTER TABLE `orders` ADD COLUMN `gatewayOrderId` VARCHAR(191) NULL,
    ADD COLUMN `gatewayPaymentId` VARCHAR(191) NULL;
