import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

type BudgetRow = {
  id: number
  month: string
  income: string
  expenses: string
  note: string | null
}

type ExpenseRow = {
  id: number
  category: string
  amount: string
  description: string | null
  documentRef: string | null
  occurredAt: string
}

type SalaryRow = {
  id: number
  driverId: number | null
  employeeName: string | null
  employeeRole: string | null
  rate: string | null
  units: number | null
  total: string
  paidAt: string
}

const today = new Date()
const thirtyDaysAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
const formatDate = (date: Date) => date.toISOString().slice(0, 10)

function AccountantPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_accountant_role')
  const queryClient = useQueryClient()

  const [budgetForm, setBudgetForm] = useState({
    month: formatDate(today).slice(0, 7) + '-01',
    income: '',
    expenses: '',
    note: '',
  })
  const [expensesQuery, setExpensesQuery] = useState({
    from: formatDate(thirtyDaysAgo),
    to: formatDate(today),
    category: '',
  })
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    amount: '',
    description: '',
    occurredAt: formatDate(today),
    documentRef: '',
  })
  const [salaryForm, setSalaryForm] = useState({
    driverId: '',
    employeeName: '',
    employeeRole: '',
    rate: '',
    units: '',
    total: '',
    paidAt: formatDate(today),
  })
  const [salariesQuery, setSalariesQuery] = useState({
    from: formatDate(thirtyDaysAgo),
    to: formatDate(today),
    role: '',
  })
  const [incomeQuery, setIncomeQuery] = useState({
    from: formatDate(thirtyDaysAgo),
    to: formatDate(today),
  })
  const [reportQuery, setReportQuery] = useState({
    from: formatDate(thirtyDaysAgo),
    to: formatDate(today),
  })

  const budgetsQuery = useQuery({
    queryKey: ['accountant', 'budgets'],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await api.get('/accountant/budgets')
      return response.data as BudgetRow[]
    },
  })

  const expensesMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {
        from: expensesQuery.from,
        to: expensesQuery.to,
      }
      if (expensesQuery.category) {
        params.category = expensesQuery.category
      }
      const response = await api.get('/accountant/expenses', { params })
      return response.data as ExpenseRow[]
    },
  })

  const salariesMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {
        from: salariesQuery.from,
        to: salariesQuery.to,
      }
      if (salariesQuery.role) {
        params.role = salariesQuery.role
      }
      const response = await api.get('/accountant/salaries', { params })
      return response.data as SalaryRow[]
    },
  })

  const incomeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/accountant/income', {
        params: incomeQuery,
      })
      return response.data as {
        topupsTotal: string
        ticketsTotal: string
        finesTotal: string
      }
    },
  })

  const reportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/accountant/report', {
        params: reportQuery,
      })
      return response.data as {
        net: string
        expensesTotal: string
        salariesTotal: string
      }
    },
  })

  const createBudgetMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        month: budgetForm.month,
        income: Number(budgetForm.income),
        expenses: Number(budgetForm.expenses),
        note: budgetForm.note || undefined,
      }
      const response = await api.post('/accountant/budgets', payload)
      return response.data as { id: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountant', 'budgets'] })
    },
  })

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        description: expenseForm.description || undefined,
        occurredAt: expenseForm.occurredAt,
        documentRef: expenseForm.documentRef || undefined,
      }
      const response = await api.post('/accountant/expenses', payload)
      return response.data as { id: number }
    },
    onSuccess: () => {
      expensesMutation.mutate()
    },
  })

  const createSalaryMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        driverId: salaryForm.driverId ? Number(salaryForm.driverId) : undefined,
        employeeName: salaryForm.employeeName || undefined,
        employeeRole: salaryForm.employeeRole || undefined,
        rate: salaryForm.rate ? Number(salaryForm.rate) : undefined,
        units: salaryForm.units ? Number(salaryForm.units) : undefined,
        total: Number(salaryForm.total),
        paidAt: salaryForm.paidAt,
      }
      const response = await api.post('/accountant/salaries', payload)
      return response.data as { id: number }
    },
    onSuccess: () => {
      salariesMutation.mutate()
    },
  })

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">Доступ бухгалтера</h2>
          <p className="mt-2 text-slate-600">
            Увійдіть під акаунтом бухгалтера, щоб бачити фінансові дані.
          </p>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">Немає доступу</h2>
          <p className="mt-2 text-slate-600">
            Цей акаунт не має ролі бухгалтера.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="rounded-3xl border border-white/70 bg-white/70 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          ct-accountant
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Фінанси: бюджет, витрати, доходи, зарплата
        </h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Бюджет на місяць
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={budgetForm.month}
              onChange={(event) =>
                setBudgetForm((prev) => ({ ...prev, month: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Планові доходи"
              value={budgetForm.income}
              onChange={(event) =>
                setBudgetForm((prev) => ({ ...prev, income: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Планові витрати"
              value={budgetForm.expenses}
              onChange={(event) =>
                setBudgetForm((prev) => ({
                  ...prev,
                  expenses: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Коментар"
              value={budgetForm.note}
              onChange={(event) =>
                setBudgetForm((prev) => ({ ...prev, note: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => createBudgetMutation.mutate()}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Зберегти бюджет
          </button>
          <div className="mt-4 space-y-2 text-sm">
            {(budgetsQuery.data ?? []).slice(0, 6).map((budget) => (
              <div
                key={budget.id}
                className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2"
              >
                {budget.month} · {budget.income} доходи · {budget.expenses}{' '}
                витрати
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Фінансові звіти
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={reportQuery.from}
              onChange={(event) =>
                setReportQuery((prev) => ({ ...prev, from: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={reportQuery.to}
              onChange={(event) =>
                setReportQuery((prev) => ({ ...prev, to: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => reportMutation.mutate()}
            className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Сформувати звіт
          </button>
          {reportMutation.data && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Чистий результат: {reportMutation.data.net}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Облік витрат
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Категорія"
              value={expenseForm.category}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  category: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Сума"
              value={expenseForm.amount}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  amount: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Документ"
              value={expenseForm.documentRef}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  documentRef: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={expenseForm.occurredAt}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  occurredAt: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => createExpenseMutation.mutate()}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Додати витрату
          </button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={expensesQuery.from}
              onChange={(event) =>
                setExpensesQuery((prev) => ({
                  ...prev,
                  from: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={expensesQuery.to}
              onChange={(event) =>
                setExpensesQuery((prev) => ({
                  ...prev,
                  to: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Категорія"
              value={expensesQuery.category}
              onChange={(event) =>
                setExpensesQuery((prev) => ({
                  ...prev,
                  category: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => expensesMutation.mutate()}
            className="mt-3 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Показати витрати
          </button>
          <div className="mt-4 space-y-2 text-sm">
            {(expensesMutation.data ?? []).map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2"
              >
                {row.occurredAt.slice(0, 10)} · {row.category} · {row.amount}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">Доходи</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={incomeQuery.from}
              onChange={(event) =>
                setIncomeQuery((prev) => ({
                  ...prev,
                  from: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={incomeQuery.to}
              onChange={(event) =>
                setIncomeQuery((prev) => ({
                  ...prev,
                  to: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => incomeMutation.mutate()}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Порахувати
          </button>
          {incomeMutation.data && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2">
                Поповнення: {incomeMutation.data.topupsTotal}
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2">
                Квитки: {incomeMutation.data.ticketsTotal}
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2">
                Штрафи: {incomeMutation.data.finesTotal}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">Зарплати</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="ID водія"
              value={salaryForm.driverId}
              onChange={(event) =>
                setSalaryForm((prev) => ({
                  ...prev,
                  driverId: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Ім’я працівника"
              value={salaryForm.employeeName}
              onChange={(event) =>
                setSalaryForm((prev) => ({
                  ...prev,
                  employeeName: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Роль"
              value={salaryForm.employeeRole}
              onChange={(event) =>
                setSalaryForm((prev) => ({
                  ...prev,
                  employeeRole: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Ставка"
              value={salaryForm.rate}
              onChange={(event) =>
                setSalaryForm((prev) => ({ ...prev, rate: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="К-сть годин/змін"
              value={salaryForm.units}
              onChange={(event) =>
                setSalaryForm((prev) => ({ ...prev, units: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Сума"
              value={salaryForm.total}
              onChange={(event) =>
                setSalaryForm((prev) => ({ ...prev, total: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={salaryForm.paidAt}
              onChange={(event) =>
                setSalaryForm((prev) => ({ ...prev, paidAt: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => createSalaryMutation.mutate()}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Нарахувати зарплату
          </button>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Аналіз зарплат
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={salariesQuery.from}
              onChange={(event) =>
                setSalariesQuery((prev) => ({
                  ...prev,
                  from: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={salariesQuery.to}
              onChange={(event) =>
                setSalariesQuery((prev) => ({
                  ...prev,
                  to: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Роль"
              value={salariesQuery.role}
              onChange={(event) =>
                setSalariesQuery((prev) => ({
                  ...prev,
                  role: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => salariesMutation.mutate()}
            className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Показати нарахування
          </button>
          <div className="mt-4 space-y-2 text-sm">
            {(salariesMutation.data ?? []).map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2"
              >
                {row.paidAt.slice(0, 10)} · {row.employeeRole ?? '—'} ·{' '}
                {row.total}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default AccountantPage
