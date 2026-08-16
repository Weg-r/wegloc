import { DEFAULT_SETTINGS, type Route } from '../types/route'

/** A short walk around the Champ de Mars, used to seed a fresh editor. */
export const DEMO_ROUTE: Route = {
  id: 'demo-champ-de-mars',
  name: 'Champ de Mars loop',
  waypoints: [
    { id: 'wp-1', lng: 2.2945, lat: 48.8584, altitude: 33, legSpeedMps: null },
    { id: 'wp-2', lng: 2.2977, lat: 48.8557, altitude: 35, legSpeedMps: 1.4 },
    { id: 'wp-3', lng: 2.3012, lat: 48.8566, altitude: 34, legSpeedMps: 2.8 },
    { id: 'wp-4', lng: 2.3010, lat: 48.8600, altitude: 36, legSpeedMps: 1.4 },
    { id: 'wp-5', lng: 2.2965, lat: 48.8607, altitude: 34, legSpeedMps: 1.1 },
  ],
  settings: { ...DEFAULT_SETTINGS, altitudeMode: 'per-waypoint' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}
