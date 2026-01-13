import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
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
  DollarSign,
  BarChart3,
  PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Car,
  CreditCard,
  Search,
  Check,
  Sparkles,
} from 'lucide-react'
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { Progress } from '@/components/ui/progress'
import {
  createExpense,
  createSalary,
  getBudgets,
  getDrivers,
  getExpenses,
  getFinancialReport,
  getSalaries,
  upsertBudget,
} from '@/lib/accountant-api'
import { cn } from '@/lib/utils'

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
  driverId: number | null
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
  const [activeTab, setActiveTab] = useState('analytics')
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth())
  const [driverSearchOpen, setDriverSearchOpen] = useState(false)

  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    category: '',
    amount: '',
    description: '',
    documentRef: '',
    occurredAt: '',
  })

  const [salaryForm, setSalaryForm] = useState<SalaryFormState>({
    driverId: null,
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

  // Get dates for previous month (for comparison)
  const { prevStartDate, prevEndDate } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prevStart = new Date(year, month - 2, 1)
    const prevEnd = new Date(year, month - 1, 0)
    return {
      prevStartDate: formatDateForApi(prevStart),
      prevEndDate: formatDateForApi(prevEnd),
    }
  }, [selectedMonth])

  // Queries
  useQuery({
    queryKey: ['accountant-budgets'],
    queryFn: () => getBudgets({ limit: 12 }),
  })

  const driversQuery = useQuery({
    queryKey: ['accountant-drivers'],
    queryFn: getDrivers,
  })

  const expensesQuery = useQuery({
    queryKey: ['accountant-expenses', startDate, endDate],
    queryFn: () => getExpenses({ from: startDate, to: endDate, limit: 500 }),
  })

  const salariesQuery = useQuery({
    queryKey: ['accountant-salaries', startDate, endDate],
    queryFn: () => getSalaries({ from: startDate, to: endDate, limit: 500 }),
  })

  const prevSalariesQuery = useQuery({
    queryKey: ['accountant-salaries-prev', prevStartDate, prevEndDate],
    queryFn: () => getSalaries({ from: prevStartDate, to: prevEndDate, limit: 500 }),
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
        driverId: null,
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

  // ============ SALARY ANALYTICS DATA ============

  // Total salary for current period
  const totalSalaries = useMemo(() => {
    if (!salariesQuery.data) return 0
    return salariesQuery.data.reduce((sum, s) => sum + Number(s.total), 0)
  }, [salariesQuery.data])

  // Total salary for previous period
  const prevTotalSalaries = useMemo(() => {
    if (!prevSalariesQuery.data) return 0
    return prevSalariesQuery.data.reduce((sum, s) => sum + Number(s.total), 0)
  }, [prevSalariesQuery.data])

  // Salary change percentage
  const salaryChangePercent = useMemo(() => {
    if (prevTotalSalaries === 0) return 0
    return ((totalSalaries - prevTotalSalaries) / prevTotalSalaries) * 100
  }, [totalSalaries, prevTotalSalaries])

  // Unique drivers count
  const uniqueDrivers = useMemo(() => {
    if (!salariesQuery.data) return 0
    const ids = new Set(salariesQuery.data.map((s) => s.driverId))
    return ids.size
  }, [salariesQuery.data])

  // Average salary per driver
  const avgSalary = useMemo(() => {
    if (uniqueDrivers === 0) return 0
    return totalSalaries / uniqueDrivers
  }, [totalSalaries, uniqueDrivers])

  // Top drivers by salary
  const topDrivers = useMemo(() => {
    if (!salariesQuery.data) return []
    const driverMap = new Map<number, { total: number; name: string; license: string; payments: number }>()

    salariesQuery.data.forEach((s) => {
      const existing = driverMap.get(s.driverId) || { total: 0, name: s.driverName, license: s.licenseNumber, payments: 0 }
      driverMap.set(s.driverId, {
        total: existing.total + Number(s.total),
        name: s.driverName,
        license: s.licenseNumber,
        payments: existing.payments + 1,
      })
    })

    return Array.from(driverMap.entries())
      .map(([driverId, data]) => ({
        driverId,
        name: data.name,
        license: data.license,
        total: data.total,
        payments: data.payments,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [salariesQuery.data])

  // Max salary for progress bar calculation
  const maxDriverSalary = useMemo(() => {
    return topDrivers.length > 0 ? topDrivers[0].total : 1
  }, [topDrivers])

  // Computed data for report charts
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

  // Selected driver info
  const selectedDriver = useMemo(() => {
    if (!salaryForm.driverId || !driversQuery.data) return null
    return driversQuery.data.find((d) => d.id === salaryForm.driverId)
  }, [salaryForm.driverId, driversQuery.data])

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
    if (!salaryForm.driverId) return
    const total = salaryForm.total ? Number(salaryForm.total) : undefined
    const rate = salaryForm.rate ? Number(salaryForm.rate) : undefined
    const units = salaryForm.units ? Number(salaryForm.units) : undefined

    if (!total && (!rate || !units)) return

    salaryMutation.mutate({
      driverId: salaryForm.driverId,
      rate,
      units,
      total,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Header with gradient accent */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-sm">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">Панель бухгалтера</h1>
                </div>
                <p className="text-blue-100 max-w-md">
                  Фінансовий облік, аналітика зарплат водіїв та звітність
                </p>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <Calendar className="h-5 w-5 text-blue-200" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px] border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
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
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-white dark:bg-slate-800 shadow-sm rounded-xl">
              <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
                <BarChart3 className="h-4 w-4 mr-2" />
                Аналітика
              </TabsTrigger>
              <TabsTrigger value="salaries" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white">
                <Car className="h-4 w-4 mr-2" />
                Зарплати
              </TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
                <Receipt className="h-4 w-4 mr-2" />
                Витрати
              </TabsTrigger>
              <TabsTrigger value="report" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                <PieChartIcon className="h-4 w-4 mr-2" />
                Звіт
              </TabsTrigger>
            </TabsList>

            {/* ============ ANALYTICS TAB ============ */}
            <TabsContent value="analytics" className="space-y-6 mt-6">
              {/* Hero Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Total Salaries Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-blue-100">Загальні виплати</CardTitle>
                      <div className="rounded-lg bg-white/20 p-2">
                        <DollarSign className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        <AnimatedCounter
                          value={totalSalaries}
                          suffix=" ₴"
                          formatFn={(v) => formatCompact(v)}
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        {salaryChangePercent >= 0 ? (
                          <ArrowUpRight className="h-4 w-4 text-blue-200" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-blue-200" />
                        )}
                        <span className="text-sm text-blue-100">
                          {salaryChangePercent >= 0 ? '+' : ''}{salaryChangePercent.toFixed(1)}% до минулого місяця
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Drivers Count Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-xl shadow-emerald-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-100">Водіїв</CardTitle>
                      <div className="rounded-lg bg-white/20 p-2">
                        <Car className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        <AnimatedCounter value={uniqueDrivers} />
                      </div>
                      <p className="text-sm text-emerald-100 mt-2">
                        Отримали виплати цього місяця
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Average Salary Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-amber-100">Середня виплата</CardTitle>
                      <div className="rounded-lg bg-white/20 p-2">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        <AnimatedCounter
                          value={avgSalary}
                          suffix=" ₴"
                          formatFn={(v) => formatCompact(v)}
                        />
                      </div>
                      <p className="text-sm text-amber-100 mt-2">
                        На одного водія
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Payments Count Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl shadow-purple-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-purple-100">Транзакцій</CardTitle>
                      <div className="rounded-lg bg-white/20 p-2">
                        <Receipt className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        <AnimatedCounter value={salariesQuery.data?.length || 0} />
                      </div>
                      <p className="text-sm text-purple-100 mt-2">
                        Виплат за період
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Top Drivers Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-amber-500" />
                          Топ водіїв за виплатами
                        </CardTitle>
                        <CardDescription>Рейтинг за загальною сумою зарплати</CardDescription>
                      </div>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        Топ {Math.min(topDrivers.length, 10)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {topDrivers.length > 0 ? (
                      <div className="space-y-4">
                        {topDrivers.map((driver, index) => (
                          <div key={driver.driverId} className="flex items-center gap-4">
                            <div className={cn(
                              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg",
                              index === 0 && "bg-gradient-to-br from-yellow-400 to-amber-500",
                              index === 1 && "bg-gradient-to-br from-slate-300 to-slate-400",
                              index === 2 && "bg-gradient-to-br from-amber-600 to-amber-700",
                              index > 2 && "bg-gradient-to-br from-slate-500 to-slate-600"
                            )}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-semibold truncate">{driver.name}</span>
                                  <Badge variant="outline" className="flex-shrink-0 text-xs text-blue-600 border-blue-300">
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    {driver.license}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <span className="text-xs text-muted-foreground">{driver.payments} виплат</span>
                                  <span className="font-bold text-green-600">
                                    {formatMoney(driver.total)}
                                  </span>
                                </div>
                              </div>
                              <div className="relative h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(driver.total / maxDriverSalary) * 100}%` }}
                                  transition={{ duration: 0.8, delay: index * 0.1 }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p>Немає даних за період</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Detailed Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Детальні виплати водіям</CardTitle>
                        <CardDescription>
                          Всього: {formatMoney(totalSalaries)}
                        </CardDescription>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {salariesQuery.data?.length || 0} записів
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                            <TableHead className="font-semibold">Водій</TableHead>
                            <TableHead className="font-semibold">Посвідчення</TableHead>
                            <TableHead className="font-semibold text-right">Ставка</TableHead>
                            <TableHead className="font-semibold text-right">Години</TableHead>
                            <TableHead className="font-semibold text-right">Сума</TableHead>
                            <TableHead className="font-semibold text-right">Дата</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salariesQuery.isLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="h-24 text-center">
                                <Loader2 className="h-5 w-5 animate-spin inline-block" />
                              </TableCell>
                            </TableRow>
                          ) : salariesQuery.data?.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                <Car className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p>Немає виплат за обраний період</p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            salariesQuery.data?.slice(0, 20).map((salary) => (
                              <TableRow key={salary.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <TableCell className="font-medium">{salary.driverName}</TableCell>
                                <TableCell className="text-muted-foreground">{salary.licenseNumber}</TableCell>
                                <TableCell className="text-right">
                                  {salary.rate ? `${formatMoney(salary.rate)}/год` : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {salary.units ?? '—'}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-green-600">
                                  {formatMoney(salary.total)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatDate(salary.paidAt)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {(salariesQuery.data?.length || 0) > 20 && (
                      <p className="text-sm text-muted-foreground text-center mt-4">
                        Показано 20 з {salariesQuery.data?.length} записів
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* ============ SALARIES TAB ============ */}
            <TabsContent value="salaries" className="space-y-6 mt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Add Salary Form */}
                <Card className="lg:col-span-1 border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Нарахування зарплати
                    </CardTitle>
                    <CardDescription className="text-green-100">Виплата водіям</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {/* Driver Selection with Combobox */}
                    <div className="space-y-2">
                      <Label>Водій *</Label>
                      <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={driverSearchOpen}
                            className="w-full justify-between h-auto min-h-[2.5rem] py-2"
                          >
                            {selectedDriver ? (
                              <div className="flex items-center gap-2 text-left">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                  {selectedDriver.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-medium">{selectedDriver.fullName}</div>
                                  <div className="text-xs text-muted-foreground">{selectedDriver.driverLicenseNumber}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Оберіть водія...</span>
                            )}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Пошук водія..." />
                            <CommandList>
                              <CommandEmpty>Водія не знайдено</CommandEmpty>
                              <CommandGroup>
                                {driversQuery.data?.map((driver) => (
                                  <CommandItem
                                    key={driver.id}
                                    value={`${driver.fullName} ${driver.driverLicenseNumber}`}
                                    onSelect={() => {
                                      setSalaryForm((prev) => ({ ...prev, driverId: driver.id }))
                                      setDriverSearchOpen(false)
                                    }}
                                    className="flex items-center gap-3 py-3"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                      {driver.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium">{driver.fullName}</div>
                                      <div className="text-xs text-muted-foreground">{driver.driverLicenseNumber}</div>
                                    </div>
                                    {salaryForm.driverId === driver.id && (
                                      <Check className="h-4 w-4 text-green-500" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                      <Label htmlFor="salary-total">Сума до виплати</Label>
                      <Input
                        id="salary-total"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Або введіть фіксовану суму"
                        value={salaryForm.total}
                        onChange={(e) => setSalaryForm((prev) => ({ ...prev, total: e.target.value }))}
                        className="text-lg font-semibold"
                      />
                      <p className="text-xs text-muted-foreground">
                        Вкажіть або ставку × години, або загальну суму
                      </p>
                    </div>

                    {salaryMutation.error && (
                      <p className="text-sm text-red-500">Помилка нарахування зарплати</p>
                    )}

                    <Button
                      onClick={handleSalarySubmit}
                      disabled={salaryMutation.isPending || !salaryForm.driverId}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      {salaryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Нарахувати
                    </Button>
                  </CardContent>
                </Card>

                {/* Salaries Table */}
                <Card className="lg:col-span-2 border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Виплати за місяць</CardTitle>
                    <CardDescription>
                      Всього: <span className="font-semibold text-green-600">{formatMoney(totalSalaries)}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Водій</TableHead>
                            <TableHead className="text-right">Ставка</TableHead>
                            <TableHead className="text-right">Години</TableHead>
                            <TableHead className="text-right">Сума</TableHead>
                            <TableHead className="text-right">Дата</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salariesQuery.isLoading && (
                            <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center">
                                <Loader2 className="h-5 w-5 animate-spin inline-block" />
                              </TableCell>
                            </TableRow>
                          )}
                          {salariesQuery.data?.map((salary) => (
                            <TableRow key={salary.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{salary.driverName}</div>
                                  <div className="text-xs text-muted-foreground">{salary.licenseNumber}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {salary.rate ? `${Number(salary.rate).toFixed(0)} ₴` : '—'}
                              </TableCell>
                              <TableCell className="text-right">{salary.units ?? '—'}</TableCell>
                              <TableCell className="text-right font-semibold text-green-600">{formatMoney(salary.total)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatDate(salary.paidAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {salariesQuery.data?.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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

            {/* ============ EXPENSES TAB ============ */}
            <TabsContent value="expenses" className="space-y-6 mt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Add Expense Form */}
                <Card className="lg:col-span-1 border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Додати витрату
                    </CardTitle>
                    <CardDescription className="text-amber-100">Фіксація операційних витрат</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
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

                    <Button
                      onClick={handleExpenseSubmit}
                      disabled={expenseMutation.isPending}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      {expenseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Додати витрату
                    </Button>
                  </CardContent>
                </Card>

                {/* Expenses Table */}
                <Card className="lg:col-span-2 border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Витрати за місяць</CardTitle>
                    <CardDescription>
                      Всього: <span className="font-semibold text-red-600">{formatMoney(expensesQuery.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0)}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Категорія</TableHead>
                            <TableHead className="text-right">Сума</TableHead>
                            <TableHead>Документ</TableHead>
                            <TableHead className="text-right">Дата</TableHead>
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
                              <TableCell className="text-right font-semibold text-red-600">
                                -{formatMoney(expense.amount)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {expense.documentRef || '—'}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
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

            {/* ============ REPORT TAB ============ */}
            <TabsContent value="report" className="space-y-6 mt-6">
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Доходи</p>
                        <p className="text-3xl font-bold text-green-600">
                          <AnimatedCounter value={totalIncome} suffix=" ₴" formatFn={formatCompact} />
                        </p>
                      </div>
                      <div className="rounded-xl bg-green-100 dark:bg-green-900/30 p-3">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-red-400 to-rose-500" />
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Витрати</p>
                        <p className="text-3xl font-bold text-red-600">
                          <AnimatedCounter value={totalExpenses} suffix=" ₴" formatFn={formatCompact} />
                        </p>
                      </div>
                      <div className="rounded-xl bg-red-100 dark:bg-red-900/30 p-3">
                        <TrendingDown className="h-6 w-6 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-0 shadow-lg overflow-hidden`}>
                  <div className={`h-1 bg-gradient-to-r ${netProfit >= 0 ? 'from-blue-400 to-indigo-500' : 'from-red-400 to-rose-500'}`} />
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Чистий прибуток</p>
                        <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          <AnimatedCounter value={netProfit} suffix=" ₴" formatFn={formatCompact} />
                        </p>
                      </div>
                      <div className={`rounded-xl p-3 ${netProfit >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                        <Wallet className={`h-6 w-6 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Income Table */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      Доходи
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border">
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
                              <TableCell className="text-right text-green-600 font-semibold">
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
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <TrendingDown className="h-5 w-5" />
                      Витрати
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border">
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
                              <TableCell className="text-right text-red-600 font-semibold">
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

              {/* Expense Chart */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Структура витрат</CardTitle>
                  <CardDescription>Розподіл за категоріями</CardDescription>
                </CardHeader>
                <CardContent>
                  {expenseChartData.length > 0 ? (
                    <div className="flex items-center">
                      <div className="w-1/2">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={expenseChartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={110}
                              paddingAngle={2}
                            >
                              {expenseChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border">
                                      <p className="font-semibold">{payload[0].name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {formatMoney(payload[0].value as number)}
                                      </p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 space-y-3">
                        {expenseChartData.map((item) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.fill }}
                            />
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{item.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {formatMoney(item.value)}
                                </span>
                              </div>
                              <Progress
                                value={(item.value / totalExpenses) * 100}
                                className="h-1.5 mt-1"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                      Немає витрат за період
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Budget Planning */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-indigo-500" />
                    Плановий бюджет
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
                      <Button
                        onClick={handleBudgetSubmit}
                        disabled={budgetMutation.isPending}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                      >
                        {budgetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Зберегти
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// Chart colors
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

function formatCompact(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toLocaleString('uk-UA')
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' }).format(date)
}
