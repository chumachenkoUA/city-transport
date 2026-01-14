// API functions for driver endpoints

import { apiGet, apiPost } from './api';

export type DriverDirection = 'forward' | 'reverse';

export interface DriverProfile {
  id: number;
  login: string;
  fullName: string;
  email: string;
  phone: string;
  driverLicenseNumber: string;
  licenseCategories: unknown;
}

export interface DriverTripStop {
  id: number;
  name: string;
  lon: string;
  lat: string;
  distanceToNextKm: number | null;
  minutesToNextStop: number | null;
}

export interface DriverTrip {
  id: number;
  startsAt: string;
  endsAt: string | null;
  passengerCount: number;
  plannedStartAt: string | null;
  plannedEndsAt: string | null;
  startDelayMin: number | null;
  route: {
    id: number;
    number: string;
    transportTypeId: number;
    direction: DriverDirection;
  };
  vehicle: {
    id: number;
    fleetNumber: string;
  };
  transportType: {
    id: number;
    name: string;
  };
  stops: DriverTripStop[];
}

export interface DriverSchedule {
  driver: DriverProfile;
  date: string;
  assigned: boolean;
  vehicle: {
    id: number;
    fleetNumber: string;
  } | null;
  route: {
    id: number;
    number: string;
    transportTypeId: number;
    direction: DriverDirection;
  } | null;
  transportType: {
    id: number;
    name: string;
  } | null;
  schedule: {
    workStartTime: string;
    workEndTime: string;
    intervalMin: number;
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  } | null;
  trips: DriverTrip[];
  stops: DriverTripStop[];
}

export interface DriverActiveTrip {
  id: number;
  routeId: number;
  routeNumber: string;
  direction: DriverDirection;
  transportType: string;
  vehicleId: number;
  fleetNumber: string;
  plannedStartsAt: string;
  actualStartsAt: string;
  passengerCount: number;
  startDelayMin: number | null;
}

export interface DriverScheduledTrip {
  id: number;
  routeId: number;
  routeNumber: string;
  direction: DriverDirection;
  transportType: string;
  vehicleId: number;
  fleetNumber: string;
  plannedStartsAt: string;
  plannedEndsAt: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface DriverRouteStop {
  routeId: number;
  stopId: number;
  stopName: string;
  lon: string;
  lat: string;
  distanceToNextKm: string | null;
  prevRouteStopId: number | null;
  nextRouteStopId: number | null;
}

export interface DriverRoutePoint {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
  prevRoutePointId: number | null;
  nextRoutePointId: number | null;
}

export type RouteLookupParams = {
  routeId?: number;
  routeNumber?: string;
  transportTypeId?: number;
  direction?: DriverDirection;
}

export type StartTripPayload = {
  tripId?: number;
  startedAt?: string;
}

export type FinishTripPayload = {
  endedAt?: string;
}

export type PassengerCountPayload = {
  tripId: number;
  passengerCount: number;
}

export type DriverGpsPayload = {
  lon: number;
  lat: number;
  recordedAt?: string;
}

export function getDriverProfile() {
  return apiGet<DriverProfile>('/driver/me');
}

export function getDriverSchedule(date?: string) {
  return apiGet<DriverSchedule>('/driver/schedule', { date });
}

export function getDriverActiveTrip() {
  return apiGet<DriverActiveTrip | null>('/driver/active-trip');
}

export function getDriverScheduledTrips() {
  return apiGet<DriverScheduledTrip[]>('/driver/scheduled-trips');
}

export function getDriverRouteStops(params: RouteLookupParams) {
  return apiGet<DriverRouteStop[]>('/driver/routes/stops', params);
}

export function getDriverRoutePoints(params: RouteLookupParams) {
  return apiGet<DriverRoutePoint[]>('/driver/routes/points', params);
}

export function startDriverTrip(payload: StartTripPayload) {
  return apiPost<{ tripId: number | null }>('/driver/trips/start', payload);
}

export function finishDriverTrip(payload: FinishTripPayload) {
  return apiPost<{ tripId: number | null }>('/driver/trips/finish', payload);
}

export function updateTripPassengerCount(payload: PassengerCountPayload) {
  return apiPost<{ ok: true }>('/driver/trips/passengers', payload);
}

export function logDriverGps(payload: DriverGpsPayload) {
  return apiPost<{ ok: true }>('/driver/trips/gps', payload);
}
