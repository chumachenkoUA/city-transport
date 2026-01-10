import { apiGet, apiPost } from './api'

export type ControllerCardDetails = {
  id: number
  cardNumber: string
  balance: string
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

export function checkControllerCard(cardNumber: string) {
  return apiGet<ControllerCardDetails>(`/controller/cards/${cardNumber}/check`)
}

export function issueControllerFine(payload: IssueFinePayload) {
  return apiPost<{ fineId: number }>('/controller/fines', payload)
}
