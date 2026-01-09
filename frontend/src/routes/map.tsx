import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapRoute,
  MapClusterLayer,
} from '@/components/ui/map';
import {
  planRoute,
  getStopGeometries,
  getAllRouteGeometries,
  getTransportTypes,
  getRoutes,
  type RouteOption,
  type StopGeometry,
} from '@/lib/guest-api';
import { RouteSearch } from '@/components/route-planner/route-search';
import { RouteCard } from '@/components/route-planner/route-card';
import { RouteMapView } from '@/components/route-planner/route-map-view';
import {
  Loader2,
  MapPin,
  Navigation,
  Bus,
  Train,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/map')({
  component: MapPage,
});

const UKRAINE_CENTER: [number, number] = [31.1656, 48.3794];

type MapMode = 'browse' | 'plan';

function MapPage() {
  const [mode, setMode] = useState<MapMode>('browse');
  const [selectedTransportType, setSelectedTransportType] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<StopGeometry | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState(true);

  // Route planning state
  const [searchParams, setSearchParams] = useState<{
    lonA: number;
    latA: number;
    lonB: number;
    latB: number;
  } | null>(null);
  const [selectedPlanRoute, setSelectedPlanRoute] = useState<RouteOption | null>(null);

  // Fetch data
  const { data: transportTypes } = useQuery({
    queryKey: ['transport-types'],
    queryFn: getTransportTypes,
  });

  const { data: routes } = useQuery({
    queryKey: ['routes', selectedTransportType],
    queryFn: () => getRoutes(selectedTransportType ?? undefined),
  });

  const { data: stopGeometries, isLoading: stopsLoading } = useQuery({
    queryKey: ['stop-geometries'],
    queryFn: getStopGeometries,
  });

  const { data: routeGeometries, isLoading: routesLoading } = useQuery({
    queryKey: ['route-geometries', selectedTransportType],
    queryFn: () => getAllRouteGeometries(selectedTransportType ?? undefined),
  });

  const { data: planRoutes, isLoading: planLoading, error: planError } = useQuery({
    queryKey: ['route-planner', searchParams],
    queryFn: () => planRoute(searchParams!),
    enabled: !!searchParams && mode === 'plan',
  });

  // Convert stops to GeoJSON for clustering
  const stopsGeoJSON = useMemo(() => {
    if (!stopGeometries) return null;
    return {
      type: 'FeatureCollection' as const,
      features: stopGeometries.map((stop) => ({
        type: 'Feature' as const,
        properties: {
          id: stop.id,
          name: stop.name,
        },
        geometry: stop.geometry,
      })),
    };
  }, [stopGeometries]);

  // Get selected route geometry
  const selectedRouteGeometry = useMemo(() => {
    if (!selectedRouteId || !routeGeometries) return null;
    return routeGeometries.find((r) => r.routeId === selectedRouteId);
  }, [selectedRouteId, routeGeometries]);


  const handleStopClick = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point, { id: number; name: string }>) => {
      const stop = stopGeometries?.find((s) => s.id === feature.properties.id);
      if (stop) {
        setSelectedStop(stop);
      }
    },
    [stopGeometries]
  );

  const handleRouteSelect = useCallback((routeId: number) => {
    setSelectedRouteId((prev) => (prev === routeId ? null : routeId));
    setSelectedStop(null);
  }, []);

  const getTransportIcon = (typeId: number) => {
    switch (typeId) {
      case 1:
        return <Bus className="h-4 w-4" />;
      case 2:
        return <Train className="h-4 w-4" />;
      default:
        return <Bus className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-[400px] border-r flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
        {/* Mode Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'browse'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
            onClick={() => {
              setMode('browse');
              setSelectedPlanRoute(null);
              setSearchParams(null);
            }}
          >
            <MapPin className="h-4 w-4 inline-block mr-2" />
            Перегляд
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'plan'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
            onClick={() => {
              setMode('plan');
              setSelectedRouteId(null);
              setSelectedStop(null);
            }}
          >
            <Navigation className="h-4 w-4 inline-block mr-2" />
            Планування
          </button>
        </div>

        {/* Browse Mode Content */}
        {mode === 'browse' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Transport Type Filter */}
            <div className="p-4 border-b">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Тип транспорту
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedTransportType === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTransportType(null)}
                >
                  Всі
                </Button>
                {transportTypes?.map((type) => (
                  <Button
                    key={type.id}
                    variant={selectedTransportType === type.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTransportType(type.id)}
                  >
                    {getTransportIcon(type.id)}
                    <span className="ml-1">{type.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Routes List */}
            <div className="flex-1 overflow-auto">
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setExpandedRoutes(!expandedRoutes)}
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  Маршрути ({routes?.length ?? 0})
                </span>
                {expandedRoutes ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {expandedRoutes && (
                <div className="divide-y dark:divide-gray-700">
                  {routesLoading && (
                    <div className="p-4 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                    </div>
                  )}

                  {routes?.map((route) => {
                    const routeId = route.routeId ?? route.id;
                    const routeNumber = route.number ?? route.routeNumber;
                    return (
                      <button
                        key={`${routeId}-${route.direction}`}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          selectedRouteId === routeId
                            ? 'bg-blue-50 dark:bg-blue-950'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => handleRouteSelect(routeId!)}
                      >
                        <span
                          className={`px-2 py-1 text-sm font-medium rounded border ${
                            selectedRouteId === routeId
                              ? 'border-blue-500 bg-blue-100 dark:bg-blue-900'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {routeNumber}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white truncate">
                            {route.transportType}
                          </p>
                          {route.direction && (
                            <p className="text-xs text-gray-500 truncate">
                              {route.direction === 'forward' ? 'Прямий' : 'Зворотній'}
                            </p>
                          )}
                        </div>
                        {route.intervalMin && (
                          <span className="text-xs text-gray-500">
                            ~{route.intervalMin} хв
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Stop Info */}
            {selectedStop && (
              <div className="border-t p-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {selectedStop.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedStop.geometry.coordinates[1].toFixed(5)},{' '}
                      {selectedStop.geometry.coordinates[0].toFixed(5)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedStop(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plan Mode Content */}
        {mode === 'plan' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Планування маршруту
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Оберіть точки відправлення та призначення
              </p>
            </div>

            <RouteSearch onSearch={setSearchParams} />

            <div className="flex-1 overflow-auto p-4">
              {planLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600 dark:text-gray-300">
                    Шукаємо маршрути...
                  </span>
                </div>
              )}

              {planError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Помилка при пошуку маршрутів. Спробуйте ще раз.
                  </p>
                </div>
              )}

              {planRoutes && planRoutes.length === 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Маршрутів не знайдено. Спробуйте інші точки або збільште радіус пошуку.
                  </p>
                </div>
              )}

              {planRoutes && planRoutes.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Знайдено {planRoutes.length}{' '}
                    {planRoutes.length === 1 ? 'маршрут' : 'маршрутів'}
                  </h3>

                  {planRoutes.map((route, idx) => (
                    <RouteCard
                      key={idx}
                      route={route}
                      isSelected={selectedPlanRoute === route}
                      onClick={() => setSelectedPlanRoute(route)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map center={UKRAINE_CENTER} zoom={12}>
          <MapControls showLocate showFullscreen />

          {/* Browse Mode: Show stops as clusters */}
          {mode === 'browse' && stopsGeoJSON && !selectedRouteId && (
            <MapClusterLayer
              data={stopsGeoJSON}
              clusterMaxZoom={14}
              clusterRadius={50}
              pointColor="#3b82f6"
              onPointClick={handleStopClick}
            />
          )}

          {/* Browse Mode: Show selected route */}
          {mode === 'browse' && selectedRouteGeometry && (
            <>
              <MapRoute
                coordinates={
                  selectedRouteGeometry.geometry.coordinates as [number, number][]
                }
                color="#3B82F6"
                width={5}
              />
            </>
          )}

          {/* Browse Mode: Selected stop marker */}
          {mode === 'browse' && selectedStop && (
            <MapMarker
              longitude={selectedStop.geometry.coordinates[0]}
              latitude={selectedStop.geometry.coordinates[1]}
            >
              <MarkerContent>
                <div className="h-6 w-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-white" />
                </div>
              </MarkerContent>
              <MarkerPopup closeButton>
                <div className="p-2 min-w-[150px]">
                  <h4 className="font-medium text-sm">{selectedStop.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Зупинка #{selectedStop.id}
                  </p>
                </div>
              </MarkerPopup>
            </MapMarker>
          )}

          {/* Plan Mode: Show selected planned route */}
          {mode === 'plan' && selectedPlanRoute && (
            <RouteMapView route={selectedPlanRoute} />
          )}
        </Map>

        {/* Hint overlay */}
        {mode === 'browse' && !selectedRouteId && !selectedStop && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Оберіть маршрут зі списку або клікніть на зупинку
            </p>
          </div>
        )}

        {mode === 'plan' && !selectedPlanRoute && searchParams && planRoutes && planRoutes.length > 0 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Оберіть маршрут зі списку ліворуч
            </p>
          </div>
        )}

        {/* Loading overlay */}
        {(stopsLoading || routesLoading) && mode === 'browse' && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Завантаження даних...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
