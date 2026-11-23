import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface LocationState {
  latitude: number;
  longitude: number;
  radiusKm: number;
  city: string;
  updateCoordinates: (lat: number, lng: number, cityName?: string) => void;
  updateRadius: (radius: number) => void;
}

// Default coordinates matching Pune (from backend seed/geo tests) as fallback
const DEFAULT_LOCATION = {
  latitude: 18.5204,
  longitude: 73.8567,
  radiusKm: 10,
  city: 'Pune',
};

const LocationContext = createContext<LocationState | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [latitude, setLatitude] = useState(DEFAULT_LOCATION.latitude);
  const [longitude, setLongitude] = useState(DEFAULT_LOCATION.longitude);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_LOCATION.radiusKm);
  const [city, setCity] = useState(DEFAULT_LOCATION.city);

  const updateCoordinates = (lat: number, lng: number, cityName = 'Current Location') => {
    setLatitude(lat);
    setLongitude(lng);
    setCity(cityName);
  };

  const updateRadius = (newRadius: number) => {
    setRadiusKm(newRadius);
  };

  return (
    <LocationContext.Provider
      value={{
        latitude,
        longitude,
        radiusKm,
        city,
        updateCoordinates,
        updateRadius,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = (): LocationState => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};

export default LocationContext;
