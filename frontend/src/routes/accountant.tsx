import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  createExpense,
  createSalary,
  getBudgets,
  getExpenses,
  getFinancialReport,
  getSalaries,
  upsertBudget,
  type FinancialReport,
} from '@/lib/accountant-api'

export const Route = createFileRoute('/accountant')({
  component: AccountantPage,
})

type BudgetFormState = {
  month: string
  income: string
  expenses: string
  note: string
}

type ExpenseFormState = {
  category: string
  amount: string
  description: string
  documentRef: string
  occurredAt: string
}

type SalaryFormState = {
  driverId: string
  employeeName: string
  employeeRole: string
  rate: string
  units: string
  total: string
}

function AccountantPage() {
  const queryClient = useQueryClient()
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(() => ({
    month: getMonthStart(),
    income: '',
    expenses: '',
    note: '',
  }))
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    category: '',
    amount: '',
    description: '',
    documentRef: '',
    occurredAt: '',
  })
  const [salaryForm, setSalaryForm] = useState<SalaryFormState>({
    driverId: '',
    employeeName: '',
    employeeRole: '',
    rate: '',
    units: '',
    total: '',
  })
  const [reportForm, setReportForm] = useState(() => getDefaultPeriod())
  const [reportQuery, setReportQuery] = useState(() => getDefaultPeriod())

  const budgetsQuery = useQuery({
    queryKey: ['accountant-budgets'],
    queryFn: () => getBudgets({ limit: 50 }),
  })

  const expensesQuery = useQuery({
    queryKey: ['accountant-expenses'],
    queryFn: () => getExpenses({ limit: 50 }),
  })

  const salariesQuery = useQuery({
    queryKey: ['accountant-salaries'],
    queryFn: () => getSalaries({ limit: 50 }),
  })

  const reportQueryResult = useQuery({
    queryKey: ['accountant-report', reportQuery],
    queryFn: () => getFinancialReport(reportQuery),
  })

  const budgetMutation = useMutation({
    mutationFn: upsertBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountant-budgets'] })
    },
  })

  const expenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      setExpenseForm({
        category: '',
        amount: '',
        description: '',
        documentRef: '',
        occurredAt: '',
      })
      queryClient.invalidateQueries({ queryKey: ['accountant-expenses'] })
    },
  })

  const salaryMutation = useMutation({
    mutationFn: createSalary,
    onSuccess: () => {
      setSalaryForm({
        driverId: '',
        employeeName: '',
        employeeRole: '',
        rate: '',
        units: '',
        total: '',
      })
      queryClient.invalidateQueries({ queryKey: ['accountant-salaries'] })
    },
  })

  const reportData = reportQueryResult.data
  const incomeItems = useMemo(() => {
    if (!reportData) return []
    return reportData.items.filter((item) => item.type === 'income' || item.type === 'income_flow')
  }, [reportData])

  const handleBudgetSubmit = () => {
    if (!budgetForm.month || !budgetForm.income || !budgetForm.expenses) return
    budgetMutation.mutate({
      month: budgetForm.month,
      income: Number(budgetForm.income),
      expenses: Number(budgetForm.expenses),
      note: budgetForm.note.trim() || undefined,
    })
  }

  const handleExpenseSubmit = () => {
    if (!expenseForm.category || !expenseForm.amount) return
    expenseMutation.mutate({
      category: expenseForm.category.trim(),
      amount: Number(expenseForm.amount),
      description: expenseForm.description.trim() || undefined,
      documentRef: expenseForm.documentRef.trim() || undefined,
      occurredAt: expenseForm.occurredAt
        ? new Date(expenseForm.occurredAt).toISOString()
        : undefined,
    })
  }

  const handleSalarySubmit = () => {
    if (!salaryForm.total) return
    salaryMutation.mutate({
      driverId: salaryForm.driverId ? Number(salaryForm.driverId) : undefined,
      employeeName: salaryForm.employeeName.trim() || undefined,
      employeeRole: salaryForm.employeeRole.trim() || undefined,
      rate: salaryForm.rate ? Number(salaryForm.rate) : undefined,
      units: salaryForm.units ? Number(salaryForm.units) : undefined,
      total: Number(salaryForm.total),
    })
  }

  const handleComputeSalary = () => {
    const rate = Number(salaryForm.rate)
    const units = Number(salaryForm.units)
    if (!Number.isFinite(rate) || !Number.isFinite(units)) return
    const total = rate * units
    setSalaryForm((prev) => ({ ...prev, total: total.toFixed(2) }))
  }

  const handleReportRefresh = () => {
    setReportQuery(reportForm)
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Панель бухгалтера</h1>
          <p className="text-muted-foreground">
            Бюджети, витрати, зарплати та фінансові звіти.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Місячний бюджет</CardTitle>
              <CardDescription>Введення або оновлення бюджету</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="budget-month">Місяць (перший день)</Label>
                  <Input
                    id="budget-month"
                    type="date"
                    value={budgetForm.month}
                    onChange={(event) =>
                      setBudgetForm((prev) => ({ ...prev, month: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-income">Доходи</Label>
                  <Input
                    id="budget-income"
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetForm.income}
                    onChange={(event) =>
                      setBudgetForm((prev) => ({ ...prev, income: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-expenses">Витрати</Label>
                  <Input
                    id="budget-expenses"
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetForm.expenses}
                    onChange={(event) =>
                      setBudgetForm((prev) => ({ ...prev, expenses: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="budget-note">Примітка</Label>
                  <Textarea
                    id="budget-note"
                    value={budgetForm.note}
                    onChange={(event) =>
                      setBudgetForm((prev) => ({ ...prev, note: event.target.value }))
                    }
                    placeholder="Коментар до бюджету"
                  />
                </div>
              </div>

              {budgetMutation.error && (
                <p className="text-sm text-red-500">Не вдалося зберегти бюджет.</p>
              )}

              <Button onClick={handleBudgetSubmit} disabled={budgetMutation.isPending}>
                {budgetMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Зберегти бюджет
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Витрати</CardTitle>
              <CardDescription>Фіксація операційних витрат</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-category">Категорія</Label>
                  <Input
                    id="expense-category"
                    value={expenseForm.category}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, category: event.target.value }))
                    }
                    placeholder="Пальне, ремонт..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-amount">Сума</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-document">Документ</Label>
                  <Input
                    id="expense-document"
                    value={expenseForm.documentRef}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, documentRef: event.target.value }))
                    }
                    placeholder="Накладна №"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-date">Дата</Label>
                  <Input
                    id="expense-date"
                    type="datetime-local"
                    value={expenseForm.occurredAt}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, occurredAt: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="expense-desc">Опис</Label>
                  <Textarea
                    id="expense-desc"
                    value={expenseForm.description}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </div>
              </div>

              {expenseMutation.error && (
                <p className="text-sm text-red-500">Не вдалося додати витрату.</p>
              )}

              <Button onClick={handleExpenseSubmit} disabled={expenseMutation.isPending}>
                {expenseMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Додати витрату
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Нарахування зарплати</CardTitle>
              <CardDescription>Водії та інші працівники</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="salary-driver">ID водія (опційно)</Label>
                  <Input
                    id="salary-driver"
                    type="number"
                    min="1"
                    value={salaryForm.driverId}
                    onChange={(event) =>
                      setSalaryForm((prev) => ({ ...prev, driverId: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-name">ПІБ</Label>
                  <Input
                    id="salary-name"
                    value={salaryForm.employeeName}
                    onChange={(event) =>
                      setSalaryForm((prev) => ({ ...prev, employeeName: event.target.value }))
                    }
                    placeholder="Іваненко Іван"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-role">Посада</Label>
                  <Input
                    id="salary-role"
                    value={salaryForm.employeeRole}
                    onChange={(event) =>
                      setSalaryForm((prev) => ({ ...prev, employeeRole: event.target.value }))
                    }
                    placeholder="Водій"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-rate">Ставка</Label>
                  <Input
                    id="salary-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryForm.rate}
                    onChange={(event) =>
                      setSalaryForm((prev) => ({ ...prev, rate: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-units">Години / зміни</Label>
                  <Input
                    id="salary-units"
                    type="number"
                    min="0"
                    value={salaryForm.units}
                    onChange={(event) =>
                      setSalaryForm((prev) => ({ ...prev, units: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-total">Сума до виплати</Label>
                  <Input
                    id="salary-total"
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryForm.total}
                    onChange={(event) =>
                      setSalaryForm((prev) => ({ ...prev, total: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={handleComputeSalary}>
                  Розрахувати суму
                </Button>
                <Button onClick={handleSalarySubmit} disabled={salaryMutation.isPending}>
                  {salaryMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Нарахувати
                </Button>
              </div>

              {salaryMutation.error && (
                <p className="text-sm text-red-500">Не вдалося нарахувати зарплату.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Фінансовий звіт</CardTitle>
              <CardDescription>Аналітика доходів та витрат</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="report-start">Початок</Label>
                  <Input
                    id="report-start"
                    type="date"
                    value={reportForm.startDate}
                    onChange={(event) =>
                      setReportForm((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-end">Кінець</Label>
                  <Input
                    id="report-end"
                    type="date"
                    value={reportForm.endDate}
                    onChange={(event) =>
                      setReportForm((prev) => ({ ...prev, endDate: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleReportRefresh} variant="outline">
                    Оновити
                  </Button>
                </div>
              </div>

              {reportQueryResult.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Формуємо звіт...
                </div>
              )}
              {reportQueryResult.error && (
                <p className="text-sm text-red-500">Не вдалося отримати звіт.</p>
              )}

              {reportData && <ReportSummaryView report={reportData} />}

              {reportData && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Доходи</h3>
                  {incomeItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">Немає доходів за період.</p>
                  )}
                  {incomeItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Категорія</TableHead>
                          <TableHead>Сума</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incomeItems.map((item) => (
                          <TableRow key={`${item.type}-${item.category}`}>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{formatMoney(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Бюджети</CardTitle>
              <CardDescription>Останні місячні записи</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Місяць</TableHead>
                    <TableHead>Доходи</TableHead>
                    <TableHead>Витрати</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetsQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin inline-block" />
                      </TableCell>
                    </TableRow>
                  )}
                  {budgetsQuery.error && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-red-500">
                        Помилка завантаження
                      </TableCell>
                    </TableRow>
                  )}
                  {budgetsQuery.data?.map((budget) => (
                    <TableRow key={budget.id}>
                      <TableCell>{formatMonth(budget.month)}</TableCell>
                      <TableCell>{formatMoney(budget.plannedIncome)}</TableCell>
                      <TableCell>{formatMoney(budget.plannedExpenses)}</TableCell>
                    </TableRow>
                  ))}
                  {budgetsQuery.data && budgetsQuery.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Даних немає
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Витрати</CardTitle>
              <CardDescription>Останні операції</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Категорія</TableHead>
                    <TableHead>Сума</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin inline-block" />
                      </TableCell>
                    </TableRow>
                  )}
                  {expensesQuery.error && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-red-500">
                        Помилка завантаження
                      </TableCell>
                    </TableRow>
                  )}
                  {expensesQuery.data?.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{formatMoney(expense.amount)}</TableCell>
                      <TableCell>{formatDate(expense.occurredAt)}</TableCell>
                    </TableRow>
                  ))}
                  {expensesQuery.data && expensesQuery.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Даних немає
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Зарплати</CardTitle>
              <CardDescription>Нарахування працівникам</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Працівник</TableHead>
                    <TableHead>Сума</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salariesQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin inline-block" />
                      </TableCell>
                    </TableRow>
                  )}
                  {salariesQuery.error && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-red-500">
                        Помилка завантаження
                      </TableCell>
                    </TableRow>
                  )}
                  {salariesQuery.data?.map((salary) => (
                    <TableRow key={salary.id}>
                      <TableCell>{salary.employeeName}</TableCell>
                      <TableCell>{formatMoney(salary.total)}</TableCell>
                      <TableCell>{formatDate(salary.paidAt)}</TableCell>
                    </TableRow>
                  ))}
                  {salariesQuery.data && salariesQuery.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Даних немає
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ReportSummaryView({ report }: { report: FinancialReport }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-md border px-4 py-3">
        <div className="text-xs uppercase text-muted-foreground">Доходи</div>
        <div className="text-lg font-semibold">{formatMoney(report.summary.totalIncome)}</div>
      </div>
      <div className="rounded-md border px-4 py-3">
        <div className="text-xs uppercase text-muted-foreground">Витрати</div>
        <div className="text-lg font-semibold">{formatMoney(report.summary.totalExpenses)}</div>
      </div>
      <div className="rounded-md border px-4 py-3">
        <div className="text-xs uppercase text-muted-foreground">Підсумок</div>
        <div className="text-lg font-semibold">{formatMoney(report.summary.netProfit)}</div>
      </div>
    </div>
  )
}

function getMonthStart() {
  const now = new Date()
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1))
}

function getDefaultPeriod() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  }
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMoney(value: number | string | null | undefined) {
  if (value == null) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return `${numeric.toFixed(2)} ₴`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' }).format(date)
}

function formatMonth(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('uk-UA', { month: 'short', year: 'numeric' }).format(date)
}
