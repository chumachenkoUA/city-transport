# 5 МОДЕЛЬ ПРОГРАМНОГО ДОДАТКУ

Гості, пасажири, водії, контролери, диспетчери, менеджери, бухгалтери та представники муніципалітету користуються окремими інтерфейсами відповідно до своєї ролі в системі управління міським транспортом. Рівень представлення підсистеми «гість» побудований у вигляді односторінкового веб-застосунку (SPA) на базі React. Гість взаємодіє з системою через загальнодоступні інтерфейси. Послідовність переходів по сторінках додатку для гостя відображена на рисунку 5.1.

```
MERMAID ДЛЯ РИСУНКУ 5.1:

flowchart TD
    HOME["Головна сторінка<br/>index.tsx"]

    LOGIN["Авторизація<br/>login.tsx"]
    REGISTER["Реєстрація<br/>register.tsx"]
    CONTACTS["Контакти та підтримка<br/>contacts.tsx"]
    MAP["Карта маршрутів<br/>map.tsx"]

    BROWSE["Перегляд маршрутів"]
    PLAN["Планування поїздки"]
    NEARBY["Зупинки поблизу"]
    COMPLAINT["Подача скарги"]

    HOME --> LOGIN
    HOME --> REGISTER
    HOME --> CONTACTS
    HOME --> MAP

    LOGIN --> HOME
    LOGIN <--> REGISTER

    CONTACTS --> COMPLAINT

    MAP --> BROWSE
    MAP --> PLAN
    MAP --> NEARBY

    PLAN --> LOGIN

    style HOME fill:#e1f5fe
    style LOGIN fill:#fff3e0
    style REGISTER fill:#fff3e0
    style MAP fill:#e8f5e9
    style CONTACTS fill:#fce4ec
```

**Рисунок 5.1 – Ієрархія сторінок додатку для незареєстрованого користувача**

Гість починає роботу з головної сторінки, де відображається загальна інформація про систему міського транспорту міста: статистика маршрутів, зупинок та транспортних засобів. Використовуючи інтерактивну карту, він може переглядати маршрути, планувати поїздки з використанням GPS-геолокації для пошуку найближчих зупинок. З будь-якої сторінки доступна навігація до форми реєстрації або сторінки входу. На сторінці контактів гість може подати скаргу або пропозицію без реєстрації.

Ієрархія сторінок для пасажира, водія, контролера, диспетчера, менеджера, бухгалтера та представника муніципалітету наведена в додатку Д.

Модель рівня прикладного компоненту — на цьому рівні знаходяться класи, що відповідають за обробку вхідних запитів та координацію бізнес-процесів. Для гостя ключовими є контролер CtGuestController та сервіс CtGuestService. Діаграма класів моделей даних наведена на рисунку 5.2.

```
MERMAID ДЛЯ РИСУНКУ 5.2:

classDiagram
    class TransportType {
        +id: Long
        +name: String
    }

    class Route {
        +id: Long
        +transportTypeId: Long
        +number: String
        +direction: String
        +isActive: Boolean
    }

    class Stop {
        +id: Long
        +name: String
        +lon: Decimal
        +lat: Decimal
    }

    class RouteStop {
        +id: Long
        +routeId: Long
        +stopId: Long
        +prevRouteStopId: Long
        +nextRouteStopId: Long
        +distanceToNextKm: Decimal
    }

    class VehicleModel {
        +id: Long
        +name: String
        +typeId: Long
        +capacity: Integer
    }

    class Vehicle {
        +id: Long
        +fleetNumber: String
        +vehicleModelId: Long
        +routeId: Long
    }

    class Driver {
        +id: Long
        +login: String
        +email: String
        +phone: String
        +fullName: String
        +driverLicenseNumber: String
        +licenseCategories: JSON
        +passportData: JSON
    }

    class DriverVehicleAssignment {
        +id: Long
        +driverId: Long
        +vehicleId: Long
        +assignedAt: Timestamp
    }

    class Schedule {
        +id: Long
        +routeId: Long
        +vehicleId: Long
        +workStartTime: Time
        +workEndTime: Time
        +intervalMin: Integer
        +monday-sunday: Boolean
    }

    class Trip {
        +id: Long
        +routeId: Long
        +driverId: Long
        +plannedStartsAt: Timestamp
        +plannedEndsAt: Timestamp
        +actualStartsAt: Timestamp
        +actualEndsAt: Timestamp
        +status: String
        +passengerCount: Integer
    }

    class User {
        +id: Long
        +login: String
        +email: String
        +phone: String
        +fullName: String
        +registeredAt: Timestamp
    }

    class TransportCard {
        +id: Long
        +userId: Long
        +balance: Decimal
        +cardNumber: String
    }

    class Ticket {
        +id: Long
        +tripId: Long
        +cardId: Long
        +price: Decimal
        +purchasedAt: Timestamp
    }

    class Fine {
        +id: Long
        +userId: Long
        +status: String
        +amount: Decimal
        +reason: String
        +issuedBy: String
        +tripId: Long
        +issuedAt: Timestamp
    }

    class FineAppeal {
        +id: Long
        +fineId: Long
        +message: String
        +status: String
        +createdAt: Timestamp
    }

    class ComplaintSuggestion {
        +id: Long
        +userId: Long
        +type: String
        +message: String
        +status: String
        +createdAt: Timestamp
    }

    class Budget {
        +id: Long
        +month: Date
        +plannedIncome: Decimal
        +plannedExpenses: Decimal
        +actualIncome: Decimal
        +actualExpenses: Decimal
    }

    class Income {
        +id: Long
        +source: String
        +amount: Decimal
        +description: String
        +receivedAt: Timestamp
    }

    class Expense {
        +id: Long
        +category: String
        +amount: Decimal
        +description: String
        +occurredAt: Timestamp
    }

    class SalaryPayment {
        +id: Long
        +driverId: Long
        +rate: Decimal
        +units: Integer
        +total: Decimal
        +paidAt: Timestamp
    }

    class VehicleGpsLog {
        +id: Long
        +vehicleId: Long
        +lon: Decimal
        +lat: Decimal
        +recordedAt: Timestamp
    }
```

**Рисунок 5.2 – Діаграма моделей даних інформаційної системи з атрибутами**

Атрибути кожного класу відповідають полям відповідних реляційних таблиць та результатам виконання збережених процедур. Класи VehicleGpsLog та UserGpsLog пов'язані з відповідними логами GPS-трекінгу серверної частини СУБД. Класи конфігурації сесії (SessionService, RequestContextService, DbService) не мають відображення у фізичних таблицях БД і призначені для реалізації безпечного перемикання підключень до бази даних залежно від ролі користувача в поточній сесії.

На рисунку 5.3 наведені ті ж самі модельні класи, але із зазначенням ключових зв'язків між ними:

```
MERMAID ДЛЯ РИСУНКУ 5.3:

flowchart LR
    TransportType --> Route
    TransportType --> VehicleModel

    Route --> RouteStop
    Route --> RoutePoint
    Route --> Vehicle
    Route --> Schedule
    Route --> Trip

    Stop --> RouteStop

    VehicleModel --> Vehicle

    Vehicle --> DriverVehicleAssignment
    Vehicle --> VehicleGpsLog
    Vehicle --> Schedule

    Driver --> DriverVehicleAssignment
    Driver --> Trip
    Driver --> SalaryPayment

    User --> TransportCard
    User --> Fine
    User --> UserGpsLog
    User --> ComplaintSuggestion

    TransportCard --> CardTopUp
    TransportCard --> Ticket

    Trip --> Ticket
    Trip --> Fine

    Fine --> FineAppeal
```

**Рисунок 5.3 – Діаграма моделей даних інформаційної системи зі зв'язками**

Реалізація цих зв'язків відображає специфіку функціонування предметної області «Міський транспорт» та організовує коректний обмін даними між ключовими об'єктами системи. Кожна асоціація в моделі, як-от ідентифікація водія та конкретного транспортного засобу в межах одного призначення, або прив'язка квитка до конкретного рейсу та транспортної картки, є критично важливою для забезпечення логічної цілісності бізнес-процесів.

Класи-сервіси виступають центральною ланкою прикладного шару застосунку, де зосереджена основна бізнес-поведінка системи. Вони виконують роль координаторів: приймають запити від контролерів, перевіряють права доступу та делегують виконання складних операцій базі даних. Головною особливістю цього шару є інкапсуляція механізмів виклику збережених процедур і функцій PostgreSQL. Такий підхід дозволяє перенести важкі обчислення та перевірки обмежень (наприклад, контроль унікальності призначень водіїв або розрахунок часу прибуття транспорту) безпосередньо на бік сервера бази даних.

Крім того, сервіси забезпечують атомарність операцій за допомогою управління транзакціями на рівні бази даних. Це гарантує, що при виконанні комплексних дій — наприклад, при одночасному створенні рейсу, призначенні водія та оновленні розкладу — дані залишаться в узгодженому стані навіть у разі виникнення помилок. Структурна організація цих компонентів та їхня взаємодія з базою даних наведена на діаграмі класів сервісного рівня (рис. 5.4):

```
MERMAID ДЛЯ РИСУНКУ 5.4:

classDiagram
    class CommonService {
        <<Session Management>>
        + createSession(login, password, roles): Token
        + getSession(token): Session
        + deleteSession(token): void
    }

    class CtGuestService {
        <<Public / Guest>>
        + listTransportTypes(): List
        + listRoutes(transportTypeId): List
        + getStopsNear(lon, lat, radius): List
        + getRoutesByStop(stopId): List
        + getRouteStops(routeId): List
        + getRouteGeometry(routeId): GeoJSON
        + getSchedule(routeId, stopId): Schedule
        + planRoute(from, to): RoutePlan
        + searchStops(query): List
        + submitComplaint(data): void
    }

    class CtPassengerService {
        <<Profile & Cards>>
        + getMyProfile(): Profile
        + getMyCard(): Card
        + topUpCard(cardNumber, amount): void
        + buyTicket(tripId, cardId): void
        --Trips & Fines--
        + getMyTrips(): List
        + getMyFines(): List
        + getFineDetails(fineId): Fine
        + payFine(fineId): void
        + createAppeal(fineId, message): void
    }

    class CtDriverService {
        <<Profile & Schedule>>
        + getProfile(): Profile
        + getScheduleByLogin(date): Schedule
        + getScheduledTrips(): List
        --Trip Management--
        + getActiveTrip(): Trip
        + startTrip(tripId): void
        + finishTrip(tripId): void
        + setPassengerCount(tripId, count): void
        + logGps(lon, lat, speed): void
    }

    class CtControllerService {
        <<Card Verification>>
        + checkCard(cardNumber): CardDetails
        + getActiveTrips(fleetNumber): List
        --Fine Issuance--
        + issueFine(userId, tripId, amount, reason): Long
        + getRoutes(): List
        + getVehicles(routeId): List
    }

    class CtDispatcherService {
        <<Schedule Management>>
        + listSchedules(): List
        + createSchedule(data): Long
        + updateSchedule(id, data): void
        + deleteSchedule(id): void
        --Trip Management--
        + listTrips(status): List
        + createTrip(data): Long
        + generateDailyTrips(data): Integer
        + cancelTrip(id): void
        --Monitoring--
        + listActiveTrips(): List
        + listDeviations(): List
        + monitorVehicle(fleetNumber): Status
        + getDashboard(): Dashboard
        --Assignments--
        + listDrivers(): List
        + listVehicles(): List
        + assignDriver(driverId, vehicleId): void
    }

    class CtManagerService {
        <<Driver Management>>
        + listDrivers(): List
        + hireDriver(data): void
        --Vehicle Management--
        + listVehicles(): List
        + addVehicle(data): void
        + listModels(): List
        --Staff Management--
        + listStaffRoles(): List
        + createStaffUser(data): void
        + removeStaffUser(login): void
    }

    class CtAccountantService {
        <<Budget Management>>
        + listBudgets(year): List
        + upsertBudget(data): void
        --Income & Expenses--
        + createIncome(data): void
        + getIncomes(from, to): List
        + createExpense(data): void
        + getExpenses(from, to): List
        --Payroll--
        + getDrivers(): List
        + createSalary(data): void
        + getSalaries(from, to): List
        + getReport(from, to): Report
    }

    class CtMunicipalityService {
        <<Route Management>>
        + listRoutes(): List
        + createRoute(data): Long
        + setRouteActive(routeId, isActive): void
        --Stop Management--
        + listStops(): List
        + createStop(data): Long
        + updateStop(id, data): void
        --Analytics--
        + getPassengerFlow(query): FlowData
        + getTopRoutes(query): List
        + getPassengerTrend(query): List
        --Complaints--
        + getComplaints(query): List
        + updateComplaintStatus(id, status): void
    }
```

**Рисунок 5.4 – Діаграма сервісів інформаційної системи**

Класи контролерів в архітектурному патерні виступають фундаментальними компонентами прикладного рівня, що виконують роль інтелектуального посередника між інтерфейсом користувача та логікою обробки даних. Основна функція контролерів полягає в перехопленні вхідних HTTP-запитів, валідації параметрів та координації подальшої взаємодії з сервісним шаром.

В архітектурі розробленої системи використовується REST API підхід до побудови контролерів на базі NestJS framework. Всі контролери працюють виключно з JSON-форматом даних, що споживається клієнтським SPA-застосунком на React. Такий підхід дозволяє реалізувати динамічне оновлення інтерфейсу без повного перезавантаження сторінок (наприклад, під час відстеження GPS-позиції транспорту або оновлення статусу рейсу в реальному часі).

Така декомпозиція прикладного рівня дозволяє системі бути гнучкою та масштабованою, забезпечуючи високу швидкість відгуку інтерфейсу. Детальна структура розподілу методів, маршрутів (URL-mapping) та взаємозв'язків між контролерами різних підсистем представлена на діаграмі класів (рис. 5.5):

```
MERMAID ДЛЯ РИСУНКУ 5.5:

classDiagram
    class AuthController {
        <<@Controller /auth>>
        + POST /login
        + POST /logout
    }

    class CtGuestController {
        <<@Controller /guest>>
        + GET /transport-types
        + GET /routes
        + GET /stops/near
        + GET /stops/:stopId/routes
        + GET /routes/stops
        + GET /routes/points
        + GET /routes/geometry
        + GET /routes/geometries
        + GET /stops/geometries
        + GET /routes/schedule
        + GET /routes/plan
        + GET /stops/search
        + POST /complaints
    }

    class CtPassengerController {
        <<@Controller /passenger>>
        + GET /profile
        + GET /card
        + POST /cards/:cardNumber/top-up
        + POST /tickets/buy
        + GET /trips
        + GET /fines
        + GET /fines/:fineId
        + POST /fines/:fineId/pay
        + POST /fines/:fineId/appeals
        + POST /complaints
    }

    class CtDriverController {
        <<@Controller /driver>>
        + GET /me
        + GET /schedule
        + GET /active-trip
        + GET /scheduled-trips
        + GET /routes/stops
        + GET /routes/points
        + POST /trips/start
        + POST /trips/finish
        + POST /trips/passengers
        + POST /trips/gps
    }

    class CtControllerController {
        <<@Controller /controller>>
        + GET /routes
        + GET /vehicles
        + GET /vehicles/:fleetNumber/trips
        + GET /cards/:cardNumber/check
        + POST /fines
    }

    class CtDispatcherController {
        <<@Controller /dispatcher>>
        + GET /dashboard
        + GET /routes
        + GET /schedules
        + POST /schedules
        + GET /schedules/:id
        + PATCH /schedules/:id
        + DELETE /schedules/:id
        + GET /vehicles
        + GET /drivers
        + GET /assignments
        + POST /assignments
        + GET /trips
        + POST /trips
        + POST /trips/generate
        + PATCH /trips/:id/cancel
        + DELETE /trips/:id
        + GET /active-trips
        + GET /deviations
        + GET /vehicles/:fleetNumber/monitoring
    }

    class CtManagerController {
        <<@Controller /manager>>
        + GET /drivers
        + GET /vehicles
        + GET /routes
        + GET /transport-types
        + GET /models
        + POST /drivers
        + POST /vehicles
        + GET /staff-roles
        + POST /staff
        + DELETE /staff/:login
    }

    class CtAccountantController {
        <<@Controller /accountant>>
        + GET /budgets
        + POST /budgets
        + POST /expenses
        + GET /expenses
        + POST /incomes
        + GET /incomes
        + GET /drivers
        + POST /salaries
        + GET /salaries
        + GET /report
    }

    class CtMunicipalityController {
        <<@Controller /municipality>>
        + GET /transport-types
        + GET /stops
        + POST /stops
        + PATCH /stops/:id
        + GET /routes
        + POST /routes
        + PATCH /routes/:routeId/active
        + GET /routes/:routeId/stops
        + GET /routes/:routeId/points
        + GET /passenger-flow
        + GET /passenger-flow/detailed
        + GET /passenger-flow/top-routes
        + GET /passenger-flow/trend
        + GET /complaints
        + PATCH /complaints/:id/status
    }
```

**Рисунок 5.5 – Діаграма контролерів інформаційної системи**

Сервіси та контролери в розробленій інформаційній системі не мають прямого наслідування, оскільки виконують різні функціональні ролі. Їх ідентифікація та підключення до контексту виконання здійснюється за допомогою декораторів NestJS: @Controller для контролерів та @Injectable для сервісів. Взаємодія між ними базується на принципі впровадження залежностей (Dependency Injection), що забезпечується фреймворком NestJS.
