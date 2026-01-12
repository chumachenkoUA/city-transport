import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
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
  Map as MapView,
  MapControls,
  MapMarker,
  MarkerContent,
  MapRoute,
} from '@/components/ui/map'
import { StatCard, StatCardSkeleton } from '@/components/domain/stats'
import { EmptyState, TableSkeleton, ErrorState } from '@/components/domain/data-display'
import { FormSection } from '@/components/domain/forms'
import {
  assignDispatcherDriver,
  createDispatcherSchedule,
  detectDispatcherDeviation,
  getDispatcherSchedule,
  getDispatcherVehicleMonitoring,
  listDispatcherActiveTrips,
  listDispatcherAssignments,
  listDispatcherDeviations,
  listDispatcherDrivers,
  listDispatcherRoutes,
  listDispatcherSchedules,
  listDispatcherVehicles,
  updateDispatcherSchedule,
  getDispatcherDashboard,
  type DispatcherDirection,
  type DispatcherRoute,
} from '@/lib/dispatcher-api'
import { toast } from 'sonner'
import {
  Bus,
  Calendar,
  Users,
  AlertTriangle,
  Activity,
  MapPin,
  Loader2,
  Eye,
  Edit2,
} from 'lucide-react'

export const Route = createFileRoute('/dispatcher')({
  component: DispatcherPage,
})

const UKRAINE_CENTER: [number, number] = [31.1656, 48.3794]

const directionLabels: Record<DispatcherDirection, string> = {
  forward: 'Прямий',
  reverse: 'Зворотній',
}

function DispatcherPage() {
  const queryClient = useQueryClient()
  const mapRef = useRef<MapLibreMap | null>(null)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Schedule creation form
  const [createRouteId, setCreateRouteId] = useState('')
  const [createVehicleId, setCreateVehicleId] = useState('')
  const [createStartTime, setCreateStartTime] = useState('')
  const [createEndTime, setCreateEndTime] = useState('')
  const [createInterval, setCreateInterval] = useState('')

  // Schedule update form
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [updateRouteId, setUpdateRouteId] = useState('')
  const [updateVehicleId, setUpdateVehicleId] = useState('')
  const [updateStartTime, setUpdateStartTime] = useState<string | null>(null)
  const [updateEndTime, setUpdateEndTime] = useState<string | null>(null)
  const [updateInterval, setUpdateInterval] = useState<string | null>(null)

  // Assignment form
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [assignmentTime, setAssignmentTime] = useState('')

  // Monitoring form
  const [monitorFleetNumber, setMonitorFleetNumber] = useState('')
  const [deviationFleetNumber, setDeviationFleetNumber] = useState('')
  const [deviationTime, setDeviationTime] = useState('')

  // Queries
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dispatcher-dashboard'],
    queryFn: getDispatcherDashboard,
  })

  const { data: routes } = useQuery({
    queryKey: ['dispatcher-routes'],
    queryFn: listDispatcherRoutes,
  })

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['dispatcher-schedules'],
    queryFn: listDispatcherSchedules,
  })

  const { data: drivers } = useQuery({
    queryKey: ['dispatcher-drivers'],
    queryFn: listDispatcherDrivers,
  })

  const { data: vehicles } = useQuery({
    queryKey: ['dispatcher-vehicles'],
    queryFn: listDispatcherVehicles,
  })

  const { data: assignments } = useQuery({
    queryKey: ['dispatcher-assignments'],
    queryFn: listDispatcherAssignments,
  })

  const { data: activeTrips } = useQuery({
    queryKey: ['dispatcher-active-trips'],
    queryFn: listDispatcherActiveTrips,
  })

  const { data: deviations } = useQuery({
    queryKey: ['dispatcher-deviations'],
    queryFn: listDispatcherDeviations,
  })

  const resolvedScheduleId = useMemo(() => {
    if (selectedScheduleId && schedules?.some((s) => s.id === Number(selectedScheduleId))) {
      return selectedScheduleId
    }
    const fallback = schedules?.[0]?.id
    return fallback ? String(fallback) : null
  }, [schedules, selectedScheduleId])

  const selectedSchedule = useMemo(() => {
    if (!resolvedScheduleId || !schedules?.length) return null
    return schedules.find((schedule) => schedule.id === Number(resolvedScheduleId)) ?? null
  }, [resolvedScheduleId, schedules])

  const { data: scheduleDetails, isLoading: scheduleDetailsLoading } = useQuery({
    queryKey: ['dispatcher-schedule-details', resolvedScheduleId],
    queryFn: () => getDispatcherSchedule(Number(resolvedScheduleId)),
    enabled: !!resolvedScheduleId,
  })

  const { data: monitoringData } = useQuery({
    queryKey: ['dispatcher-monitoring', monitorFleetNumber],
    queryFn: () => getDispatcherVehicleMonitoring(monitorFleetNumber),
    enabled: !!monitorFleetNumber,
  })

  // Sync update form with selected schedule
  useEffect(() => {
    if (!selectedSchedule) {
      setUpdateRouteId('')
      setUpdateVehicleId('')
      setUpdateStartTime(null)
      setUpdateEndTime(null)
      setUpdateInterval(null)
      return
    }
    setUpdateRouteId(String(selectedSchedule.routeId))
    setUpdateVehicleId(selectedSchedule.vehicleId ? String(selectedSchedule.vehicleId) : '')
  }, [selectedSchedule?.id])

  // Filtered vehicles
  const createVehicles = useMemo(() => {
    if (!vehicles || !createRouteId) return vehicles
    return vehicles.filter((v) => v.routeId === Number(createRouteId))
  }, [vehicles, createRouteId])

  const updateVehicles = useMemo(() => {
    if (!vehicles || !updateRouteId) return vehicles
    return vehicles.filter((v) => v.routeId === Number(updateRouteId))
  }, [vehicles, updateRouteId])

  const selectedAssignmentVehicle = useMemo(() => {
    if (!vehicles?.length || !selectedVehicleId) return null
    return vehicles.find((v) => v.id === Number(selectedVehicleId)) ?? null
  }, [vehicles, selectedVehicleId])

  const selectedAssignmentRoute = useMemo(() => {
    if (!selectedAssignmentVehicle || !routes?.length) return null
    return routes.find((r) => r.id === selectedAssignmentVehicle.routeId) ?? null
  }, [routes, selectedAssignmentVehicle])

  // Map data
  const routeCoordinates = useMemo(() => {
    if (!monitoringData?.routePoints?.length) return []
    return monitoringData.routePoints
      .map((p) => [Number(p.lon), Number(p.lat)] as [number, number])
      .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
  }, [monitoringData])

  const mapCenter = useMemo<[number, number]>(() => {
    if (monitoringData?.vehicle?.lon && monitoringData?.vehicle?.lat) {
      const lon = Number(monitoringData.vehicle.lon)
      const lat = Number(monitoringData.vehicle.lat)
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        return [lon, lat]
      }
    }
    if (routeCoordinates.length > 0) {
      return routeCoordinates[0]
    }
    return UKRAINE_CENTER
  }, [monitoringData, routeCoordinates])

  // Display values for update form
  const displayUpdateStartTime =
    updateStartTime ?? (selectedSchedule ? toTimeInputValue(selectedSchedule.workStartTime) : '')
  const displayUpdateEndTime =
    updateEndTime ?? (selectedSchedule ? toTimeInputValue(selectedSchedule.workEndTime) : '')
  const displayUpdateInterval =
    updateInterval ?? (selectedSchedule ? String(selectedSchedule.intervalMin) : '')

  // Mutations
  const createScheduleMutation = useMutation({
    mutationFn: createDispatcherSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatcher-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['dispatcher-dashboard'] })
      setCreateRouteId('')
      setCreateVehicleId('')
      setCreateStartTime('')
      setCreateEndTime('')
      setCreateInterval('')
      toast.success('Розклад створено успішно!')
    },
    onError: (error: Error) => {
      toast.error('Помилка створення розкладу', { description: error.message })
    },
  })

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateDispatcherSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatcher-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['dispatcher-schedule-details'] })
      queryClient.invalidateQueries({ queryKey: ['dispatcher-dashboard'] })
      setUpdateStartTime(null)
      setUpdateEndTime(null)
      setUpdateInterval(null)
      toast.success('Розклад оновлено успішно!')
    },
    onError: (error: Error) => {
      toast.error('Помилка оновлення розкладу', { description: error.message })
    },
  })

  const assignDriverMutation = useMutation({
    mutationFn: assignDispatcherDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatcher-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['dispatcher-active-trips'] })
      queryClient.invalidateQueries({ queryKey: ['dispatcher-dashboard'] })
      setSelectedDriverId('')
      setSelectedVehicleId('')
      setAssignmentTime('')
      toast.success('Водія призначено успішно!')
    },
    onError: (error: Error) => {
      toast.error('Помилка призначення водія', { description: error.message })
    },
  })

  const deviationMutation = useMutation({
    mutationFn: ({ fleetNumber, data }: { fleetNumber: string; data?: any }) =>
      detectDispatcherDeviation(fleetNumber, data),
    onSuccess: (data) => {
      toast.success('Відхилення перевірено', {
        description: data.delayMinutes
          ? `Затримка: ${data.delayMinutes} хв`
          : 'Відхилення не виявлено',
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка перевірки відхилення', { description: error.message })
    },
  })

  // Handlers
  const handleCreateSchedule = () => {
    if (!createRouteId || !createVehicleId || !createStartTime || !createEndTime || !createInterval) {
      toast.error('Заповніть всі обов\'язкові поля')
      return
    }
    createScheduleMutation.mutate({
      routeId: Number(createRouteId),
      vehicleId: Number(createVehicleId),
      workStartTime: createStartTime,
      workEndTime: createEndTime,
      intervalMin: Number(createInterval),
    })
  }

  const handleUpdateSchedule = () => {
    if (!resolvedScheduleId) {
      toast.error('Оберіть розклад для оновлення')
      return
    }
    const payload: any = {}
    if (updateRouteId) payload.routeId = Number(updateRouteId)
    if (updateVehicleId) payload.vehicleId = Number(updateVehicleId)
    if (updateStartTime) payload.workStartTime = updateStartTime
    if (updateEndTime) payload.workEndTime = updateEndTime
    if (updateInterval) payload.intervalMin = Number(updateInterval)

    if (Object.keys(payload).length === 0) {
      toast.error('Змініть хоча б одне поле')
      return
    }

    updateScheduleMutation.mutate({ id: Number(resolvedScheduleId), data: payload })
  }

  const handleAssignDriver = () => {
    if (!selectedDriverId || !selectedVehicleId) {
      toast.error('Оберіть водія та транспорт')
      return
    }
    assignDriverMutation.mutate({
      driverId: Number(selectedDriverId),
      vehicleId: Number(selectedVehicleId),
      assignedAt: assignmentTime ? new Date(assignmentTime).toISOString() : undefined,
    })
  }

  const handleCheckDeviation = () => {
    if (!deviationFleetNumber) {
      toast.error('Введіть бортовий номер')
      return
    }
    deviationMutation.mutate({
      fleetNumber: deviationFleetNumber,
      data: deviationTime ? { currentTime: new Date(deviationTime).toISOString() } : undefined,
    })
  }

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    if (!dashboard) return []
    return [
      {
        title: 'Активні рейси',
        value: dashboard.activeTrips || 0,
        icon: Activity,
        variant: 'success' as const,
      },
      {
        title: 'Розклади сьогодні',
        value: dashboard.schedulesToday || 0,
        icon: Calendar,
      },
      {
        title: 'Водії без призначення',
        value: dashboard.unassignedDrivers || 0,
        icon: Users,
        variant: dashboard.unassignedDrivers > 0 ? ('warning' as const) : ('default' as const),
      },
      {
        title: 'Транспорт без призначення',
        value: dashboard.unassignedVehicles || 0,
        icon: Bus,
        variant: dashboard.unassignedVehicles > 0 ? ('warning' as const) : ('default' as const),
      },
      {
        title: 'Відхилення',
        value: dashboard.deviations || 0,
        icon: AlertTriangle,
        variant: dashboard.deviations > 0 ? ('warning' as const) : ('default' as const),
      },
    ]
  }, [dashboard])

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
              <BreadcrumbPage>Диспетчер</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div>
          <h1 className="text-display-sm">Кабінет диспетчера</h1>
          <p className="text-body-md text-muted-foreground mt-2">
            Управління розкладом, призначеннями та моніторингом транспорту
          </p>
        </div>

        {/* Dashboard Stats */}
        {dashboardLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {dashboardStats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Огляд</TabsTrigger>
            <TabsTrigger value="schedules">Розклади</TabsTrigger>
            <TabsTrigger value="assignments">Призначення</TabsTrigger>
            <TabsTrigger value="monitoring">Моніторинг</TabsTrigger>
            <TabsTrigger value="deviations">Відхилення</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Active Trips */}
              <Card>
                <CardHeader>
                  <CardTitle>Активні рейси</CardTitle>
                  <CardDescription>Поточні рейси на маршрутах</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeTrips && activeTrips.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {activeTrips.map((trip) => (
                        <div
                          key={trip.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge>{trip.routeNumber}</Badge>
                              <Badge variant="outline">{trip.fleetNumber}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{trip.driverName}</p>
                          </div>
                          <Badge variant="success">Активний</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Activity}
                      title="Немає активних рейсів"
                      description="Активні рейси з'являться тут"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Recent Assignments */}
              <Card>
                <CardHeader>
                  <CardTitle>Останні призначення</CardTitle>
                  <CardDescription>Призначення водіїв на транспорт</CardDescription>
                </CardHeader>
                <CardContent>
                  {assignments && assignments.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {assignments.slice(0, 5).map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{assignment.driverName}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{assignment.fleetNumber}</Badge>
                              <span className="text-xs text-muted-foreground">
                                Маршрут {assignment.routeNumber}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="Немає призначень"
                      description="Призначення з'являться тут"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Schedules Tab */}
          <TabsContent value="schedules" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Create Schedule */}
              <FormSection
                title="Створення розкладу"
                description="Новий розклад для маршруту"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-route">Маршрут *</Label>
                    <Select value={createRouteId} onValueChange={setCreateRouteId}>
                      <SelectTrigger id="create-route">
                        <SelectValue placeholder="Оберіть маршрут" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes?.map((route) => (
                          <SelectItem key={route.id} value={String(route.id)}>
                            {route.number} • {directionLabels[route.direction]} •{' '}
                            {route.transportTypeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-vehicle">Транспорт *</Label>
                    <Select
                      value={createVehicleId}
                      onValueChange={setCreateVehicleId}
                      disabled={!createRouteId}
                    >
                      <SelectTrigger id="create-vehicle">
                        <SelectValue
                          placeholder={createRouteId ? 'Оберіть транспорт' : 'Спочатку оберіть маршрут'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {createVehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                            {vehicle.fleetNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-start">Початок роботи *</Label>
                      <Input
                        id="create-start"
                        type="time"
                        value={createStartTime}
                        onChange={(e) => setCreateStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-end">Кінець роботи *</Label>
                      <Input
                        id="create-end"
                        type="time"
                        value={createEndTime}
                        onChange={(e) => setCreateEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-interval">Інтервал (хв) *</Label>
                    <Input
                      id="create-interval"
                      type="number"
                      min="1"
                      value={createInterval}
                      onChange={(e) => setCreateInterval(e.target.value)}
                      placeholder="15"
                    />
                  </div>

                  <Button
                    onClick={handleCreateSchedule}
                    disabled={createScheduleMutation.isPending}
                    className="w-full"
                  >
                    {createScheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Створити розклад
                  </Button>
                </div>
              </FormSection>

              {/* Schedule List & Update */}
              <div className="space-y-4">
                <h3 className="text-heading-md">Список розкладів</h3>
                {schedulesLoading ? (
                  <TableSkeleton rows={5} cols={6} />
                ) : schedules && schedules.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Маршрут</TableHead>
                          <TableHead>Напрямок</TableHead>
                          <TableHead>Транспорт</TableHead>
                          <TableHead>Час</TableHead>
                          <TableHead>Інтервал</TableHead>
                          <TableHead className="text-right">Дії</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedules.map((schedule) => (
                          <TableRow
                            key={schedule.id}
                            className={
                              resolvedScheduleId === String(schedule.id) ? 'bg-muted/50' : ''
                            }
                          >
                            <TableCell>
                              <Badge>{schedule.routeNumber}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {directionLabels[schedule.direction]}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {schedule.fleetNumber || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {schedule.workStartTime} - {schedule.workEndTime}
                            </TableCell>
                            <TableCell className="text-sm">{schedule.intervalMin} хв</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedScheduleId(String(schedule.id))}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState
                    icon={Calendar}
                    title="Немає розкладів"
                    description="Створіть перший розклад"
                  />
                )}

                {/* Update Schedule Form */}
                {selectedSchedule && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Оновлення розкладу</CardTitle>
                      <CardDescription>
                        Маршрут {selectedSchedule.routeNumber} • {selectedSchedule.fleetNumber || 'Без транспорту'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="update-route">Маршрут</Label>
                        <Select value={updateRouteId} onValueChange={setUpdateRouteId}>
                          <SelectTrigger id="update-route">
                            <SelectValue placeholder="Оберіть маршрут" />
                          </SelectTrigger>
                          <SelectContent>
                            {routes?.map((route) => (
                              <SelectItem key={route.id} value={String(route.id)}>
                                {route.number} • {directionLabels[route.direction]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="update-vehicle">Транспорт</Label>
                        <Select
                          value={updateVehicleId}
                          onValueChange={setUpdateVehicleId}
                          disabled={!updateRouteId}
                        >
                          <SelectTrigger id="update-vehicle">
                            <SelectValue placeholder="Оберіть транспорт" />
                          </SelectTrigger>
                          <SelectContent>
                            {updateVehicles?.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                                {vehicle.fleetNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="update-start">Початок роботи</Label>
                          <Input
                            id="update-start"
                            type="time"
                            value={displayUpdateStartTime}
                            onChange={(e) => setUpdateStartTime(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="update-end">Кінець роботи</Label>
                          <Input
                            id="update-end"
                            type="time"
                            value={displayUpdateEndTime}
                            onChange={(e) => setUpdateEndTime(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="update-interval">Інтервал (хв)</Label>
                        <Input
                          id="update-interval"
                          type="number"
                          min="1"
                          value={displayUpdateInterval}
                          onChange={(e) => setUpdateInterval(e.target.value)}
                        />
                      </div>

                      <Button
                        onClick={handleUpdateSchedule}
                        disabled={updateScheduleMutation.isPending}
                        className="w-full"
                      >
                        {updateScheduleMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Edit2 className="mr-2 h-4 w-4" />
                        Оновити розклад
                      </Button>

                      {/* Schedule Details */}
                      {scheduleDetailsLoading ? (
                        <TableSkeleton rows={3} cols={1} />
                      ) : scheduleDetails && (
                        <div className="mt-4 space-y-4">
                          <h4 className="text-heading-sm">Деталі розкладу</h4>
                          <div className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Тривалість маршруту:</span>
                              <span className="font-medium">
                                {scheduleDetails.routeDurationMin || '—'} хв
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Час закінчення:</span>
                              <span className="font-medium">
                                {scheduleDetails.routeEndTime || '—'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Кількість відправлень:</span>
                              <span className="font-medium">{scheduleDetails.departures.length}</span>
                            </div>
                          </div>

                          {scheduleDetails.stops.length > 0 && (
                            <div className="mt-4">
                              <h4 className="text-heading-sm mb-2">Зупинки</h4>
                              <div className="rounded-md border max-h-[200px] overflow-y-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Назва</TableHead>
                                      <TableHead>До наступної</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {scheduleDetails.stops.map((stop) => (
                                      <TableRow key={stop.id}>
                                        <TableCell className="text-sm">{stop.name}</TableCell>
                                        <TableCell className="text-sm">
                                          {stop.minutesToNextStop != null
                                            ? `${stop.minutesToNextStop} хв`
                                            : '—'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection
                title="Призначення водія"
                description="Призначити водія на транспортний засіб"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="assign-driver">Водій *</Label>
                    <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                      <SelectTrigger id="assign-driver">
                        <SelectValue placeholder="Оберіть водія" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={String(driver.id)}>
                            {driver.fullName} • {driver.login}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assign-vehicle">Транспорт *</Label>
                    <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                      <SelectTrigger id="assign-vehicle">
                        <SelectValue placeholder="Оберіть транспорт" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                            {vehicle.fleetNumber} • Маршрут {vehicle.routeNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedAssignmentRoute && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Маршрут:</span>
                            <Badge>{selectedAssignmentRoute.number}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Напрямок:</span>
                            <span>{directionLabels[selectedAssignmentRoute.direction]}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Тип транспорту:</span>
                            <span>{selectedAssignmentRoute.transportTypeName}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="assign-time">Час призначення (опційно)</Label>
                    <Input
                      id="assign-time"
                      type="datetime-local"
                      value={assignmentTime}
                      onChange={(e) => setAssignmentTime(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleAssignDriver}
                    disabled={assignDriverMutation.isPending}
                    className="w-full"
                  >
                    {assignDriverMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Призначити водія
                  </Button>
                </div>
              </FormSection>

              {/* Assignments List */}
              <div className="space-y-4">
                <h3 className="text-heading-md">Список призначень</h3>
                {assignments && assignments.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Водій</TableHead>
                          <TableHead>Транспорт</TableHead>
                          <TableHead>Маршрут</TableHead>
                          <TableHead>Призначено</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-sm">{assignment.driverName}</p>
                                <p className="text-xs text-muted-foreground">{assignment.driverLogin}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{assignment.fleetNumber}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge>{assignment.routeNumber}</Badge>
                                <p className="text-xs text-muted-foreground">
                                  {directionLabels[assignment.direction]}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(assignment.assignedAt).toLocaleDateString('uk-UA')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Немає призначень"
                    description="Призначте водіїв на транспорт"
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Моніторинг транспорту</CardTitle>
                <CardDescription>GPS відстеження та маршрути</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="monitor-fleet">Бортовий номер</Label>
                    <Input
                      id="monitor-fleet"
                      value={monitorFleetNumber}
                      onChange={(e) => setMonitorFleetNumber(e.target.value)}
                      placeholder="Введіть бортовий номер"
                    />
                  </div>
                  <div className="self-end">
                    <Button
                      onClick={() => {
                        if (monitorFleetNumber) {
                          queryClient.invalidateQueries({
                            queryKey: ['dispatcher-monitoring', monitorFleetNumber],
                          })
                        }
                      }}
                      disabled={!monitorFleetNumber}
                      className="w-full"
                    >
                      Відобразити
                    </Button>
                  </div>
                </div>

                {monitoringData && (
                  <div className="space-y-4">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="grid gap-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Транспорт:</span>
                            <Badge variant="outline">{monitoringData.vehicle.fleetNumber}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Маршрут:</span>
                            <Badge>{monitoringData.vehicle.routeNumber}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Напрямок:</span>
                            <span>{directionLabels[monitoringData.vehicle.routeDirection]}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Водій:</span>
                            <span>{monitoringData.vehicle.driverName || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Статус:</span>
                            <Badge
                              variant={
                                monitoringData.vehicle.status === 'active' ? 'success' : 'default'
                              }
                            >
                              {monitoringData.vehicle.status}
                            </Badge>
                          </div>
                          {monitoringData.vehicle.lon && monitoringData.vehicle.lat && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">GPS:</span>
                              <span className="font-mono text-xs">
                                {Number(monitoringData.vehicle.lat).toFixed(5)},{' '}
                                {Number(monitoringData.vehicle.lon).toFixed(5)}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="rounded-md border overflow-hidden">
                      <div className="h-[500px]">
                        <MapView ref={mapRef} center={mapCenter} zoom={13}>
                          <MapControls showLocate showFullscreen />
                          {routeCoordinates.length >= 2 && (
                            <MapRoute
                              coordinates={routeCoordinates}
                              color="#2563EB"
                              width={4}
                              opacity={0.85}
                            />
                          )}
                          {monitoringData.vehicle.lon && monitoringData.vehicle.lat && (
                            <MapMarker
                              longitude={Number(monitoringData.vehicle.lon)}
                              latitude={Number(monitoringData.vehicle.lat)}
                            >
                              <MarkerContent>
                                <div className="flex flex-col items-center">
                                  <div className="h-4 w-4 rounded-full bg-emerald-500 border-2 border-white shadow-md" />
                                  <div className="mt-1 px-2 py-1 bg-white rounded shadow text-xs font-medium">
                                    {monitoringData.vehicle.fleetNumber}
                                  </div>
                                </div>
                              </MarkerContent>
                            </MapMarker>
                          )}
                        </MapView>
                      </div>
                    </div>
                  </div>
                )}

                {!monitoringData && monitorFleetNumber && (
                  <EmptyState
                    icon={MapPin}
                    title="Транспорт не знайдено"
                    description="Перевірте бортовий номер та спробуйте ще раз"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deviations Tab */}
          <TabsContent value="deviations" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection
                title="Перевірка відхилення"
                description="Виявлення відхилень від розкладу"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviation-fleet">Бортовий номер *</Label>
                    <Input
                      id="deviation-fleet"
                      value={deviationFleetNumber}
                      onChange={(e) => setDeviationFleetNumber(e.target.value)}
                      placeholder="Введіть бортовий номер"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deviation-time">Час перевірки (опційно)</Label>
                    <Input
                      id="deviation-time"
                      type="datetime-local"
                      value={deviationTime}
                      onChange={(e) => setDeviationTime(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleCheckDeviation}
                    disabled={deviationMutation.isPending}
                    className="w-full"
                  >
                    {deviationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Перевірити відхилення
                  </Button>
                </div>
              </FormSection>

              {/* Deviations List */}
              <div className="space-y-4">
                <h3 className="text-heading-md">Список відхилень</h3>
                {deviations && deviations.length > 0 ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {deviations.map((deviation) => (
                      <Card
                        key={deviation.tripId}
                        className="border-warning/30 bg-warning/5"
                      >
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge>{deviation.routeNumber}</Badge>
                                <Badge variant="outline">{deviation.fleetNumber}</Badge>
                              </div>
                              <Badge variant="warning">
                                {deviation.delayMinutes != null
                                  ? `${deviation.delayMinutes > 0 ? '+' : ''}${deviation.delayMinutes} хв`
                                  : 'Невідомо'}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <p className="font-medium">{deviation.driverName}</p>
                              <p className="text-muted-foreground">
                                Початок: {new Date(deviation.startsAt).toLocaleString('uk-UA')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Немає відхилень"
                    description="Відхилення від розкладу з'являться тут"
                  />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Helper functions
function toTimeInputValue(timeStr: string): string {
  if (!timeStr) return ''
  return timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr
}
