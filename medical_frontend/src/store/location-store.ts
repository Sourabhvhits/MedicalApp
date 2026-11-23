'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationState {
  coords: Coordinates | null;
  label: string | null;
  pincode: string | null;
  radiusKm: number;
  status: 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';
  setCoords: (coords: Coordinates, label?: string) => void;
  setPincode: (pincode: string | null) => void;
  setRadius: (radiusKm: number) => void;
  setStatus: (status: LocationState['status']) => void;
  clear: () => void;
}

/**
 * The customer's chosen search location. Persisted so returning visitors keep
 * their area without being prompted for permission again.
 */
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      coords: null,
      label: null,
      pincode: null,
      radiusKm: 5,
      status: 'idle',

      setCoords: (coords, label) =>
        set({ coords, label: label ?? 'Current location', status: 'granted', pincode: null }),
      setPincode: (pincode) => set({ pincode, coords: pincode ? null : undefined as never }),
      setRadius: (radiusKm) => set({ radiusKm }),
      setStatus: (status) => set({ status }),
      clear: () => set({ coords: null, label: null, pincode: null, status: 'idle' }),
    }),
    { name: 'medsaas.location' },
  ),
);

/** Requests the browser location and stores it. Resolves to null if refused. */
export async function requestBrowserLocation(): Promise<Coordinates | null> {
  const store = useLocationStore.getState();

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    store.setStatus('unavailable');
    return null;
  }

  store.setStatus('locating');

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        };
        store.setCoords(coords);
        resolve(coords);
      },
      () => {
        store.setStatus('denied');
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}
