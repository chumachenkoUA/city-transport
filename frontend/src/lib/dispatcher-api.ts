// API functions for dispatcher endpoints

import { apiGet, apiPatch, apiPost } from './api';

export type DispatcherDirection = 'forward' | 'reverse';

export interface DispatcherRoute {
  id: number;
  number: string;
  direction: DispatcherDirection;
  transportTypeId: number;
  transportTypeName: string;
}

export interface DispatcherScheduleListItem {
  id: number;
  routeId: number;
  routeNumber: string;
  direction: DispatcherDirection;
  transportType: string;
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
  vehicleId: number | null;
  fleetNumber: string | null;
}

export interface DispatcherScheduleStop {
  id: number;
  name: string;
  lon: string;
  lat: string;
  distanceToNextKm: number | null;
  minutesToNextStop: number | null;
}

export interface DispatcherScheduleDetails {
  id: number;
  routeNumber: string;
  routeDirection: DispatcherDirection;
  transportType: string;
  fleetNumber: string | null;
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
  routeDurationMin: number | null;
  routeEndTime: string | null;
  departures: string[];
  stops: DispatcherScheduleStop[];
}

export interface DispatcherVehicle {
  id: number;
  fleetNumber: string;
  routeId: number;
  routeNumber: string;
  capacity: number;
}

export interface DispatcherDriver {
  id: number;
  login: string;
  fullName: string;
  phone: string;
  driverLicenseNumber: string;
}

export interface DispatcherAssignment {
  id: number;
  driverId: number;
  driverName: string;
  driverLogin: string;
  driverPhone: string;
  vehicleId: number;
  fleetNumber: string;
  routeId: number;
  routeNumber: string;
  direction: DispatcherDirection;
  transportTypeId: number;
  transportType: string;
  assignedAt: string;
}

export interface DispatcherActiveTrip {
  id: number;
  routeNumber: string;
  fleetNumber: string;
  driverName: string;
  startsAt: string;
}

export interface DispatcherDashboard {
  activeTrips: number;
  deviations: number;
  schedulesToday: number;
  unassignedDrivers: number;
  unassignedVehicles: number;
}

export interface DispatcherDeviationItem {
  tripId: number;
  fleetNumber: string;
  routeNumber: string;
  driverName: string;
  startsAt: string;
  delayMinutes: number | null;
}

export interface DispatcherRoutePoint {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
}

export interface DispatcherVehicleMonitoring {
  vehicle: {
    vehicleId: number;
    fleetNumber: string;
    routeId: number;
    routeNumber: string;
    routeDirection: DispatcherDirection;
    transportType: string;
    lon: string | null;
    lat: string | null;
    recordedAt: string | null;
    status: string;
    driverName: string | null;
  };
  routePoints: DispatcherRoutePoint[];
}

export interface DispatcherDeviationCheck {
  fleetNumber: string;
  status: string;
  tripId: number;
  routeNumber: string;
  driverName: string;
  startsAt: string;
  delayMinutes: number | null;
}

export interface CreateSchedulePayload {
  routeId?: number;
  vehicleId?: number;
  transportTypeId?: number;
  routeNumber?: string;
  direction?: DispatcherDirection;
  fleetNumber?: string;
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
}

export interface UpdateSchedulePayload {
  routeId?: number;
  vehicleId?: number;
  transportTypeId?: number;
  routeNumber?: string;
  direction?: DispatcherDirection;
  fleetNumber?: string;
  workStartTime?: string;
  workEndTime?: string;
  intervalMin?: number;
}

export interface AssignDriverPayload {
  driverId?: number;
  driverLogin?: string;
  vehicleId?: number;
  fleetNumber?: string;
  transportTypeId?: number;
  routeNumber?: string;
  direction?: DispatcherDirection;
  assignedAt?: string;
}

export function getDispatcherDashboard() {
  return apiGet<DispatcherDashboard>('/dispatcher/dashboard');
}

export function listDispatcherRoutes() {
  return apiGet<DispatcherRoute[]>('/dispatcher/routes');
}

export function listDispatcherSchedules() {
  return apiGet<DispatcherScheduleListItem[]>('/dispatcher/schedules');
}

export function getDispatcherSchedule(id: number) {
  return apiGet<DispatcherScheduleDetails>(`/dispatcher/schedules/${id}`);
}

export function createDispatcherSchedule(payload: CreateSchedulePayload) {
  return apiPost<{ id: number }>('/dispatcher/schedules', payload);
}

export function updateDispatcherSchedule(id: number, payload: UpdateSchedulePayload) {
  return apiPatch<{ ok: true }>(`/dispatcher/schedules/${id}`, payload);
}

export function listDispatcherDrivers() {
  return apiGet<DispatcherDriver[]>('/dispatcher/drivers');
}

export function listDispatcherVehicles() {
  return apiGet<DispatcherVehicle[]>('/dispatcher/vehicles');
}

export function listDispatcherAssignments() {
  return apiGet<DispatcherAssignment[]>('/dispatcher/assignments');
}

export function listDispatcherActiveTrips() {
  return apiGet<DispatcherActiveTrip[]>('/dispatcher/active-trips');
}

export function listDispatcherDeviations() {
  return apiGet<DispatcherDeviationItem[]>('/dispatcher/deviations');
}

export function assignDispatcherDriver(payload: AssignDriverPayload) {
  return apiPost<{ ok: true }>('/dispatcher/assignments', payload);
}

export function getDispatcherVehicleMonitoring(fleetNumber: string) {
  return apiGet<DispatcherVehicleMonitoring>(
    `/dispatcher/vehicles/${fleetNumber}/monitoring`
  );
}

export function detectDispatcherDeviation(
  fleetNumber: string,
  payload?: { currentTime?: string; lon?: number; lat?: number }
) {
  return apiPost<DispatcherDeviationCheck>(
    `/dispatcher/vehicles/${fleetNumber}/deviation`,
    payload
  );
}

export function getDispatcherRoutePoints(routeId: number) {
  return apiGet<DispatcherRoutePoint[]>(`/dispatcher/routes/${routeId}/points`);
}
