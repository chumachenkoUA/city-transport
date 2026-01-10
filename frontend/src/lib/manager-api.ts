import { apiGet, apiPost } from './api'

export type ManagerDriver = {
  id: number
  login: string
  fullName: string
  email: string
  phone: string
  driverLicenseNumber: string
  licenseCategories: unknown
}

export type ManagerVehicle = {
  id: number
  fleetNumber: string
  routeNumber: string
  transportType: string
  modelName: string
  capacity: number
}

export type ManagerRoute = {
  id: number
  number: string
  direction: string
  transportTypeId: number
  transportType: string
}

export type ManagerTransportType = {
  id: number
  name: string
}

export type HireDriverPayload = {
  login: string
  password?: string
  email: string
  phone: string
  fullName: string
  driverLicenseNumber: string
  licenseCategories: string[]
  passportData: {
    series: string
    number: string
  }
}

export type CreateVehiclePayload = {
  fleetNumber: string
  transportTypeId: number
  capacity: number
  routeId?: number
  routeNumber?: string
  direction?: string
}

export function getManagerDrivers() {
  return apiGet<ManagerDriver[]>('/manager/drivers')
}

export function getManagerVehicles() {
  return apiGet<ManagerVehicle[]>('/manager/vehicles')
}

export function getManagerRoutes() {
  return apiGet<ManagerRoute[]>('/manager/routes')
}

export function getManagerTransportTypes() {
  return apiGet<ManagerTransportType[]>('/manager/transport-types')
}

export function hireDriver(payload: HireDriverPayload) {
  return apiPost<{ id: number }>('/manager/drivers', payload)
}

export function addVehicle(payload: CreateVehiclePayload) {
  return apiPost<{ id: number }>('/manager/vehicles', payload)
}
