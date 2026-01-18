import React from 'react';
import type { RouteOption } from '../../lib/guest-api';
import { ArrowRight, Footprints } from 'lucide-react';

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onClick: () => void;
}

export function RouteCard({ route, isSelected, onClick }: RouteCardProps) {
  const isDirect = route.transferCount === 0;

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 border rounded-md text-left transition-colors relative
        ${isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
        }
      `}
    >
      {/* Direct route badge */}
      {isDirect && (
        <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded font-medium">
          Прямий
        </span>
      )}

      {/* Номери маршрутів */}
      <div className="flex items-center gap-2 mb-2 flex-wrap pr-14">
        {route.segments.map((seg, idx) => (
          <React.Fragment key={idx}>
            <span className="inline-flex items-center px-2 py-1 text-sm font-medium border border-gray-300 rounded-md dark:border-gray-600">
              {seg.routeNumber}
            </span>
            {idx < route.segments.length - 1 && (
              <ArrowRight className="h-4 w-4 text-gray-400" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Час і тривалість */}
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-300">
          {route.segments[0].departureTime} - {route.segments[route.segments.length - 1].arrivalTime}
        </span>
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {route.totalTimeMin} хв
        </span>
      </div>

      {/* Відстань та ходьба */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>{route.totalDistanceKm.toFixed(1)} км</span>
        {route.walkingDistanceM != null && route.walkingDistanceM > 0 && (
          <span className="flex items-center gap-1">
            <Footprints className="h-3 w-3" />
            {route.walkingDistanceM < 1000
              ? `${route.walkingDistanceM} м`
              : `${(route.walkingDistanceM / 1000).toFixed(1)} км`}
            {route.walkingTimeMin != null && ` (~${Math.round(route.walkingTimeMin)} хв)`}
          </span>
        )}
      </div>

      {/* Пересадки (якщо є) */}
      {route.transferCount > 0 && (
        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
          <span>🔄</span>
          <span>
            {route.transferCount} {route.transferCount === 1 ? 'пересадка' : 'пересадки'} • очікування ~{formatWait(route)} хв
          </span>
        </div>
      )}
    </button>
  );
}

function formatWait(route: RouteOption) {
  const transfers = route.transfers ?? (route.transfer ? [route.transfer] : []);
  const totalWait = transfers.reduce(
    (sum, item) => sum + (item.waitTimeMin ?? 0),
    0,
  );
  return totalWait;
}
