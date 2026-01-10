// API functions for dispatcher endpoints

import { apiGet, apiPatch, apiPost } from './api';

export type DispatcherDirection = 'forward' | 'reverse';

export interface DispatcherRoute {
  id: number;
  number: string;
  direction: DispatcherDirection;
  transportTypeId: number;
  transportType: string;
}

export interface DispatcherScheduleListItem {
  id: number;
  routeNumber: string;
  transportType: string;
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
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
  transportType: string;
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
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
  fleetNumber: string;
  routeNumber: string;
  transportType: string;
  lastRecordedAt: string;
  status: string;
  driverName: string;
}

export interface DispatcherRoutePoint {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
}

export interface DispatcherVehicleMonitoring {
  vehicle: {
    fleetNumber: string;
    routeNumber: string;
    transportType: string;
    lon: string;
    lat: string;
    recordedAt: string;
    status: string;
    driverName: string;
  };
  routePoints: DispatcherRoutePoint[];
}

export interface DispatcherDeviationCheck {
  fleetNumber: string;
  status: string;
  deviation: string;
  details: DispatcherVehicleMonitoring['vehicle'];
}

export interface CreateSchedulePayload {
  routeId?: number;
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
  transportTypeId?: number;
  routeNumber?: string;
  direction?: DispatcherDirection;
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
  payload?: { currentTime?: string }
) {
  return apiPost<DispatcherDeviationCheck>(
    `/dispatcher/vehicles/${fleetNumber}/deviation`,
    payload
  );
}
