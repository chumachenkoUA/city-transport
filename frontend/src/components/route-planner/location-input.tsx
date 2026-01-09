import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { searchStops, type StopSearchResult } from '@/lib/guest-api';
import { Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface LocationValue {
  type: 'coordinates' | 'stop';
  lon: number;
  lat: number;
  name?: string;
  stopId?: number;
}

interface LocationInputProps {
  label: string;
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  useGeolocation?: boolean;
  placeholder?: string;
}

export function LocationInput({
  label,
  value,
  onChange,
  useGeolocation = false,
  placeholder = "Введіть назву зупинки..."
}: LocationInputProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Пошук зупинок
  const { data: stops, isLoading: isLoadingStops } = useQuery({
    queryKey: ['stops-search', query],
    queryFn: () => searchStops({ q: query }),
    enabled: query.length >= 2,
  });

  // Оновити query коли value змінюється
  useEffect(() => {
    if (value?.name) {
      setQuery(value.name);
    }
  }, [value]);

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      alert('Геолокація не підтримується вашим браузером');
      return;
    }

    setIsLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          type: 'coordinates',
          lon: pos.coords.longitude,
          lat: pos.coords.latitude,
          name: 'Моє місцезнаходження',
        });
        setQuery('Моє місцезнаходження');
        setIsLoadingGeo(false);
        setShowDropdown(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Не вдалося отримати геолокацію');
        setIsLoadingGeo(false);
      }
    );
  };

  const selectStop = (stop: StopSearchResult) => {
    onChange({
      type: 'stop',
      lon: Number(stop.lon),
      lat: Number(stop.lat),
      name: stop.name,
      stopId: stop.id,
    });
    setQuery(stop.name);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => {
              // Delay to allow click on dropdown item
              setTimeout(() => setShowDropdown(false), 200);
            }}
          />

          {/* Dropdown with results */}
          {showDropdown && query.length >= 2 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
              {isLoadingStops && (
                <div className="p-3 text-center text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin inline-block" />
                  <span className="ml-2">Пошук...</span>
                </div>
              )}

              {!isLoadingStops && stops && stops.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                    Зупинки
                  </div>
                  {stops.map((stop) => (
                    <button
                      key={stop.id}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      onClick={() => selectStop(stop)}
                    >
                      {stop.name}
                    </button>
                  ))}
                </div>
              )}

              {!isLoadingStops && stops && stops.length === 0 && (
                <div className="p-3 text-center text-gray-500 text-sm">
                  Зупинок не знайдено
                </div>
              )}
            </div>
          )}
        </div>

        {/* Геолокація кнопка */}
        {useGeolocation && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGeolocation}
            disabled={isLoadingGeo}
            title="Використати моє місцезнаходження"
          >
            {isLoadingGeo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Відображення вибраної локації */}
      {value && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {value.name || `${value.lat.toFixed(4)}, ${value.lon.toFixed(4)}`}
        </div>
      )}
    </div>
  );
}
