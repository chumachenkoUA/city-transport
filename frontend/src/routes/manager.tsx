import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormSection } from '@/components/domain/forms'
import { VehicleCard } from '@/components/domain/transport'
import { EmptyState, TableSkeleton } from '@/components/domain/data-display'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Bus, Loader2, UserPlus } from 'lucide-react'
import {
  hireDriver,
  addVehicle,
  getManagerDrivers,
  getManagerVehicles,
  getManagerRoutes,
  getManagerTransportTypes,
  getManagerModels,
} from '@/lib/manager-api'
import { toast } from 'sonner'

export const Route = createFileRoute('/manager')({
  component: ManagerPage,
})

function ManagerPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('drivers')

  // Driver form state
  const [driverForm, setDriverForm] = useState({
    login: '',
    password: '',
    email: '',
    phone: '',
    fullName: '',
    driverLicenseNumber: '',
    licenseCategories: '',
    passportSeries: '',
    passportNumber: '',
  })

  // Vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    fleetNumber: '',
    transportTypeId: '',
    modelId: '',
    routeId: '',
  })

  // Queries
  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ['manager-drivers'],
    queryFn: getManagerDrivers,
  })

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['manager-vehicles'],
    queryFn: getManagerVehicles,
  })

  const { data: routes } = useQuery({
    queryKey: ['manager-routes'],
    queryFn: getManagerRoutes,
  })

  const { data: transportTypes } = useQuery({
    queryKey: ['manager-transport-types'],
    queryFn: getManagerTransportTypes,
  })

  const { data: models } = useQuery({
    queryKey: ['manager-models'],
    queryFn: getManagerModels,
  })

  // Filter models by transport type
  const filteredModels = useMemo(() => {
    if (!models || !vehicleForm.transportTypeId) return []
    return models.filter((m) => m.transportTypeId === Number(vehicleForm.transportTypeId))
  }, [models, vehicleForm.transportTypeId])

  // Hire driver mutation
  const hireDriverMutation = useMutation({
    mutationFn: hireDriver,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['manager-drivers'] })
      setDriverForm({
        login: '',
        password: '',
        email: '',
        phone: '',
        fullName: '',
        driverLicenseNumber: '',
        licenseCategories: '',
        passportSeries: '',
        passportNumber: '',
      })
      toast.success('Водія найнято успішно!', {
        description: `ID: ${data.id}`,
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка найму водія', {
        description: error.message,
      })
    },
  })

  // Add vehicle mutation
  const addVehicleMutation = useMutation({
    mutationFn: addVehicle,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['manager-vehicles'] })
      setVehicleForm({
        fleetNumber: '',
        transportTypeId: '',
        modelId: '',
        routeId: '',
      })
      toast.success('Транспорт додано успішно!', {
        description: `ID: ${data.id}`,
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка додавання транспорту', {
        description: error.message,
      })
    },
  })

  const handleHireDriver = () => {
    if (!driverForm.login || !driverForm.password || !driverForm.fullName) {
      toast.error('Заповніть обов\'язкові поля')
      return
    }

    const [firstName, ...lastNameParts] = driverForm.fullName.split(' ')
    const lastName = lastNameParts.join(' ')

    hireDriverMutation.mutate({
      login: driverForm.login,
      password: driverForm.password,
      email: driverForm.email || undefined,
      phone: driverForm.phone || undefined,
      firstName,
      lastName: lastName || firstName,
      driverLicenseNumber: driverForm.driverLicenseNumber || undefined,
      licenseCategories: driverForm.licenseCategories || undefined,
      passportSeries: driverForm.passportSeries || undefined,
      passportNumber: driverForm.passportNumber || undefined,
    })
  }

  const handleAddVehicle = () => {
    if (!vehicleForm.fleetNumber || !vehicleForm.transportTypeId || !vehicleForm.modelId) {
      toast.error('Заповніть обов\'язкові поля')
      return
    }

    addVehicleMutation.mutate({
      fleetNumber: vehicleForm.fleetNumber,
      transportTypeId: Number(vehicleForm.transportTypeId),
      modelId: Number(vehicleForm.modelId),
      routeId: vehicleForm.routeId ? Number(vehicleForm.routeId) : undefined,
    })
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
              <BreadcrumbPage>Менеджер</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div>
          <h1 className="text-display-sm">Кабінет менеджера</h1>
          <p className="text-body-md text-muted-foreground mt-2">
            Найм водіїв та управління транспортним парком
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drivers">Водії</TabsTrigger>
            <TabsTrigger value="vehicles">Транспорт</TabsTrigger>
          </TabsList>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection
                title="Найм водія"
                description="Додайте нового водія до системи"
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="login">Логін *</Label>
                      <Input
                        id="login"
                        value={driverForm.login}
                        onChange={(e) => setDriverForm({ ...driverForm, login: e.target.value })}
                        placeholder="driver_ivanov"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Пароль *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={driverForm.password}
                        onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">ПІБ *</Label>
                    <Input
                      id="fullName"
                      value={driverForm.fullName}
                      onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                      placeholder="Іванов Іван Іванович"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={driverForm.email}
                        onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Телефон</Label>
                      <Input
                        id="phone"
                        value={driverForm.phone}
                        onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                        placeholder="+380..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="license">Номер водійського посвідчення</Label>
                    <Input
                      id="license"
                      value={driverForm.driverLicenseNumber}
                      onChange={(e) => setDriverForm({ ...driverForm, driverLicenseNumber: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categories">Категорії</Label>
                    <Input
                      id="categories"
                      value={driverForm.licenseCategories}
                      onChange={(e) => setDriverForm({ ...driverForm, licenseCategories: e.target.value })}
                      placeholder="D, D1"
                    />
                  </div>

                  <Button
                    onClick={handleHireDriver}
                    disabled={hireDriverMutation.isPending}
                    className="w-full"
                  >
                    {hireDriverMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <UserPlus className="mr-2 h-4 w-4" />
                    Найняти водія
                  </Button>
                </div>
              </FormSection>

              <div className="space-y-4">
                <h3 className="text-heading-md">Список водіїв</h3>
                {driversLoading ? (
                  <TableSkeleton rows={5} cols={3} />
                ) : drivers && drivers.length > 0 ? (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {drivers.map((driver) => (
                      <Card key={driver.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{driver.firstName} {driver.lastName}</p>
                              <p className="text-sm text-muted-foreground">{driver.phone || driver.email}</p>
                            </div>
                            <Badge variant="outline">{driver.login}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Немає водіїв"
                    description="Почніть з найму першого водія"
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* Vehicles Tab */}
          <TabsContent value="vehicles" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection
                title="Додавання транспорту"
                description="Зареєструйте новий транспортний засіб"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fleetNumber">Бортовий номер *</Label>
                    <Input
                      id="fleetNumber"
                      value={vehicleForm.fleetNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, fleetNumber: e.target.value })}
                      placeholder="BUS-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transportType">Тип транспорту *</Label>
                    <Select
                      value={vehicleForm.transportTypeId}
                      onValueChange={(value) => setVehicleForm({ ...vehicleForm, transportTypeId: value, modelId: '' })}
                    >
                      <SelectTrigger id="transportType">
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
                    <Label htmlFor="model">Модель *</Label>
                    <Select
                      value={vehicleForm.modelId}
                      onValueChange={(value) => setVehicleForm({ ...vehicleForm, modelId: value })}
                      disabled={!vehicleForm.transportTypeId}
                    >
                      <SelectTrigger id="model">
                        <SelectValue placeholder={vehicleForm.transportTypeId ? "Оберіть модель" : "Спочатку оберіть тип"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredModels?.map((model) => (
                          <SelectItem key={model.id} value={String(model.id)}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="route">Маршрут (опціонально)</Label>
                    <Select
                      value={vehicleForm.routeId}
                      onValueChange={(value) => setVehicleForm({ ...vehicleForm, routeId: value })}
                    >
                      <SelectTrigger id="route">
                        <SelectValue placeholder="Оберіть маршрут" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes?.map((route) => (
                          <SelectItem key={route.id} value={String(route.id)}>
                            {route.number} • {route.transportTypeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleAddVehicle}
                    disabled={addVehicleMutation.isPending}
                    className="w-full"
                  >
                    {addVehicleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Bus className="mr-2 h-4 w-4" />
                    Додати транспорт
                  </Button>
                </div>
              </FormSection>

              <div className="space-y-4">
                <h3 className="text-heading-md">Транспортний парк</h3>
                {vehiclesLoading ? (
                  <TableSkeleton rows={5} cols={3} />
                ) : vehicles && vehicles.length > 0 ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {vehicles.map((vehicle) => (
                      <VehicleCard
                        key={vehicle.id}
                        fleetNumber={vehicle.fleetNumber}
                        model={vehicle.modelName || 'Невідома модель'}
                        transportType={vehicle.transportTypeName || ''}
                        routeNumber={vehicle.routeNumber}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Bus}
                    title="Немає транспорту"
                    description="Додайте перший транспортний засіб до парку"
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
