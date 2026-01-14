# Архітектурний аналіз системи City Transport

**Дата:** 2026-01-14

---

## Частина 1: Як будується маршрут з точки А в точку Б

### 1.1 Структура даних маршруту

Маршрут в системі складається з трьох основних сутностей:

```
routes (Маршрут)
    ├── route_stops (Зупинки на маршруті) - двозв'язний список
    │   └── stops (Довідник зупинок)
    └── route_points (Точки геометрії) - двозв'язний список
```

#### Таблиця `routes`
```sql
CREATE TABLE "routes" (
    "id" bigserial PRIMARY KEY,
    "transport_type_id" bigint NOT NULL,  -- Тип транспорту (Автобус/Тролейбус/Трамвай)
    "number" text NOT NULL,                -- Номер маршруту ("5", "12A")
    "direction" text NOT NULL,             -- 'forward' або 'reverse'
    "is_active" boolean DEFAULT true
);
```

#### Таблиця `route_stops` (Двозв'язний список)
```sql
CREATE TABLE "route_stops" (
    "id" bigserial PRIMARY KEY,
    "route_id" bigint NOT NULL,
    "stop_id" bigint NOT NULL,
    "prev_route_stop_id" bigint UNIQUE,    -- Попередня зупинка (NULL = перша)
    "next_route_stop_id" bigint UNIQUE,    -- Наступна зупинка (NULL = остання)
    "distance_to_next_km" numeric(10, 3)   -- Відстань до наступної зупинки
);
```

#### Таблиця `route_points` (Геометрія для карти)
```sql
CREATE TABLE "route_points" (
    "id" bigserial PRIMARY KEY,
    "route_id" bigint NOT NULL,
    "lon" numeric(10, 7) NOT NULL,
    "lat" numeric(10, 7) NOT NULL,
    "prev_route_point_id" bigint UNIQUE,   -- Попередня точка
    "next_route_point_id" bigint UNIQUE    -- Наступна точка
);
```

### 1.2 Чому двозв'язний список?

**Переваги:**
1. **Гарантований порядок** - не залежить від ID чи порядку вставки
2. **Ефективна вставка/видалення** - O(1) для операцій посередині
3. **Рекурсивний обхід** - PostgreSQL CTE ефективно обходить список
4. **Цілісність** - UNIQUE constraints гарантують відсутність циклів

**Аргументація:**
- Порядок зупинок критичний для розрахунку часу прибуття
- Зміна порядку зупинок (наприклад, об'їзд) вимагає тільки оновлення посилань
- Альтернатива (поле `order_index`) вимагає перенумерації при вставці

### 1.3 Алгоритм побудови маршруту (plan_route)

Функція `guest_api.plan_route()` працює так:

```
Вхід: координати А (lon_a, lat_a), координати Б (lon_b, lat_b)
Вихід: список варіантів маршруту з часом та відстанню

Крок 1: Знайти найближчі зупинки до точки А (радіус 500м)
        → stops_a = find_nearby_stops(lon_a, lat_a, 500m)

Крок 2: Знайти найближчі зупинки до точки Б (радіус 500м)
        → stops_b = find_nearby_stops(lon_b, lat_b, 500m)

Крок 3: Знайти маршрути, що проходять через обидві зупинки
        → potential_routes = routes WHERE
            EXISTS stop_a IN route_stops AND
            EXISTS stop_b IN route_stops

Крок 4: Для кожного маршруту обійти двозв'язний список
        → Рекурсивний CTE від першої зупинки до останньої
        → Накопичувати відстань (accum_dist)

Крок 5: Перевірити напрямок (stop_a має бути ДО stop_b)
        → WHERE ra.path_seq < rb.path_seq

Крок 6: Розрахувати час поїздки
        → travel_min = (distance_km / 25 km/h) * 60

Крок 7: Знайти найближчий відправлення з розкладу
        → next_departure = work_start_time + CEIL((now - work_start) / interval) * interval

Крок 8: Повернути JSON з варіантами маршруту
```

### 1.4 Рекурсивний CTE для обходу списку

```sql
WITH RECURSIVE traversal AS (
    -- Базовий випадок: перша зупинка (prev = NULL)
    SELECT rs.id, rs.route_id, rs.stop_id, rs.next_route_stop_id,
           1 as path_seq, 0::numeric as accum_dist
    FROM route_stops rs
    WHERE rs.prev_route_stop_id IS NULL

    UNION ALL

    -- Рекурсивний випадок: наступна зупинка
    SELECT next_rs.id, next_rs.route_id, next_rs.stop_id, next_rs.next_route_stop_id,
           t.path_seq + 1,
           t.accum_dist + COALESCE(t.distance_to_next_km, 0)
    FROM route_stops next_rs
    JOIN traversal t ON next_rs.id = t.next_route_stop_id
    WHERE t.path_seq < 1000  -- Захист від нескінченного циклу
)
SELECT * FROM traversal;
```

### 1.5 Розрахунок відстаней між зупинками

Функція `municipality_api.recalculate_route_stop_distances()`:

```
1. Обійти route_points → отримати кумулятивну відстань для кожної точки
2. Для кожної зупинки знайти найближчу точку на геометрії (LATERAL JOIN)
3. Відстань між зупинками = різниця кумулятивних відстаней їх найближчих точок
4. Використовує PostGIS ST_DistanceSphere для точного розрахунку
```

### 1.6 pgRouting для складних маршрутів

Функція `guest_api.plan_route_pgrouting()` використовує алгоритм Дейкстри:

```
1. Побудувати граф:
   - Вершини = route_stop.id
   - Ребра = переходи між зупинками (cost = час поїздки)
   - Трансфери = ребра між однаковими зупинками різних маршрутів (cost = штраф пересадки)

2. Запустити pgr_dijkstra(граф, стартові_вершини, кінцеві_вершини)

3. Отримати найкоротший шлях з урахуванням пересадок
```

---

## Частина 2: Логічні покращення системи

### 2.1 Тригери (обґрунтовані)

#### 2.1.1 Автоматичне оновлення бюджету при витратах/доходах

**Проблема:** Бухгалтер вручну оновлює планові суми в `budgets`, але фактичні суми розраховуються динамічно.

**Рішення:** Тригер для автоматичного накопичення фактичних сум.

```sql
-- Додати колонки для фактичних сум
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS actual_income numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_expenses numeric(14, 2) DEFAULT 0;

-- Тригер на tickets (дохід від квитків)
CREATE OR REPLACE FUNCTION public.fn_update_budget_on_ticket()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.budgets (month, actual_income)
    VALUES (date_trunc('month', NEW.purchased_at)::date, NEW.price)
    ON CONFLICT (month) DO UPDATE
    SET actual_income = budgets.actual_income + NEW.price;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_budget_ticket_income
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.fn_update_budget_on_ticket();

-- Тригер на expenses (витрати)
CREATE OR REPLACE FUNCTION public.fn_update_budget_on_expense()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.budgets (month, actual_expenses)
    VALUES (date_trunc('month', NEW.occurred_at)::date, NEW.amount)
    ON CONFLICT (month) DO UPDATE
    SET actual_expenses = budgets.actual_expenses + NEW.amount;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_budget_expense
AFTER INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.fn_update_budget_on_expense();
```

**Аргументація:**
- Бухгалтер бачить план/факт в одній таблиці
- Не потрібно кожного разу агрегувати tickets + expenses + salary_payments
- Дані завжди актуальні без додаткових запитів

---

#### 2.1.2 Автоматичне створення транспортної картки при реєстрації

**Проблема:** Після реєстрації пасажира потрібно окремо створювати картку.

**Рішення:** Тригер автоматично створює картку з унікальним номером.

```sql
CREATE OR REPLACE FUNCTION public.fn_create_card_on_user_register()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_card_number text;
BEGIN
    -- Генерація унікального номера картки: CT + рік + 8 цифр
    v_card_number := 'CT' || EXTRACT(YEAR FROM now())::text ||
                     LPAD((nextval('transport_card_seq')::text), 8, '0');

    INSERT INTO public.transport_cards (user_id, card_number, balance)
    VALUES (NEW.id, v_card_number, 0);

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_card_on_register
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.fn_create_card_on_user_register();

-- Sequence для номерів карток
CREATE SEQUENCE IF NOT EXISTS transport_card_seq START 1;
```

**Аргументація:**
- Спрощує реєстрацію (одна операція замість двох)
- Гарантує наявність картки для кожного пасажира
- Унікальний формат номера для ідентифікації

---

#### 2.1.3 Автоматичне прострочення штрафів

**Проблема:** Штрафи зі статусом "Очікує сплати" не змінюються автоматично.

**Рішення:** Scheduled job або тригерна функція для прострочення.

```sql
-- Функція для прострочення штрафів (викликається pg_cron або вручну)
CREATE OR REPLACE FUNCTION public.fn_expire_overdue_fines()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.fines
    SET status = 'Прострочено'
    WHERE status = 'Очікує сплати'
      AND issued_at < now() - interval '30 days'
    RETURNING count(*) INTO v_count;

    RETURN v_count;
END;
$$;

-- Або тригер при SELECT (матеріалізований view з refresh)
```

**Аргументація:**
- Штрафи не повинні висіти безкінечно
- 30 днів - стандартний термін оплати
- Дозволяє відстежувати неплатників

---

### 2.2 Аналітичні функції (обґрунтовані)

#### 2.2.1 Ефективність водіїв з PERCENTILE та LAG

**Проблема:** Менеджер/бухгалтер хочуть бачити продуктивність водіїв порівняно з іншими.

```sql
CREATE OR REPLACE FUNCTION accountant_api.get_driver_efficiency(
    p_from date,
    p_to date
)
RETURNS TABLE (
    driver_id bigint,
    driver_name text,
    total_trips integer,
    total_passengers integer,
    avg_passengers_per_trip numeric,
    total_hours numeric,
    efficiency_rank integer,
    percentile integer,  -- Який відсоток водіїв гірші
    vs_prev_month_pct numeric  -- Зміна порівняно з попереднім місяцем
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
WITH driver_stats AS (
    SELECT
        d.id AS driver_id,
        d.full_name AS driver_name,
        COUNT(t.id)::integer AS total_trips,
        SUM(t.passenger_count)::integer AS total_passengers,
        ROUND(AVG(t.passenger_count), 1) AS avg_passengers_per_trip,
        ROUND(SUM(EXTRACT(EPOCH FROM (t.actual_ends_at - t.actual_starts_at)) / 3600.0), 1) AS total_hours
    FROM public.drivers d
    LEFT JOIN public.trips t ON t.driver_id = d.id
        AND t.status = 'completed'
        AND t.actual_starts_at BETWEEN p_from AND p_to + 1
    GROUP BY d.id, d.full_name
),
prev_month AS (
    SELECT
        t.driver_id,
        SUM(t.passenger_count)::integer AS prev_passengers
    FROM public.trips t
    WHERE t.status = 'completed'
      AND t.actual_starts_at BETWEEN (p_from - interval '1 month')::date
                                  AND p_from
    GROUP BY t.driver_id
),
ranked AS (
    SELECT
        ds.*,
        RANK() OVER (ORDER BY ds.total_passengers DESC NULLS LAST)::integer AS efficiency_rank,
        PERCENT_RANK() OVER (ORDER BY ds.total_passengers)::numeric * 100 AS percentile_raw,
        pm.prev_passengers
    FROM driver_stats ds
    LEFT JOIN prev_month pm ON pm.driver_id = ds.driver_id
)
SELECT
    driver_id,
    driver_name,
    total_trips,
    total_passengers,
    avg_passengers_per_trip,
    total_hours,
    efficiency_rank,
    ROUND(percentile_raw)::integer AS percentile,
    CASE
        WHEN prev_passengers > 0 THEN
            ROUND(((total_passengers - prev_passengers)::numeric / prev_passengers) * 100, 1)
        ELSE NULL
    END AS vs_prev_month_pct
FROM ranked
ORDER BY efficiency_rank;
$$;
```

**Аргументація:**
- `RANK()` - порівняння водіїв між собою
- `PERCENT_RANK()` - показує позицію у відсотках (топ 10%, топ 50%)
- Порівняння з минулим місяцем показує динаміку

---

#### 2.2.2 Аналіз затримок рейсів з накопиченням

**Проблема:** Диспетчер хоче бачити патерни затримок для оптимізації розкладу.

```sql
CREATE OR REPLACE FUNCTION dispatcher_api.get_delay_analytics(
    p_from date,
    p_to date,
    p_route_id bigint DEFAULT NULL
)
RETURNS TABLE (
    trip_date date,
    route_number text,
    transport_type text,
    avg_delay_min numeric,
    max_delay_min numeric,
    on_time_pct numeric,  -- % рейсів вчасно (±5 хв)
    delay_trend numeric,  -- Тренд: зростає чи зменшується
    cumulative_delay_min numeric  -- Накопичена затримка
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
WITH daily_delays AS (
    SELECT
        t.actual_starts_at::date AS trip_date,
        r.number AS route_number,
        tt.name AS transport_type,
        t.route_id,
        EXTRACT(EPOCH FROM (t.actual_starts_at - t.planned_starts_at)) / 60.0 AS delay_min
    FROM public.trips t
    JOIN public.routes r ON r.id = t.route_id
    JOIN public.transport_types tt ON tt.id = r.transport_type_id
    WHERE t.status = 'completed'
      AND t.actual_starts_at IS NOT NULL
      AND t.actual_starts_at BETWEEN p_from AND p_to + 1
      AND (p_route_id IS NULL OR t.route_id = p_route_id)
),
aggregated AS (
    SELECT
        trip_date,
        route_number,
        transport_type,
        ROUND(AVG(delay_min), 1) AS avg_delay_min,
        ROUND(MAX(delay_min), 1) AS max_delay_min,
        ROUND(COUNT(*) FILTER (WHERE ABS(delay_min) <= 5)::numeric / COUNT(*) * 100, 1) AS on_time_pct
    FROM daily_delays
    GROUP BY trip_date, route_number, transport_type
)
SELECT
    trip_date,
    route_number,
    transport_type,
    avg_delay_min,
    max_delay_min,
    on_time_pct,
    -- Тренд: різниця з попереднім днем
    avg_delay_min - LAG(avg_delay_min) OVER (
        PARTITION BY route_number
        ORDER BY trip_date
    ) AS delay_trend,
    -- Кумулятивна затримка
    SUM(avg_delay_min) OVER (
        PARTITION BY route_number
        ORDER BY trip_date
    ) AS cumulative_delay_min
FROM aggregated
ORDER BY trip_date DESC, route_number;
$$;
```

**Аргументація:**
- `LAG()` показує чи ситуація покращується/погіршується
- `SUM() OVER` накопичує затримки для виявлення проблемних маршрутів
- `FILTER (WHERE)` рахує % вчасних рейсів

---

#### 2.2.3 Когортний аналіз пасажирів

**Проблема:** Муніципалітет хоче бачити retention пасажирів по місяцях.

```sql
CREATE OR REPLACE FUNCTION municipality_api.get_passenger_cohort_analysis(
    p_from date,
    p_to date
)
RETURNS TABLE (
    registration_month date,
    cohort_size integer,
    month_1_active integer,
    month_2_active integer,
    month_3_active integer,
    month_1_retention_pct numeric,
    month_2_retention_pct numeric,
    month_3_retention_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
WITH cohorts AS (
    SELECT
        date_trunc('month', u.registered_at)::date AS registration_month,
        u.id AS user_id
    FROM public.users u
    WHERE u.registered_at BETWEEN p_from AND p_to + 1
),
activity AS (
    SELECT
        tc.user_id,
        date_trunc('month', t.purchased_at)::date AS activity_month
    FROM public.tickets t
    JOIN public.transport_cards tc ON tc.id = t.card_id
    GROUP BY tc.user_id, date_trunc('month', t.purchased_at)::date
),
cohort_activity AS (
    SELECT
        c.registration_month,
        c.user_id,
        EXTRACT(MONTH FROM age(a.activity_month, c.registration_month))::integer AS months_since_reg
    FROM cohorts c
    LEFT JOIN activity a ON a.user_id = c.user_id
        AND a.activity_month >= c.registration_month
)
SELECT
    registration_month,
    COUNT(DISTINCT user_id)::integer AS cohort_size,
    COUNT(DISTINCT user_id) FILTER (WHERE months_since_reg = 1)::integer AS month_1_active,
    COUNT(DISTINCT user_id) FILTER (WHERE months_since_reg = 2)::integer AS month_2_active,
    COUNT(DISTINCT user_id) FILTER (WHERE months_since_reg = 3)::integer AS month_3_active,
    ROUND(COUNT(DISTINCT user_id) FILTER (WHERE months_since_reg = 1)::numeric
        / NULLIF(COUNT(DISTINCT user_id), 0) * 100, 1) AS month_1_retention_pct,
    ROUND(COUNT(DISTINCT user_id) FILTER (WHERE months_since_reg = 2)::numeric
        / NULLIF(COUNT(DISTINCT user_id), 0) * 100, 1) AS month_2_retention_pct,
    ROUND(COUNT(DISTINCT user_id) FILTER (WHERE months_since_reg = 3)::numeric
        / NULLIF(COUNT(DISTINCT user_id), 0) * 100, 1) AS month_3_retention_pct
FROM cohort_activity
GROUP BY registration_month
ORDER BY registration_month;
$$;
```

**Аргументація:**
- Показує скільки нових пасажирів продовжують користуватися транспортом
- Дозволяє оцінити ефективність маркетингових кампаній
- Стандартний продуктовий метрика для SaaS/сервісів

---

#### 2.2.4 Прогнозування завантаженості маршрутів

**Проблема:** Диспетчер хоче знати очікувану завантаженість для планування.

```sql
CREATE OR REPLACE FUNCTION dispatcher_api.predict_route_load(
    p_route_id bigint,
    p_date date,
    p_hour integer
)
RETURNS TABLE (
    predicted_passengers integer,
    confidence_pct numeric,
    historical_avg numeric,
    historical_stddev numeric,
    similar_days_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
WITH historical AS (
    SELECT
        EXTRACT(DOW FROM t.actual_starts_at)::integer AS day_of_week,
        EXTRACT(HOUR FROM t.actual_starts_at)::integer AS hour_of_day,
        t.passenger_count
    FROM public.trips t
    WHERE t.route_id = p_route_id
      AND t.status = 'completed'
      AND t.actual_starts_at >= now() - interval '3 months'
),
similar_conditions AS (
    SELECT passenger_count
    FROM historical
    WHERE day_of_week = EXTRACT(DOW FROM p_date)::integer
      AND hour_of_day = p_hour
)
SELECT
    ROUND(AVG(passenger_count))::integer AS predicted_passengers,
    -- Confidence based on sample size and variance
    CASE
        WHEN COUNT(*) >= 10 AND STDDEV(passenger_count) < AVG(passenger_count) * 0.3 THEN 90
        WHEN COUNT(*) >= 5 THEN 70
        WHEN COUNT(*) >= 2 THEN 50
        ELSE 30
    END::numeric AS confidence_pct,
    ROUND(AVG(passenger_count), 1) AS historical_avg,
    ROUND(STDDEV(passenger_count), 1) AS historical_stddev,
    COUNT(*)::integer AS similar_days_count
FROM similar_conditions;
$$;
```

**Аргументація:**
- Базовий прогноз на основі історичних даних
- Враховує день тижня та годину
- Показує рівень довіри до прогнозу

---

### 2.3 Індекси для продуктивності

```sql
-- Для аналітики пасажиропотоку (частий запит по даті та статусу)
CREATE INDEX IF NOT EXISTS idx_trips_completed_date
ON public.trips (actual_starts_at::date)
WHERE status = 'completed';

-- Для пошуку штрафів користувача
CREATE INDEX IF NOT EXISTS idx_fines_user_status
ON public.fines (user_id, status);

-- Для GPS логів транспорту (часові запити)
CREATE INDEX IF NOT EXISTS idx_vehicle_gps_recorded
ON public.vehicle_gps_logs (vehicle_id, recorded_at DESC);

-- Для скарг по даті (сортування в дашборді)
CREATE INDEX IF NOT EXISTS idx_complaints_created
ON public.complaints_suggestions (created_at DESC);

-- GiST індекс для географічних запитів (якщо багато запитів nearby)
CREATE INDEX IF NOT EXISTS idx_stops_geom
ON public.stops USING GIST (
    ST_SetSRID(ST_MakePoint(lon::float8, lat::float8), 4326)::geography
);
```

---

### 2.4 Materialized Views для важких звітів

```sql
-- Щоденний звіт з кешуванням (оновлювати раз на годину)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_summary AS
SELECT
    t.actual_starts_at::date AS report_date,
    COUNT(DISTINCT t.id) AS total_trips,
    SUM(t.passenger_count) AS total_passengers,
    COUNT(DISTINCT t.driver_id) AS active_drivers,
    (SELECT SUM(price) FROM public.tickets WHERE purchased_at::date = t.actual_starts_at::date) AS ticket_revenue
FROM public.trips t
WHERE t.status = 'completed'
GROUP BY t.actual_starts_at::date
ORDER BY report_date DESC;

CREATE UNIQUE INDEX ON mv_daily_summary (report_date);

-- Оновлення через pg_cron або вручну
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_summary;
```

**Аргументація:**
- Важкі агрегації не блокують основні таблиці
- Dashboard завантажується миттєво
- `CONCURRENTLY` дозволяє читати під час оновлення

---

## Підсумок рекомендацій

| Категорія | Покращення | Пріоритет | Аргументація |
|-----------|------------|-----------|--------------|
| Тригер | Оновлення бюджету при витратах | Високий | План/факт в одному місці |
| Тригер | Створення картки при реєстрації | Середній | Спрощення UX |
| Тригер | Прострочення штрафів | Середній | Автоматизація бізнес-правил |
| Аналітика | Ефективність водіїв (RANK, PERCENT_RANK) | Високий | KPI для менеджменту |
| Аналітика | Затримки рейсів (LAG, SUM OVER) | Високий | Оптимізація розкладу |
| Аналітика | Когортний аналіз | Низький | Retention метрики |
| Аналітика | Прогнозування завантаженості | Низький | Планування ресурсів |
| Індекс | trips по даті та статусу | Високий | Прискорення звітів |
| Індекс | GiST для географії | Середній | Прискорення nearby |
| MV | Щоденний звіт | Середній | Швидкий dashboard |

Всі покращення логічно обґрунтовані та вирішують конкретні бізнес-задачі, а не додані "для галочки".
