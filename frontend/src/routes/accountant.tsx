import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  Loader2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Users,
  PiggyBank,
  Calendar,
  Plus,
} from 'lucide-react'
import { Bar, BarChart, Pie, PieChart } from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import {
  createExpense,
  createSalary,
  getBudgets,
  getExpenses,
  getFinancialReport,
  getSalaries,
  upsertBudget,
} from '@/lib/accountant-api'

export const Route = createFileRoute('/accountant')({
  component: AccountantPage,
})

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

const EXPENSE_CATEGORIES = [
  'Паливо',
  'Ремонт',
  'Запчастини',
  'Мийка',
  'Страхування',
  'Комунальні послуги',
  'Інше',
]

function AccountantPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth())

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
    employeeRole: 'Водій',
    rate: '',
    units: '',
    total: '',
  })

  const [budgetForm, setBudgetForm] = useState({
    income: '',
    expenses: '',
    note: '',
  })

  // Get dates for selected month
  const { startDate, endDate } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    return {
      startDate: formatDateForApi(start),
      endDate: formatDateForApi(end),
    }
  }, [selectedMonth])

  // Queries
  const budgetsQuery = useQuery({
    queryKey: ['accountant-budgets'],
    queryFn: () => getBudgets({ limit: 12 }),
  })

  const expensesQuery = useQuery({
    queryKey: ['accountant-expenses', startDate, endDate],
    queryFn: () => getExpenses({ from: startDate, to: endDate, limit: 100 }),
  })

  const salariesQuery = useQuery({
    queryKey: ['accountant-salaries', startDate, endDate],
    queryFn: () => getSalaries({ from: startDate, to: endDate, limit: 100 }),
  })

  const reportQuery = useQuery({
    queryKey: ['accountant-report', startDate, endDate],
    queryFn: () => getFinancialReport({ startDate, endDate }),
  })

  // Mutations
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
      queryClient.invalidateQueries({ queryKey: ['accountant-report'] })
    },
  })

  const salaryMutation = useMutation({
    mutationFn: createSalary,
    onSuccess: () => {
      setSalaryForm({
        driverId: '',
        employeeName: '',
        employeeRole: 'Водій',
        rate: '',
        units: '',
        total: '',
      })
      queryClient.invalidateQueries({ queryKey: ['accountant-salaries'] })
      queryClient.invalidateQueries({ queryKey: ['accountant-report'] })
    },
  })

  const budgetMutation = useMutation({
    mutationFn: upsertBudget,
    onSuccess: () => {
      setBudgetForm({ income: '', expenses: '', note: '' })
      queryClient.invalidateQueries({ queryKey: ['accountant-budgets'] })
    },
  })

  // Computed data for charts
  const reportData = reportQuery.data
  const { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit } = useMemo(() => {
    if (!reportData) {
      return { incomeItems: [], expenseItems: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 }
    }
    const incomeItems = reportData.items.filter(
      (item) => item.type === 'income' || item.type === 'income_flow'
    )
    const expenseItems = reportData.items.filter((item) => item.type === 'expense')
    return {
      incomeItems,
      expenseItems,
      totalIncome: reportData.summary.totalIncome,
      totalExpenses: reportData.summary.totalExpenses,
      netProfit: reportData.summary.netProfit,
    }
  }, [reportData])

  // Chart data for expenses by category
  const expenseChartData = useMemo(() => {
    return expenseItems.map((item, index) => ({
      name: item.category,
      value: Number(item.amount),
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))
  }, [expenseItems])

  // Chart data for income vs expenses
  const summaryChartData = useMemo(() => {
    return [
      { name: 'Доходи', value: totalIncome, fill: '#22c55e' },
      { name: 'Витрати', value: totalExpenses, fill: '#ef4444' },
    ]
  }, [totalIncome, totalExpenses])

  // Monthly trend data from budgets
  const monthlyTrendData = useMemo(() => {
    if (!budgetsQuery.data) return []
    return budgetsQuery.data
      .slice(0, 6)
      .reverse()
      .map((budget) => ({
        month: formatMonthShort(budget.month),
        income: Number(budget.plannedIncome),
        expenses: Number(budget.plannedExpenses),
      }))
  }, [budgetsQuery.data])

  // Handlers
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
    if (!salaryForm.total || !salaryForm.employeeName) return
    salaryMutation.mutate({
      driverId: salaryForm.driverId ? Number(salaryForm.driverId) : undefined,
      employeeName: salaryForm.employeeName.trim(),
      employeeRole: salaryForm.employeeRole.trim() || 'Водій',
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

  const handleBudgetSubmit = () => {
    if (!budgetForm.income && !budgetForm.expenses) return
    budgetMutation.mutate({
      month: `${selectedMonth}-01`,
      income: Number(budgetForm.income) || 0,
      expenses: Number(budgetForm.expenses) || 0,
      note: budgetForm.note.trim() || undefined,
    })
  }

  // Generate month options for selector
  const monthOptions = useMemo(() => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(date)
      options.push({ value, label })
    }
    return options
  }, [])

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Головна</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Бухгалтерія</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header with Month Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Панель бухгалтера</h1>
            <p className="text-muted-foreground mt-1">
              Фінансовий облік та звітність
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
            <TabsTrigger value="expenses">Витрати</TabsTrigger>
            <TabsTrigger value="salaries">Зарплати</TabsTrigger>
            <TabsTrigger value="report">Звіт</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Доходи</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatMoney(totalIncome)}
                  </div>
                  <p className="text-xs text-muted-foreground">За обраний місяць</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Витрати</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatMoney(totalExpenses)}
                  </div>
                  <p className="text-xs text-muted-foreground">За обраний місяць</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Баланс</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatMoney(netProfit)}
                  </div>
                  <p className="text-xs text-muted-foreground">Чистий прибуток</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Операцій</CardTitle>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(expensesQuery.data?.length || 0) + (salariesQuery.data?.length || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Витрат та виплат</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Income vs Expenses Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Доходи vs Витрати</CardTitle>
                  <CardDescription>Співвідношення за місяць</CardDescription>
                </CardHeader>
                <CardContent>
                  {totalIncome > 0 || totalExpenses > 0 ? (
                    <ChartContainer config={summaryChartConfig} className="mx-auto aspect-square max-h-[300px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={summaryChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                      Немає даних за період
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expenses by Category Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Витрати за категоріями</CardTitle>
                  <CardDescription>Розподіл витрат</CardDescription>
                </CardHeader>
                <CardContent>
                  {expenseChartData.length > 0 ? (
                    <ChartContainer config={expenseChartConfig} className="mx-auto aspect-square max-h-[300px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={expenseChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                      Немає витрат за період
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Trend Bar Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Динаміка за останні місяці</CardTitle>
                  <CardDescription>Порівняння доходів та витрат</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlyTrendData.length > 0 ? (
                    <ChartContainer config={trendChartConfig} className="h-[300px] w-full">
                      <BarChart data={monthlyTrendData}>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="income" fill="#22c55e" radius={4} name="Доходи" />
                        <Bar dataKey="expenses" fill="#ef4444" radius={4} name="Витрати" />
                        <ChartLegend content={<ChartLegendContent />} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                      Немає історичних даних
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Budget Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  Плановий бюджет на місяць
                </CardTitle>
                <CardDescription>
                  Встановіть планові показники для {monthOptions.find(o => o.value === selectedMonth)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget-income">Плановий дохід</Label>
                    <Input
                      id="budget-income"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={budgetForm.income}
                      onChange={(e) => setBudgetForm((prev) => ({ ...prev, income: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget-expenses">Планові витрати</Label>
                    <Input
                      id="budget-expenses"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={budgetForm.expenses}
                      onChange={(e) => setBudgetForm((prev) => ({ ...prev, expenses: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget-note">Примітка</Label>
                    <Input
                      id="budget-note"
                      placeholder="Коментар"
                      value={budgetForm.note}
                      onChange={(e) => setBudgetForm((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleBudgetSubmit} disabled={budgetMutation.isPending} className="w-full">
                      {budgetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Зберегти
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Add Expense Form */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Додати витрату
                  </CardTitle>
                  <CardDescription>Фіксація операційних витрат</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="expense-category">Категорія *</Label>
                    <Select
                      value={expenseForm.category}
                      onValueChange={(value) => setExpenseForm((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger id="expense-category">
                        <SelectValue placeholder="Оберіть категорію" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">Сума *</Label>
                    <Input
                      id="expense-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-document">Документ</Label>
                    <Input
                      id="expense-document"
                      placeholder="Накладна №"
                      value={expenseForm.documentRef}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, documentRef: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-date">Дата</Label>
                    <Input
                      id="expense-date"
                      type="datetime-local"
                      value={expenseForm.occurredAt}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-desc">Опис</Label>
                    <Textarea
                      id="expense-desc"
                      placeholder="Деталі витрати..."
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  {expenseMutation.error && (
                    <p className="text-sm text-red-500">Помилка додавання витрати</p>
                  )}

                  <Button onClick={handleExpenseSubmit} disabled={expenseMutation.isPending} className="w-full">
                    {expenseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Додати витрату
                  </Button>
                </CardContent>
              </Card>

              {/* Expenses Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Витрати за місяць</CardTitle>
                  <CardDescription>
                    Всього: {formatMoney(expensesQuery.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Категорія</TableHead>
                          <TableHead>Сума</TableHead>
                          <TableHead>Документ</TableHead>
                          <TableHead>Дата</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expensesQuery.isLoading && (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                              <Loader2 className="h-5 w-5 animate-spin inline-block" />
                            </TableCell>
                          </TableRow>
                        )}
                        {expensesQuery.data?.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="font-medium">{expense.category}</TableCell>
                            <TableCell>{formatMoney(expense.amount)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {expense.documentRef || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(expense.occurredAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {expensesQuery.data?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Немає витрат за обраний період
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Salaries Tab */}
          <TabsContent value="salaries" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Add Salary Form */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Нарахування зарплати
                  </CardTitle>
                  <CardDescription>Виплата працівникам</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="salary-name">ПІБ працівника *</Label>
                    <Input
                      id="salary-name"
                      placeholder="Іванов Іван"
                      value={salaryForm.employeeName}
                      onChange={(e) => setSalaryForm((prev) => ({ ...prev, employeeName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salary-role">Посада</Label>
                    <Select
                      value={salaryForm.employeeRole}
                      onValueChange={(value) => setSalaryForm((prev) => ({ ...prev, employeeRole: value }))}
                    >
                      <SelectTrigger id="salary-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Водій">Водій</SelectItem>
                        <SelectItem value="Диспетчер">Диспетчер</SelectItem>
                        <SelectItem value="Контролер">Контролер</SelectItem>
                        <SelectItem value="Механік">Механік</SelectItem>
                        <SelectItem value="Інше">Інше</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salary-driver">ID водія (опційно)</Label>
                    <Input
                      id="salary-driver"
                      type="number"
                      min="1"
                      placeholder="Для автоматичного зв'язку"
                      value={salaryForm.driverId}
                      onChange={(e) => setSalaryForm((prev) => ({ ...prev, driverId: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="salary-rate">Ставка (грн/год)</Label>
                      <Input
                        id="salary-rate"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={salaryForm.rate}
                        onChange={(e) => setSalaryForm((prev) => ({ ...prev, rate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salary-units">Години</Label>
                      <Input
                        id="salary-units"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={salaryForm.units}
                        onChange={(e) => setSalaryForm((prev) => ({ ...prev, units: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Button variant="outline" onClick={handleComputeSalary} className="w-full">
                    Розрахувати суму
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="salary-total">Сума до виплати *</Label>
                    <Input
                      id="salary-total"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={salaryForm.total}
                      onChange={(e) => setSalaryForm((prev) => ({ ...prev, total: e.target.value }))}
                    />
                  </div>

                  {salaryMutation.error && (
                    <p className="text-sm text-red-500">Помилка нарахування зарплати</p>
                  )}

                  <Button onClick={handleSalarySubmit} disabled={salaryMutation.isPending} className="w-full">
                    {salaryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Нарахувати
                  </Button>
                </CardContent>
              </Card>

              {/* Salaries Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Виплати за місяць</CardTitle>
                  <CardDescription>
                    Всього: {formatMoney(salariesQuery.data?.reduce((sum, s) => sum + Number(s.total), 0) || 0)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Працівник</TableHead>
                          <TableHead>Посада</TableHead>
                          <TableHead>Сума</TableHead>
                          <TableHead>Дата</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salariesQuery.isLoading && (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                              <Loader2 className="h-5 w-5 animate-spin inline-block" />
                            </TableCell>
                          </TableRow>
                        )}
                        {salariesQuery.data?.map((salary) => (
                          <TableRow key={salary.id}>
                            <TableCell className="font-medium">{salary.employeeName}</TableCell>
                            <TableCell className="text-muted-foreground">{salary.role}</TableCell>
                            <TableCell>{formatMoney(salary.total)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(salary.paidAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {salariesQuery.data?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Немає виплат за обраний період
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Report Tab */}
          <TabsContent value="report" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Income Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                    Доходи
                  </CardTitle>
                  <CardDescription>
                    Загалом: {formatMoney(totalIncome)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Категорія</TableHead>
                          <TableHead className="text-right">Сума</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportQuery.isLoading && (
                          <TableRow>
                            <TableCell colSpan={2} className="h-24 text-center">
                              <Loader2 className="h-5 w-5 animate-spin inline-block" />
                            </TableCell>
                          </TableRow>
                        )}
                        {incomeItems.map((item) => (
                          <TableRow key={`${item.type}-${item.category}`}>
                            <TableCell className="font-medium">{item.category}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              +{formatMoney(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {incomeItems.length === 0 && !reportQuery.isLoading && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                              Немає доходів за період
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Expenses Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                    Витрати
                  </CardTitle>
                  <CardDescription>
                    Загалом: {formatMoney(totalExpenses)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Категорія</TableHead>
                          <TableHead className="text-right">Сума</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportQuery.isLoading && (
                          <TableRow>
                            <TableCell colSpan={2} className="h-24 text-center">
                              <Loader2 className="h-5 w-5 animate-spin inline-block" />
                            </TableCell>
                          </TableRow>
                        )}
                        {expenseItems.map((item) => (
                          <TableRow key={`${item.type}-${item.category}`}>
                            <TableCell className="font-medium">{item.category}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              -{formatMoney(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {expenseItems.length === 0 && !reportQuery.isLoading && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                              Немає витрат за період
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Підсумок за місяць</CardTitle>
                <CardDescription>
                  {monthOptions.find(o => o.value === selectedMonth)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-sm text-muted-foreground">Доходи</p>
                    <p className="text-2xl font-bold text-green-600">{formatMoney(totalIncome)}</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-sm text-muted-foreground">Витрати</p>
                    <p className="text-2xl font-bold text-red-600">{formatMoney(totalExpenses)}</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-sm text-muted-foreground">Чистий прибуток</p>
                    <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatMoney(netProfit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Chart configs
const summaryChartConfig: ChartConfig = {
  value: { label: 'Сума' },
  Доходи: { label: 'Доходи', color: '#22c55e' },
  Витрати: { label: 'Витрати', color: '#ef4444' },
}

const expenseChartConfig: ChartConfig = {
  value: { label: 'Сума' },
}

const trendChartConfig: ChartConfig = {
  income: { label: 'Доходи', color: '#22c55e' },
  expenses: { label: 'Витрати', color: '#ef4444' },
}

const CHART_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
]

// Helper functions
function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatDateForApi(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatMoney(value: number | string | null | undefined) {
  if (value == null) return '0 ₴'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0 ₴'
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' }).format(date)
}

function formatMonthShort(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('uk-UA', { month: 'short' }).format(date)
}
