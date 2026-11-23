"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../database/prisma");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const ApiError_1 = require("../../utils/ApiError");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const pagination_1 = require("../../utils/pagination");
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const listQuery = query_validation_1.paginationQuery.extend({
    unreadOnly: zod_1.z.coerce.boolean().default(false),
    event: zod_1.z.string().trim().max(60).optional(),
});
router.get('/', (0, validate_1.validate)({ query: listQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(req.query);
    const where = {
        userId: req.user.id,
        channel: 'IN_APP',
        ...(req.query.unreadOnly ? { readAt: null } : {}),
        ...(req.query.event ? { event: req.query.event } : {}),
    };
    const [items, total, unread] = await Promise.all([
        prisma_1.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma_1.prisma.notification.count({ where }),
        prisma_1.prisma.notification.count({ where: { userId: req.user.id, channel: 'IN_APP', readAt: null } }),
    ]);
    return res.json({
        success: true,
        message: 'Success',
        data: items,
        meta: (0, response_1.buildMeta)(page, limit, total),
        unreadCount: unread,
    });
}));
router.get('/unread-count', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, {
    unreadCount: await prisma_1.prisma.notification.count({
        where: { userId: req.user.id, channel: 'IN_APP', readAt: null },
    }),
})));
router.patch('/:id/read', (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await prisma_1.prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.id, readAt: null },
        data: { readAt: new Date(), status: 'READ' },
    });
    if (result.count === 0)
        throw ApiError_1.ApiError.notFound('Notification not found');
    return (0, response_1.ok)(res, { read: true }, 'Marked as read');
}));
router.patch('/read-all', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await prisma_1.prisma.notification.updateMany({
        where: { userId: req.user.id, readAt: null },
        data: { readAt: new Date(), status: 'READ' },
    });
    return (0, response_1.ok)(res, { updated: result.count }, 'All notifications marked as read');
}));
(0, openapi_1.doc)('get', '/notifications', { tags: ['Notifications'], summary: 'In-app notification feed', query: listQuery, paginated: true });
(0, openapi_1.doc)('get', '/notifications/unread-count', { tags: ['Notifications'], summary: 'Unread notification count' });
(0, openapi_1.doc)('patch', '/notifications/{id}/read', { tags: ['Notifications'], summary: 'Mark one notification read', params: query_validation_1.idParam, status: 200 });
(0, openapi_1.doc)('patch', '/notifications/read-all', { tags: ['Notifications'], summary: 'Mark every notification read', status: 200 });
exports.default = router;
//# sourceMappingURL=notification.routes.js.map