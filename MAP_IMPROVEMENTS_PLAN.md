# План покращення функціональності мапи для пасажирів

## Огляд

Цей план покриває комплексне покращення інтерактивної мапи транспорту для Guest та Registered Passenger ролей. Основні зміни включають: видалення кластеризації зупинок, множинний вибір маршрутів, кольорове кодування по типу транспорту та напрямку, відображення маршрутів через зупинку, та виправлення пошуку в режимі планування.

## Поточна реалізація

**Головний компонент мапи**: `/frontend/src/routes/map.tsx` (448 рядків)

**Критичні проблеми**:
- **Line 367**: Зупинки ховаються коли обрано маршрут: `{!selectedRouteId && stopsGeoJSON && ...}`
- **Line 48**: Тільки один маршрут може бути обраний одночасно
- **Line 368**: Завжди активна кластеризація через `MapClusterLayer`
- **Line 384**: Всі маршрути синього кольору `color="#3B82F6"`
- **Lines 229-268**: Прямий та зворотній напрямки показуються як окремі елементи списку
- **Line 274-295**: При кліку на зупинку не показуються маршрути що через неї проходять

**План Mode проблема**: `/frontend/src/components/route-planner/location-input.tsx`
- **Lines 35-39**: Немає debouncing для пошуку - запит робиться на кожну зміну query
- Це може призводити до надмірної кількості API запитів і проблем з пошуком

## Вимоги користувача

### 1. Відображення зупинок
✅ Видалити кластеризацію повністю - завжди показувати всі зупинки як окремі точки
✅ Зупинки повинні залишатись видимими навіть коли відображаються маршрути
✅ Зупинки видимі в обох режимах: Browse та Plan

### 2. Кольори типів транспорту
- **Автобус**: Жовтий (#FCD34D або схожий)
- **Тролейбус**: Синій (#3B82F6 або схожий)
- **Трамвай**: Червоний (#EF4444 або схожий)

### 3. Кольори напрямків
- **Прямий (forward)**: Світліший відтінок базового кольору
- **Зворотній (reverse)**: Темніший відтінок базового кольору
- Приклад для автобуса: Forward=#FCD34D, Reverse=#F59E0B

### 4. Групування маршрутів в UI
- Маршрути з однаковим номером але різними напрямками групуються як ОДИН елемент в сайдбарі
- Формат: "Маршрут 5" (не "Маршрут 5 Прямий" та "Маршрут 5 Зворотній" окремо)
- При виборі малюються ОБІ напрямки з різними кольорами

### 5. Множинний вибір маршрутів (3 методи)
a) **Чекбокси** - Вибір декількох конкретних маршрутів через чекбокси
b) **Кнопка "Показати всі маршрути"** - Перемикач для відображення всіх маршрутів одночасно
c) **Фільтр по типу транспорту** - Показати всі автобуси/тролейбуси/трамваї

### 6. Клік по зупинці
- Показувати popup з:
  - Назва та координати зупинки (вже є)
  - **НОВЄ**: Список маршрутів що проходять через цю зупинку
  - Для кожного маршруту: номер, тип транспорту, приблизний інтервал

### 7. Покращення Plan Mode
- Виправити проблему "не знаходить потрібні зупинки"
- Додати debouncing для пошуку (300ms)
- Показувати візуальну підказку про мінімум 2 символи

### 8. Guest vs Registered Passenger
- Обидві ролі мають доступ до мапи та планування маршрутів
- Різниця тільки в додаткових функціях для зареєстрованих (картки, поїздки, штрафи)

## Технічна інформація

**Transport Type IDs** (з backend seed):
- Type ID 1: Трамвай (route_type='0')
- Type ID 2: Автобус (route_type='3')
- Type ID 3: Тролейбус (route_type='11' або '800')

**Direction values**: 'forward' та 'reverse' (enforced by DB constraint)

**API Endpoints доступні**:
- `GET /guest/stops/geometries` - Всі зупинки з координатами ✅
- `GET /guest/routes/geometries?transportTypeId=X` - Всі маршрути ✅
- `GET /guest/stops/:stopId/routes` - Маршрути через зупинку ✅
- `GET /guest/routes/plan` - Планування маршруту ✅
- `GET /guest/stops/search?q=` - Пошук зупинок ✅

## План реалізації

### PHASE 1: Утилітні файли для кольорів і групування

**Створити два нових файли:**

#### 1.1 `/frontend/src/lib/map-colors.ts`

Централізоване управління кольорами:

```typescript
export const TRANSPORT_COLORS = {
  1: { name: 'Трамвай', base: '#EF4444', light: '#F87171', dark: '#DC2626' },
  2: { name: 'Автобус', base: '#FCD34D', light: '#FDE68A', dark: '#F59E0B' },
  3: { name: 'Тролейбус', base: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
} as const;

export function getRouteColor(transportTypeId: number, direction?: string): string {
  const colors = TRANSPORT_COLORS[transportTypeId];
  if (!colors) return '#9CA3AF'; // Gray fallback
  if (!direction) return colors.base;
  return direction === 'forward' ? colors.light : colors.dark;
}

export function getTransportTypeColor(transportTypeId: number): string {
  return TRANSPORT_COLORS[transportTypeId]?.base ?? '#9CA3AF';
}
```

#### 1.2 `/frontend/src/lib/route-utils.ts`

Логіка групування маршрутів:

```typescript
import { Route } from '@/lib/guest-api';

export interface GroupedRoute {
  number: string;
  transportTypeId: number;
  transportType: string;
  intervalMin?: number | null;
  routes: Route[]; // forward + reverse
  routeIds: number[]; // all route IDs in this group
}

export function groupRoutesByNumber(routes: Route[]): GroupedRoute[] {
  const groups = new Map<string, GroupedRoute>();

  for (const route of routes) {
    const routeId = route.routeId ?? route.id;
    const routeNumber = route.number ?? route.routeNumber;
    const key = `${routeNumber}-${route.transportTypeId}`;

    if (!groups.has(key)) {
      groups.set(key, {
        number: routeNumber!,
        transportTypeId: route.transportTypeId,
        transportType: route.transportType,
        intervalMin: route.intervalMin,
        routes: [],
        routeIds: [],
      });
    }

    const group = groups.get(key)!;
    group.routes.push(route);
    if (routeId) group.routeIds.push(routeId);
  }

  return Array.from(groups.values());
}
```

**Файли**:
- `frontend/src/lib/map-colors.ts` (новий)
- `frontend/src/lib/route-utils.ts` (новий)

---

### PHASE 2: Оновлення стану в map.tsx

**Файл**: `/frontend/src/routes/map.tsx`

#### 2.1 Імпорти (додати після line 21)

```typescript
import { groupRoutesByNumber } from '@/lib/route-utils';
import { getRouteColor, getTransportTypeColor } from '@/lib/map-colors';
import { getRoutesByStop, type Route as ApiRoute } from '@/lib/guest-api';
```

#### 2.2 Замінити state для вибору маршрутів (line 48)

**ВИДАЛИТИ**:
```typescript
const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
```

**ДОДАТИ**:
```typescript
const [selectedRouteNumbers, setSelectedRouteNumbers] = useState<Set<string>>(new Set());
const [showAllRoutes, setShowAllRoutes] = useState(false);
const [clickedStopId, setClickedStopId] = useState<number | null>(null);
```

#### 2.3 Додати обчислення згрупованих маршрутів (після line 86)

```typescript
// Group routes by number (combine forward/reverse)
const groupedRoutes = useMemo(() => {
  if (!routes) return [];
  return groupRoutesByNumber(routes);
}, [routes]);

// Get geometries for selected routes
const selectedRouteGeometries = useMemo(() => {
  if (!routeGeometries) return [];

  // Show all if toggle is on
  if (showAllRoutes) return routeGeometries;

  // Show selected groups
  return routeGeometries.filter(geom => {
    const group = groupedRoutes.find(g => g.routeIds.includes(geom.routeId));
    return group && selectedRouteNumbers.has(group.number);
  });
}, [routeGeometries, selectedRouteNumbers, showAllRoutes, groupedRoutes]);
```

#### 2.4 Додати запит для маршрутів на зупинці (після line 86)

```typescript
// Fetch routes at clicked stop
const { data: routesAtStop, isLoading: routesAtStopLoading } = useQuery({
  queryKey: ['routes-at-stop', clickedStopId],
  queryFn: () => getRoutesByStop(clickedStopId!),
  enabled: !!clickedStopId,
});
```

#### 2.5 Оновити обробник кліку по зупинці (замінити handleStopClick lines 111-119)

```typescript
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
```

#### 2.6 Додати обробник для множинного вибору (після handleStopClick)

```typescript
const handleRouteToggle = useCallback((routeNumber: string) => {
  if (showAllRoutes) return; // Disable individual selection when "show all" is on

  setSelectedRouteNumbers(prev => {
    const next = new Set(prev);
    if (next.has(routeNumber)) {
      next.delete(routeNumber);
    } else {
      next.add(routeNumber);
    }
    return next;
  });
}, [showAllRoutes]);

const handleShowAllToggle = useCallback(() => {
  setShowAllRoutes(prev => !prev);
  if (!showAllRoutes) {
    setSelectedRouteNumbers(new Set()); // Clear individual selections
  }
}, [showAllRoutes]);
```

**Файли**:
- `frontend/src/routes/map.tsx` (major changes)

---

### PHASE 3: Оновлення UI сайдбару

**Файл**: `/frontend/src/routes/map.tsx`

#### 3.1 Додати кнопку "Показати всі маршрути" (після line 203, перед Routes List)

```typescript
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
```

#### 3.2 Замінити список маршрутів (lines 206-271)

**ВИДАЛИТИ** старий список маршрутів

**ДОДАТИ** новий список з групуванням:

```typescript
{/* Routes List */}
<div className="flex-1 overflow-auto">
  <button
    className="w-full px-4 py-3 flex items-center justify-between text-left border-b hover:bg-gray-50 dark:hover:bg-gray-800"
    onClick={() => setExpandedRoutes(!expandedRoutes)}
  >
    <span className="font-medium text-gray-900 dark:text-white">
      Маршрути ({groupedRoutes.length ?? 0})
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

      {groupedRoutes?.map((group) => {
        const isSelected = selectedRouteNumbers.has(group.number);
        const isDisabled = showAllRoutes;
        const color = getTransportTypeColor(group.transportTypeId);

        return (
          <div
            key={`${group.number}-${group.transportTypeId}`}
            className={`px-4 py-3 flex items-center gap-3 transition-colors ${
              isSelected && !isDisabled
                ? 'bg-blue-50 dark:bg-blue-950'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            } ${isDisabled ? 'opacity-50' : ''}`}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={isSelected || showAllRoutes}
              disabled={isDisabled}
              onChange={() => handleRouteToggle(group.number)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />

            {/* Color indicator */}
            <div
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />

            {/* Route number badge */}
            <span
              className="px-2 py-1 text-sm font-medium rounded border flex-shrink-0"
              style={{
                borderColor: color,
                backgroundColor: isSelected ? `${color}20` : 'transparent'
              }}
            >
              {group.number}
            </span>

            {/* Route info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {group.transportType}
              </p>
              <p className="text-xs text-gray-500">
                {group.routes.length} напрямки
              </p>
            </div>

            {/* Interval */}
            {group.intervalMin && (
              <span className="text-xs text-gray-500 flex-shrink-0">
                ~{group.intervalMin} хв
              </span>
            )}
          </div>
        );
      })}
    </div>
  )}
</div>
```

#### 3.3 Оновити Selected Stop Info (lines 273-295)

**ЗАМІНИТИ** блок Selected Stop Info:

```typescript
{/* Selected Stop Info */}
{selectedStop && (
  <div className="border-t bg-gray-50 dark:bg-gray-800 max-h-80 overflow-auto">
    {/* Header */}
    <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 p-4 border-b flex items-start justify-between">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">
          {selectedStop.name}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          ID: {selectedStop.id} • {selectedStop.geometry.coordinates[1].toFixed(5)}, {selectedStop.geometry.coordinates[0].toFixed(5)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setSelectedStop(null);
          setClickedStopId(null);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>

    {/* Routes at stop */}
    <div className="p-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Маршрути через цю зупинку:
      </h4>

      {routesAtStopLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      )}

      {routesAtStop && routesAtStop.length === 0 && (
        <p className="text-sm text-gray-500">
          Маршрути не знайдено
        </p>
      )}

      {routesAtStop && routesAtStop.length > 0 && (
        <div className="space-y-2">
          {routesAtStop.map((route) => {
            const routeNumber = route.number ?? route.routeNumber;
            const color = getTransportTypeColor(route.transportTypeId);

            return (
              <div
                key={`${route.routeId}-${route.direction}`}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
              >
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium text-sm">
                  {routeNumber}
                </span>
                <span className="text-xs text-gray-500 flex-1">
                  {route.transportType} • {route.direction === 'forward' ? 'Прямий' : 'Зворотній'}
                </span>
                {route.intervalMin && (
                  <span className="text-xs text-gray-500">
                    ~{route.intervalMin} хв
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
)}
```

**Файли**:
- `frontend/src/routes/map.tsx` (major UI changes)

---

### PHASE 4: Оновлення рендерингу мапи

**Файл**: `/frontend/src/routes/map.tsx`

#### 4.1 ВИДАЛИТИ кластеризацію зупинок (lines 366-375)

**ВИДАЛИТИ**:
```typescript
{mode === 'browse' && stopsGeoJSON && !selectedRouteId && (
  <MapClusterLayer ... />
)}
```

#### 4.2 ДОДАТИ індивідуальні маркери для всіх зупинок (замінити блок 366-375)

```typescript
{/* Browse Mode: Show ALL stops as individual markers (NO clustering) */}
{mode === 'browse' && stopGeometries && (
  <>
    {stopGeometries.map((stop) => (
      <MapMarker
        key={stop.id}
        longitude={stop.geometry.coordinates[0]}
        latitude={stop.geometry.coordinates[1]}
        onClick={() => {
          const feature: GeoJSON.Feature<GeoJSON.Point, { id: number; name: string }> = {
            type: 'Feature',
            properties: { id: stop.id, name: stop.name },
            geometry: stop.geometry,
          };
          handleStopClick(feature);
        }}
      >
        <MarkerContent>
          <div
            className={`h-2 w-2 rounded-full border border-white shadow-sm transition-all cursor-pointer
              ${selectedStop?.id === stop.id ? 'bg-green-500 h-3 w-3' : 'bg-blue-500 hover:h-2.5 hover:w-2.5'}`}
          />
        </MarkerContent>
      </MapMarker>
    ))}
  </>
)}
```

#### 4.3 Оновити рендеринг маршрутів (замінити lines 377-388)

**ВИДАЛИТИ** старий блок:
```typescript
{mode === 'browse' && selectedRouteGeometry && ...}
```

**ДОДАТИ** новий блок для множинних маршрутів:

```typescript
{/* Browse Mode: Show multiple selected routes with colors */}
{mode === 'browse' && selectedRouteGeometries.length > 0 && (
  <>
    {selectedRouteGeometries.map((geom) => (
      <MapRoute
        key={`${geom.routeId}-${geom.direction || 'unknown'}`}
        coordinates={geom.geometry.coordinates as [number, number][]}
        color={getRouteColor(geom.transportTypeId, geom.direction)}
        width={4}
        opacity={0.7}
      />
    ))}
  </>
)}
```

#### 4.4 ВИДАЛИТИ старий selected stop marker (lines 390-410)

Старий маркер більше не потрібен, бо зупинки завжди видимі та підсвічуються при виборі.

**Файли**:
- `frontend/src/routes/map.tsx` (map rendering changes)

---

### PHASE 5: Виправлення Plan Mode search

**Файл**: `/frontend/src/components/route-planner/location-input.tsx`

#### 5.1 Додати debouncing (після line 29)

**ДОДАТИ** після `const [query, setQuery] = useState('');`:

```typescript
const [debouncedQuery, setDebouncedQuery] = useState('');

// Debounce search query
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(query);
  }, 300);

  return () => clearTimeout(timer);
}, [query]);
```

#### 5.2 Оновити useQuery для використання debounced значення (lines 35-39)

**ЗАМІНИТИ**:
```typescript
const { data: stops, isLoading: isLoadingStops } = useQuery({
  queryKey: ['stops-search', query],
  queryFn: () => searchStops({ q: query }),
  enabled: query.length >= 2,
});
```

**НА**:
```typescript
const { data: stops, isLoading: isLoadingStops } = useQuery({
  queryKey: ['stops-search', debouncedQuery],
  queryFn: () => searchStops({ q: debouncedQuery }),
  enabled: debouncedQuery.length >= 2,
});
```

#### 5.3 Додати візуальну підказку про мінімум символів

Знайти блок з input field і додати після нього:

```typescript
{/* Visual feedback for minimum characters */}
{query.length > 0 && query.length < 2 && (
  <p className="text-xs text-gray-500 mt-1">
    Введіть мінімум 2 символи для пошуку
  </p>
)}

{/* Show loading indicator */}
{query.length >= 2 && query !== debouncedQuery && (
  <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
    <Loader2 className="h-3 w-3 animate-spin" />
    Пошук...
  </p>
)}
```

**Файли**:
- `frontend/src/components/route-planner/location-input.tsx` (add debouncing + visual feedback)

---

### PHASE 6: Додати Plan Mode зупинки (опційно)

**Файл**: `/frontend/src/routes/map.tsx`

Щоб зупинки були видимі також в Plan Mode, додати рендеринг зупинок для plan mode (після browse mode stops блок):

```typescript
{/* Plan Mode: Show ALL stops as individual markers */}
{mode === 'plan' && stopGeometries && (
  <>
    {stopGeometries.map((stop) => (
      <MapMarker
        key={stop.id}
        longitude={stop.geometry.coordinates[0]}
        latitude={stop.geometry.coordinates[1]}
      >
        <MarkerContent>
          <div className="h-1.5 w-1.5 rounded-full bg-gray-400 border border-white shadow-sm" />
        </MarkerContent>
      </MapMarker>
    ))}
  </>
)}
```

**Файли**:
- `frontend/src/routes/map.tsx` (plan mode stops)

---

## Критичні файли для модифікації

### Нові файли (2)
1. `/frontend/src/lib/map-colors.ts` - Утиліти кольорів для типів транспорту та напрямків
2. `/frontend/src/lib/route-utils.ts` - Логіка групування маршрутів

### Модифіковані файли (2)
3. `/frontend/src/routes/map.tsx` - Головний компонент мапи (MAJOR CHANGES)
   - State management (Phase 2)
   - Sidebar UI (Phase 3)
   - Map rendering (Phase 4)
   - Plan mode stops (Phase 6)

4. `/frontend/src/components/route-planner/location-input.tsx` - Пошук зупинок
   - Add debouncing (Phase 5)
   - Visual feedback (Phase 5)

### Backend
**❌ ЗМІН НЕ ПОТРІБНО** - всі API endpoints вже існують

---

## Потенційні виклики та рішення

### Виклик 1: Продуктивність при рендерингу сотень зупинок
**Проблема**: Сотні React компонентів `MapMarker` можуть сповільнити роботу

**Рішення**:
- Спочатку імплементувати як є (з React компонентами)
- Якщо виникнуть проблеми з продуктивністю, можна створити `MapStopsLayer` компонент який використовує native MapLibre circle layer
- Native layer рендериться значно швидше (один layer замість сотень DOM елементів)

### Виклик 2: Накладання маршрутів при показі всіх
**Проблема**: 50+ маршрутів можуть бути нечитабельними

**Рішення**:
- Ширина лінії 4px (не дуже товста)
- Opacity 0.7 (напівпрозорість допомагає бачити накладання)
- Обрані маршрути можна рендерити останніми (вищий z-index)

### Виклик 3: Контраст жовтих маршрутів
**Проблема**: Жовті маршрути можуть бути погано видимі на світлій мапі

**Рішення**:
- Використати трохи темніший відтінок жовтого (#F59E0B замість #FCD34D) якщо потрібно
- Тестувати на світлій та темній темах мапи
- Можна додати тонку обводку (stroke) для контрасту

### Виклик 4: Transport Type ID Mapping
**Проблема**: Переконатись що ID з seed відповідають ID в базі

**Перевірка**:
- З seed.ts: Трамвай=тип 0 (але використовується транспорт ID 1), Автобус=тип 3 (ID 2), Тролейбус=тип 11/800 (ID 3)
- Потрібно перевірити реальні transportTypeId в базі
- Можливо треба буде скоригувати TRANSPORT_COLORS mapping

---

## Верифікація (Testing Checklist)

### Базова функціональність
- [ ] Всі зупинки видимі без кластеризації при всіх рівнях zoom
- [ ] Зупинки залишаються видимими коли обрано маршрути
- [ ] Зупинки видимі в Browse режимі
- [ ] Зупинки видимі в Plan режимі

### Кольорове кодування
- [ ] Автобуси показуються жовтим кольором
- [ ] Тролейбуси показуються синім кольором
- [ ] Трамваї показуються червоним кольором
- [ ] Прямий напрямок - світліший відтінок
- [ ] Зворотній напрямок - темніший відтінок

### Групування та вибір
- [ ] Маршрути згруповані по номеру в sidebar
- [ ] При виборі маршруту малюються ОБІ напрямки (прямий + зворотній)
- [ ] Чекбокси дозволяють множинний вибір
- [ ] Кнопка "Показати всі маршрути" працює
- [ ] Фільтр по типу транспорту працює (вже є в UI, має працювати з груповими)

### Клік по зупинці
- [ ] Клік по зупинці показує popup
- [ ] Popup містить назву, координати, ID
- [ ] Popup показує список маршрутів через цю зупинку
- [ ] Кожен маршрут показує: номер, тип, напрямок, інтервал

### Plan Mode
- [ ] Пошук зупинок працює після введення 2+ символів
- [ ] Немає зайвих API запитів (debouncing працює)
- [ ] Показується підказка "мінімум 2 символи" коли треба
- [ ] Пошук знаходить потрібні зупинки

### Access Control
- [ ] Guest користувачі можуть відкрити /map
- [ ] Registered passengers можуть відкрити /map
- [ ] Обидві ролі можуть планувати маршрути
- [ ] Немає помилок доступу до API

### Продуктивність
- [ ] Прокрутка мапи плавна з сотнями зупинок
- [ ] Zoom працює без затримок
- [ ] Рендеринг 50+ маршрутів не викликає проблем
- [ ] UI відгукується швидко при виборі маршрутів

---

## Орієнтовний час реалізації

- **Phase 1**: Утилітні файли - 30 хв
- **Phase 2**: State management - 1 год
- **Phase 3**: Sidebar UI - 2 год
- **Phase 4**: Map rendering - 1.5 год
- **Phase 5**: Plan mode search - 45 хв
- **Phase 6**: Plan mode stops - 15 хв
- **Testing & Bug fixes**: 2 год

**Загалом**: ~8 годин

---

## Примітки

- Всі API endpoints вже реалізовані на backend - змін backend не потрібно
- MapLibre GL підтримує GeoJSON LineStrings та Points - використовується поточною реалізацією
- TanStack Query надає кешування - множинні виклики одного endpoint будуть кешуватись
- Dark mode вже підтримується - всі кольори працюватимуть в обох темах
