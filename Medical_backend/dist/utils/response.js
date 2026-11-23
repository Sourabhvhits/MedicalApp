"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.created = created;
exports.noContent = noContent;
exports.paginated = paginated;
exports.buildMeta = buildMeta;
function ok(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
}
function created(res, data, message = 'Created successfully') {
    return ok(res, data, message, 201);
}
function noContent(res, message = 'Deleted successfully') {
    return res.status(200).json({ success: true, message, data: null });
}
function paginated(res, items, meta, message = 'Success') {
    return res.status(200).json({ success: true, message, data: items, meta });
}
function buildMeta(page, limit, total) {
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}
//# sourceMappingURL=response.js.map