import { apiGet, apiPatch, apiPost } from './api'

export type MunicipalityTransportType = {
  id: number
  name: string
}

export type MunicipalityStop = {
  id: number
  name: string
  lon: string
  lat: string
}

export type MunicipalityRoute = {
  id: number
  number: string
  direction: string
  isActive: boolean
  transportTypeId: number
  transportType: string
}

export type MunicipalityRouteStop = {
  id: number
  routeId: number
  stopId: number
  stopName: string
  lon: string
  lat: string
  prevRouteStopId: number | null
  nextRouteStopId: number | null
  distanceToNextKm: string | null
}

export type MunicipalityRoutePoint = {
  id: number
  routeId: number
  lon: string
  lat: string
  prevRoutePointId: number | null
  nextRoutePointId: number | null
}

export type RouteStopInput = {
  stopId?: number
  name?: string
  lon?: number
  lat?: number
  distanceToNextKm?: number
}

export type RoutePointInput = {
  lon: number
  lat: number
}

export type CreateMunicipalityRoutePayload = {
  transportTypeId: number
  number: string
  direction: 'forward' | 'reverse'
  isActive?: boolean
  stops: RouteStopInput[]
  points: RoutePointInput[]
}

export type PassengerFlowRow = {
  tripDate: string
  routeNumber: string
  transportType: string
  passengerCount: number
}

export type ComplaintRow = {
  id: number
  type: string
  message: string
  status: string
  createdAt: string
  routeNumber: string | null
  transportType: string | null
  fleetNumber: string | null
  contactInfo: string | null
}

export function getMunicipalityTransportTypes() {
  return apiGet<MunicipalityTransportType[]>('/municipality/transport-types')
}

export function getMunicipalityStops() {
  return apiGet<MunicipalityStop[]>('/municipality/stops')
}

export function createMunicipalityStop(payload: {
  name: string
  lon: number
  lat: number
}) {
  return apiPost<{ id: number }>('/municipality/stops', payload)
}

export function updateMunicipalityStop(
  id: number,
  payload: {
    name: string
    lon: number
    lat: number
  }
) {
  return apiPatch<{ success: true }>(`/municipality/stops/${id}`, payload)
}

export function getMunicipalityRoutes() {
  return apiGet<MunicipalityRoute[]>('/municipality/routes')
}

export function setMunicipalityRouteActive(routeId: number, isActive: boolean) {
  return apiPatch<{ success: true }>(`/municipality/routes/${routeId}/active`, {
    isActive,
  })
}

export function createMunicipalityRoute(payload: CreateMunicipalityRoutePayload) {
  return apiPost<{
    route: MunicipalityRoute
    routeStops: MunicipalityRouteStop[]
    routePoints: MunicipalityRoutePoint[]
  }>('/municipality/routes', payload)
}

export function getMunicipalityRouteStops(routeId: number) {
  return apiGet<MunicipalityRouteStop[]>(`/municipality/routes/${routeId}/stops`)
}

export function getMunicipalityRoutePoints(routeId: number) {
  return apiGet<MunicipalityRoutePoint[]>(`/municipality/routes/${routeId}/points`)
}

export function getPassengerFlow(params: {
  from: string
  to: string
  routeNumber?: string
  transportTypeId?: number
}) {
  return apiGet<PassengerFlowRow[]>('/municipality/passenger-flow', params)
}

export function getComplaints(params: {
  from: string
  to: string
  routeNumber?: string
  transportTypeId?: number
  fleetNumber?: string
}) {
  return apiGet<ComplaintRow[]>('/municipality/complaints', params)
}

export function updateComplaintStatus(id: number, status: string) {
  return apiPatch<{ success: true }>(`/municipality/complaints/${id}/status`, {
    status,
  })
}
