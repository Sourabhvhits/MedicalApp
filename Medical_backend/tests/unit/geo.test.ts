import { describe, expect, it } from 'vitest';
import { boundingBox, haversineKm } from '../../src/utils/geo';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const MUMBAI = { latitude: 19.076, longitude: 72.8777 };

describe('haversineKm', () => {
  it('returns zero for the same point', () => {
    expect(haversineKm(PUNE, PUNE)).toBe(0);
  });

  it('matches the known Pune-Mumbai distance within a kilometre', () => {
    expect(haversineKm(PUNE, MUMBAI)).toBeCloseTo(119.7, 0);
  });

  it('is symmetric', () => {
    expect(haversineKm(PUNE, MUMBAI)).toBeCloseTo(haversineKm(MUMBAI, PUNE), 6);
  });

  it('measures a short intra-city hop in the right order of magnitude', () => {
    const nearby = { latitude: 18.5314, longitude: 73.8446 };
    const distance = haversineKm(PUNE, nearby);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(3);
  });
});

describe('boundingBox', () => {
  it('contains every point inside the radius', () => {
    const box = boundingBox(PUNE, 5);
    const inside = { latitude: 18.5314, longitude: 73.8446 };

    expect(inside.latitude).toBeGreaterThanOrEqual(box.minLat);
    expect(inside.latitude).toBeLessThanOrEqual(box.maxLat);
    expect(inside.longitude).toBeGreaterThanOrEqual(box.minLng);
    expect(inside.longitude).toBeLessThanOrEqual(box.maxLng);
  });

  it('excludes a point well outside the radius', () => {
    const box = boundingBox(PUNE, 5);
    expect(MUMBAI.latitude > box.maxLat || MUMBAI.longitude < box.minLng).toBe(true);
  });

  it('grows with the radius', () => {
    const small = boundingBox(PUNE, 1);
    const large = boundingBox(PUNE, 50);
    expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
  });
});
