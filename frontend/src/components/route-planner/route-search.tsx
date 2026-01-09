import { useEffect, useState } from 'react';
import { LocationInput, type LocationValue } from './location-input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface RouteSearchProps {
  onSearch: (params: {
    lonA: number;
    latA: number;
    lonB: number;
    latB: number;
  }) => void;
}

export function RouteSearch({ onSearch }: RouteSearchProps) {
  const [pointA, setPointA] = useState<LocationValue | null>(null);
  const [pointB, setPointB] = useState<LocationValue | null>(null);

  // Автоматична геолокація для точки А при завантаженні
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPointA({
          type: 'coordinates',
          lon: pos.coords.longitude,
          lat: pos.coords.latitude,
          name: 'Моє місцезнаходження',
        });
      },
      (error) => {
        console.log('Geolocation not available:', error);
        // Не показуємо помилку - просто не встановлюємо
      }
    );
  }, []);

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
      <div className="space-y-4">
        <LocationInput
          label="Звідки"
          value={pointA}
          onChange={setPointA}
          useGeolocation
          placeholder="Введіть початкову точку..."
        />

        <LocationInput
          label="Куди"
          value={pointB}
          onChange={setPointB}
          placeholder="Введіть кінцеву точку..."
        />
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
          Оберіть початкову та кінцеву точки
        </p>
      )}
    </div>
  );
}
