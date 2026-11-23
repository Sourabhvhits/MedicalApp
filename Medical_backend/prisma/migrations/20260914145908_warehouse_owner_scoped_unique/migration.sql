-- DropIndex
DROP INDEX `warehouses_ownerType_vendorId_retailerId_code_key` ON `warehouses`;

-- CreateIndex
CREATE UNIQUE INDEX `warehouses_vendorId_code_key` ON `warehouses`(`vendorId`, `code`);

-- CreateIndex
CREATE UNIQUE INDEX `warehouses_retailerId_code_key` ON `warehouses`(`retailerId`, `code`);

