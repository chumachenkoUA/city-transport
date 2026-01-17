// API functions for passenger endpoints

import { apiGet, apiPost } from './api';
import type { Stop } from './guest-api';

// Types
export interface PassengerProfile {
  id: number;
  login: string;
  fullName: string;
  email: string;
  phone: string;
  registeredAt: string;
}

export interface PassengerCard {
  id: number;
  cardNumber: string;
  balance: string; // decimal string
  issuedAt: string;
  lastUsedAt?: string;
}

export interface Trip {
  id: number;
  routeNumber: string;
  transportType: string;
  cost: string;
  startedAt: string;
  endedAt?: string;
}

export interface Fine {
  id: number;
  amount: string;
  reason: string;
  issuedAt: string;
  paidAt?: string;
  status: string;
}

export interface CreateAppealDto {
  message: string;
}

export interface TopUpDto {
  amount: number;
}

export interface CreatePassengerComplaintDto {
  type: 'complaint' | 'suggestion';
  message: string;
  routeNumber?: string;
  transportType?: string;
  vehicleNumber?: string;
}

// API functions

export function getMyProfile() {
  return apiGet<PassengerProfile | null>('/passenger/profile');
}

export function getMyCard() {
  return apiGet<PassengerCard | null>('/passenger/card');
}

export interface TopUpHistory {
  id: number;
  amount: string;
  toppedUpAt: string;
}

export function getMyTopUps(limit: number = 3) {
  return apiGet<TopUpHistory[]>(`/passenger/card/top-ups?limit=${limit}`);
}

export function topUpCard(cardNumber: string, amount: number) {
  return apiPost<void>(`/passenger/cards/${cardNumber}/top-up`, { amount });
}

export function getMyTrips() {
  return apiGet<Trip[]>('/passenger/trips');
}

export function getMyFines() {
  return apiGet<Fine[]>('/passenger/fines');
}

export function payFine(fineId: number, cardId: number) {
  return apiPost(`/passenger/fines/${fineId}/pay`, { cardId });
}

export function createAppeal(fineId: number, message: string) {
  return apiPost<void>(`/passenger/fines/${fineId}/appeals`, { message });
}

export function createPassengerComplaint(data: CreatePassengerComplaintDto) {
  return apiPost<void>('/passenger/complaints', data);
}

// Reuse guest types for stops if needed, or define specific ones
export function getStopsNear(params: {
  longitude: number;
  latitude: number;
  radiusMeters: number;
}) {
  return apiGet<Stop[]>('/passenger/stops/near', {
    lon: params.longitude,
    lat: params.latitude,
    radius: params.radiusMeters,
  });
}

// Additional route endpoints

export interface PassengerRoute {
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

export interface PassengerRouteStop {
  id: number;           // route_stops table ID
  stopId: number;       // actual stop ID
  stopName: string;
  lon: string;
  lat: string;
  distanceToNextKm: string | null;
}

export interface PassengerRoutePoint {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
}

export interface PassengerRouteSegment {
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

export interface PassengerRouteOption {
  totalTimeMin: number;
  totalDistanceKm: number;
  transferCount: number;
  segments: PassengerRouteSegment[];
}

export interface FineDetails extends Fine {
  cardNumber?: string;
  routeNumber?: string;
  fleetNumber?: string;
  controllerName?: string;
}

export interface BuyTicketDto {
  cardNumber: string;
  routeId?: number;
  routeNumber?: string;
  tripId?: number;
}

export function getRoutesByStop(stopId: number) {
  return apiGet<PassengerRoute[]>(`/passenger/stops/${stopId}/routes`);
}

export function getRouteStops(params: {
  routeId?: number;
  routeNumber?: string;
  transportTypeId?: number;
  direction?: string;
}) {
  return apiGet<PassengerRouteStop[]>('/passenger/routes/stops', params);
}

export function getRoutePoints(params: {
  routeId?: number;
  routeNumber?: string;
  transportTypeId?: number;
  direction?: string;
}) {
  return apiGet<PassengerRoutePoint[]>('/passenger/routes/points', params);
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
  return apiGet<PassengerRouteOption[]>('/passenger/routes/plan', params);
}

export function getSchedule(params: {
  routeId?: number;
  routeNumber?: string;
  transportTypeId?: number;
  direction?: string;
}) {
  return apiGet('/passenger/routes/schedule', params);
}

export function buyTicket(payload: BuyTicketDto) {
  return apiPost<{ ticketId: number }>('/passenger/tickets/buy', payload);
}

export function getFineDetails(fineId: number) {
  return apiGet<FineDetails>(`/passenger/fines/${fineId}`);
}
