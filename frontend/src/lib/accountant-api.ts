import { apiGet, apiPost } from './api'

export type BudgetRow = {
  id: number
  month: string
  plannedIncome: number | string
  plannedExpenses: number | string
  actualIncome: number | string
  actualExpenses: number | string
  note?: string | null
}

export type BudgetQuery = {
  month?: string
  limit?: number
  offset?: number
}

export type UpsertBudgetPayload = {
  month: string
  plannedIncome: number
  plannedExpenses: number
  note?: string
}

export type ExpenseRow = {
  id: number
  category: string
  amount: number | string
  description?: string | null
  documentRef?: string | null
  occurredAt: string
}

export type ExpenseQuery = {
  category?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type CreateExpensePayload = {
  category: string
  amount: number
  description?: string
  documentRef?: string
  occurredAt?: string
}

export type IncomeSource = 'government' | 'tickets' | 'fines' | 'other'

export type IncomeRow = {
  id: number
  source: IncomeSource
  amount: number | string
  description?: string | null
  documentRef?: string | null
  receivedAt: string
}

export type IncomeQuery = {
  source?: IncomeSource
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type CreateIncomePayload = {
  source: IncomeSource
  amount: number
  description?: string
  documentRef?: string
  receivedAt?: string
}

export type DriverRow = {
  id: number
  fullName: string
  driverLicenseNumber: string
}

export type SalaryRow = {
  id: number
  paidAt: string
  driverId: number
  driverName: string
  licenseNumber: string
  rate: number | string | null
  units: number | null
  total: number | string
}

export type SalariesQuery = {
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type CreateSalaryPayload = {
  driverId: number
  rate?: number
  units?: number
  total?: number
}

export type ReportItem = {
  category: string
  amount: number
  type: string
}

export type ReportSummary = {
  totalIncome: number
  totalExpenses: number
  netProfit: number
}

export type FinancialReport = {
  period: { start: string; end: string }
  items: ReportItem[]
  summary: ReportSummary
}

export type PeriodQuery = {
  startDate?: string
  endDate?: string
}

export function getBudgets(params?: BudgetQuery) {
  return apiGet<BudgetRow[]>('/accountant/budgets', params)
}

export function upsertBudget(payload: UpsertBudgetPayload) {
  return apiPost<{ id: number }>('/accountant/budgets', payload)
}

export function createExpense(payload: CreateExpensePayload) {
  return apiPost<{ id: number }>('/accountant/expenses', payload)
}

export function getExpenses(params?: ExpenseQuery) {
  return apiGet<ExpenseRow[]>('/accountant/expenses', params)
}

export function getDrivers() {
  return apiGet<DriverRow[]>('/accountant/drivers')
}

export function createSalary(payload: CreateSalaryPayload) {
  return apiPost<{ id: number }>('/accountant/salaries', payload)
}

export function getSalaries(params?: SalariesQuery) {
  return apiGet<SalaryRow[]>('/accountant/salaries', params)
}

export function getFinancialReport(params?: PeriodQuery) {
  return apiGet<FinancialReport>('/accountant/report', params)
}

export function getIncomeSummary(params?: PeriodQuery) {
  return apiGet<{ income: ReportItem[] }>('/accountant/income', params)
}

export function createIncome(payload: CreateIncomePayload) {
  return apiPost<{ id: number }>('/accountant/incomes', payload)
}

export function getIncomes(params?: IncomeQuery) {
  return apiGet<IncomeRow[]>('/accountant/incomes', params)
}
