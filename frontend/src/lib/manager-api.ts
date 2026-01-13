import { apiDelete, apiGet, apiPost } from './api'

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
  transportTypeName: string
}

export type ManagerTransportType = {
  id: number
  name: string
}

export type ManagerVehicleModel = {
  id: number
  name: string
  capacity: number
  transportTypeId: number
  transportType: string
}

export type HireDriverPayload = {
  login: string
  password?: string
  email?: string
  phone?: string
  firstName: string
  lastName: string
  driverLicenseNumber?: string
  licenseCategories?: string
  passportSeries?: string
  passportNumber?: string
}

export type CreateVehiclePayload = {
  fleetNumber: string
  transportTypeId: number
  modelId: number
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

export function getManagerModels() {
  return apiGet<ManagerVehicleModel[]>('/manager/models')
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

// Staff user management

export type StaffRole = 'dispatcher' | 'controller' | 'accountant' | 'municipality' | 'manager'

export type StaffRoleInfo = {
  role_name: string
  description: string
}

export type CreateStaffUserPayload = {
  login: string
  password: string
  role: StaffRole
  fullName?: string
  email?: string
  phone?: string
}

export function getStaffRoles() {
  return apiGet<StaffRoleInfo[]>('/manager/staff-roles')
}

export function createStaffUser(payload: CreateStaffUserPayload) {
  return apiPost<{ ok: true }>('/manager/staff', payload)
}

export function removeStaffUser(login: string) {
  return apiDelete<{ ok: true }>(`/manager/staff/${login}`)
}
