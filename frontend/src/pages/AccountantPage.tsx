import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

function AccountantPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_accountant_role')

  const [budgetsQuery, setBudgetsQuery] = useState({ month: '' })
  const [budgetById, setBudgetById] = useState({ id: '' })
  const [createBudgetForm, setCreateBudgetForm] = useState({
    month: '',
    income: '',
    expenses: '',
    note: '',
  })
  const [updateBudgetForm, setUpdateBudgetForm] = useState({
    id: '',
    month: '',
    income: '',
    expenses: '',
    note: '',
  })
  const [createExpenseForm, setCreateExpenseForm] = useState({
    category: '',
    amount: '',
    description: '',
    occurredAt: '',
    documentRef: '',
  })
  const [expensesQuery, setExpensesQuery] = useState({
    from: '',
    to: '',
    category: '',
  })
  const [createSalaryForm, setCreateSalaryForm] = useState({
    driverId: '',
    employeeName: '',
    employeeRole: '',
    rate: '',
    units: '',
    total: '',
    paidAt: '',
  })
  const [salariesQuery, setSalariesQuery] = useState({
    from: '',
    to: '',
    role: '',
  })
  const [incomeQuery, setIncomeQuery] = useState({ from: '', to: '' })
  const [reportQuery, setReportQuery] = useState({ from: '', to: '' })

  const budgetsMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {}
      if (budgetsQuery.month) {
        params.month = budgetsQuery.month
      }
      const response = await api.get('/accountant/budgets', { params })
      return response.data
    },
  })

  const budgetMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/accountant/budgets/${budgetById.id}`)
      return response.data
    },
  })

  const createBudgetMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        month: createBudgetForm.month,
        income: Number(createBudgetForm.income),
        expenses: Number(createBudgetForm.expenses),
      }
      if (createBudgetForm.note) {
        payload.note = createBudgetForm.note
      }
      const response = await api.post('/accountant/budgets', payload)
      return response.data
    },
  })

  const updateBudgetMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {}
      if (updateBudgetForm.month) {
        payload.month = updateBudgetForm.month
      }
      if (updateBudgetForm.income) {
        payload.income = Number(updateBudgetForm.income)
      }
      if (updateBudgetForm.expenses) {
        payload.expenses = Number(updateBudgetForm.expenses)
      }
      if (updateBudgetForm.note) {
        payload.note = updateBudgetForm.note
      }
      const response = await api.patch(
        `/accountant/budgets/${updateBudgetForm.id}`,
        payload,
      )
      return response.data
    },
  })

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        category: createExpenseForm.category,
        amount: Number(createExpenseForm.amount),
      }
      if (createExpenseForm.description) {
        payload.description = createExpenseForm.description
      }
      if (createExpenseForm.occurredAt) {
        payload.occurredAt = new Date(createExpenseForm.occurredAt).toISOString()
      }
      if (createExpenseForm.documentRef) {
        payload.documentRef = createExpenseForm.documentRef
      }
      const response = await api.post('/accountant/expenses', payload)
      return response.data
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
      return response.data
    },
  })

  const createSalaryMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        total: Number(createSalaryForm.total),
      }
      if (createSalaryForm.driverId) {
        payload.driverId = Number(createSalaryForm.driverId)
      }
      if (createSalaryForm.employeeName) {
        payload.employeeName = createSalaryForm.employeeName
      }
      if (createSalaryForm.employeeRole) {
        payload.employeeRole = createSalaryForm.employeeRole
      }
      if (createSalaryForm.rate) {
        payload.rate = Number(createSalaryForm.rate)
      }
      if (createSalaryForm.units) {
        payload.units = Number(createSalaryForm.units)
      }
      if (createSalaryForm.paidAt) {
        payload.paidAt = new Date(createSalaryForm.paidAt).toISOString()
      }
      const response = await api.post('/accountant/salaries', payload)
      return response.data
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
      return response.data
    },
  })

  const incomeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/accountant/income', {
        params: incomeQuery,
      })
      return response.data
    },
  })

  const reportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/accountant/report', {
        params: reportQuery,
      })
      return response.data
    },
  })

  if (!user) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">Accountant access</div>
          <p className="hero-body">Sign in with an accountant account.</p>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">No access</div>
          <p className="hero-body">
            This account does not have accountant permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="role-shell">
      <header className="role-header">
        <div>
          <p className="hero-kicker">Accountant desk</p>
          <h1>Budgets, expenses, salaries, and reports.</h1>
          <p className="hero-body">
            Track finances and generate income summaries.
          </p>
        </div>
        <span className="panel-chip">ct_accountant_role</span>
      </header>

      <div className="role-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            budgetsMutation.mutate()
          }}
        >
          <div className="panel-title">Budgets</div>
          <label>
            Month (YYYY-MM-01)
            <input
              type="date"
              value={budgetsQuery.month}
              onChange={(event) =>
                setBudgetsQuery({ month: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={budgetsMutation.isPending}>
            {budgetsMutation.isPending ? 'Loading...' : 'Get budgets'}
          </button>
          {budgetsMutation.error && (
            <div className="status error">
              {getErrorMessage(budgetsMutation.error, 'Request failed.')}
            </div>
          )}
          {budgetsMutation.data && (
            <pre className="result-block">
              {JSON.stringify(budgetsMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            budgetMutation.mutate()
          }}
        >
          <div className="panel-title">Budget by ID</div>
          <label>
            Budget ID
            <input
              type="number"
              min={1}
              value={budgetById.id}
              onChange={(event) => setBudgetById({ id: event.target.value })}
              required
            />
          </label>
          <button type="submit" disabled={budgetMutation.isPending}>
            {budgetMutation.isPending ? 'Loading...' : 'Get budget'}
          </button>
          {budgetMutation.error && (
            <div className="status error">
              {getErrorMessage(budgetMutation.error, 'Request failed.')}
            </div>
          )}
          {budgetMutation.data && (
            <pre className="result-block">
              {JSON.stringify(budgetMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createBudgetMutation.mutate()
          }}
        >
          <div className="panel-title">Create budget</div>
          <label>
            Month (YYYY-MM-01)
            <input
              type="date"
              value={createBudgetForm.month}
              onChange={(event) =>
                setCreateBudgetForm({
                  ...createBudgetForm,
                  month: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Income
            <input
              type="number"
              min={0}
              step={0.01}
              value={createBudgetForm.income}
              onChange={(event) =>
                setCreateBudgetForm({
                  ...createBudgetForm,
                  income: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Expenses
            <input
              type="number"
              min={0}
              step={0.01}
              value={createBudgetForm.expenses}
              onChange={(event) =>
                setCreateBudgetForm({
                  ...createBudgetForm,
                  expenses: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Note
            <input
              type="text"
              value={createBudgetForm.note}
              onChange={(event) =>
                setCreateBudgetForm({
                  ...createBudgetForm,
                  note: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={createBudgetMutation.isPending}>
            {createBudgetMutation.isPending ? 'Saving...' : 'Create budget'}
          </button>
          {createBudgetMutation.error && (
            <div className="status error">
              {getErrorMessage(createBudgetMutation.error, 'Request failed.')}
            </div>
          )}
          {createBudgetMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createBudgetMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateBudgetMutation.mutate()
          }}
        >
          <div className="panel-title">Update budget</div>
          <label>
            Budget ID
            <input
              type="number"
              min={1}
              value={updateBudgetForm.id}
              onChange={(event) =>
                setUpdateBudgetForm({
                  ...updateBudgetForm,
                  id: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Month
            <input
              type="date"
              value={updateBudgetForm.month}
              onChange={(event) =>
                setUpdateBudgetForm({
                  ...updateBudgetForm,
                  month: event.target.value,
                })
              }
            />
          </label>
          <label>
            Income
            <input
              type="number"
              min={0}
              step={0.01}
              value={updateBudgetForm.income}
              onChange={(event) =>
                setUpdateBudgetForm({
                  ...updateBudgetForm,
                  income: event.target.value,
                })
              }
            />
          </label>
          <label>
            Expenses
            <input
              type="number"
              min={0}
              step={0.01}
              value={updateBudgetForm.expenses}
              onChange={(event) =>
                setUpdateBudgetForm({
                  ...updateBudgetForm,
                  expenses: event.target.value,
                })
              }
            />
          </label>
          <label>
            Note
            <input
              type="text"
              value={updateBudgetForm.note}
              onChange={(event) =>
                setUpdateBudgetForm({
                  ...updateBudgetForm,
                  note: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={updateBudgetMutation.isPending}>
            {updateBudgetMutation.isPending ? 'Updating...' : 'Update budget'}
          </button>
          {updateBudgetMutation.error && (
            <div className="status error">
              {getErrorMessage(updateBudgetMutation.error, 'Request failed.')}
            </div>
          )}
          {updateBudgetMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateBudgetMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createExpenseMutation.mutate()
          }}
        >
          <div className="panel-title">Create expense</div>
          <label>
            Category
            <input
              type="text"
              value={createExpenseForm.category}
              onChange={(event) =>
                setCreateExpenseForm({
                  ...createExpenseForm,
                  category: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={createExpenseForm.amount}
              onChange={(event) =>
                setCreateExpenseForm({
                  ...createExpenseForm,
                  amount: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Description
            <input
              type="text"
              value={createExpenseForm.description}
              onChange={(event) =>
                setCreateExpenseForm({
                  ...createExpenseForm,
                  description: event.target.value,
                })
              }
            />
          </label>
          <label>
            Occurred at
            <input
              type="datetime-local"
              value={createExpenseForm.occurredAt}
              onChange={(event) =>
                setCreateExpenseForm({
                  ...createExpenseForm,
                  occurredAt: event.target.value,
                })
              }
            />
          </label>
          <label>
            Document ref
            <input
              type="text"
              value={createExpenseForm.documentRef}
              onChange={(event) =>
                setCreateExpenseForm({
                  ...createExpenseForm,
                  documentRef: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={createExpenseMutation.isPending}>
            {createExpenseMutation.isPending ? 'Saving...' : 'Create expense'}
          </button>
          {createExpenseMutation.error && (
            <div className="status error">
              {getErrorMessage(createExpenseMutation.error, 'Request failed.')}
            </div>
          )}
          {createExpenseMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createExpenseMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            expensesMutation.mutate()
          }}
        >
          <div className="panel-title">Expenses</div>
          <label>
            From
            <input
              type="date"
              value={expensesQuery.from}
              onChange={(event) =>
                setExpensesQuery({ ...expensesQuery, from: event.target.value })
              }
              required
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={expensesQuery.to}
              onChange={(event) =>
                setExpensesQuery({ ...expensesQuery, to: event.target.value })
              }
              required
            />
          </label>
          <label>
            Category
            <input
              type="text"
              value={expensesQuery.category}
              onChange={(event) =>
                setExpensesQuery({
                  ...expensesQuery,
                  category: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={expensesMutation.isPending}>
            {expensesMutation.isPending ? 'Loading...' : 'Get expenses'}
          </button>
          {expensesMutation.error && (
            <div className="status error">
              {getErrorMessage(expensesMutation.error, 'Request failed.')}
            </div>
          )}
          {expensesMutation.data && (
            <pre className="result-block">
              {JSON.stringify(expensesMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createSalaryMutation.mutate()
          }}
        >
          <div className="panel-title">Salary payment</div>
          <label>
            Driver ID
            <input
              type="number"
              min={1}
              value={createSalaryForm.driverId}
              onChange={(event) =>
                setCreateSalaryForm({
                  ...createSalaryForm,
                  driverId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Employee name
            <input
              type="text"
              value={createSalaryForm.employeeName}
              onChange={(event) =>
                setCreateSalaryForm({
                  ...createSalaryForm,
                  employeeName: event.target.value,
                })
              }
            />
          </label>
          <label>
            Employee role
            <input
              type="text"
              value={createSalaryForm.employeeRole}
              onChange={(event) =>
                setCreateSalaryForm({
                  ...createSalaryForm,
                  employeeRole: event.target.value,
                })
              }
            />
          </label>
          <label>
            Rate
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={createSalaryForm.rate}
              onChange={(event) =>
                setCreateSalaryForm({
                  ...createSalaryForm,
                  rate: event.target.value,
                })
              }
            />
          </label>
          <label>
            Units
            <input
              type="number"
              min={1}
              value={createSalaryForm.units}
              onChange={(event) =>
                setCreateSalaryForm({
                  ...createSalaryForm,
                  units: event.target.value,
                })
              }
            />
          </label>
          <label>
            Total
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={createSalaryForm.total}
              onChange={(event) =>
                setCreateSalaryForm({
                  ...createSalaryForm,
                  total: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Paid at
            <input
              type="datetime-local"
              value={createSalaryForm.paidAt}
              onChange={(event) =>
                setCreateSalaryForm({
                  ...createSalaryForm,
                  paidAt: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={createSalaryMutation.isPending}>
            {createSalaryMutation.isPending ? 'Saving...' : 'Create payment'}
          </button>
          {createSalaryMutation.error && (
            <div className="status error">
              {getErrorMessage(createSalaryMutation.error, 'Request failed.')}
            </div>
          )}
          {createSalaryMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createSalaryMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            salariesMutation.mutate()
          }}
        >
          <div className="panel-title">Salaries</div>
          <label>
            From
            <input
              type="date"
              value={salariesQuery.from}
              onChange={(event) =>
                setSalariesQuery({ ...salariesQuery, from: event.target.value })
              }
              required
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={salariesQuery.to}
              onChange={(event) =>
                setSalariesQuery({ ...salariesQuery, to: event.target.value })
              }
              required
            />
          </label>
          <label>
            Role
            <input
              type="text"
              value={salariesQuery.role}
              onChange={(event) =>
                setSalariesQuery({
                  ...salariesQuery,
                  role: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={salariesMutation.isPending}>
            {salariesMutation.isPending ? 'Loading...' : 'Get salaries'}
          </button>
          {salariesMutation.error && (
            <div className="status error">
              {getErrorMessage(salariesMutation.error, 'Request failed.')}
            </div>
          )}
          {salariesMutation.data && (
            <pre className="result-block">
              {JSON.stringify(salariesMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            incomeMutation.mutate()
          }}
        >
          <div className="panel-title">Income summary</div>
          <label>
            From
            <input
              type="date"
              value={incomeQuery.from}
              onChange={(event) =>
                setIncomeQuery({ ...incomeQuery, from: event.target.value })
              }
              required
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={incomeQuery.to}
              onChange={(event) =>
                setIncomeQuery({ ...incomeQuery, to: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={incomeMutation.isPending}>
            {incomeMutation.isPending ? 'Loading...' : 'Get income'}
          </button>
          {incomeMutation.error && (
            <div className="status error">
              {getErrorMessage(incomeMutation.error, 'Request failed.')}
            </div>
          )}
          {incomeMutation.data && (
            <pre className="result-block">
              {JSON.stringify(incomeMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            reportMutation.mutate()
          }}
        >
          <div className="panel-title">Financial report</div>
          <label>
            From
            <input
              type="date"
              value={reportQuery.from}
              onChange={(event) =>
                setReportQuery({ ...reportQuery, from: event.target.value })
              }
              required
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={reportQuery.to}
              onChange={(event) =>
                setReportQuery({ ...reportQuery, to: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={reportMutation.isPending}>
            {reportMutation.isPending ? 'Loading...' : 'Get report'}
          </button>
          {reportMutation.error && (
            <div className="status error">
              {getErrorMessage(reportMutation.error, 'Request failed.')}
            </div>
          )}
          {reportMutation.data && (
            <pre className="result-block">
              {JSON.stringify(reportMutation.data, null, 2)}
            </pre>
          )}
        </form>
      </div>
    </main>
  )
}

export default AccountantPage
