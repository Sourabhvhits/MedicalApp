-- AlterTable
ALTER TABLE `kyc_requirements` MODIFY `documentType` VARCHAR(60) NOT NULL;

-- AlterTable
ALTER TABLE `shop_documents` MODIFY `type` VARCHAR(60) NOT NULL;

-- AlterTable
ALTER TABLE `vendor_documents` MODIFY `type` VARCHAR(60) NOT NULL;

