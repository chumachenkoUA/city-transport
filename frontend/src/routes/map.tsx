import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Map as MapContainer,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapRoute,
  MapClusterLayer,
  useMap,
} from '@/components/ui/map';
import {
  planRoute,
  getStopGeometries,
  getAllRouteGeometries,
  getTransportTypes,
  getRoutes,
  getRoutesByStop,
  getRouteSchedule,
  getRouteStops,
  getStopsNear,
  type RouteOption,
  type StopGeometry,
  type Route as GuestRoute,
} from '@/lib/guest-api';
import { groupRoutesByNumber } from '@/lib/route-utils';
import { getRouteColor, getTransportTypeColor } from '@/lib/map-colors';
import { RouteSearch } from '@/components/route-planner/route-search';
import { RouteCard } from '@/components/route-planner/route-card';
import { RouteMapView } from '@/components/route-planner/route-map-view';
import { ScheduleModal } from '@/components/schedule-modal';
import {
  Loader2,
  MapPin,
  Navigation,
  Bus,
  Train,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Locate,
  X,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/map')({
  component: MapPage,
});

const LVIV_CENTER: [number, number] = [24.0316, 49.8429];

type MapMode = 'browse' | 'plan';

// Helper component to handle map clicks for point selection
function MapClickHandler({
  isSelectingPoint,
  onPointSelected,
}: {
  isSelectingPoint: 'A' | 'B' | null;
  onPointSelected: (point: 'A' | 'B', coords: { lon: number; lat: number }) => void;
}) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || !isSelectingPoint) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      onPointSelected(isSelectingPoint, { lon: lng, lat });
    };

    map.on('click', handleClick);

    // Change cursor to crosshair when selecting
    map.getCanvas().style.cursor = 'crosshair';

    return () => {
      map.off('click', handleClick);
      map.getCanvas().style.cursor = '';
    };
  }, [map, isSelectingPoint, onPointSelected]);

  return null;
}

// Helper component to track zoom level changes
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;

    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };

    // Initial zoom
    onZoomChange(map.getZoom());

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

const CLUSTER_ZOOM_THRESHOLD = 13;

function MapPage() {
  const [mode, setMode] = useState<MapMode>('browse');
  const [selectedTransportType, setSelectedTransportType] = useState<number | null>(null);
  const [selectedRouteNumbers, setSelectedRouteNumbers] = useState<Set<string>>(
    () => new Set()
  );
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [clickedStopId, setClickedStopId] = useState<number | null>(null);
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
  const [planPointA, setPlanPointA] = useState<{ lon: number; lat: number } | null>(null);
  const [planPointB, setPlanPointB] = useState<{ lon: number; lat: number } | null>(null);
  const [isSelectingPoint, setIsSelectingPoint] = useState<'A' | 'B' | null>(null);
  const [userLocation, setUserLocation] = useState<{ lon: number; lat: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(12);

  // Nearby stops state
  const [showNearbyStops, setShowNearbyStops] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalRoute, setScheduleModalRoute] = useState<{
    routeId: number;
    routeNumber: string;
    transportTypeName: string;
    transportTypeId: number;
    direction?: string;
    stopId?: number;
    stopName?: string;
  } | null>(null);

  // Sidebar selected route for schedule viewing
  const [sidebarSelectedRoute, setSidebarSelectedRoute] = useState<{
    routeId: number;
    routeNumber: string;
    transportTypeId: number;
    transportTypeName: string;
  } | null>(null);

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

  const groupedRoutes = useMemo(() => {
    if (!routes) return [];
    return groupRoutesByNumber(routes);
  }, [routes]);

  // Filter routes by search query
  const filteredGroupedRoutes = useMemo(() => {
    if (!routeSearchQuery.trim()) return groupedRoutes;
    const query = routeSearchQuery.toLowerCase().trim();
    return groupedRoutes.filter((group) =>
      group.number.toLowerCase().includes(query) ||
      group.transportTypeName.toLowerCase().includes(query)
    );
  }, [groupedRoutes, routeSearchQuery]);

  const routeIdToGroupKey = useMemo(() => {
    const map = new Map<number, string>();
    for (const group of groupedRoutes) {
      const groupKey = `${group.number}-${group.transportTypeId}`;
      for (const routeId of group.routeIds) {
        map.set(routeId, groupKey);
      }
    }
    return map;
  }, [groupedRoutes]);

  const selectedRouteGeometries = useMemo(() => {
    if (!routeGeometries) return [];
    if (showAllRoutes) return routeGeometries;
    if (selectedRouteNumbers.size === 0) return [];
    return routeGeometries.filter((geom) => {
      const groupKey = routeIdToGroupKey.get(geom.routeId);
      return groupKey ? selectedRouteNumbers.has(groupKey) : false;
    });
  }, [routeGeometries, showAllRoutes, selectedRouteNumbers, routeIdToGroupKey]);

  // Calculate selected route IDs for fetching their stops
  const selectedRouteIds = useMemo(() => {
    if (showAllRoutes || selectedRouteNumbers.size === 0) return [];
    const ids: number[] = [];
    for (const group of groupedRoutes) {
      const groupKey = `${group.number}-${group.transportTypeId}`;
      if (selectedRouteNumbers.has(groupKey)) {
        ids.push(...group.routeIds);
      }
    }
    return ids;
  }, [groupedRoutes, selectedRouteNumbers, showAllRoutes]);

  // Fetch stops for all selected routes
  const routeStopsQueries = useQueries({
    queries: selectedRouteIds.map((routeId) => ({
      queryKey: ['route-stops', routeId],
      queryFn: () => getRouteStops({ routeId }),
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })),
  });

  // Combine all stops into a Set of IDs
  const selectedRouteStopIds = useMemo(() => {
    const stopIds = new Set<number>();
    for (const query of routeStopsQueries) {
      if (query.data) {
        for (const routeStop of query.data) {
          // Use stopId (the actual stop ID), not id (route_stops junction table ID)
          stopIds.add(routeStop.stopId);
        }
      }
    }
    return stopIds;
  }, [routeStopsQueries]);

  // Convert stops to GeoJSON for clustering
  const stopsGeoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, { id: number; name: string }>>(() => {
    if (!stopGeometries) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: stopGeometries.map((stop) => ({
        type: 'Feature' as const,
        properties: { id: stop.id, name: stop.name },
        geometry: stop.geometry,
      })),
    };
  }, [stopGeometries]);

  const showClusters = currentZoom < CLUSTER_ZOOM_THRESHOLD;

  const { data: routesAtStop, isLoading: routesAtStopLoading } = useQuery({
    queryKey: ['routes-at-stop', clickedStopId],
    queryFn: () => getRoutesByStop(clickedStopId!),
    enabled: !!clickedStopId,
  });

  // Schedule for sidebar selected route
  const { data: sidebarSchedule, isLoading: sidebarScheduleLoading } = useQuery({
    queryKey: ['sidebar-schedule', sidebarSelectedRoute?.routeId],
    queryFn: () => getRouteSchedule({ routeId: sidebarSelectedRoute!.routeId }),
    enabled: !!sidebarSelectedRoute,
  });

  // Nearby stops query
  const { data: nearbyStops, isLoading: nearbyStopsLoading } = useQuery({
    queryKey: ['nearby-stops', userLocation?.lon, userLocation?.lat],
    queryFn: () => getStopsNear({
      longitude: userLocation!.lon,
      latitude: userLocation!.lat,
      radiusMeters: 500,
    }),
    enabled: !!userLocation && showNearbyStops,
  });

  const handleStopClick = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point, { id: number; name: string }>) => {
      const stop = stopGeometries?.find((s) => s.id === feature.properties.id);
      if (stop) {
        setSelectedStop(stop);
        setClickedStopId(stop.id);
      }
    },
    [stopGeometries]
  );

  const handleRouteToggle = useCallback(
    (routeNumber: string, transportTypeId: number) => {
      if (showAllRoutes) return;

      const groupKey = `${routeNumber}-${transportTypeId}`;
      setSelectedRouteNumbers((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        return next;
      });
    },
    [showAllRoutes]
  );

  const handleShowAllToggle = useCallback(() => {
    setShowAllRoutes((prev) => !prev);
    if (!showAllRoutes) {
      setSelectedRouteNumbers(new Set());
    }
  }, [showAllRoutes]);

  const handleSetPointA = useCallback(() => {
    setIsSelectingPoint('A');
  }, []);

  const handleSetPointB = useCallback(() => {
    setIsSelectingPoint('B');
  }, []);

  const handleClearPointA = useCallback(() => {
    setPlanPointA(null);
    setSearchParams(null);
    setSelectedPlanRoute(null);
  }, []);

  const handleClearPointB = useCallback(() => {
    setPlanPointB(null);
    setSearchParams(null);
    setSelectedPlanRoute(null);
  }, []);

  const handlePointSelected = useCallback((point: 'A' | 'B', coords: { lon: number; lat: number }) => {
    if (point === 'A') {
      setPlanPointA(coords);
    } else {
      setPlanPointB(coords);
    }
    setIsSelectingPoint(null);
  }, []);

  const handleLocate = useCallback((coords: { longitude: number; latitude: number }) => {
    setUserLocation({ lon: coords.longitude, lat: coords.latitude });
  }, []);

  // Get user's GPS location and show nearby stops
  const handleFindNearbyStops = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Геолокація не підтримується вашим браузером');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setUserLocation({ lon: longitude, lat: latitude });
        setShowNearbyStops(true);
        setGpsLoading(false);
      },
      (error) => {
        setGpsLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Доступ до геолокації заборонено. Дозвольте доступ у налаштуваннях браузера.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Інформація про місцезнаходження недоступна.');
            break;
          case error.TIMEOUT:
            setGpsError('Час очікування геолокації вичерпано.');
            break;
          default:
            setGpsError('Невідома помилка геолокації.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  const handleCloseNearbyStops = useCallback(() => {
    setShowNearbyStops(false);
    setGpsError(null);
  }, []);

  const handleOpenScheduleModal = useCallback(
    (route: GuestRoute, stopId?: number, stopName?: string) => {
      const routeId = route.routeId ?? route.id;
      const routeNumber = route.number ?? route.routeNumber ?? '';
      const transportTypeName = route.transportTypeName ?? route.transportType ?? '';
      if (!routeId) return;

      setScheduleModalRoute({
        routeId,
        routeNumber,
        transportTypeName,
        transportTypeId: route.transportTypeId,
        direction: route.direction,
        stopId,
        stopName,
      });
      setScheduleModalOpen(true);
    },
    []
  );

  const handleSidebarRouteClick = useCallback(
    (group: { number: string; transportTypeId: number; transportTypeName: string; routeIds: number[] }) => {
      // Toggle selection
      if (sidebarSelectedRoute?.routeNumber === group.number &&
          sidebarSelectedRoute?.transportTypeId === group.transportTypeId) {
        setSidebarSelectedRoute(null);
      } else {
        setSidebarSelectedRoute({
          routeId: group.routeIds[0], // Use the first route ID
          routeNumber: group.number,
          transportTypeId: group.transportTypeId,
          transportTypeName: group.transportTypeName,
        });
      }
    },
    [sidebarSelectedRoute]
  );

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
              setSelectedRouteNumbers(new Set());
              setShowAllRoutes(false);
              setSelectedStop(null);
              setClickedStopId(null);
            }}
          >
            <Navigation className="h-4 w-4 inline-block mr-2" />
            Планування
          </button>
        </div>

        {/* Browse Mode Content */}
        {mode === 'browse' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Nearby Stops Button */}
            <div className="p-4 border-b">
              <Button
                variant={showNearbyStops ? 'default' : 'outline'}
                className="w-full"
                onClick={handleFindNearbyStops}
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Locate className="h-4 w-4 mr-2" />
                )}
                {gpsLoading ? 'Визначаємо локацію...' : 'Найближчі зупинки'}
              </Button>

              {gpsError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                  {gpsError}
                </div>
              )}
            </div>

            {/* Nearby Stops Panel */}
            {showNearbyStops && (
              <div className="border-b bg-blue-50 dark:bg-blue-950/30">
                <div className="p-3 flex items-center justify-between border-b border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Locate className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Найближчі зупинки</span>
                  </div>
                  <button
                    onClick={handleCloseNearbyStops}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                  >
                    <X className="h-4 w-4 text-blue-600" />
                  </button>
                </div>

                {userLocation && (
                  <div className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800">
                    📍 Ваші координати: {userLocation.lat.toFixed(5)}, {userLocation.lon.toFixed(5)}
                  </div>
                )}

                <div className="max-h-[250px] overflow-auto">
                  {nearbyStopsLoading && (
                    <div className="p-4 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      <span className="ml-2 text-sm text-blue-600">Завантаження...</span>
                    </div>
                  )}

                  {!nearbyStopsLoading && (!nearbyStops || nearbyStops.length === 0) && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Зупинок поблизу не знайдено (радіус 500м)
                    </div>
                  )}

                  {!nearbyStopsLoading && nearbyStops && nearbyStops.length > 0 && (
                    <div className="divide-y divide-blue-200 dark:divide-blue-800">
                      {nearbyStops.map((stop) => (
                        <button
                          key={stop.id}
                          className="w-full p-3 text-left hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          onClick={() => {
                            const stopGeom = stopGeometries?.find(s => s.id === stop.id);
                            if (stopGeom) {
                              setSelectedStop(stopGeom);
                              setClickedStopId(stop.id);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {stop.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                ID: {stop.id} • {stop.lat.toFixed(5)}, {stop.lon.toFixed(5)}
                              </div>
                            </div>
                            <div className="flex-shrink-0 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded text-sm font-medium">
                              {Math.round(stop.distanceM ?? 0)} м
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {/* Show All Routes Toggle */}
            <div className="px-4 py-3 border-b">
              <Button
                variant={showAllRoutes ? 'default' : 'outline'}
                className="w-full"
                onClick={handleShowAllToggle}
              >
                {showAllRoutes ? 'Приховати всі маршрути' : 'Показати всі маршрути'}
              </Button>
            </div>

            {/* Routes List */}
            <div className="flex-1 overflow-auto flex flex-col">
              {/* Search input */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Пошук маршруту..."
                    value={routeSearchQuery}
                    onChange={(e) => setRouteSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {routeSearchQuery && (
                    <button
                      onClick={() => setRouteSearchQuery('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setExpandedRoutes(!expandedRoutes)}
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  Маршрути ({filteredGroupedRoutes.length}{routeSearchQuery ? ` з ${groupedRoutes.length}` : ''})
                </span>
                {expandedRoutes ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {expandedRoutes && (
                <div className="divide-y dark:divide-gray-700 flex-1 overflow-auto">
                  {routesLoading && (
                    <div className="p-4 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                    </div>
                  )}

                  {filteredGroupedRoutes.length === 0 && !routesLoading && (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Маршрути не знайдено</p>
                      {routeSearchQuery && (
                        <button
                          onClick={() => setRouteSearchQuery('')}
                          className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
                        >
                          Очистити пошук
                        </button>
                      )}
                    </div>
                  )}

                  {filteredGroupedRoutes.map((group) => {
                    const groupKey = `${group.number}-${group.transportTypeId}`;
                    const isSelected = selectedRouteNumbers.has(groupKey);
                    const isDisabled = showAllRoutes;
                    const color = getTransportTypeColor(group.transportTypeId);
                    const isScheduleSelected = sidebarSelectedRoute?.routeNumber === group.number &&
                      sidebarSelectedRoute?.transportTypeId === group.transportTypeId;

                    return (
                      <div key={groupKey}>
                        <div
                          className={`px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                            isSelected && !isDisabled
                              ? 'bg-blue-50 dark:bg-blue-950'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          } ${isDisabled ? 'opacity-50' : ''} ${
                            isScheduleSelected ? 'ring-2 ring-inset ring-blue-400' : ''
                          }`}
                          onClick={() => handleSidebarRouteClick(group)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected || showAllRoutes}
                            disabled={isDisabled}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() =>
                              handleRouteToggle(group.number, group.transportTypeId)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                          />

                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />

                          <span
                            className="px-2 py-1 text-sm font-medium rounded border flex-shrink-0"
                            style={{
                              borderColor: color,
                              backgroundColor: isSelected ? `${color}20` : 'transparent',
                            }}
                          >
                            {group.number}
                          </span>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white truncate">
                              {group.transportTypeName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {group.routes.length} напрямки
                            </p>
                          </div>

                          {group.intervalMin && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                              ≈{group.intervalMin} хв
                            </span>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSidebarRouteClick(group);
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              isScheduleSelected
                                ? 'bg-blue-100 dark:bg-blue-900/50'
                                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                            title="Розклад"
                          >
                            <Clock className={`h-4 w-4 ${isScheduleSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                          </button>
                        </div>

                        {/* Schedule panel for selected route */}
                        {isScheduleSelected && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-b border-gray-200 dark:border-gray-700">
                            {sidebarScheduleLoading && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                                <span className="ml-2 text-sm text-gray-500">Завантаження...</span>
                              </div>
                            )}

                            {!sidebarScheduleLoading && !sidebarSchedule && (
                              <div className="text-center py-4 text-sm text-gray-500">
                                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                Розклад не знайдено
                              </div>
                            )}

                            {!sidebarScheduleLoading && sidebarSchedule && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                  <Clock className="h-4 w-4" />
                                  Розклад руху
                                </div>

                                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-green-600 font-medium">
                                        {sidebarSchedule.schedule.workStartTime?.slice(0, 5) || '--:--'}
                                      </span>
                                      <span className="text-gray-400">—</span>
                                      <span className="text-red-600 font-medium">
                                        {sidebarSchedule.schedule.workEndTime?.slice(0, 5) || '--:--'}
                                      </span>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                                      ≈{sidebarSchedule.schedule.intervalMin} хв
                                    </span>
                                  </div>

                                  {/* Show first few departures */}
                                  {sidebarSchedule.departures?.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                      <div className="text-xs text-gray-500 mb-1">Відправлення:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {sidebarSchedule.departures.slice(0, 8).map((time, idx) => (
                                          <span key={idx} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">
                                            {time}
                                          </span>
                                        ))}
                                        {sidebarSchedule.departures.length > 8 && (
                                          <span className="text-xs text-gray-400">+{sidebarSchedule.departures.length - 8}</span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    {sidebarSchedule.route.direction === 'forward' ? 'Прямий напрямок' : 'Зворотній напрямок'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

            <RouteSearch
              onSearch={setSearchParams}
              pointA={planPointA}
              pointB={planPointB}
              onSetPointA={handleSetPointA}
              onSetPointB={handleSetPointB}
              onClearPointA={handleClearPointA}
              onClearPointB={handleClearPointB}
              isSelectingPoint={isSelectingPoint}
            />

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
        <MapContainer center={LVIV_CENTER} zoom={12}>
          <MapControls showLocate showFullscreen onLocate={handleLocate} />

          {/* Track zoom level for clustering */}
          <ZoomTracker onZoomChange={setCurrentZoom} />

          {/* User Location Marker */}
          {userLocation && (
            <MapMarker
              longitude={userLocation.lon}
              latitude={userLocation.lat}
            >
              <MarkerContent>
                <div className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-lg animate-pulse" />
              </MarkerContent>
              <MarkerPopup>
                <div className="p-2">
                  <p className="font-medium text-sm">Ви тут</p>
                </div>
              </MarkerPopup>
            </MapMarker>
          )}

          {/* Map click handler for point selection in plan mode */}
          {mode === 'plan' && (
            <MapClickHandler
              isSelectingPoint={isSelectingPoint}
              onPointSelected={handlePointSelected}
            />
          )}

          {/* Browse Mode: Clustered view when zoomed out */}
          {mode === 'browse' && showClusters && stopsGeoJson.features.length > 0 && (
            <MapClusterLayer
              data={stopsGeoJson}
              clusterMaxZoom={CLUSTER_ZOOM_THRESHOLD - 1}
              clusterRadius={50}
              clusterColors={['#3b82f6', '#22c55e', '#f59e0b']}
              clusterThresholds={[50, 200]}
              pointColor="#3b82f6"
              onPointClick={handleStopClick}
            />
          )}

          {/* Browse Mode: Individual markers when zoomed in */}
          {mode === 'browse' && !showClusters && stopGeometries && (
            <>
              {stopGeometries.map((stop) => {
                const stopRoutesLoading = clickedStopId === stop.id && routesAtStopLoading;
                const stopRoutes = clickedStopId === stop.id ? routesAtStop : null;

                // Determine if this stop should be grayed out
                const hasSelectedRoutes = selectedRouteNumbers.size > 0 && !showAllRoutes;
                const isOnSelectedRoute = selectedRouteStopIds.has(stop.id);
                const isGrayed = hasSelectedRoutes && !isOnSelectedRoute;

                return (
                  <MapMarker
                    key={stop.id}
                    longitude={stop.geometry.coordinates[0]}
                    latitude={stop.geometry.coordinates[1]}
                    onClick={() => {
                      const feature: GeoJSON.Feature<
                        GeoJSON.Point,
                        { id: number; name: string }
                      > = {
                        type: 'Feature',
                        properties: { id: stop.id, name: stop.name },
                        geometry: stop.geometry,
                      };
                      handleStopClick(feature);
                    }}
                  >
                    <MarkerContent>
                      <div
                        className={`rounded-full border-2 border-white shadow-md transition-all duration-200 cursor-pointer ${
                          selectedStop?.id === stop.id
                            ? 'h-5 w-5 bg-green-500 animate-pulse shadow-lg shadow-green-500/30'
                            : isGrayed
                              ? 'h-3 w-3 bg-gray-400 opacity-50 hover:opacity-70'
                              : 'h-4 w-4 bg-blue-500 hover:h-5 hover:w-5 hover:shadow-lg hover:shadow-blue-500/30'
                        }`}
                      />
                    </MarkerContent>

                    {selectedStop?.id === stop.id && (
                      <MarkerPopup closeButton>
                        <div className="min-w-[250px] max-w-[300px]">
                          <h3 className="font-medium text-base mb-1">{stop.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            {stop.geometry.coordinates[1].toFixed(5)}, {stop.geometry.coordinates[0].toFixed(5)}
                          </p>

                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Маршрути через цю зупинку:
                          </h4>

                          {stopRoutesLoading && (
                            <div className="flex items-center justify-center py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            </div>
                          )}

                          {stopRoutes && stopRoutes.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Маршрути не знайдено</p>
                          )}

                          {stopRoutes && stopRoutes.length > 0 && (
                            <div className="space-y-1.5 max-h-[200px] overflow-auto">
                              {stopRoutes.map((route) => {
                                const routeNumber = route.number ?? route.routeNumber;
                                const routeId = route.routeId ?? route.id;
                                const color = getTransportTypeColor(route.transportTypeId);

                                return (
                                  <div
                                    key={`${routeId}-${route.direction}`}
                                    className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    <div
                                      className="h-2 w-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className="font-medium text-sm">{routeNumber}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">
                                      {route.transportTypeName ?? route.transportType} •{' '}
                                      {route.direction === 'forward' ? 'Прямий' : 'Зворотній'}
                                    </span>
                                    {route.nextArrivalMin != null && route.nextArrivalMin >= 0 ? (
                                      <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded font-medium flex-shrink-0">
                                        {route.nextArrivalMin} хв
                                      </span>
                                    ) : route.intervalMin ? (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                        ≈{route.intervalMin} хв
                                      </span>
                                    ) : null}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenScheduleModal(route, stop.id, stop.name);
                                      }}
                                      className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                      title="Розклад"
                                    >
                                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </MarkerPopup>
                    )}
                  </MapMarker>
                );
              })}
            </>
          )}

          {/* Plan Mode: Show ALL stops as individual markers */}
          {mode === 'plan' && stopGeometries && (
            <>
              {stopGeometries.map((stop) => {
                const stopRoutesLoading = clickedStopId === stop.id && routesAtStopLoading;
                const stopRoutes = clickedStopId === stop.id ? routesAtStop : null;

                return (
                  <MapMarker
                    key={stop.id}
                    longitude={stop.geometry.coordinates[0]}
                    latitude={stop.geometry.coordinates[1]}
                    onClick={() => {
                      const feature: GeoJSON.Feature<
                        GeoJSON.Point,
                        { id: number; name: string }
                      > = {
                        type: 'Feature',
                        properties: { id: stop.id, name: stop.name },
                        geometry: stop.geometry,
                      };
                      handleStopClick(feature);
                    }}
                  >
                    <MarkerContent>
                      <div
                        className={`rounded-full border border-white shadow-sm transition-all duration-200 cursor-pointer ${
                          selectedStop?.id === stop.id
                            ? 'h-4 w-4 bg-blue-500 animate-pulse shadow-md shadow-blue-500/30'
                            : 'h-3 w-3 bg-gray-400 hover:h-4 hover:w-4 hover:bg-gray-500 hover:shadow-md'
                        }`}
                      />
                    </MarkerContent>

                    {selectedStop?.id === stop.id && (
                      <MarkerPopup closeButton>
                        <div className="min-w-[250px] max-w-[300px]">
                          <h3 className="font-medium text-base mb-1">{stop.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            {stop.geometry.coordinates[1].toFixed(5)}, {stop.geometry.coordinates[0].toFixed(5)}
                          </p>

                          {/* Кнопки для планування маршруту */}
                          <div className="flex gap-2 mb-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                handlePointSelected('A', {
                                  lon: stop.geometry.coordinates[0],
                                  lat: stop.geometry.coordinates[1],
                                });
                                setSelectedStop(null);
                              }}
                            >
                              <MapPin className="h-3 w-3 mr-1 text-green-500" />
                              Звідси
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                handlePointSelected('B', {
                                  lon: stop.geometry.coordinates[0],
                                  lat: stop.geometry.coordinates[1],
                                });
                                setSelectedStop(null);
                              }}
                            >
                              <Navigation className="h-3 w-3 mr-1 text-red-500" />
                              Сюди
                            </Button>
                          </div>

                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Маршрути через цю зупинку:
                          </h4>

                          {stopRoutesLoading && (
                            <div className="flex items-center justify-center py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            </div>
                          )}

                          {stopRoutes && stopRoutes.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Маршрути не знайдено</p>
                          )}

                          {stopRoutes && stopRoutes.length > 0 && (
                            <div className="space-y-1.5 max-h-[200px] overflow-auto">
                              {stopRoutes.map((route) => {
                                const routeNumber = route.number ?? route.routeNumber;
                                const routeId = route.routeId ?? route.id;
                                const color = getTransportTypeColor(route.transportTypeId);

                                return (
                                  <div
                                    key={`${routeId}-${route.direction}`}
                                    className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    <div
                                      className="h-2 w-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className="font-medium text-sm">{routeNumber}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">
                                      {route.transportTypeName ?? route.transportType} •{' '}
                                      {route.direction === 'forward' ? 'Прямий' : 'Зворотній'}
                                    </span>
                                    {route.nextArrivalMin != null && route.nextArrivalMin >= 0 ? (
                                      <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded font-medium flex-shrink-0">
                                        {route.nextArrivalMin} хв
                                      </span>
                                    ) : route.intervalMin ? (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                        ≈{route.intervalMin} хв
                                      </span>
                                    ) : null}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenScheduleModal(route, stop.id, stop.name);
                                      }}
                                      className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                      title="Розклад"
                                    >
                                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </MarkerPopup>
                    )}
                  </MapMarker>
                );
              })}
            </>
          )}

          {/* User Location Marker */}
          {userLocation && showNearbyStops && (
            <MapMarker
              longitude={userLocation.lon}
              latitude={userLocation.lat}
            >
              <MarkerContent>
                <div className="relative">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 border-2 border-white shadow-lg">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping" />
                </div>
              </MarkerContent>
              <MarkerPopup>
                <div className="p-2">
                  <p className="font-medium text-sm">📍 Ваше місцезнаходження</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {userLocation.lat.toFixed(5)}, {userLocation.lon.toFixed(5)}
                  </p>
                </div>
              </MarkerPopup>
            </MapMarker>
          )}

          {/* Plan Mode: Show point A marker */}
          {mode === 'plan' && planPointA && (
            <MapMarker
              longitude={planPointA.lon}
              latitude={planPointA.lat}
            >
              <MarkerContent>
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500 border-2 border-white shadow-lg">
                  <span className="text-white font-bold text-sm">А</span>
                </div>
              </MarkerContent>
              <MarkerPopup>
                <div className="p-2">
                  <p className="font-medium text-sm">Точка А (початок)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {planPointA.lat.toFixed(5)}, {planPointA.lon.toFixed(5)}
                  </p>
                </div>
              </MarkerPopup>
            </MapMarker>
          )}

          {/* Plan Mode: Show point B marker */}
          {mode === 'plan' && planPointB && (
            <MapMarker
              longitude={planPointB.lon}
              latitude={planPointB.lat}
            >
              <MarkerContent>
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-red-500 border-2 border-white shadow-lg">
                  <span className="text-white font-bold text-sm">Б</span>
                </div>
              </MarkerContent>
              <MarkerPopup>
                <div className="p-2">
                  <p className="font-medium text-sm">Точка Б (кінець)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {planPointB.lat.toFixed(5)}, {planPointB.lon.toFixed(5)}
                  </p>
                </div>
              </MarkerPopup>
            </MapMarker>
          )}

          {/* Browse Mode: Show multiple selected routes with colors */}
          {mode === 'browse' && selectedRouteGeometries.length > 0 && (
            <>
              {selectedRouteGeometries.map((geom) => (
                <MapRoute
                  key={`${geom.routeId}-${geom.direction || 'unknown'}`}
                  coordinates={geom.geometry.coordinates as [number, number][]}
                  color={getRouteColor(geom.transportTypeId ?? 1, geom.direction)}
                  width={4}
                  opacity={0.7}
                />
              ))}
            </>
          )}

          {/* Plan Mode: Show selected planned route */}
          {mode === 'plan' && selectedPlanRoute && (
            <RouteMapView route={selectedPlanRoute} />
          )}
        </MapContainer>

        {/* Hint overlay */}
        {mode === 'browse' &&
          selectedRouteNumbers.size === 0 &&
          !showAllRoutes &&
          !selectedStop && (
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

      {/* Schedule Modal */}
      {scheduleModalRoute && (
        <ScheduleModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          routeId={scheduleModalRoute.routeId}
          routeNumber={scheduleModalRoute.routeNumber}
          transportTypeName={scheduleModalRoute.transportTypeName}
          transportTypeId={scheduleModalRoute.transportTypeId}
          direction={scheduleModalRoute.direction}
          stopId={scheduleModalRoute.stopId}
          stopName={scheduleModalRoute.stopName}
        />
      )}
    </div>
  );
}
