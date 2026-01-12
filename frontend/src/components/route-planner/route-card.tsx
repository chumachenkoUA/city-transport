import React from 'react';
import type { RouteOption } from '../../lib/guest-api';
import { ArrowRight } from 'lucide-react';

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onClick: () => void;
}

export function RouteCard({ route, isSelected, onClick }: RouteCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 border rounded-md text-left transition-colors
        ${isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
        }
      `}
    >
      {/* Номери маршрутів */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
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

      {/* Відстань */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {route.totalDistanceKm.toFixed(1)} км
      </div>

      {/* Пересадки (якщо є) */}
      {route.transferCount > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
          <span>🔄</span>
          <span>
            {route.transferCount} пересадки • очікування {formatWait(route)} хв
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
