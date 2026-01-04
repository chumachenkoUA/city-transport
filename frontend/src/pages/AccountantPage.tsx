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
      setBudgetForm((prev) => ({ ...prev, income: '', expenses: '', note: '' }))
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
      setExpenseForm({ category: '', amount: '', description: '', occurredAt: formatDate(today), documentRef: '' })
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

  if (!user || !hasAccess) {
    return (
      <main className="page-shell flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-slate-800">Обмежений доступ</h2>
          <p className="mt-2 text-slate-600">
            Увійдіть під акаунтом бухгалтера.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-2">
        <div className="badge badge-warning w-fit">ct-accountant</div>
        <h1 className="text-3xl sm:text-4xl text-slate-900">
          Фінансовий контроль
        </h1>
        <p className="text-slate-500 max-w-2xl">
          Бюджетування, витрати, нарахування зарплат та звітність.
        </p>
      </header>

      <section className="grid-dashboard">
        {/* Budget */}
        <div className="card">
          <div className="card-header">
            <h2>Бюджет</h2>
          </div>
          <div className="space-y-4">
            <div className="form-group">
              <label>Місяць</label>
              <input
                type="date"
                value={budgetForm.month}
                onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })}
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label>Доходи (План)</label>
                <input
                  type="number"
                  value={budgetForm.income}
                  onChange={(e) => setBudgetForm({ ...budgetForm, income: e.target.value })}
                  className="input"
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Витрати (План)</label>
                <input
                  type="number"
                  value={budgetForm.expenses}
                  onChange={(e) => setBudgetForm({ ...budgetForm, expenses: e.target.value })}
                  className="input"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Примітка</label>
              <input
                value={budgetForm.note}
                onChange={(e) => setBudgetForm({ ...budgetForm, note: e.target.value })}
                className="input"
                placeholder="Коментар..."
              />
            </div>
            
            <button
              onClick={() => createBudgetMutation.mutate()}
              disabled={createBudgetMutation.isPending}
              className="btn btn-primary w-full"
            >
              Зберегти
            </button>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Останні бюджети</h3>
              {(budgetsQuery.data ?? []).slice(0, 4).map((budget) => (
                <div key={budget.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 text-sm">
                  <span className="font-mono text-slate-600">{budget.month.slice(0, 7)}</span>
                  <div className="text-right">
                    <div className="text-emerald-600">+{budget.income}</div>
                    <div className="text-rose-600">-{budget.expenses}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="card">
          <div className="card-header">
            <h2>Витрати</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label>Категорія</label>
                <input
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="input"
                  placeholder="Пальне"
                />
              </div>
              <div className="form-group">
                <label>Сума</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="input"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Документ</label>
              <input
                value={expenseForm.documentRef}
                onChange={(e) => setExpenseForm({ ...expenseForm, documentRef: e.target.value })}
                className="input"
                placeholder="№ Накладної"
              />
            </div>
            <button
              onClick={() => createExpenseMutation.mutate()}
              className="btn btn-secondary w-full"
            >
              Додати витрату
            </button>

            <div className="bg-slate-50 rounded-2xl p-4 mt-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  value={expensesQuery.from}
                  onChange={(e) => setExpensesQuery({ ...expensesQuery, from: e.target.value })}
                  className="input flex-1 py-1.5 text-xs bg-white"
                />
                <input
                  type="date"
                  value={expensesQuery.to}
                  onChange={(e) => setExpensesQuery({ ...expensesQuery, to: e.target.value })}
                  className="input flex-1 py-1.5 text-xs bg-white"
                />
              </div>
              <button onClick={() => expensesMutation.mutate()} className="btn btn-ghost w-full text-xs py-1">Оновити список</button>
              
              <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {(expensesMutation.data ?? []).map((row) => (
                  <div key={row.id} className="text-xs flex justify-between p-2 bg-white rounded border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-700">{row.category}</span>
                      <span className="text-slate-400 ml-2">{row.occurredAt.slice(0, 10)}</span>
                    </div>
                    <span className="font-mono text-slate-900">{row.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reports & Salaries (Combined Column) */}
        <div className="flex flex-col gap-6">
          {/* Reports */}
          <div className="card">
            <div className="card-header">
              <h2>Звітність</h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={reportQuery.from}
                  onChange={(e) => setReportQuery({ ...reportQuery, from: e.target.value })}
                  className="input w-full"
                />
                <input
                  type="date"
                  value={reportQuery.to}
                  onChange={(e) => setReportQuery({ ...reportQuery, to: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => incomeMutation.mutate()} className="btn btn-secondary text-xs">Доходи</button>
                <button onClick={() => reportMutation.mutate()} className="btn btn-primary text-xs">Повний звіт</button>
              </div>

              {incomeMutation.data && (
                <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-400">Поповн.</div>
                    <div className="font-bold text-slate-700">{incomeMutation.data.topupsTotal}</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-400">Квитки</div>
                    <div className="font-bold text-slate-700">{incomeMutation.data.ticketsTotal}</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-400">Штрафи</div>
                    <div className="font-bold text-slate-700">{incomeMutation.data.finesTotal}</div>
                  </div>
                </div>
              )}

              {reportMutation.data && (
                <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <div className="text-sm text-emerald-600 mb-1">Чистий прибуток</div>
                  <div className="text-2xl font-bold text-emerald-700">{reportMutation.data.net}</div>
                  <div className="text-xs text-emerald-500 mt-1">
                    Витрати: {reportMutation.data.expensesTotal} | ЗП: {reportMutation.data.salariesTotal}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Salaries Quick Form */}
          <div className="card flex-1">
            <div className="card-header">
              <h2>Зарплата</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>ID Водія</label>
                  <input
                    value={salaryForm.driverId}
                    onChange={(e) => setSalaryForm({ ...salaryForm, driverId: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Сума</label>
                  <input
                    value={salaryForm.total}
                    onChange={(e) => setSalaryForm({ ...salaryForm, total: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <button
                onClick={() => createSalaryMutation.mutate()}
                className="btn btn-secondary w-full"
              >
                Нарахувати
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AccountantPage