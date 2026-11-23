"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("../modules/auth/auth.routes"));
const admin_routes_1 = __importDefault(require("../modules/admin/admin.routes"));
const product_routes_1 = __importDefault(require("../modules/products/product.routes"));
const vendor_routes_1 = __importDefault(require("../modules/vendors/vendor.routes"));
const retailer_routes_1 = __importDefault(require("../modules/retailers/retailer.routes"));
const customer_routes_1 = __importDefault(require("../modules/customers/customer.routes"));
const notification_routes_1 = __importDefault(require("../modules/notifications/notification.routes"));
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({ success: true, message: 'API is healthy', data: { uptime: process.uptime() } });
});
router.use('/auth', auth_routes_1.default);
router.use('/admin', admin_routes_1.default);
router.use('/products', product_routes_1.default);
router.use('/vendor', vendor_routes_1.default);
router.use('/retailer', retailer_routes_1.default);
router.use('/customers', customer_routes_1.default);
router.use('/notifications', notification_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map