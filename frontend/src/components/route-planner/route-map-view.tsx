import { useQuery } from '@tanstack/react-query';
import { MapMarker, MarkerContent, MarkerPopup, MapRoute } from '@/components/ui/map';
import { getRouteGeometryBetweenStops, type RouteOption } from '@/lib/guest-api';
import { ArrowRightLeft } from 'lucide-react';

interface RouteMapViewProps {
  route: RouteOption;
}

export function RouteMapView({ route }: RouteMapViewProps) {
  // Завантажити геометрії для кожного сегменту
  const segmentsKey = route.segments
    .map(s => `${s.routeId}-${s.fromStop.id}-${s.toStop.id}`)
    .join('_');

  const { data: geometries } = useQuery({
    queryKey: ['route-geometries-segments', segmentsKey],
    queryFn: async () => {
      return Promise.all(
        route.segments.map(seg =>
          getRouteGeometryBetweenStops({
            routeId: seg.routeId,
            fromStopId: seg.fromStop.id,
            toStopId: seg.toStop.id,
          })
        )
      );
    },
    enabled: !!route && route.segments.length > 0,
  });

  if (!route || !geometries) return null;

  return (
    <>
      {/* Лінії маршрутів */}
      {geometries.map((geom, idx) => (
        <MapRoute
          key={idx}
          coordinates={geom.coordinates as [number, number][]}
          color={idx === 0 ? '#3B82F6' : '#10B981'} // Blue for first, green for transfer
          width={5}
        />
      ))}

      {/* Маркер початку (зелений) */}
      <MapMarker
        longitude={Number(route.segments[0].fromStop.lon)}
        latitude={Number(route.segments[0].fromStop.lat)}
      >
        <MarkerContent>
          <div className="h-4 w-4 rounded-full bg-green-500 border-2 border-white shadow-lg" />
        </MarkerContent>
        <MarkerPopup>
          <div className="p-2">
            <h4 className="font-medium text-sm">{route.segments[0].fromStop.name}</h4>
            <p className="text-xs text-gray-500">Початок маршруту</p>
            <p className="text-xs text-gray-600 mt-1">
              Відправлення: {route.segments[0].departureTime}
            </p>
          </div>
        </MarkerPopup>
      </MapMarker>

      {/* Маркер кінця (червоний) */}
      <MapMarker
        longitude={Number(route.segments[route.segments.length - 1].toStop.lon)}
        latitude={Number(route.segments[route.segments.length - 1].toStop.lat)}
      >
        <MarkerContent>
          <div className="h-4 w-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
        </MarkerContent>
        <MarkerPopup>
          <div className="p-2">
            <h4 className="font-medium text-sm">
              {route.segments[route.segments.length - 1].toStop.name}
            </h4>
            <p className="text-xs text-gray-500">Кінець маршруту</p>
            <p className="text-xs text-gray-600 mt-1">
              Прибуття: {route.segments[route.segments.length - 1].arrivalTime}
            </p>
          </div>
        </MarkerPopup>
      </MapMarker>

      {/* Маркери пересадок */}
      {(route.transfers ?? (route.transfer ? [route.transfer] : [])).map(
        (transfer, idx) => (
          <MapMarker
            key={`${transfer.stopId}-${idx}`}
            longitude={Number(transfer.lon)}
            latitude={Number(transfer.lat)}
          >
            <MarkerContent>
              <div className="h-5 w-5 rounded-full bg-yellow-500 border-2 border-white shadow-lg flex items-center justify-center">
                <ArrowRightLeft className="h-3 w-3 text-white" />
              </div>
            </MarkerContent>
            <MarkerPopup>
              <div className="p-2">
                <h4 className="font-medium text-sm">Пересадка {idx + 1}</h4>
                <p className="text-xs text-gray-600">{transfer.stopName}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Очікування: {transfer.waitTimeMin} хв
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ),
      )}
    </>
  );
}
