# Аналіз програмної моделі застосунку "Міський транспорт"

## 1. BACKEND (NestJS)

### 1.1 Дерево каталогів

```
backend/
├── drizzle/                              # SQL-міграції (11 файлів)
│   ├── 0000_init.sql                     # Створення таблиць
│   ├── 0001_api_structure.sql            # Схеми API, RLS
│   ├── 0002_guest_api.sql                # Views/функції для гостя
│   ├── 0003_passenger_api.sql            # Views/функції для пасажира
│   ├── 0004_operational_api.sql          # API для водія
│   ├── 0005_dispatcher_api.sql           # API для диспетчера
│   ├── 0006_accountant_api.sql           # API для бухгалтера
│   ├── 0007_manager_api.sql              # API для менеджера
│   ├── 0008_municipality_api.sql         # API для муніципалітету
│   ├── 0009_controller_api.sql           # API для контролера
│   └── 0010_security_hardening.sql       # Фінальне затягування прав
├── src/
│   ├── common/
│   │   ├── filters/                      # Exception filters
│   │   ├── interceptors/                 # Response interceptors
│   │   ├── session/                      # Redis, сесії, контекст
│   │   │   ├── redis.service.ts
│   │   │   ├── session.service.ts
│   │   │   ├── request-context.service.ts
│   │   │   └── auth-session.middleware.ts
│   │   ├── utils/                        # Допоміжні функції
│   │   └── validators/                   # Custom validators
│   ├── db/
│   │   ├── schema/                       # Drizzle ORM схеми (24 таблиці)
│   │   ├── db.module.ts
│   │   ├── db.service.ts                 # Динамічні пули підключень
│   │   └── schema.ts                     # Експорт усіх схем
│   ├── modules/                          # CRUD-модулі (24 модулі)
│   │   ├── auth/
│   │   ├── users/
│   │   ├── drivers/
│   │   ├── vehicles/
│   │   ├── routes/
│   │   ├── stops/
│   │   ├── trips/
│   │   ├── schedules/
│   │   ├── fines/
│   │   ├── budgets/
│   │   └── ... (ще 14 модулів)
│   └── roles/                            # Рольові API-модулі (8 модулів)
│       ├── ct-guest/
│       ├── ct-passenger/
│       ├── ct-driver/
│       ├── ct-controller/
│       ├── ct-dispatcher/
│       ├── ct-manager/
│       ├── ct-accountant/
│       └── ct-municipality/
└── test/                                 # E2E тести
```

### 1.2 CRUD-модулі (modules/)

| Модуль | Контролер | Сервіс | Призначення |
|--------|-----------|--------|-------------|
| auth | AuthController | AuthService | Реєстрація, логін, логаут |
| users | UsersController | UsersService | CRUD користувачів (пасажирів) |
| drivers | DriversController | DriversService | CRUD водіїв |
| vehicles | VehiclesController | VehiclesService | CRUD транспортних засобів |
| routes | RoutesController | RoutesService | CRUD маршрутів |
| stops | StopsController | StopsService | CRUD зупинок |
| route-stops | RouteStopsController | RouteStopsService | Зв'язок маршрут-зупинка |
| route-points | RoutePointsController | RoutePointsService | GPS-точки геометрії |
| schedules | SchedulesController | SchedulesService | Розклади руху |
| trips | TripsController | TripsService | Рейси |
| transport-cards | TransportCardsController | TransportCardsService | Транспортні картки |
| card-top-ups | CardTopUpsController | CardTopUpsService | Поповнення карток |
| tickets | TicketsController | TicketsService | Квитки |
| fines | FinesController | FinesService | Штрафи |
| fine-appeals | FineAppealsController | FineAppealsService | Апеляції на штрафи |
| complaints-suggestions | ComplaintsSuggestionsController | ComplaintsSuggestionsService | Скарги та пропозиції |
| budgets | BudgetsController | BudgetsService | Бюджети (план/факт) |
| incomes | IncomesController | IncomesService | Доходи |
| expenses | ExpensesController | ExpensesService | Витрати |
| salary-payments | SalaryPaymentsController | SalaryPaymentsService | Виплати зарплат |
| driver-vehicle-assignments | DriverVehicleAssignmentsController | DriverVehicleAssignmentsService | Призначення водіїв |
| user-gps-logs | UserGpsLogsController | UserGpsLogsService | GPS-логи користувачів |
| vehicle-gps-logs | VehicleGpsLogsController | VehicleGpsLogsService | GPS-логи транспорту |
| transport-types | TransportTypesController | TransportTypesService | Типи транспорту |

### 1.3 Рольові модулі (roles/)

| Модуль | Контролер | Сервіс | Призначення |
|--------|-----------|--------|-------------|
| **ct-guest** | CtGuestController | CtGuestService | Публічний API: маршрути, зупинки, розклади, карта, подача скарг без авторизації |
| **ct-passenger** | CtPassengerController | CtPassengerService | Особистий кабінет: профіль, картка, баланс, поїздки, штрафи, апеляції, поповнення |
| **ct-driver** | CtDriverController | CtDriverService | Робоче місце водія: розклад, старт/стоп рейсу, GPS-трекінг, кількість пасажирів |
| **ct-controller** | CtControllerController | CtControllerService | Перевірка карток пасажирів, виписування штрафів, прив'язка до рейсу |
| **ct-dispatcher** | CtDispatcherController | CtDispatcherService | Управління: рейси, розклади, призначення водіїв, моніторинг, відхилення |
| **ct-manager** | CtManagerController | CtManagerService | Кадри: найм водіїв, додавання транспорту, створення акаунтів персоналу |
| **ct-accountant** | CtAccountantController | CtAccountantService | Фінанси: доходи, витрати, зарплати водіям, бюджети, фінансові звіти |
| **ct-municipality** | CtMunicipalityController | CtMunicipalityService | Планування: зупинки, маршрути, аналітика пасажиропотоку, обробка скарг |

### 1.4 Автентифікація

#### Процес логіну

```
1. POST /auth/login { login, password }
          │
          ▼
2. AuthService підключається до PostgreSQL
   з credentials користувача:
   ┌────────────────────────────────────┐
   │ const client = new Client({       │
   │   user: payload.login,            │
   │   password: payload.password      │
   │ });                                │
   │ await client.connect();           │
   └────────────────────────────────────┘
   Якщо невірні credentials → UnauthorizedException
          │
          ▼
3. Отримання ролей через pg_has_role():
   ┌────────────────────────────────────┐
   │ SELECT rolname FROM pg_roles      │
   │ WHERE pg_has_role(current_user,   │
   │       oid, 'member')              │
   │   AND rolname LIKE 'ct_%';        │
   └────────────────────────────────────┘
   Результат: ['ct_passenger_role'] або
              ['ct_dispatcher_role', 'ct_driver_role']
          │
          ▼
4. Збереження сесії в Redis:
   ┌────────────────────────────────────┐
   │ Key: ct:session:<uuid>            │
   │ Value: {                          │
   │   login: "passenger1",            │
   │   password: "***",                │
   │   roles: ["ct_passenger_role"],   │
   │   user: { id, fullName, email }   │
   │ }                                 │
   │ TTL: 6 годин (21600 секунд)       │
   └────────────────────────────────────┘
          │
          ▼
5. Відповідь клієнту:
   { token: "<uuid>", roles: [...], expiresIn: 21600 }
```

#### Що зберігається в Redis

```typescript
type AuthSession = {
  login: string;      // PostgreSQL login (роль)
  password: string;   // Пароль (для створення пулу)
  roles: string[];    // Масив ролей ct_*_role
  user: {
    id: number;
    login: string;
    fullName: string;
    email: string;
    phone: string;
    registeredAt: string;
  } | null;
};
```

#### Формування контексту ролі

```
Кожен HTTP-запит проходить через AuthSessionMiddleware:

1. Витягує токен з Authorization: Bearer <token>
2. Завантажує сесію з Redis
3. Зберігає в AsyncLocalStorage (RequestContextService)
4. DbService бере сесію з контексту і створює Pool
   з user=session.login, password=session.password
```

### 1.5 Доступ до PostgreSQL

#### Архітектура "Thick Database"

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL                               │
├─────────────────────────────────────────────────────────────┤
│  Схема: public                                              │
│  ├── users, drivers, vehicles, routes, ...                  │
│  └── Власник: ct_migrator                                   │
│      НІХТО крім ct_migrator не має прямого доступу!         │
├─────────────────────────────────────────────────────────────┤
│  Схема: guest_api                                           │
│  ├── v_routes (VIEW)                                        │
│  ├── v_stops (VIEW)                                         │
│  ├── get_schedule() (FUNCTION)                              │
│  └── Доступ: ct_guest_role + всі інші ролі                  │
├─────────────────────────────────────────────────────────────┤
│  Схема: passenger_api                                       │
│  ├── v_my_cards (VIEW with security_barrier)                │
│  ├── v_my_trips (VIEW with security_barrier)                │
│  ├── v_my_fines (VIEW with security_barrier)                │
│  ├── top_up_card() (SECURITY DEFINER)                       │
│  ├── pay_fine() (SECURITY DEFINER)                          │
│  └── Доступ: тільки ct_passenger_role                       │
├─────────────────────────────────────────────────────────────┤
│  Схема: driver_api                                          │
│  ├── v_my_schedule (VIEW)                                   │
│  ├── start_trip() (SECURITY DEFINER)                        │
│  ├── finish_trip() (SECURITY DEFINER)                       │
│  ├── log_gps() (SECURITY DEFINER)                           │
│  └── Доступ: тільки ct_driver_role                          │
├─────────────────────────────────────────────────────────────┤
│  ... аналогічно для dispatcher_api, manager_api,            │
│      accountant_api, municipality_api, controller_api       │
└─────────────────────────────────────────────────────────────┘
```

#### PostgreSQL ролі (групові)

```sql
-- Групові ролі (NOLOGIN) - визначають права
ct_guest_role       -- Публічний доступ
ct_passenger_role   -- Пасажири
ct_driver_role      -- Водії
ct_controller_role  -- Контролери
ct_dispatcher_role  -- Диспетчери
ct_manager_role     -- Менеджери
ct_accountant_role  -- Бухгалтери
ct_municipality_role -- Муніципалітет

-- Користувачі (LOGIN) - наслідують групові ролі
passenger1 ← MEMBER OF ct_passenger_role
driver1    ← MEMBER OF ct_driver_role
dispatcher1 ← MEMBER OF ct_dispatcher_role
```

#### Приклад VIEW з security_barrier

```sql
CREATE OR REPLACE VIEW passenger_api.v_my_fines
WITH (security_barrier = true) AS
SELECT f.id, f.amount, f.reason, f.status, f.issued_at
FROM public.fines f
JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;  -- Фільтр по поточному користувачу
```

#### Приклад SECURITY DEFINER функції

```sql
CREATE OR REPLACE FUNCTION passenger_api.pay_fine(p_fine_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER           -- Виконується з правами ct_migrator
SET search_path = public   -- Захист від SQL injection
AS $$
DECLARE
    v_user_id bigint;
BEGIN
    -- Перевірка що штраф належить поточному користувачу
    SELECT id INTO v_user_id FROM users WHERE login = session_user;

    IF NOT EXISTS (SELECT 1 FROM fines WHERE id = p_fine_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Fine not found or access denied';
    END IF;

    UPDATE fines SET status = 'Оплачено' WHERE id = p_fine_id;
END;
$$;
```

#### Динамічні пули підключень (DbService)

```typescript
// backend/src/db/db.service.ts
get db() {
  const session = this.contextService.get();

  // Якщо немає сесії - використовуємо базовий пул (ct_migrator)
  if (!session?.login) return this.baseDb;

  // Шукаємо кешований пул для користувача
  const cached = this.userPools.get(session.login);
  if (cached) return cached.db;

  // Створюємо новий пул під логіном користувача
  const pool = new Pool({
    user: session.login,      // passenger1, driver1, ...
    password: session.password,
    host: this.baseConfig.host,
    database: this.baseConfig.database
  });

  this.userPools.set(session.login, { pool, db: drizzle(pool) });
  return drizzle(pool);
}
```

---

## 2. FRONTEND (React + Vite)

### 2.1 Дерево каталогів

```
frontend/
├── public/                               # Статичні ресурси
├── src/
│   ├── assets/                           # Зображення, іконки
│   ├── components/
│   │   ├── domain/                       # Бізнес-компоненти
│   │   │   ├── data-display/             # Таблиці, картки
│   │   │   ├── dispatcher/               # Компоненти диспетчера
│   │   │   ├── forms/                    # Форми
│   │   │   ├── map/                      # Карта
│   │   │   ├── municipality/             # Компоненти муніципалітету
│   │   │   ├── schedule/                 # Розклади
│   │   │   ├── stats/                    # Статистика
│   │   │   ├── transport/                # Транспорт
│   │   │   └── trip/                     # Рейси
│   │   ├── route-planner/                # Планувальник маршрутів
│   │   └── ui/                           # shadcn/ui компоненти
│   ├── hooks/                            # Custom React hooks
│   ├── lib/
│   │   ├── api.ts                        # Базовий Axios wrapper
│   │   ├── guest-api.ts                  # API для гостя
│   │   ├── passenger-api.ts              # API для пасажира
│   │   ├── driver-api.ts                 # API для водія
│   │   ├── controller-api.ts             # API для контролера
│   │   ├── dispatcher-api.ts             # API для диспетчера
│   │   ├── manager-api.ts                # API для менеджера
│   │   ├── accountant-api.ts             # API для бухгалтера
│   │   ├── municipality-api.ts           # API для муніципалітету
│   │   ├── map-colors.ts                 # Кольори маршрутів
│   │   ├── route-utils.ts                # Утиліти маршрутів
│   │   └── toast.ts                      # Сповіщення
│   └── routes/                           # TanStack Router сторінки
│       ├── __root.tsx                    # Кореневий layout
│       ├── index.tsx                     # / - Головна
│       ├── login.tsx                     # /login
│       ├── register.tsx                  # /register
│       ├── map.tsx                       # /map
│       ├── contacts.tsx                  # /contacts
│       ├── passenger/                    # /passenger/*
│       │   ├── route.tsx                 # Layout
│       │   └── index.tsx                 # Dashboard
│       ├── driver.tsx                    # /driver
│       ├── controller.tsx                # /controller
│       ├── dispatcher.tsx                # /dispatcher
│       ├── manager.tsx                   # /manager
│       ├── accountant.tsx                # /accountant
│       └── municipality.tsx              # /municipality
└── .tanstack/                            # TanStack Router cache
```

### 2.2 Роут-групи TanStack Router

#### Публічні сторінки (без авторизації)

| Роут | Файл | Функціонал |
|------|------|------------|
| `/` | `index.tsx` | Головна: статистика, hero section, CTA |
| `/map` | `map.tsx` | Інтерактивна карта: маршрути, зупинки, планування |
| `/contacts` | `contacts.tsx` | FAQ, контакти, форма скарги |
| `/login` | `login.tsx` | Авторизація |
| `/register` | `register.tsx` | Реєстрація пасажира |

#### Пасажир (`ct_passenger_role`)

| Роут | Функціонал |
|------|------------|
| `/passenger` | Особистий кабінет: профіль, картка, баланс |
| | Історія поїздок (квитки) |
| | Список штрафів, оплата, апеляції |
| | Поповнення картки |

#### Водій (`ct_driver_role`)

| Роут | Вкладки |
|------|---------|
| `/driver` | **Огляд**: профіль, активний рейс, статистика |
| | **Розклад**: рейси на обрану дату |
| | **Управління**: вибір маршруту, старт/стоп, пасажири |
| | **Карта**: GPS-трекінг, зупинки маршруту |

#### Контролер (`ct_controller_role`)

| Роут | Кроки |
|------|-------|
| `/controller` | **Крок 1**: Вибір транспорту (маршрут → бортовий номер) |
| | **Крок 2**: Перевірка картки (номер → баланс, валідність) |
| | **Крок 3**: Виписування штрафу (сума, причина) |

#### Диспетчер (`ct_dispatcher_role`)

| Роут | Вкладки |
|------|---------|
| `/dispatcher` | **Огляд**: dashboard, активні рейси/водії/транспорт |
| | **Рейси**: список, створення, генерація, скасування |
| | **Розклади**: CRUD розкладів |
| | **Призначення**: водій → транспорт |
| | **Моніторинг**: real-time карта, статус рейсів |
| | **Відхилення**: alerts, порушення графіку |

#### Менеджер (`ct_manager_role`)

| Роут | Вкладки |
|------|---------|
| `/manager` | **Водії**: список, найм нового водія |
| | **Транспорт**: список, додавання транспорту |
| | **Персонал**: створення акаунтів (диспетчер, контролер, ...) |

#### Бухгалтер (`ct_accountant_role`)

| Роут | Вкладки |
|------|---------|
| `/accountant` | **Аналітика**: dashboard, ключові показники |
| | **Доходи**: government, tickets, fines, other |
| | **Зарплати**: виплати водіям |
| | **Витрати**: пальне, ремонт, запчастини, страховка |
| | **Звіт**: план/факт, період |

#### Муніципалітет (`ct_municipality_role`)

| Роут | Вкладки |
|------|---------|
| `/municipality` | **Зупинки**: CRUD, координати |
| | **Проектування**: конструктор маршрутів |
| | **Маршрути**: список, активація/деактивація |
| | **Аналітика**: пасажиропотік, топ маршрутів |
| | **Скарги**: обробка звернень |

### 2.3 Організація API-клієнтів

```
frontend/src/lib/
├── api.ts              # Базовий Axios instance + interceptors
│                       # - Додає Authorization: Bearer <token>
│                       # - ApiError клас для обробки помилок
│
├── guest-api.ts        # Публічний API (без авторизації)
│   ├── getTransportTypes()
│   ├── getRoutes()
│   ├── getStopsNear(lon, lat, radius)
│   ├── getRouteStops(routeId)
│   ├── getSchedule(routeId, stopId)
│   └── submitComplaint(data)
│
├── passenger-api.ts    # API пасажира
│   ├── getProfile()
│   ├── getCard()
│   ├── topUpCard(cardNumber, amount)
│   ├── getTrips()
│   ├── getFines()
│   ├── payFine(fineId)
│   └── createAppeal(fineId, message)
│
├── driver-api.ts       # API водія
│   ├── getProfile()
│   ├── getSchedule(date)
│   ├── getActiveTrip()
│   ├── startTrip(tripId)
│   ├── finishTrip(tripId, passengerCount)
│   └── logGps(lon, lat)
│
├── controller-api.ts   # API контролера
│   ├── getVehicles(routeId?)
│   ├── getActiveTrips(fleetNumber)
│   ├── checkCard(cardNumber)
│   └── issueFine(data)
│
├── dispatcher-api.ts   # API диспетчера
│   ├── getDashboard()
│   ├── getSchedules() / createSchedule() / updateSchedule()
│   ├── getTrips() / createTrip() / generateTrips()
│   ├── getAssignments() / assignDriver()
│   ├── getActiveTrips()
│   └── monitorVehicle(fleetNumber)
│
├── manager-api.ts      # API менеджера
│   ├── getDrivers() / hireDriver()
│   ├── getVehicles() / addVehicle()
│   └── createStaffUser()
│
├── accountant-api.ts   # API бухгалтера
│   ├── getBudgets() / upsertBudget()
│   ├── getIncomes() / createIncome()
│   ├── getExpenses() / createExpense()
│   ├── getSalaries() / createSalary()
│   └── getReport(from, to)
│
└── municipality-api.ts # API муніципалітету
    ├── getStops() / createStop() / updateStop()
    ├── getRoutes() / createRoute() / setRouteActive()
    ├── getPassengerFlow() / getTopRoutes()
    └── getComplaints() / updateComplaintStatus()
```

### 2.4 Ключові бібліотеки

| Бібліотека | Версія | Використання |
|------------|--------|--------------|
| **React** | 19 | UI framework |
| **TanStack Router** | 1.x | File-based routing, type-safe |
| **TanStack Query** | 5.x | Server state: useQuery, useMutation, кешування |
| **Zustand** | 5.x | Auth store (persisted to localStorage) |
| **MapLibre GL** | 5.x | Інтерактивна карта в `/map`, `/driver`, `/dispatcher` |
| **Recharts** | 2.x | Графіки в `/accountant`, `/municipality` |
| **react-hook-form** | 7.x | Форми з валідацією (zod) |
| **shadcn/ui** | - | UI компоненти (Radix + Tailwind) |
| **Tailwind CSS** | 4.x | Стилізація |
| **Axios** | 1.x | HTTP клієнт |

#### Де використовуються

- **TanStack Query**: усі сторінки для `useQuery` (GET) та `useMutation` (POST/PATCH/DELETE)
- **MapLibre GL**: `/map` (публічна карта), `/driver` (карта маршруту), `/dispatcher` (моніторинг)
- **Recharts**: `/accountant` (фінансові графіки), `/municipality` (аналітика пасажиропотоку)
- **Zustand**: `useAuthStore()` — зберігає `{ token, roles, user }` в localStorage

---

## 3. ТЕКСТ ДЛЯ ПОЯСНЮВАЛЬНОЇ ЗАПИСКИ

### МОДЕЛЬ ПРОГРАМНОГО ЗАСТОСУНКУ

Інформаційна система управління міським транспортом реалізована як клієнт-серверний веб-застосунок із використанням архітектури REST API. Серверна частина побудована на фреймворку NestJS (Node.js), а клієнтська — на React із використанням TanStack Router для маршрутизації та TanStack Query для управління станом даних.

**Архітектура серверної частини.** Backend організований за модульним принципом із чітким розділенням відповідальностей. Виділено два типи модулів:

1) *CRUD-модулі* (`src/modules/`) — інкапсулюють базову логіку роботи з сутностями бази даних. Кожен з 24 модулів містить схему Drizzle ORM, контролер з REST-ендпоінтами та сервіс з бізнес-логікою. Приклади: users, drivers, vehicles, routes, trips, fines, budgets.

2) *Рольові модулі* (`src/roles/`) — реалізують специфічну бізнес-логіку для кожної з 8 ролей системи: ct-guest (публічний доступ), ct-passenger (пасажири), ct-driver (водії), ct-controller (контролери), ct-dispatcher (диспетчери), ct-manager (менеджери), ct-accountant (бухгалтери), ct-municipality (представники муніципалітету). Структура рольового модуля показана на рисунку 5.1.

**[Рис. 5.1 — UML-діаграма класів рольового модуля ct-dispatcher]**

Кожен рольовий модуль складається з трьох компонентів: контролера, що визначає HTTP-ендпоінти та валідує вхідні дані через DTO-класи; сервісу, що містить бізнес-логіку та взаємодіє з базою даних; модуля NestJS, що реєструє залежності. Сервіс отримує доступ до бази даних через DbService, який динамічно створює пули підключень під обліковим записом поточного користувача.

**Механізм автентифікації.** Система використовує унікальний підхід — кожен користувач є реальною роллю PostgreSQL. При авторизації система підключається до бази даних з credentials користувача, отримує список його ролей через системну функцію pg_has_role(), та зберігає сесію в Redis із TTL 6 годин. Сесія містить логін, пароль (для створення пулу підключень), масив ролей та базову інформацію про користувача. Подальші запити виконуються від імені PostgreSQL-користувача, що забезпечує контроль доступу на рівні СУБД.

**Архітектура бази даних.** Застосовано патерн "Thick Database" з розділенням на схеми. Таблиці розміщені в схемі public і належать службовому користувачу ct_migrator. Жодна бізнес-роль не має прямого доступу до таблиць. Для кожної ролі створено окрему API-схему (guest_api, passenger_api, driver_api тощо), що містить:
- VIEW з атрибутом security_barrier для читання даних з фільтрацією по session_user;
- SECURITY DEFINER функції для мутацій, що виконуються з правами ct_migrator після валідації прав доступу.

Такий підхід забезпечує row-level security без використання RLS-політик, з повним контролем логіки доступу в коді функцій.

**Архітектура клієнтської частини.** Frontend реалізований як Single Page Application на React 19 із file-based routing через TanStack Router. Для кожної ролі створено окрему сторінку з табами або кроками. API-клієнти організовані в окремі модулі за ролями (guest-api.ts, passenger-api.ts, driver-api.ts тощо), що типізують запити та відповіді.

Ієрархія сторінок клієнтського застосунку показана на рисунку 5.2.

**[Рис. 5.2 — Ієрархія сторінок (роутів) клієнтського застосунку]**

Публічна зона включає головну сторінку, інтерактивну карту маршрутів (MapLibre GL), сторінку контактів з FAQ та формою скарги, а також сторінки авторизації та реєстрації. Після входу користувач перенаправляється на відповідний dashboard залежно від ролі. Наприклад, диспетчер отримує доступ до шести вкладок: огляд (dashboard), рейси, розклади, призначення водіїв, моніторинг транспорту в реальному часі та відхилення від графіку.

**Технологічні особливості:**
- GPS-трекінг транспорту в реальному часі з автоматичним оновленням кожні 30 секунд;
- кластеризація зупинок на карті для оптимізації рендерингу;
- автоматична генерація рейсів на основі розкладів;
- аналітика пасажиропотоку з візуалізацією через Recharts;
- оптимістичні оновлення UI через TanStack Query mutations.
