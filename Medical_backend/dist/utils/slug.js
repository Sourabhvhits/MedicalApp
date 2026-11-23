"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
exports.uniqueSlug = uniqueSlug;
function slugify(value) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
}
/** Appends a numeric suffix until `exists` reports the slug as free. */
async function uniqueSlug(base, exists) {
    const root = slugify(base) || 'item';
    let candidate = root;
    let counter = 1;
    while (await exists(candidate)) {
        counter += 1;
        candidate = `${root}-${counter}`;
    }
    return candidate;
}
//# sourceMappingURL=slug.js.map