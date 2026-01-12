import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl'
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
import { FormSection } from '@/components/domain/forms'
import { EmptyState, TableSkeleton } from '@/components/domain/data-display'
import { ComplaintCard } from '@/components/domain/municipality'
import {
  createMunicipalityRoute,
  createMunicipalityStop,
  getComplaints,
  getMunicipalityRoutePoints,
  getMunicipalityRouteStops,
  getMunicipalityRoutes,
  getMunicipalityStops,
  getMunicipalityTransportTypes,
  getPassengerFlow,
  setMunicipalityRouteActive,
  updateMunicipalityStop,
  updateComplaintStatus,
} from '@/lib/municipality-api'
import { toast } from 'sonner'
import {
  MapPin,
  Bus,
  TrendingUp,
  MessageSquare,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Map as MapIcon,
} from 'lucide-react'

export const Route = createFileRoute('/municipality')({
  component: MunicipalityPage,
})

type StopDraft = {
  stopId: string
  name: string
  lon: string
  lat: string
  distanceToNextKm: string
}

type PointDraft = {
  lon: string
  lat: string
}

const LVIV_CENTER: [number, number] = [24.0316, 49.8429]

function MunicipalityPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('stops')

  // Stop forms
  const [createStopForm, setCreateStopForm] = useState({ name: '', lon: '', lat: '' })
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null)
  const [updateStopForm, setUpdateStopForm] = useState({ name: '', lon: '', lat: '' })

  // Route creation form
  const [routeForm, setRouteForm] = useState({
    number: '',
    transportTypeId: '',
    direction: 'forward' as 'forward' | 'reverse',
  })
  const [routeStopsDrafts, setRouteStopsDrafts] = useState<StopDraft[]>([
    emptyStop(),
    emptyStop(),
  ])
  const [routePointsDrafts, setRoutePointsDrafts] = useState<PointDraft[]>([
    emptyPoint(),
    emptyPoint(),
  ])
  const [routeCreateResult, setRouteCreateResult] = useState<string | null>(null)

  // Route viewing
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')

  // Analytics filters
  const [flowForm, setFlowForm] = useState({
    from: getDateDaysAgo(30),
    to: getDateDaysAgo(0),
    routeNumber: '',
    transportTypeId: '',
  })
  const [flowQuery, setFlowQuery] = useState({
    from: getDateDaysAgo(30),
    to: getDateDaysAgo(0),
    routeNumber: '',
    transportTypeId: '',
  })

  // Complaints filters
  const [complaintsForm, setComplaintsForm] = useState({
    from: getDateDaysAgo(30),
    to: getDateDaysAgo(0),
    routeNumber: '',
    transportTypeId: '',
    fleetNumber: '',
  })
  const [complaintsQuery, setComplaintsQuery] = useState({
    from: getDateDaysAgo(30),
    to: getDateDaysAgo(0),
    routeNumber: '',
    transportTypeId: '',
    fleetNumber: '',
  })

  const previewMapRef = useRef<MapLibreMap | null>(null)
  const viewMapRef = useRef<MapLibreMap | null>(null)

  // Queries
  const { data: transportTypes } = useQuery({
    queryKey: ['municipality-transport-types'],
    queryFn: getMunicipalityTransportTypes,
  })

  const { data: stops, isLoading: stopsLoading } = useQuery({
    queryKey: ['municipality-stops'],
    queryFn: getMunicipalityStops,
  })

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['municipality-routes'],
    queryFn: getMunicipalityRoutes,
  })

  const { data: routeStops } = useQuery({
    queryKey: ['municipality-route-stops', selectedRouteId],
    queryFn: () => getMunicipalityRouteStops(Number(selectedRouteId)),
    enabled: !!selectedRouteId,
  })

  const { data: routePoints } = useQuery({
    queryKey: ['municipality-route-points', selectedRouteId],
    queryFn: () => getMunicipalityRoutePoints(Number(selectedRouteId)),
    enabled: !!selectedRouteId,
  })

  const { data: passengerFlow, isLoading: flowLoading } = useQuery({
    queryKey: ['municipality-passenger-flow', flowQuery],
    queryFn: () =>
      getPassengerFlow({
        from: flowQuery.from,
        to: flowQuery.to,
        routeNumber: flowQuery.routeNumber || undefined,
        transportTypeId: flowQuery.transportTypeId
          ? Number(flowQuery.transportTypeId)
          : undefined,
      }),
  })

  const { data: complaints, isLoading: complaintsLoading } = useQuery({
    queryKey: ['municipality-complaints', complaintsQuery],
    queryFn: () =>
      getComplaints({
        from: complaintsQuery.from,
        to: complaintsQuery.to,
        routeNumber: complaintsQuery.routeNumber || undefined,
        transportTypeId: complaintsQuery.transportTypeId
          ? Number(complaintsQuery.transportTypeId)
          : undefined,
        fleetNumber: complaintsQuery.fleetNumber || undefined,
      }),
  })

  // Mutations
  const createStopMutation = useMutation({
    mutationFn: createMunicipalityStop,
    onSuccess: () => {
      setCreateStopForm({ name: '', lon: '', lat: '' })
      queryClient.invalidateQueries({ queryKey: ['municipality-stops'] })
      toast.success('Зупинку створено успішно!')
    },
    onError: (error: Error) => {
      toast.error('Помилка створення зупинки', { description: error.message })
    },
  })

  const updateStopMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateMunicipalityStop(id, data),
    onSuccess: () => {
      setSelectedStopId(null)
      setUpdateStopForm({ name: '', lon: '', lat: '' })
      queryClient.invalidateQueries({ queryKey: ['municipality-stops'] })
      toast.success('Зупинку оновлено успішно!')
    },
    onError: (error: Error) => {
      toast.error('Помилка оновлення зупинки', { description: error.message })
    },
  })

  const createRouteMutation = useMutation({
    mutationFn: createMunicipalityRoute,
    onSuccess: (data) => {
      setRouteCreateResult(`Маршрут створено (ID ${data.route.id})`)
      setRouteForm({ number: '', transportTypeId: '', direction: 'forward' })
      setRouteStopsDrafts([emptyStop(), emptyStop()])
      setRoutePointsDrafts([emptyPoint(), emptyPoint()])
      queryClient.invalidateQueries({ queryKey: ['municipality-routes'] })
      toast.success('Маршрут створено успішно!', {
        description: `ID: ${data.route.id}`,
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка створення маршруту', { description: error.message })
    },
  })

  const setRouteActiveMutation = useMutation({
    mutationFn: ({ routeId, isActive }: { routeId: number; isActive: boolean }) =>
      setMunicipalityRouteActive(routeId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipality-routes'] })
      toast.success('Статус маршруту оновлено')
    },
    onError: (error: Error) => {
      toast.error('Помилка оновлення статусу', { description: error.message })
    },
  })

  const updateComplaintStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateComplaintStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipality-complaints'] })
      toast.success('Статус скарги оновлено')
    },
    onError: (error: Error) => {
      toast.error('Помилка оновлення статусу', { description: error.message })
    },
  })

  // Sync update form with selected stop
  useEffect(() => {
    if (!selectedStopId || !stops) {
      setUpdateStopForm({ name: '', lon: '', lat: '' })
      return
    }
    const stop = stops.find((s) => s.id === selectedStopId)
    if (stop) {
      setUpdateStopForm({
        name: stop.name,
        lon: String(stop.lon),
        lat: String(stop.lat),
      })
    }
  }, [selectedStopId, stops])

  // Map data for route preview
  const previewCoordinates = useMemo(
    () => toCoordinates(routePointsDrafts),
    [routePointsDrafts]
  )

  const previewStops = useMemo(
    () => toStopCoordinates(routeStopsDrafts),
    [routeStopsDrafts]
  )

  const previewBounds = useMemo(() => getBounds(previewCoordinates), [previewCoordinates])

  useEffect(() => {
    if (!previewBounds || !previewMapRef.current) return
    const map = previewMapRef.current
    const fit = () =>
      map.fitBounds(previewBounds, { padding: 56, duration: 600, maxZoom: 14 })

    if (map.isStyleLoaded()) {
      fit()
    } else {
      map.once('load', fit)
    }
  }, [previewBounds])

  // Map data for route viewing
  const viewCoordinates = useMemo(
    () => toRoutePointCoords(routePoints ?? []),
    [routePoints]
  )

  const viewStops = useMemo(() => toRouteStopCoords(routeStops ?? []), [routeStops])

  const viewBounds = useMemo(() => getBounds(viewCoordinates), [viewCoordinates])

  useEffect(() => {
    if (!viewBounds || !viewMapRef.current) return
    const map = viewMapRef.current
    const fit = () => map.fitBounds(viewBounds, { padding: 56, duration: 600, maxZoom: 14 })

    if (map.isStyleLoaded()) {
      fit()
    } else {
      map.once('load', fit)
    }
  }, [viewBounds])

  // Handlers
  const handleCreateStop = () => {
    const lon = Number(createStopForm.lon)
    const lat = Number(createStopForm.lat)
    if (!createStopForm.name || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      toast.error('Заповніть всі поля коректно')
      return
    }
    createStopMutation.mutate({ name: createStopForm.name, lon, lat })
  }

  const handleUpdateStop = () => {
    if (!selectedStopId) return
    const lon = Number(updateStopForm.lon)
    const lat = Number(updateStopForm.lat)
    if (!updateStopForm.name || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      toast.error('Заповніть всі поля коректно')
      return
    }
    updateStopMutation.mutate({
      id: selectedStopId,
      data: { name: updateStopForm.name, lon, lat },
    })
  }

  const handleCreateRoute = () => {
    if (!routeForm.number || !routeForm.transportTypeId) {
      toast.error('Заповніть номер маршруту та тип транспорту')
      return
    }

    const stops = routeStopsDrafts
      .filter((s) => s.stopId && s.distanceToNextKm)
      .map((s) => ({
        stopId: Number(s.stopId),
        distanceToNextKm: Number(s.distanceToNextKm),
      }))

    const points = routePointsDrafts
      .filter((p) => p.lon && p.lat)
      .map((p) => ({
        lon: Number(p.lon),
        lat: Number(p.lat),
      }))

    if (stops.length < 2) {
      toast.error('Додайте принаймні 2 зупинки')
      return
    }

    if (points.length < 2) {
      toast.error('Додайте принаймні 2 точки маршруту')
      return
    }

    createRouteMutation.mutate({
      number: routeForm.number,
      transportTypeId: Number(routeForm.transportTypeId),
      direction: routeForm.direction,
      stops,
      points,
    })
  }

  const handleApplyFlowFilters = () => {
    setFlowQuery(flowForm)
  }

  const handleApplyComplaintsFilters = () => {
    setComplaintsQuery(complaintsForm)
  }

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
              <BreadcrumbPage>Департамент мерії</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div>
          <h1 className="text-display-sm">Департамент мерії</h1>
          <p className="text-body-md text-muted-foreground mt-2">
            Управління міською транспортною інфраструктурою
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stops">Зупинки</TabsTrigger>
            <TabsTrigger value="designer">Проектування</TabsTrigger>
            <TabsTrigger value="routes">Маршрути</TabsTrigger>
            <TabsTrigger value="analytics">Аналітика</TabsTrigger>
            <TabsTrigger value="complaints">Скарги</TabsTrigger>
          </TabsList>

          {/* Stops Tab */}
          <TabsContent value="stops" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Create/Update Stop */}
              <FormSection
                title={selectedStopId ? 'Оновлення зупинки' : 'Створення зупинки'}
                description="Географічна точка зупинки"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={selectedStopId ? 'update-name' : 'create-name'}>
                      Назва *
                    </Label>
                    <Input
                      id={selectedStopId ? 'update-name' : 'create-name'}
                      value={selectedStopId ? updateStopForm.name : createStopForm.name}
                      onChange={(e) =>
                        selectedStopId
                          ? setUpdateStopForm({ ...updateStopForm, name: e.target.value })
                          : setCreateStopForm({ ...createStopForm, name: e.target.value })
                      }
                      placeholder="Площа Ринок"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={selectedStopId ? 'update-lon' : 'create-lon'}>
                        Довгота *
                      </Label>
                      <Input
                        id={selectedStopId ? 'update-lon' : 'create-lon'}
                        type="number"
                        step="0.000001"
                        value={selectedStopId ? updateStopForm.lon : createStopForm.lon}
                        onChange={(e) =>
                          selectedStopId
                            ? setUpdateStopForm({ ...updateStopForm, lon: e.target.value })
                            : setCreateStopForm({ ...createStopForm, lon: e.target.value })
                        }
                        placeholder="24.031609"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={selectedStopId ? 'update-lat' : 'create-lat'}>
                        Широта *
                      </Label>
                      <Input
                        id={selectedStopId ? 'update-lat' : 'create-lat'}
                        type="number"
                        step="0.000001"
                        value={selectedStopId ? updateStopForm.lat : createStopForm.lat}
                        onChange={(e) =>
                          selectedStopId
                            ? setUpdateStopForm({ ...updateStopForm, lat: e.target.value })
                            : setCreateStopForm({ ...createStopForm, lat: e.target.value })
                        }
                        placeholder="49.842957"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {selectedStopId && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedStopId(null)
                          setUpdateStopForm({ name: '', lon: '', lat: '' })
                        }}
                      >
                        Скасувати
                      </Button>
                    )}
                    <Button
                      onClick={selectedStopId ? handleUpdateStop : handleCreateStop}
                      disabled={
                        selectedStopId
                          ? updateStopMutation.isPending
                          : createStopMutation.isPending
                      }
                      className="flex-1"
                    >
                      {(selectedStopId ? updateStopMutation.isPending : createStopMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {selectedStopId ? 'Оновити' : 'Створити'}
                    </Button>
                  </div>
                </div>
              </FormSection>

              {/* Stops List */}
              <div className="space-y-4">
                <h3 className="text-heading-md">Список зупинок</h3>
                {stopsLoading ? (
                  <TableSkeleton rows={5} cols={3} />
                ) : stops && stops.length > 0 ? (
                  <div className="rounded-md border">
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Назва</TableHead>
                            <TableHead>Координати</TableHead>
                            <TableHead className="text-right">Дії</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stops.map((stop) => (
                            <TableRow
                              key={stop.id}
                              className={selectedStopId === stop.id ? 'bg-muted/50' : ''}
                            >
                              <TableCell className="font-medium">{stop.name}</TableCell>
                              <TableCell className="text-sm font-mono">
                                {Number(stop.lat).toFixed(5)}, {Number(stop.lon).toFixed(5)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedStopId(stop.id)}
                                >
                                  Редагувати
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={MapPin}
                    title="Немає зупинок"
                    description="Створіть першу зупинку для міського транспорту"
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* Route Designer Tab */}
          <TabsContent value="designer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Проектування нового маршруту</CardTitle>
                <CardDescription>
                  Створіть маршрут з зупинками та точками траси
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Route Info */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="route-number">Номер маршруту *</Label>
                    <Input
                      id="route-number"
                      value={routeForm.number}
                      onChange={(e) => setRouteForm({ ...routeForm, number: e.target.value })}
                      placeholder="5А"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route-type">Тип транспорту *</Label>
                    <Select
                      value={routeForm.transportTypeId}
                      onValueChange={(value) =>
                        setRouteForm({ ...routeForm, transportTypeId: value })
                      }
                    >
                      <SelectTrigger id="route-type">
                        <SelectValue placeholder="Оберіть тип" />
                      </SelectTrigger>
                      <SelectContent>
                        {transportTypes?.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route-direction">Напрямок *</Label>
                    <Select
                      value={routeForm.direction}
                      onValueChange={(value) =>
                        setRouteForm({
                          ...routeForm,
                          direction: value as 'forward' | 'reverse',
                        })
                      }
                    >
                      <SelectTrigger id="route-direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="forward">Прямий</SelectItem>
                        <SelectItem value="reverse">Зворотній</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Stops */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-heading-sm">Зупинки маршруту</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRouteStopsDrafts([...routeStopsDrafts, emptyStop()])}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Додати зупинку
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {routeStopsDrafts.map((stop, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`stop-${index}`}>Зупинка</Label>
                          <Select
                            value={stop.stopId}
                            onValueChange={(value) => {
                              const newStops = [...routeStopsDrafts]
                              const selectedStop = stops?.find((s) => s.id === Number(value))
                              newStops[index] = {
                                ...newStops[index],
                                stopId: value,
                                name: selectedStop?.name || '',
                                lon: selectedStop?.lon ? String(selectedStop.lon) : '',
                                lat: selectedStop?.lat ? String(selectedStop.lat) : '',
                              }
                              setRouteStopsDrafts(newStops)
                            }}
                          >
                            <SelectTrigger id={`stop-${index}`}>
                              <SelectValue placeholder="Оберіть зупинку" />
                            </SelectTrigger>
                            <SelectContent>
                              {stops?.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32 space-y-2">
                          <Label htmlFor={`dist-${index}`}>Відстань (км)</Label>
                          <Input
                            id={`dist-${index}`}
                            type="number"
                            step="0.1"
                            value={stop.distanceToNextKm}
                            onChange={(e) => {
                              const newStops = [...routeStopsDrafts]
                              newStops[index] = { ...newStops[index], distanceToNextKm: e.target.value }
                              setRouteStopsDrafts(newStops)
                            }}
                            placeholder="0.5"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (index === 0) return
                              const newStops = [...routeStopsDrafts]
                              ;[newStops[index - 1], newStops[index]] = [
                                newStops[index],
                                newStops[index - 1],
                              ]
                              setRouteStopsDrafts(newStops)
                            }}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (index === routeStopsDrafts.length - 1) return
                              const newStops = [...routeStopsDrafts]
                              ;[newStops[index], newStops[index + 1]] = [
                                newStops[index + 1],
                                newStops[index],
                              ]
                              setRouteStopsDrafts(newStops)
                            }}
                            disabled={index === routeStopsDrafts.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (routeStopsDrafts.length <= 2) return
                              setRouteStopsDrafts(routeStopsDrafts.filter((_, i) => i !== index))
                            }}
                            disabled={routeStopsDrafts.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Points */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-heading-sm">Точки траси</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRoutePointsDrafts([...routePointsDrafts, emptyPoint()])}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Додати точку
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {routePointsDrafts.map((point, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="flex-1 grid gap-2 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`point-lon-${index}`}>Довгота</Label>
                            <Input
                              id={`point-lon-${index}`}
                              type="number"
                              step="0.000001"
                              value={point.lon}
                              onChange={(e) => {
                                const newPoints = [...routePointsDrafts]
                                newPoints[index] = { ...newPoints[index], lon: e.target.value }
                                setRoutePointsDrafts(newPoints)
                              }}
                              placeholder="24.031609"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`point-lat-${index}`}>Широта</Label>
                            <Input
                              id={`point-lat-${index}`}
                              type="number"
                              step="0.000001"
                              value={point.lat}
                              onChange={(e) => {
                                const newPoints = [...routePointsDrafts]
                                newPoints[index] = { ...newPoints[index], lat: e.target.value }
                                setRoutePointsDrafts(newPoints)
                              }}
                              placeholder="49.842957"
                            />
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (routePointsDrafts.length <= 2) return
                            setRoutePointsDrafts(routePointsDrafts.filter((_, i) => i !== index))
                          }}
                          disabled={routePointsDrafts.length <= 2}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Map Preview */}
                {previewCoordinates.length >= 2 && (
                  <div className="space-y-2">
                    <h4 className="text-heading-sm">Попередній перегляд</h4>
                    <div className="rounded-md border overflow-hidden">
                      <div className="h-[400px]">
                        <MapView ref={previewMapRef} center={LVIV_CENTER} zoom={12}>
                          <MapControls />
                          {previewCoordinates.length >= 2 && (
                            <MapRoute
                              coordinates={previewCoordinates}
                              color="#2563EB"
                              width={4}
                              opacity={0.85}
                            />
                          )}
                          {previewStops.map((stop, index) => (
                            <MapMarker key={index} longitude={stop[0]} latitude={stop[1]}>
                              <MarkerContent>
                                <div className="h-3 w-3 rounded-full bg-white border-2 border-blue-600 shadow-sm" />
                              </MarkerContent>
                            </MapMarker>
                          ))}
                        </MapView>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <div className="space-y-4">
                  {routeCreateResult && (
                    <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
                      {routeCreateResult}
                    </div>
                  )}
                  <Button
                    onClick={handleCreateRoute}
                    disabled={createRouteMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {createRouteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Bus className="mr-2 h-4 w-4" />
                    Створити маршрут
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Routes Tab */}
          <TabsContent value="routes" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Routes List */}
              <div className="space-y-4">
                <h3 className="text-heading-md">Маршрути міста</h3>
                {routesLoading ? (
                  <TableSkeleton rows={5} cols={4} />
                ) : routes && routes.length > 0 ? (
                  <div className="space-y-2">
                    {routes.map((route) => (
                      <Card
                        key={route.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedRouteId === String(route.id) ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedRouteId(String(route.id))}
                      >
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge>{route.number}</Badge>
                                <Badge variant="outline">
                                  {route.direction === 'forward' ? 'Прямий' : 'Зворотній'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {route.transportTypeName}
                                </span>
                              </div>
                              <Badge variant={route.isActive ? 'success' : 'default'}>
                                {route.isActive ? 'Активний' : 'Неактивний'}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant={route.isActive ? 'outline' : 'default'}
                              onClick={(e) => {
                                e.stopPropagation()
                                setRouteActiveMutation.mutate({
                                  routeId: route.id,
                                  isActive: !route.isActive,
                                })
                              }}
                              className="w-full"
                            >
                              {route.isActive ? 'Деактивувати' : 'Активувати'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Bus}
                    title="Немає маршрутів"
                    description="Створіть маршрути у розділі Проектування"
                  />
                )}
              </div>

              {/* Route Map View */}
              <div className="space-y-4">
                <h3 className="text-heading-md">Візуалізація маршруту</h3>
                {selectedRouteId && viewCoordinates.length >= 2 ? (
                  <div className="space-y-4">
                    <div className="rounded-md border overflow-hidden">
                      <div className="h-[500px]">
                        <MapView ref={viewMapRef} center={LVIV_CENTER} zoom={12}>
                          <MapControls />
                          {viewCoordinates.length >= 2 && (
                            <MapRoute
                              coordinates={viewCoordinates}
                              color="#2563EB"
                              width={4}
                              opacity={0.85}
                            />
                          )}
                          {viewStops.map((stop, index) => (
                            <MapMarker key={index} longitude={stop[0]} latitude={stop[1]}>
                              <MarkerContent>
                                <div className="h-3 w-3 rounded-full bg-white border-2 border-blue-600 shadow-sm" />
                              </MarkerContent>
                            </MapMarker>
                          ))}
                        </MapView>
                      </div>
                    </div>

                    {routeStops && routeStops.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Зупинки маршруту</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-md border max-h-[200px] overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Назва</TableHead>
                                  <TableHead>Відстань до наступної</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {routeStops.map((stop) => (
                                  <TableRow key={stop.stopId}>
                                    <TableCell className="text-sm">{stop.stopName}</TableCell>
                                    <TableCell className="text-sm">
                                      {stop.distanceToNextKm != null
                                        ? `${stop.distanceToNextKm} км`
                                        : '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={MapIcon}
                    title="Оберіть маршрут"
                    description="Виберіть маршрут зі списку для відображення на карті"
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <CardTitle>Аналітика пасажиропотоку</CardTitle>
                </div>
                <CardDescription>Статистика використання транспорту за період</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="flow-from">Від</Label>
                    <Input
                      id="flow-from"
                      type="date"
                      value={flowForm.from}
                      onChange={(e) => setFlowForm({ ...flowForm, from: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flow-to">До</Label>
                    <Input
                      id="flow-to"
                      type="date"
                      value={flowForm.to}
                      onChange={(e) => setFlowForm({ ...flowForm, to: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flow-route">Маршрут</Label>
                    <Input
                      id="flow-route"
                      value={flowForm.routeNumber}
                      onChange={(e) => setFlowForm({ ...flowForm, routeNumber: e.target.value })}
                      placeholder="5А"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flow-type">Тип транспорту</Label>
                    <Select
                      value={flowForm.transportTypeId}
                      onValueChange={(value) =>
                        setFlowForm({ ...flowForm, transportTypeId: value })
                      }
                    >
                      <SelectTrigger id="flow-type">
                        <SelectValue placeholder="Всі" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Всі</SelectItem>
                        {transportTypes?.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleApplyFlowFilters} className="w-full">
                  Застосувати фільтри
                </Button>

                {/* Results */}
                {flowLoading ? (
                  <TableSkeleton rows={5} cols={3} />
                ) : passengerFlow && passengerFlow.length > 0 ? (
                  <div className="space-y-4">
                    {passengerFlow.map((flow, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">Маршрут {flow.routeNumber}</p>
                          <p className="text-sm text-muted-foreground">{flow.transportTypeName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{flow.totalTrips || 0}</p>
                          <p className="text-sm text-muted-foreground">рейсів</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={TrendingUp}
                    title="Немає даних"
                    description="Статистика з'явиться після накопичення даних"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="complaints" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <CardTitle>Скарги пасажирів</CardTitle>
                </div>
                <CardDescription>Управління скаргами та зверненнями</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="space-y-2">
                    <Label htmlFor="comp-from">Від</Label>
                    <Input
                      id="comp-from"
                      type="date"
                      value={complaintsForm.from}
                      onChange={(e) => setComplaintsForm({ ...complaintsForm, from: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-to">До</Label>
                    <Input
                      id="comp-to"
                      type="date"
                      value={complaintsForm.to}
                      onChange={(e) => setComplaintsForm({ ...complaintsForm, to: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-route">Маршрут</Label>
                    <Input
                      id="comp-route"
                      value={complaintsForm.routeNumber}
                      onChange={(e) =>
                        setComplaintsForm({ ...complaintsForm, routeNumber: e.target.value })
                      }
                      placeholder="5А"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-type">Тип транспорту</Label>
                    <Select
                      value={complaintsForm.transportTypeId}
                      onValueChange={(value) =>
                        setComplaintsForm({ ...complaintsForm, transportTypeId: value })
                      }
                    >
                      <SelectTrigger id="comp-type">
                        <SelectValue placeholder="Всі" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Всі</SelectItem>
                        {transportTypes?.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-fleet">Транспорт</Label>
                    <Input
                      id="comp-fleet"
                      value={complaintsForm.fleetNumber}
                      onChange={(e) =>
                        setComplaintsForm({ ...complaintsForm, fleetNumber: e.target.value })
                      }
                      placeholder="102"
                    />
                  </div>
                </div>
                <Button onClick={handleApplyComplaintsFilters} className="w-full">
                  Застосувати фільтри
                </Button>

                {/* Results */}
                {complaintsLoading ? (
                  <TableSkeleton rows={5} cols={4} />
                ) : complaints && complaints.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {complaints.map((complaint) => (
                      <ComplaintCard
                        key={complaint.id}
                        id={complaint.id}
                        passengerName={`${complaint.passengerFirstName} ${complaint.passengerLastName}`}
                        routeNumber={complaint.routeNumber}
                        fleetNumber={complaint.fleetNumber}
                        complaintText={complaint.complaintText}
                        createdAt={complaint.createdAt}
                        status={complaint.status as any}
                        onReview={() =>
                          updateComplaintStatusMutation.mutate({ id: complaint.id, status: 'reviewed' })
                        }
                        onResolve={() =>
                          updateComplaintStatusMutation.mutate({ id: complaint.id, status: 'resolved' })
                        }
                        onReject={() =>
                          updateComplaintStatusMutation.mutate({ id: complaint.id, status: 'rejected' })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={MessageSquare}
                    title="Немає скарг"
                    description="Скарги пасажирів з'являться тут"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Helper functions
function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

function emptyStop(): StopDraft {
  return { stopId: '', name: '', lon: '', lat: '', distanceToNextKm: '' }
}

function emptyPoint(): PointDraft {
  return { lon: '', lat: '' }
}

function toCoordinates(points: PointDraft[]): [number, number][] {
  return points
    .filter((p) => p.lon && p.lat)
    .map((p) => [Number(p.lon), Number(p.lat)] as [number, number])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
}

function toStopCoordinates(stops: StopDraft[]): [number, number][] {
  return stops
    .filter((s) => s.lon && s.lat)
    .map((s) => [Number(s.lon), Number(s.lat)] as [number, number])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
}

function toRoutePointCoords(points: any[]): [number, number][] {
  return points
    .map((p) => [Number(p.lon), Number(p.lat)] as [number, number])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
}

function toRouteStopCoords(stops: any[]): [number, number][] {
  return stops
    .map((s) => [Number(s.lon), Number(s.lat)] as [number, number])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
}

function getBounds(coords: [number, number][]): LngLatBounds | null {
  if (coords.length === 0) return null
  const lons = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ] as LngLatBounds
}
