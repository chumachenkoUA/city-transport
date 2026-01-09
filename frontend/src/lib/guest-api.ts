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
  transportType: string;
  direction?: string;
  intervalMin?: number | null;
  nextArrivalMin?: number | null;
}

export interface Stop {
  stop_id: number;
  name: string;
  longitude: number;
  latitude: number;
}

export interface RouteGeometry {
  routeId: number;
  number: string;
  transportTypeId: number;
  transportType: string;
  direction?: string;
  geometry: GeoJSON.LineString;
}

export interface StopGeometry {
  id: number;
  name: string;
  geometry: GeoJSON.Point;
}

export interface ComplaintDto {
  description: string;
  route_id?: number;
  stop_id?: number;
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
  return apiGet<Stop[]>('/guest/stops/near', params);
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

export function getRouteSchedule(params: {
  routeId?: number;
  routeNumber?: string;
  transportTypeId?: number;
  direction?: string;
  stopId?: number;
}) {
  return apiGet('/guest/routes/schedule', params);
}

// ================================================
// Route Planning Types and Functions
// ================================================

export interface RouteSegment {
  routeId: number;
  routeNumber: string;
  transportType: string;
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
