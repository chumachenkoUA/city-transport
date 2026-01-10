// API functions for passenger endpoints

import { apiGet, apiPost } from './api';
import type { Stop } from './guest-api';

// Types
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
  status: 'PENDING' | 'PAID' | 'APPEALED' | 'CANCELLED';
}

export interface CreateAppealDto {
  message: string;
}

export interface TopUpDto {
  amount: number;
}

export interface CreatePassengerComplaintDto {
  description: string;
  routeId?: number;
  stopId?: number;
  vehicleId?: number;
}

// API functions

export function getMyCard() {
  return apiGet<PassengerCard | null>('/passenger/card');
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

export function createAppeal(fineId: number, message: string) {
  return apiPost<void>(`/passenger/fines/${fineId}/appeals`, { message });
}

export function createPassengerComplaint(data: CreatePassengerComplaintDto) {
  return apiPost<void>('/passenger/complaints', data);
}

// Reuse guest types for stops if needed, or define specific ones
export function getPassengerStopsNear(params: {
  longitude: number;
  latitude: number;
  radiusMeters: number;
}) {
  return apiGet<Stop[]>('/passenger/stops/near', params);
}
