import { apiGet, apiPost } from './api'

export type BudgetRow = {
  id: number
  month: string
  plannedIncome: number | string
  plannedExpenses: number | string
  note?: string | null
}

export type BudgetQuery = {
  month?: string
  limit?: number
  offset?: number
}

export type UpsertBudgetPayload = {
  month: string
  income: number
  expenses: number
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

export type SalaryRow = {
  id: number
  paidAt: string
  employeeName: string
  role: string
  total: number | string
}

export type SalariesQuery = {
  employeeName?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type CreateSalaryPayload = {
  driverId?: number
  employeeName?: string
  employeeRole?: string
  rate?: number
  units?: number
  total: number
  paidAt?: string
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
