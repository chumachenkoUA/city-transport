# ДОДАТОК Д

## Ієрархії сторінок додатку для різних ролей користувачів

### Д.1 Ієрархія сторінок для пасажира

```
MERMAID:

flowchart TD
    PASSENGER["Кабінет пасажира<br/>/passenger"]

    PROFILE["Профіль"]
    CARD["Транспортна картка"]
    TRIPS["Історія поїздок"]
    FINES["Мої штрафи"]

    TOPUP["Поповнення картки"]
    PAY["Оплата штрафу"]
    APPEAL["Подача апеляції"]

    PASSENGER --> PROFILE
    PASSENGER --> CARD
    PASSENGER --> TRIPS
    PASSENGER --> FINES

    CARD --> TOPUP
    FINES --> PAY
    FINES --> APPEAL

    style PASSENGER fill:#e3f2fd
    style CARD fill:#e8f5e9
    style FINES fill:#ffebee
```

**Рисунок Д.1 – Ієрархія сторінок додатку для пасажира**

### Д.2 Ієрархія сторінок для водія

```
MERMAID:

flowchart TD
    DRIVER["Кабінет водія<br/>/driver"]

    OVERVIEW["Огляд"]
    SCHEDULE["Розклад"]
    CONTROL["Управління рейсами"]
    ROUTEMAP["Карта маршруту"]

    START["Почати рейс"]
    FINISH["Завершити рейс"]
    PASSENGERS["Оновити пасажирів"]
    GPS["GPS трекінг"]

    DRIVER --> OVERVIEW
    DRIVER --> SCHEDULE
    DRIVER --> CONTROL
    DRIVER --> ROUTEMAP

    CONTROL --> START
    START --> GPS
    CONTROL --> PASSENGERS
    CONTROL --> FINISH

    style DRIVER fill:#e3f2fd
    style CONTROL fill:#fff3e0
    style GPS fill:#e8f5e9
```

**Рисунок Д.2 – Ієрархія сторінок додатку для водія**

### Д.3 Ієрархія сторінок для контролера

```
MERMAID:

flowchart TD
    CONTROLLER["Кабінет контролера<br/>/controller"]

    STEP1["Крок 1: Вибір транспорту"]
    STEP2["Крок 2: Перевірка картки"]
    STEP3["Крок 3: Виписка штрафу"]

    ROUTE["Фільтр за маршрутом"]
    VEHICLE["Вибір транспорту"]
    TRIPS["Активні рейси"]

    SCAN["Сканування картки"]
    BALANCE["Перегляд балансу"]

    AMOUNT["Вказати суму"]
    REASON["Вказати причину"]
    CONFIRM["Підтвердити"]

    CONTROLLER --> STEP1
    STEP1 --> ROUTE
    ROUTE --> VEHICLE
    VEHICLE --> TRIPS

    STEP1 --> STEP2
    STEP2 --> SCAN
    SCAN --> BALANCE

    STEP2 --> STEP3
    STEP3 --> AMOUNT
    AMOUNT --> REASON
    REASON --> CONFIRM

    style CONTROLLER fill:#e3f2fd
    style STEP3 fill:#ffebee
```

**Рисунок Д.3 – Ієрархія сторінок додатку для контролера**

### Д.4 Ієрархія сторінок для диспетчера

```
MERMAID:

flowchart TD
    DISPATCHER["Кабінет диспетчера<br/>/dispatcher"]

    DASH["Огляд"]
    TRIPS["Рейси"]
    SCHEDULES["Розклади"]
    ASSIGN["Призначення"]
    MONITOR["Моніторинг"]
    DEVIATIONS["Відхилення"]

    CREATE_TRIP["Створити рейс"]
    GEN_TRIPS["Згенерувати рейси"]
    LIST_TRIPS["Список рейсів"]

    CREATE_SCHED["Створити розклад"]
    EDIT_SCHED["Редагувати"]
    DELETE_SCHED["Видалити"]

    ASSIGN_DRIVER["Призначити водія"]
    LIST_ASSIGN["Історія призначень"]

    DISPATCHER --> DASH
    DISPATCHER --> TRIPS
    DISPATCHER --> SCHEDULES
    DISPATCHER --> ASSIGN
    DISPATCHER --> MONITOR
    DISPATCHER --> DEVIATIONS

    TRIPS --> CREATE_TRIP
    TRIPS --> GEN_TRIPS
    TRIPS --> LIST_TRIPS

    SCHEDULES --> CREATE_SCHED
    SCHEDULES --> EDIT_SCHED
    SCHEDULES --> DELETE_SCHED

    ASSIGN --> ASSIGN_DRIVER
    ASSIGN --> LIST_ASSIGN

    style DISPATCHER fill:#e3f2fd
    style MONITOR fill:#e8f5e9
    style DEVIATIONS fill:#ffebee
```

**Рисунок Д.4 – Ієрархія сторінок додатку для диспетчера**

### Д.5 Ієрархія сторінок для менеджера

```
MERMAID:

flowchart TD
    MANAGER["Кабінет менеджера<br/>/manager"]

    DRIVERS["Водії"]
    VEHICLES["Транспорт"]
    STAFF["Персонал"]

    LIST_DRIVERS["Список водіїв"]
    HIRE["Найняти водія"]

    LIST_VEHICLES["Список транспорту"]
    ADD_VEHICLE["Додати транспорт"]

    LIST_STAFF["Список персоналу"]
    CREATE_STAFF["Створити акаунт"]
    REMOVE_STAFF["Видалити акаунт"]

    MANAGER --> DRIVERS
    MANAGER --> VEHICLES
    MANAGER --> STAFF

    DRIVERS --> LIST_DRIVERS
    DRIVERS --> HIRE

    VEHICLES --> LIST_VEHICLES
    VEHICLES --> ADD_VEHICLE

    STAFF --> LIST_STAFF
    STAFF --> CREATE_STAFF
    STAFF --> REMOVE_STAFF

    style MANAGER fill:#e3f2fd
```

**Рисунок Д.5 – Ієрархія сторінок додатку для менеджера**

### Д.6 Ієрархія сторінок для бухгалтера

```
MERMAID:

flowchart TD
    ACCOUNTANT["Кабінет бухгалтера<br/>/accountant"]

    EXPENSES["Витрати"]
    INCOME["Доходи"]
    SALARIES["Зарплати"]
    BUDGETS["Бюджети"]
    REPORTS["Звіти"]

    ADD_EXP["Додати витрату"]
    LIST_EXP["Список витрат"]

    ADD_INC["Додати дохід"]
    LIST_INC["Список доходів"]

    PAY_SAL["Виплатити зарплату"]
    LIST_SAL["Історія виплат"]

    CREATE_BUD["Створити бюджет"]
    LIST_BUD["Список бюджетів"]

    FIN_REPORT["Фінансовий звіт"]
    CHARTS["Графіки"]

    ACCOUNTANT --> EXPENSES
    ACCOUNTANT --> INCOME
    ACCOUNTANT --> SALARIES
    ACCOUNTANT --> BUDGETS
    ACCOUNTANT --> REPORTS

    EXPENSES --> ADD_EXP
    EXPENSES --> LIST_EXP

    INCOME --> ADD_INC
    INCOME --> LIST_INC

    SALARIES --> PAY_SAL
    SALARIES --> LIST_SAL

    BUDGETS --> CREATE_BUD
    BUDGETS --> LIST_BUD

    REPORTS --> FIN_REPORT
    REPORTS --> CHARTS

    style ACCOUNTANT fill:#e3f2fd
    style REPORTS fill:#e8f5e9
```

**Рисунок Д.6 – Ієрархія сторінок додатку для бухгалтера**

### Д.7 Ієрархія сторінок для представника муніципалітету

```
MERMAID:

flowchart TD
    MUNICIPALITY["Кабінет муніципалітету<br/>/municipality"]

    ROUTES["Маршрути"]
    STOPS["Зупинки"]
    ANALYTICS["Аналітика"]
    COMPLAINTS["Скарги"]

    LIST_ROUTES["Список маршрутів"]
    CREATE_ROUTE["Створити маршрут"]
    TOGGLE_ROUTE["Активувати/Деактивувати"]

    LIST_STOPS["Список зупинок"]
    CREATE_STOP["Створити зупинку"]
    EDIT_STOP["Редагувати зупинку"]

    FLOW["Пасажиропотік"]
    TOP_ROUTES["Топ маршрутів"]
    TRENDS["Тренди"]

    LIST_COMP["Список скарг"]
    UPDATE_STATUS["Змінити статус"]

    MUNICIPALITY --> ROUTES
    MUNICIPALITY --> STOPS
    MUNICIPALITY --> ANALYTICS
    MUNICIPALITY --> COMPLAINTS

    ROUTES --> LIST_ROUTES
    ROUTES --> CREATE_ROUTE
    ROUTES --> TOGGLE_ROUTE

    STOPS --> LIST_STOPS
    STOPS --> CREATE_STOP
    STOPS --> EDIT_STOP

    ANALYTICS --> FLOW
    ANALYTICS --> TOP_ROUTES
    ANALYTICS --> TRENDS

    COMPLAINTS --> LIST_COMP
    COMPLAINTS --> UPDATE_STATUS

    style MUNICIPALITY fill:#e3f2fd
    style ANALYTICS fill:#e8f5e9
```

**Рисунок Д.7 – Ієрархія сторінок додатку для представника муніципалітету**

## Зведена таблиця доступу до системи за ролями

| Роль | URL | Основний функціонал |
|------|-----|---------------------|
| Гість | `/`, `/login`, `/register`, `/contacts`, `/map` | Перегляд маршрутів, планування поїздок, реєстрація |
| Пасажир | `/passenger` | Профіль, картка, поїздки, штрафи, апеляції |
| Водій | `/driver` | Розклад, управління рейсами, GPS-трекінг |
| Контролер | `/controller` | Перевірка карток, виписка штрафів |
| Диспетчер | `/dispatcher` | Рейси, розклади, призначення, моніторинг |
| Менеджер | `/manager` | Водії, транспорт, персонал |
| Бухгалтер | `/accountant` | Витрати, доходи, зарплати, бюджети, звіти |
| Муніципалітет | `/municipality` | Маршрути, зупинки, аналітика, скарги |
