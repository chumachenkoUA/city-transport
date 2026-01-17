# Аналіз структури репозиторію проєкту "Міський транспорт"

## 1. Дерево каталогів

### Backend (NestJS)

```
backend/
├── drizzle/                    # SQL-міграції
│   └── meta/                   # Метадані міграцій
├── scripts/                    # Утиліти (seed, etc.)
├── src/
│   ├── common/
│   │   ├── filters/            # Exception filters
│   │   ├── interceptors/       # Response interceptors
│   │   ├── session/            # Сесії, Redis, контекст запиту
│   │   ├── utils/              # Допоміжні функції
│   │   └── validators/         # Custom validators
│   ├── db/
│   │   ├── schema/             # Drizzle ORM схеми (24 таблиці)
│   │   ├── db.module.ts
│   │   ├── db.service.ts       # Пули підключень по ролях
│   │   └── schema.ts           # Експорт усіх схем
│   ├── modules/                # CRUD-модулі сутностей
│   │   ├── auth/
│   │   ├── budgets/
│   │   ├── drivers/
│   │   ├── expenses/
│   │   ├── fines/
│   │   ├── routes/
│   │   ├── schedules/
│   │   ├── stops/
│   │   ├── tickets/
│   │   ├── transport-cards/
│   │   ├── trips/
│   │   ├── users/
│   │   ├── vehicles/
│   │   └── ... (ще 11 модулів)
│   └── roles/                  # Рольові API-модулі
│       ├── ct-accountant/
│       ├── ct-controller/
│       ├── ct-dispatcher/
│       ├── ct-driver/
│       ├── ct-guest/
│       ├── ct-manager/
│       ├── ct-municipality/
│       └── ct-passenger/
├── static/                     # Статичні файли
└── test/                       # E2E тести
```

### Frontend (React + Vite)

```
frontend/
├── public/                     # Статичні ресурси
├── src/
│   ├── assets/                 # Зображення, іконки
│   ├── components/
│   │   ├── domain/             # Бізнес-компоненти
│   │   ├── route-planner/      # Планувальник маршрутів
│   │   └── ui/                 # shadcn/ui компоненти
│   ├── hooks/                  # Custom React hooks
│   ├── lib/
│   │   ├── api.ts              # Базовий fetch wrapper
│   │   ├── guest-api.ts        # API для гостя
│   │   ├── passenger-api.ts    # API для пасажира
│   │   ├── driver-api.ts       # API для водія
│   │   ├── controller-api.ts   # API для контролера
│   │   ├── dispatcher-api.ts   # API для диспетчера
│   │   ├── manager-api.ts      # API для менеджера
│   │   ├── accountant-api.ts   # API для бухгалтера
│   │   └── municipality-api.ts # API для муніципалітету
│   └── routes/                 # TanStack Router сторінки
│       ├── __root.tsx          # Кореневий layout
│       ├── index.tsx           # Головна сторінка
│       ├── login.tsx
│       ├── register.tsx
│       ├── map.tsx
│       ├── contacts.tsx
│       ├── passenger/          # Вкладені роути пасажира
│       ├── driver.tsx
│       ├── controller.tsx
│       ├── dispatcher.tsx
│       ├── manager.tsx
│       ├── accountant.tsx
│       └── municipality.tsx
└── .tanstack/                  # TanStack Router cache
```

---

## 2. Модулі NestJS

### Рольові модулі (roles/)

| Модуль | Контролер | Сервіс | Призначення |
|--------|-----------|--------|-------------|
| **ct-guest** | CtGuestController | CtGuestService | Публічний API: маршрути, зупинки, карта, скарги |
| **ct-passenger** | CtPassengerController | CtPassengerService | Профіль, картка, баланс, поїздки, штрафи, апеляції |
| **ct-driver** | CtDriverController | CtDriverService | Розклад, управління рейсами, GPS-трекінг |
| **ct-controller** | CtControllerController | CtControllerService | Перевірка карток, виписування штрафів |
| **ct-dispatcher** | CtDispatcherController | CtDispatcherService | Рейси, розклади, призначення, моніторинг |
| **ct-manager** | CtManagerController | CtManagerService | Найм водіїв, додавання транспорту, персонал |
| **ct-accountant** | CtAccountantController | CtAccountantService | Доходи, витрати, зарплати, звіти |
| **ct-municipality** | CtMunicipalityController | CtMunicipalityService | Зупинки, маршрути, аналітика, скарги |

### CRUD-модулі (modules/)

| Модуль | Призначення |
|--------|-------------|
| auth | Реєстрація, логін, логаут |
| users | Пасажири (users table) |
| drivers | Водії |
| vehicles | Транспортні засоби |
| routes | Маршрути |
| stops | Зупинки |
| route-stops | Зв'язок маршрут-зупинка |
| route-points | GPS-точки геометрії маршруту |
| schedules | Розклади руху |
| trips | Рейси |
| transport-cards | Транспортні картки |
| card-top-ups | Поповнення карток |
| tickets | Квитки |
| fines | Штрафи |
| fine-appeals | Апеляції на штрафи |
| complaints-suggestions | Скарги та пропозиції |
| budgets | Бюджети (план/факт) |
| incomes | Доходи |
| expenses | Витрати |
| salary-payments | Виплати зарплат |
| driver-vehicle-assignments | Призначення водіїв |
| user-gps-logs | GPS-логи користувачів |
| vehicle-gps-logs | GPS-логи транспорту |
| transport-types | Типи транспорту |

---

## 3. Автентифікація та підключення до БД

### Механізм автентифікації

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│   NestJS    │───▶│    Redis    │    │  PostgreSQL │
│  (React)    │    │  Backend    │    │  (sessions) │    │   (roles)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                   │                  │
      │  POST /auth/login                    │                  │
      │  {login, password}                   │                  │
      │─────────────────▶│                   │                  │
      │                  │  Підключення як   │                  │
      │                  │  PostgreSQL роль  │                  │
      │                  │─────────────────────────────────────▶│
      │                  │                   │     pg_has_role  │
      │                  │◀─────────────────────────────────────│
      │                  │                   │                  │
      │                  │  createSession()  │                  │
      │                  │──────────────────▶│                  │
      │                  │  {login,password, │                  │
      │                  │   roles} → UUID   │                  │
      │                  │◀──────────────────│                  │
      │                  │                   │                  │
      │  {token, roles}  │                   │                  │
      │◀─────────────────│                   │                  │
```

### Ключові компоненти

**1. SessionService** (`backend/src/common/session/session.service.ts`):
```typescript
// Зберігає сесію в Redis з TTL (6 годин)
await redis.set(`ct:session:${uuid}`, JSON.stringify({
  login: 'passenger1',
  password: '***',
  roles: ['ct_passenger_role'],
  user: { id, fullName, email, phone }
}), { EX: 21600 });
```

**2. AuthSessionMiddleware** (`auth-session.middleware.ts`):
```typescript
// Витягує токен з Authorization: Bearer <token>
// Завантажує сесію з Redis
// Зберігає в RequestContext для поточного запиту
```

**3. DbService** (`backend/src/db/db.service.ts`):
```typescript
// Динамічно створює пул підключень під логіном користувача
get db() {
  const session = this.contextService.get();
  if (!session) return this.baseDb; // migrator user

  // Створює Pool з user=session.login, password=session.password
  const pool = new Pool({
    user: session.login,
    password: session.password,
    ...
  });
  return drizzle(pool, { schema });
}
```

**4. AuthService.login()** (`auth.service.ts`):
```typescript
// 1. Підключається до PostgreSQL як user=payload.login
const client = new Client({ user: payload.login, password: payload.password });
await client.connect(); // Якщо невірні credentials → UnauthorizedException

// 2. Отримує ролі через pg_has_role()
SELECT rolname FROM pg_roles
WHERE pg_has_role(current_user, oid, 'member') AND rolname LIKE 'ct_%';

// 3. Зберігає сесію в Redis
sessionService.createSession({ login, password, roles, user });
```

### Результат

- **Кожен запит** виконується від імені реального PostgreSQL користувача
- В **pgAdmin → Dashboard → Sessions** видно всіх підключених користувачів
- **SECURITY DEFINER** функції та **views** у схемах `*_api` забезпечують доступ до даних

---

## 4. Роути фронтенду (TanStack Router)

### Публічні сторінки (Guest)

| Роут | Файл | Функціонал |
|------|------|------------|
| `/` | `index.tsx` | Головна сторінка, статистика |
| `/map` | `map.tsx` | Карта маршрутів, планування поїздок |
| `/contacts` | `contacts.tsx` | FAQ, контакти, форма скарги |
| `/login` | `login.tsx` | Авторизація |
| `/register` | `register.tsx` | Реєстрація пасажира |

### Пасажир (ct_passenger_role)

| Роут | Файл | Функціонал |
|------|------|------------|
| `/passenger` | `passenger/index.tsx` | Особистий кабінет, картка, баланс |
| `/passenger` | | Історія поїздок |
| `/passenger` | | Штрафи, оплата, апеляції |

### Водій (ct_driver_role)

| Роут | Файл | Вкладки |
|------|------|---------|
| `/driver` | `driver.tsx` | Огляд (профіль, активний рейс) |
| | | Розклад (рейси на дату) |
| | | Управління (старт/стоп рейсу) |
| | | Карта маршруту (GPS-трекінг) |

### Контролер (ct_controller_role)

| Роут | Файл | Функціонал |
|------|------|------------|
| `/controller` | `controller.tsx` | Крок 1: Вибір транспорту |
| | | Крок 2: Перевірка картки |
| | | Крок 3: Виписування штрафу |

### Диспетчер (ct_dispatcher_role)

| Роут | Файл | Вкладки |
|------|------|---------|
| `/dispatcher` | `dispatcher.tsx` | Огляд (dashboard) |
| | | Рейси (створення, генерація) |
| | | Розклади (CRUD) |
| | | Призначення (водій-транспорт) |
| | | Моніторинг (real-time карта) |
| | | Відхилення (alerts) |

### Менеджер (ct_manager_role)

| Роут | Файл | Вкладки |
|------|------|---------|
| `/manager` | `manager.tsx` | Водії (найм) |
| | | Транспорт (додавання) |
| | | Персонал (створення акаунтів) |

### Бухгалтер (ct_accountant_role)

| Роут | Файл | Вкладки |
|------|------|---------|
| `/accountant` | `accountant.tsx` | Аналітика (dashboard) |
| | | Доходи (government, tickets, fines) |
| | | Зарплати (водіям) |
| | | Витрати (пальне, ремонт, etc.) |
| | | Звіт (план/факт) |

### Муніципалітет (ct_municipality_role)

| Роут | Файл | Вкладки |
|------|------|---------|
| `/municipality` | `municipality.tsx` | Зупинки (CRUD) |
| | | Проектування (конструктор маршрутів) |
| | | Маршрути (перегляд, активація) |
| | | Аналітика (пасажиропотік) |
| | | Скарги (обробка) |

---

## 5. Опис програмної моделі застосунку (для пояснювальної записки)

Інформаційна система управління міським транспортом реалізована як клієнт-серверний веб-застосунок із використанням архітектури REST API. Серверна частина побудована на фреймворку NestJS (Node.js), а клієнтська — на React із використанням TanStack Router для маршрутизації та TanStack Query для управління станом даних.

**Архітектура бекенду.** Серверна частина організована за модульним принципом. Виділено два типи модулів:

1) *CRUD-модулі* (`src/modules/`) — інкапсулюють логіку роботи з окремими сутностями бази даних (users, drivers, vehicles, routes, trips тощо). Кожен модуль містить схему Drizzle ORM для опису таблиці та базові операції читання/запису.

2) *Рольові модулі* (`src/roles/`) — реалізують бізнес-логіку для кожної ролі системи: ct-guest, ct-passenger, ct-driver, ct-controller, ct-dispatcher, ct-manager, ct-accountant, ct-municipality. Кожен рольовий модуль складається з контролера (REST endpoints) та сервісу (бізнес-логіка). Структура рольового модуля показана на рисунку 5.X.

**[Місце для рисунку 5.X — UML-діаграма класів модуля ct-dispatcher]**

```
┌─────────────────────────────────────────────────────────────┐
│                    CtDispatcherModule                        │
├─────────────────────────────────────────────────────────────┤
│  CtDispatcherController                                      │
│  ├── GET /dispatcher/dashboard                               │
│  ├── GET /dispatcher/schedules                               │
│  ├── POST /dispatcher/schedules                              │
│  ├── GET /dispatcher/trips                                   │
│  ├── POST /dispatcher/trips/generate                         │
│  ├── GET /dispatcher/assignments                             │
│  └── GET /dispatcher/monitoring                              │
├─────────────────────────────────────────────────────────────┤
│  CtDispatcherService                                         │
│  ├── getDashboard(): Dashboard                               │
│  ├── listSchedules(): Schedule[]                             │
│  ├── createSchedule(dto): Schedule                           │
│  ├── generateDailyTrips(dto): number                         │
│  ├── assignDriver(dto): Assignment                           │
│  └── monitorVehicle(fleetNumber): VehicleStatus              │
├─────────────────────────────────────────────────────────────┤
│  Dependencies: DbService, RequestContextService              │
└─────────────────────────────────────────────────────────────┘
```

**Механізм автентифікації.** Система використовує token-based автентифікацію з унікальною особливістю — кожен користувач є реальною роллю PostgreSQL. При вході система:
- підключається до бази даних з credentials користувача;
- отримує список ролей через `pg_has_role()`;
- зберігає сесію в Redis (login, password, roles);
- повертає UUID-токен клієнту.

Подальші запити виконуються від імені PostgreSQL-користувача завдяки динамічному створенню пулів підключень у DbService. Це забезпечує row-level security на рівні СУБД.

**Архітектура фронтенду.** Клієнтська частина реалізована як Single Page Application (SPA) на React 19. Маршрутизація здійснюється через TanStack Router з file-based routing. Для кожної ролі створено окрему сторінку з табами або кроками:

- `/passenger` — особистий кабінет пасажира;
- `/driver` — інтерфейс водія (4 вкладки);
- `/controller` — покроковий інтерфейс контролера;
- `/dispatcher` — панель диспетчера (6 вкладок);
- `/manager` — кадрове управління (3 вкладки);
- `/accountant` — фінансовий облік (5 вкладок);
- `/municipality` — планування інфраструктури (5 вкладок).

Ієрархія сторінок для ролі диспетчера показана на рисунку 5.Y.

**[Місце для рисунку 5.Y — Ієрархія сторінок диспетчера]**

Взаємодія з API здійснюється через типізовані модулі в `src/lib/` (guest-api.ts, dispatcher-api.ts тощо). TanStack Query забезпечує кешування, інвалідацію та оптимістичні оновлення.

**Особливості реалізації:**
- GPS-трекінг транспорту в реальному часі (модуль ct-driver);
- інтерактивна карта на MapLibre GL з кластеризацією зупинок;
- автоматична генерація рейсів на основі розкладів;
- аналітика пасажиропотоку з графіками (Recharts).

---

## 6. Технологічний стек

### Backend
- **Runtime:** Node.js 22+
- **Framework:** NestJS 11
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL 16 + PostGIS 3.4
- **Cache/Sessions:** Redis
- **Validation:** class-validator, class-transformer

### Frontend
- **Framework:** React 19
- **Build:** Vite 7
- **Router:** TanStack Router
- **State:** TanStack Query, Zustand
- **UI:** shadcn/ui, Tailwind CSS 4
- **Maps:** MapLibre GL
- **Charts:** Recharts
- **Forms:** react-hook-form + zod

### DevOps
- **Containers:** Docker Compose
- **Package Manager:** pnpm
- **Testing:** Jest, Supertest
