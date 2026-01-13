// API functions for guest endpoints

import { apiGet, apiPost } from './api';

// Types
export interface TransportType {
  id: number;
  name: string;
}

export interface Route {
  routeId?: number;
  id?: number;
  number?: string;
  routeNumber?: string;
  transportTypeId: number;
  transportType?: string;
  transportTypeName?: string;
  direction?: string;
  intervalMin?: number | null;
  nextArrivalMin?: number | null;
}

export interface Stop {
  id: number;
  name: string;
  lon: number;
  lat: number;
  distanceM?: number;
}

export interface RouteGeometry {
  routeId: number;
  number: string;
  transportTypeId?: number;
  transportType?: string;
  direction?: string;
  geometry: GeoJSON.LineString;
}

export interface StopGeometry {
  id: number;
  name: string;
  geometry: GeoJSON.Point;
}

export interface ComplaintDto {
  type: 'complaint' | 'suggestion';
  message: string;
  contactInfo?: string;
  routeNumber?: string;
  transportType?: string;
  vehicleNumber?: string;
}

// API functions
export function getTransportTypes() {
  return apiGet<TransportType[]>('/guest/transport-types');
}

export function getRoutes(transportTypeId?: number) {
  return apiGet<Route[]>('/guest/routes', { transportTypeId });
}

export function getStopsNear(params: {
  longitude: number;
  latitude: number;
  radiusMeters: number;
}) {
  return apiGet<Stop[]>('/guest/stops/near', {
    lon: params.longitude,
    lat: params.latitude,
    radius: params.radiusMeters,
  });
}

export function getRoutesByStop(stopId: number) {
  return apiGet<Route[]>(`/guest/stops/${stopId}/routes`);
}

export function getRouteStops(params: {
  routeId: number;
  direction?: string;
}) {
  return apiGet<Stop[]>('/guest/routes/stops', params);
}

export function getRouteGeometry(params: {
  routeId: number;
  direction?: string;
}) {
  return apiGet<RouteGeometry>('/guest/routes/geometry', params);
}

export function getAllRouteGeometries(transportTypeId?: number) {
  return apiGet<RouteGeometry[]>('/guest/routes/geometries', { transportTypeId });
}

export function getStopGeometries() {
  return apiGet<StopGeometry[]>('/guest/stops/geometries');
}

export function submitComplaint(data: ComplaintDto) {
  return apiPost('/guest/complaints', data);
}

export function getRouteGeometryBetweenStops(params: {
  routeId: number;
  fromStopId: number;
  toStopId: number;
}) {
  return apiGet<GeoJSON.LineString>('/guest/routes/geometry-between', params);
}

export interface RouteSchedule {
  scheduleId: number;
  routeId: number;
  routeNumber: string;
  transportType: string;
  transportTypeId: number;
  direction: string;
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
  validFrom: string | null;
  validTo: string | null;
  stopId?: number;
  stopName?: string;
  stopLon?: number;
  stopLat?: number;
}

export interface DetailedRouteSchedule {
  route: {
    id: string | number;
    number: string;
    transportTypeId: string | number;
    transportTypeName: string;
    direction: string;
  };
  stop: {
    id: number;
    name: string;
    offsetMin: number | null;
  } | null;
  schedule: {
    workStartTime: string;
    workEndTime: string;
    intervalMin: number;
  };
  departures: string[];
  arrivals: string[];
}

export function getRouteSchedule(params: {
  routeId?: number;
  routeNumber?: string;
  transportTypeId?: number;
  direction?: string;
  stopId?: number;
}) {
  return apiGet<DetailedRouteSchedule>('/guest/routes/schedule', params);
}

// ================================================
// Route Planning Types and Functions
// ================================================

export interface RouteSegment {
  routeId: number;
  routeNumber: string;
  transportTypeName: string;
  transportTypeId: number;
  direction: string;
  fromStop: {
    id: number;
    name: string;
    lon: number;
    lat: number;
  };
  toStop: {
    id: number;
    name: string;
    lon: number;
    lat: number;
  };
  distanceKm: number;
  travelTimeMin: number;
  departureTime: string;
  arrivalTime: string;
}

export interface RouteOption {
  totalTimeMin: number;
  totalDistanceKm: number;
  transferCount: number;
  segments: RouteSegment[];
  transfer?: {
    stopId: number;
    stopName: string;
    lon: number;
    lat: number;
    waitTimeMin: number;
  };
  transfers?: Array<{
    stopId: number;
    stopName: string;
    lon: number;
    lat: number;
    waitTimeMin: number;
  }>;
}

export interface StopSearchResult {
  id: number;
  name: string;
  lon: number;
  lat: number;
}

export function planRoute(params: {
  lonA: number;
  latA: number;
  lonB: number;
  latB: number;
  radius?: number;
  maxWaitMin?: number;
  maxResults?: number;
}) {
  return apiGet<RouteOption[]>('/guest/routes/plan', params);
}

export function searchStops(params: {
  q: string;
  limit?: number;
}) {
  return apiGet<StopSearchResult[]>('/guest/stops/search', params);
}

// Additional endpoints

export interface RoutePoint {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
  prevRoutePointId: number | null;
  nextRoutePointId: number | null;
}

export function getRoutePoints(params: {
  routeId?: number;
  routeNumber?: string;
  transportTypeId?: number;
  direction?: string;
}) {
  return apiGet<RoutePoint[]>('/guest/routes/points', params);
}

export function getRoutesBetween(params: {
  fromLon: number;
  fromLat: number;
  toLon: number;
  toLat: number;
  radius?: number;
}) {
  return apiGet<Route[]>('/guest/routes/near', params);
}
