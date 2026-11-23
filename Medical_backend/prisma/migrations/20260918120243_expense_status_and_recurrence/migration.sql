-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `nextRecurrenceDate` DATE NULL,
    ADD COLUMN `parentExpenseId` CHAR(36) NULL,
    ADD COLUMN `recurrenceCancelledAt` DATETIME(3) NULL,
    ADD COLUMN `recurrenceInterval` ENUM('WEEKLY', 'MONTHLY', 'YEARLY') NULL,
    ADD COLUMN `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PAID';

-- CreateIndex
CREATE INDEX `expenses_isRecurring_nextRecurrenceDate_idx` ON `expenses`(`isRecurring`, `nextRecurrenceDate`);

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_parentExpenseId_fkey` FOREIGN KEY (`parentExpenseId`) REFERENCES `expenses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
