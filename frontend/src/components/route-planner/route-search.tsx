import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Search, X } from 'lucide-react';

interface RouteSearchProps {
  onSearch: (params: {
    lonA: number;
    latA: number;
    lonB: number;
    latB: number;
  }) => void;
  pointA: { lon: number; lat: number } | null;
  pointB: { lon: number; lat: number } | null;
  onSetPointA: () => void;
  onSetPointB: () => void;
  onClearPointA: () => void;
  onClearPointB: () => void;
  isSelectingPoint: 'A' | 'B' | null;
}

export function RouteSearch({
  onSearch,
  pointA,
  pointB,
  onSetPointA,
  onSetPointB,
  onClearPointA,
  onClearPointB,
  isSelectingPoint
}: RouteSearchProps) {
  const handleSearch = () => {
    if (pointA && pointB) {
      onSearch({
        lonA: pointA.lon,
        latA: pointA.lat,
        lonB: pointB.lon,
        latB: pointB.lat,
      });
    }
  };

  const canSearch = pointA && pointB;

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-3">
        {/* Point A */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Точка А (початок)
          </label>

          {pointA ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <MapPin className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Точка А
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 truncate">
                  {pointA.lat.toFixed(5)}, {pointA.lon.toFixed(5)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={onClearPointA}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant={isSelectingPoint === 'A' ? 'default' : 'outline'}
              className="w-full"
              onClick={onSetPointA}
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isSelectingPoint === 'A' ? 'Клікніть на мапі...' : 'Обрати на мапі'}
            </Button>
          )}
        </div>

        {/* Point B */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Точка Б (кінець)
          </label>

          {pointB ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <MapPin className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  Точка Б
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 truncate">
                  {pointB.lat.toFixed(5)}, {pointB.lon.toFixed(5)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={onClearPointB}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant={isSelectingPoint === 'B' ? 'default' : 'outline'}
              className="w-full"
              onClick={onSetPointB}
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isSelectingPoint === 'B' ? 'Клікніть на мапі...' : 'Обрати на мапі'}
            </Button>
          )}
        </div>
      </div>

      <Button
        onClick={handleSearch}
        disabled={!canSearch}
        className="w-full"
      >
        <Search className="h-4 w-4 mr-2" />
        Знайти маршрут
      </Button>

      {!canSearch && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Оберіть точки А та Б на мапі
        </p>
      )}

      {isSelectingPoint && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 Клікніть на мапі щоб обрати точку {isSelectingPoint}
          </p>
        </div>
      )}
    </div>
  );
}
