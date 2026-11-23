"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EARTH_RADIUS_KM = void 0;
exports.haversineKm = haversineKm;
exports.boundingBox = boundingBox;
exports.EARTH_RADIUS_KM = 6371;
/** Great-circle distance in kilometres. */
function haversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * exports.EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
/**
 * Bounding box for a radius search. Used to let MySQL narrow rows with the
 * (latitude, longitude) index before the exact haversine filter runs.
 */
function boundingBox(center, radiusKm) {
    const latDelta = radiusKm / 111.045;
    const cosLat = Math.cos((center.latitude * Math.PI) / 180);
    const lngDelta = radiusKm / (111.045 * (Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat));
    return {
        minLat: center.latitude - latDelta,
        maxLat: center.latitude + latDelta,
        minLng: center.longitude - lngDelta,
        maxLng: center.longitude + lngDelta,
    };
}
//# sourceMappingURL=geo.js.map