import { apiGet, apiPost } from './api'

export type ControllerCardDetails = {
  id: number
  cardNumber: string
  balance: string
  userFullName: string
  lastUsageAt: string | null
  lastRouteNumber: string | null
  lastTransportType: string | null
}

export type IssueFinePayload = {
  cardNumber: string
  fleetNumber?: string
  routeNumber?: string
  tripId?: number
  checkedAt?: string
  amount: number
  reason: string
  status?: string
  issuedAt?: string
}

export type Route = {
  id: number
  number: string
  transportType: string
}

export type Vehicle = {
  id: number
  fleetNumber: string
  routeId: number
  routeNumber: string
  transportType: string
  modelName: string
}

export type ControllerTrip = {
  tripId: number
  plannedStartsAt: string
  actualStartsAt: string | null
  routeNumber: string
  transportType: string
  driverName: string
  status: string
}

export function getRoutes() {
  return apiGet<Route[]>('/controller/routes')
}

export function getVehicles(routeId?: number) {
  const query = routeId ? `?routeId=${routeId}` : ''
  return apiGet<Vehicle[]>(`/controller/vehicles${query}`)
}

export function getActiveTrips(fleetNumber: string, checkedAt?: string) {
  const query = checkedAt ? `?checkedAt=${encodeURIComponent(checkedAt)}` : ''
  return apiGet<ControllerTrip[]>(
    `/controller/vehicles/${encodeURIComponent(fleetNumber)}/trips${query}`,
  )
}

export function checkControllerCard(cardNumber: string) {
  return apiGet<ControllerCardDetails>(`/controller/cards/${cardNumber}/check`)
}

export function issueControllerFine(payload: IssueFinePayload) {
  return apiPost<{ fineId: number }>('/controller/fines', payload)
}
