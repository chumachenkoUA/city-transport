# 5 МОДЕЛЬ ПРОГРАМНОГО ДОДАТКУ

Гості, пасажири, водії, контролери, диспетчери, менеджери, бухгалтери та представники муніципалітету користуються окремими інтерфейсами відповідно до своєї ролі в системі управління міським транспортом. Рівень представлення побудований у вигляді односторінкового веб-застосунку (SPA) на базі React з використанням TanStack Router для маршрутизації.

## 5.1 Ієрархія сторінок для незареєстрованого користувача

Гість взаємодіє з системою через загальнодоступні інтерфейси. Послідовність переходів по сторінках додатку для гостя відображена на рисунку 5.1.

```mermaid
flowchart TB
    subgraph Public["Публічна зона"]
        HOME["Головна сторінка<br/>/"]
    end

    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
        REGISTER["Реєстрація<br/>/register"]
    end

    subgraph Features["Функціональність"]
        MAP["Карта маршрутів<br/>/map"]
        CONTACTS["Контакти<br/>/contacts"]
    end

    subgraph MapModes["Режими карти"]
        BROWSE["Перегляд маршрутів"]
        PLAN["Планування поїздки"]
        NEARBY["Зупинки поблизу (GPS)"]
    end

    subgraph ContactFeatures["Функції контактів"]
        FAQ["FAQ"]
        COMPLAINT["Подача скарги"]
    end

    HOME --> MAP
    HOME --> CONTACTS
    HOME --> LOGIN
    HOME --> REGISTER

    LOGIN <--> REGISTER
    LOGIN -->|"успішний вхід"| DASHBOARD["Особистий кабінет<br/>(за роллю)"]

    MAP --> BROWSE
    MAP --> PLAN
    MAP --> NEARBY

    CONTACTS --> FAQ
    CONTACTS --> COMPLAINT
```

**Рисунок 5.1 – Ієрархія сторінок додатку для незареєстрованого користувача**

Гість починає роботу з головної сторінки, де відображається загальна інформація про систему міського транспорту: статистика маршрутів (150+), зупинок (2500+), транспортних засобів (500+) та показник надійності системи (99.5%). Використовуючи інтерактивну карту на базі MapLibre GL, користувач може переглядати маршрути, планувати поїздки з використанням GPS-геолокації для пошуку найближчих зупинок. На сторінці контактів гість може переглянути розділ FAQ та подати скаргу або пропозицію без реєстрації.

## 5.2 Ієрархія сторінок для пасажира

Після успішної авторизації пасажир отримує доступ до особистого кабінету з розширеним функціоналом. Ієрархія сторінок для пасажира відображена на рисунку 5.2.

```mermaid
flowchart TB
    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
    end

    subgraph Passenger["Кабінет пасажира /passenger"]
        DASHBOARD["Особистий кабінет"]

        subgraph Profile["Профіль"]
            INFO["Інформація про користувача"]
            CARD["Транспортна картка"]
        end

        subgraph CardActions["Дії з карткою"]
            BALANCE["Перегляд балансу"]
            TOPUP["Поповнення картки"]
        end

        subgraph Trips["Поїздки"]
            HISTORY["Історія поїздок"]
        end

        subgraph Fines["Штрафи"]
            FINELIST["Список штрафів"]
            FINEDETAIL["Деталі штрафу"]
            PAYFINE["Оплата штрафу"]
            APPEAL["Подання апеляції"]
        end
    end

    LOGIN -->|"ct_passenger_role"| DASHBOARD

    DASHBOARD --> INFO
    DASHBOARD --> CARD

    CARD --> BALANCE
    CARD --> TOPUP

    DASHBOARD --> HISTORY

    DASHBOARD --> FINELIST
    FINELIST --> FINEDETAIL
    FINEDETAIL --> PAYFINE
    FINEDETAIL --> APPEAL
```

**Рисунок 5.2 – Ієрархія сторінок додатку для пасажира**

Пасажир має доступ до особистого профілю, де відображається інформація про користувача та транспортну картку з поточним балансом. Система дозволяє поповнювати картку, переглядати історію поїздок, а також керувати штрафами — переглядати їх статус, здійснювати оплату або подавати апеляцію.

## 5.3 Ієрархія сторінок для водія

Водій має доступ до спеціалізованого інтерфейсу для управління рейсами та відстеження GPS-позиції. Ієрархія сторінок для водія відображена на рисунку 5.3.

```mermaid
flowchart TB
    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
    end

    subgraph Driver["Кабінет водія /driver"]
        subgraph TabOverview["Вкладка: Огляд"]
            PROFILE["Профіль водія"]
            ACTIVE["Активний рейс"]
            STATS["Статистика"]
        end

        subgraph TabSchedule["Вкладка: Розклад"]
            DATEPICKER["Вибір дати"]
            SCHEDULED["Заплановані рейси"]
        end

        subgraph TabControl["Вкладка: Управління"]
            ROUTESELECT["Вибір маршруту"]
            STARTTRIP["Початок рейсу"]
            PASSENGERS["Кількість пасажирів"]
            FINISHTRIP["Завершення рейсу"]
        end

        subgraph TabMap["Вкладка: Карта маршруту"]
            ROUTEMAP["Карта з маршрутом"]
            STOPS["Зупинки маршруту"]
            GPSTRACK["GPS-трекінг"]
        end
    end

    LOGIN -->|"ct_driver_role"| TabOverview

    TabOverview --> TabSchedule
    TabSchedule --> TabControl
    TabControl --> TabMap

    STARTTRIP --> PASSENGERS
    PASSENGERS --> FINISHTRIP

    STARTTRIP -.->|"автоматично"| GPSTRACK
```

**Рисунок 5.3 – Ієрархія сторінок додатку для водія**

Інтерфейс водія організований у вигляді вкладок. На вкладці «Огляд» відображається профіль водія з категоріями прав та інформацією про активний рейс. «Розклад» дозволяє переглядати заплановані рейси на обрану дату. «Управління» забезпечує повний цикл роботи з рейсом: вибір маршруту, початок рейсу, введення кількості пасажирів та завершення. Під час активного рейсу система автоматично веде GPS-трекінг позиції транспортного засобу.

## 5.4 Ієрархія сторінок для контролера

Контролер має спеціалізований інтерфейс для перевірки квитків та виписування штрафів. Ієрархія сторінок для контролера відображена на рисунку 5.4.

```mermaid
flowchart TB
    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
    end

    subgraph Controller["Кабінет контролера /controller"]
        subgraph Step1["Крок 1: Вибір транспорту"]
            ROUTEFILTER["Фільтр за маршрутом"]
            FLEETSELECT["Вибір бортового номера"]
            ACTIVETRIPS["Активні рейси"]
        end

        subgraph Step2["Крок 2: Перевірка картки"]
            CARDNUMBER["Введення номера картки"]
            CARDINFO["Інформація про картку"]
            PASSENGERINFO["Дані пасажира"]
            LASTUSAGE["Остання валідація"]
        end

        subgraph Step3["Крок 3: Виписування штрафу"]
            FINEAMOUNT["Сума штрафу"]
            FINEREASON["Причина штрафу"]
            CONTEXT["Контекст (рейс, водій)"]
            SUBMIT["Виписати штраф"]
        end
    end

    LOGIN -->|"ct_controller_role"| Step1

    ROUTEFILTER --> FLEETSELECT
    FLEETSELECT --> ACTIVETRIPS

    Step1 -->|"транспорт обрано"| Step2

    CARDNUMBER --> CARDINFO
    CARDINFO --> PASSENGERINFO

    Step2 -->|"порушення виявлено"| Step3

    FINEAMOUNT --> FINEREASON
    FINEREASON --> CONTEXT
    CONTEXT --> SUBMIT
```

**Рисунок 5.4 – Ієрархія сторінок додатку для контролера**

Інтерфейс контролера побудований як покроковий процес. На першому кроці контролер обирає транспортний засіб за бортовим номером та переглядає активні рейси. Другий крок — перевірка транспортної картки пасажира: введення номера картки, перегляд балансу та дати останньої валідації. У разі виявлення порушення, на третьому кроці контролер вводить суму штрафу та причину, після чого система автоматично прив'язує штраф до конкретного рейсу та водія.

## 5.5 Ієрархія сторінок для диспетчера

Диспетчер має найбільш розгалужений інтерфейс для оперативного управління рухом транспорту. Ієрархія сторінок для диспетчера відображена на рисунку 5.5.

```mermaid
flowchart TB
    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
    end

    subgraph Dispatcher["Кабінет диспетчера /dispatcher"]
        subgraph TabDashboard["Вкладка: Огляд"]
            OVERVIEW["Панель керування"]
            ACTIVESTATS["Активні рейси/водії/транспорт"]
        end

        subgraph TabTrips["Вкладка: Рейси"]
            TRIPLIST["Список рейсів"]
            TRIPFILTER["Фільтри (статус, дата, маршрут)"]
            CREATETRIP["Створення рейсу"]
            GENERATETRIPS["Генерація рейсів"]
            CANCELTRIP["Скасування рейсу"]
        end

        subgraph TabSchedules["Вкладка: Розклади"]
            SCHEDULELIST["Список розкладів"]
            CREATESCHEDULE["Створення розкладу"]
            EDITSCHEDULE["Редагування розкладу"]
            DELETESCHEDULE["Видалення розкладу"]
        end

        subgraph TabAssignments["Вкладка: Призначення"]
            ASSIGNLIST["Список призначень"]
            ASSIGNDRIVER["Призначити водія"]
            DRIVERLIST["Список водіїв"]
            VEHICLELIST["Список транспорту"]
        end

        subgraph TabMonitoring["Вкладка: Моніторинг"]
            FLEETMONITOR["Моніторинг транспорту"]
            REALTIMEMAP["Карта в реальному часі"]
            TRIPSTATUS["Статус рейсів"]
        end

        subgraph TabDeviations["Вкладка: Відхилення"]
            DEVIATIONLIST["Список відхилень"]
            ALERTS["Сповіщення"]
        end
    end

    LOGIN -->|"ct_dispatcher_role"| TabDashboard

    TabDashboard --> TabTrips
    TabDashboard --> TabSchedules
    TabDashboard --> TabAssignments
    TabDashboard --> TabMonitoring
    TabDashboard --> TabDeviations

    TRIPLIST --> CREATETRIP
    TRIPLIST --> GENERATETRIPS
    TRIPLIST --> CANCELTRIP

    SCHEDULELIST --> CREATESCHEDULE
    SCHEDULELIST --> EDITSCHEDULE
    SCHEDULELIST --> DELETESCHEDULE

    ASSIGNLIST --> ASSIGNDRIVER
    ASSIGNDRIVER --> DRIVERLIST
    ASSIGNDRIVER --> VEHICLELIST
```

**Рисунок 5.5 – Ієрархія сторінок додатку для диспетчера**

Диспетчер координує роботу всього транспортного парку через шість функціональних вкладок. «Огляд» надає загальну статистику активних рейсів, водіїв та транспорту. «Рейси» дозволяє створювати окремі рейси або генерувати їх автоматично на основі розкладу. «Розклади» забезпечує управління графіками руху. «Призначення» відповідає за закріплення водіїв за транспортними засобами. «Моніторинг» відображає позиції транспорту в реальному часі на карті. «Відхилення» фіксує порушення графіку руху.

## 5.6 Ієрархія сторінок для менеджера

Менеджер відповідає за кадрове забезпечення та управління транспортним парком. Ієрархія сторінок для менеджера відображена на рисунку 5.6.

```mermaid
flowchart TB
    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
    end

    subgraph Manager["Кабінет менеджера /manager"]
        subgraph TabDrivers["Вкладка: Водії"]
            DRIVERLIST["Список водіїв"]
            HIREDRIVER["Найм водія"]
            DRIVERFORM["Форма водія:<br/>логін, пошта, телефон,<br/>ПІБ, посвідчення, паспорт"]
        end

        subgraph TabVehicles["Вкладка: Транспорт"]
            VEHICLELIST["Список транспорту"]
            ADDVEHICLE["Додавання транспорту"]
            VEHICLEFORM["Форма транспорту:<br/>бортовий номер, тип,<br/>модель, маршрут"]
        end

        subgraph TabStaff["Вкладка: Персонал"]
            STAFFLIST["Список персоналу"]
            CREATESTAFF["Створення облікового запису"]
            STAFFFORM["Форма персоналу:<br/>логін, пошта, роль"]
            ROLES["Ролі: диспетчер, контролер,<br/>бухгалтер, муніципалітет, менеджер"]
        end
    end

    LOGIN -->|"ct_manager_role"| TabDrivers

    TabDrivers --> TabVehicles
    TabDrivers --> TabStaff

    DRIVERLIST --> HIREDRIVER
    HIREDRIVER --> DRIVERFORM

    VEHICLELIST --> ADDVEHICLE
    ADDVEHICLE --> VEHICLEFORM

    STAFFLIST --> CREATESTAFF
    CREATESTAFF --> STAFFFORM
    STAFFFORM --> ROLES
```

**Рисунок 5.6 – Ієрархія сторінок додатку для менеджера**

Менеджер працює з трьома основними напрямками. Вкладка «Водії» дозволяє переглядати список водіїв та наймати нових із заповненням детальної форми (логін, пошта, телефон, ПІБ, номер посвідчення, категорії прав, паспортні дані). Вкладка «Транспорт» забезпечує додавання нових транспортних засобів із вибором типу транспорту, моделі та призначеного маршруту. Вкладка «Персонал» дозволяє створювати облікові записи для співробітників різних ролей: диспетчер, контролер, бухгалтер, представник муніципалітету та менеджер.

## 5.7 Ієрархія сторінок для бухгалтера

Бухгалтер відповідає за фінансовий облік та звітність підприємства. Ієрархія сторінок для бухгалтера відображена на рисунку 5.7.

```mermaid
flowchart TB
    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
    end

    subgraph Accountant["Кабінет бухгалтера /accountant"]
        subgraph TabAnalytics["Вкладка: Аналітика"]
            DASHBOARD["Фінансова панель"]
            METRICS["Ключові показники"]
            TRENDS["Тренди доходів/витрат"]
            BUDGET["Виконання бюджету"]
        end

        subgraph TabIncomes["Вкладка: Доходи"]
            INCOMELIST["Список доходів"]
            CREATEINCOME["Створення запису доходу"]
            INCOMEFORM["Форма: джерело, сума,<br/>опис, документ"]
            SOURCES["Джерела: бюджет, квитки,<br/>штрафи, інше"]
        end

        subgraph TabSalaries["Вкладка: Зарплати"]
            SALARYLIST["Список виплат"]
            CREATESALARY["Створення виплати"]
            SALARYFORM["Форма: водій, ставка,<br/>одиниці, сума"]
        end

        subgraph TabExpenses["Вкладка: Витрати"]
            EXPENSELIST["Список витрат"]
            CREATEEXPENSE["Створення запису витрати"]
            EXPENSEFORM["Форма: категорія, сума,<br/>опис, документ"]
            CATEGORIES["Категорії: пальне, ремонт,<br/>запчастини, страховка"]
        end

        subgraph TabReport["Вкладка: Звіт"]
            REPORTVIEW["Фінансовий звіт"]
            PERIODSELECT["Вибір періоду"]
            COMPARISON["Порівняння план/факт"]
        end
    end

    LOGIN -->|"ct_accountant_role"| TabAnalytics

    TabAnalytics --> TabIncomes
    TabAnalytics --> TabSalaries
    TabAnalytics --> TabExpenses
    TabAnalytics --> TabReport

    INCOMELIST --> CREATEINCOME
    CREATEINCOME --> INCOMEFORM
    INCOMEFORM --> SOURCES

    SALARYLIST --> CREATESALARY
    CREATESALARY --> SALARYFORM

    EXPENSELIST --> CREATEEXPENSE
    CREATEEXPENSE --> EXPENSEFORM
    EXPENSEFORM --> CATEGORIES

    REPORTVIEW --> PERIODSELECT
    REPORTVIEW --> COMPARISON
```

**Рисунок 5.7 – Ієрархія сторінок додатку для бухгалтера**

Бухгалтер має доступ до п'яти функціональних вкладок. «Аналітика» відображає фінансову панель з ключовими показниками, трендами та виконанням бюджету. «Доходи» дозволяє вносити записи про надходження з різних джерел: державний бюджет, продаж квитків, штрафи та інші. «Зарплати» забезпечує облік виплат водіям. «Витрати» фіксує витрати за категоріями: пальне, ремонт, запчастини, мийка, страховка, комунальні послуги. «Звіт» генерує комплексний фінансовий звіт за обраний період із порівнянням планових та фактичних показників.

## 5.8 Ієрархія сторінок для представника муніципалітету

Представник муніципалітету відповідає за планування маршрутної мережі та аналіз пасажиропотоку. Ієрархія сторінок для представника муніципалітету відображена на рисунку 5.8.

```mermaid
flowchart TB
    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
    end

    subgraph Municipality["Кабінет муніципалітету /municipality"]
        subgraph TabStops["Вкладка: Зупинки"]
            STOPLIST["Список зупинок"]
            CREATESTOP["Створення зупинки"]
            EDITSTOP["Редагування зупинки"]
            STOPFORM["Форма: назва, координати"]
        end

        subgraph TabDesigner["Вкладка: Проектування"]
            ROUTEDESIGNER["Конструктор маршрутів"]
            ROUTECONFIG["Номер, тип, напрямок"]
            ADDSTOPS["Додавання зупинок"]
            ADDGEOMETRY["Геометрія маршруту"]
        end

        subgraph TabRoutes["Вкладка: Маршрути"]
            ROUTELIST["Список маршрутів"]
            ROUTEDETAIL["Деталі маршруту"]
            ROUTEMAP["Візуалізація на карті"]
            TOGGLEACTIVE["Активація/деактивація"]
        end

        subgraph TabAnalytics["Вкладка: Аналітика"]
            FLOWANALYSIS["Аналіз пасажиропотоку"]
            CHARTS["Графіки (стовпчасті, лінійні)"]
            TOPROUTES["Топ маршрутів"]
            TRENDS["Тренди пасажиропотоку"]
            DATEFILTER["Фільтр за датою"]
        end

        subgraph TabComplaints["Вкладка: Скарги"]
            COMPLAINTLIST["Список скарг"]
            COMPLAINTCARD["Картка скарги"]
            STATUSUPDATE["Оновлення статусу"]
        end
    end

    LOGIN -->|"ct_municipality_role"| TabStops

    TabStops --> TabDesigner
    TabStops --> TabRoutes
    TabStops --> TabAnalytics
    TabStops --> TabComplaints

    STOPLIST --> CREATESTOP
    STOPLIST --> EDITSTOP
    CREATESTOP --> STOPFORM

    ROUTEDESIGNER --> ROUTECONFIG
    ROUTECONFIG --> ADDSTOPS
    ADDSTOPS --> ADDGEOMETRY

    ROUTELIST --> ROUTEDETAIL
    ROUTEDETAIL --> ROUTEMAP
    ROUTEDETAIL --> TOGGLEACTIVE

    FLOWANALYSIS --> CHARTS
    FLOWANALYSIS --> TOPROUTES
    FLOWANALYSIS --> TRENDS
    FLOWANALYSIS --> DATEFILTER

    COMPLAINTLIST --> COMPLAINTCARD
    COMPLAINTCARD --> STATUSUPDATE
```

**Рисунок 5.8 – Ієрархія сторінок додатку для представника муніципалітету**

Представник муніципалітету має широкі повноваження з планування транспортної інфраструктури. Вкладка «Зупинки» дозволяє створювати та редагувати зупинки з вказівкою координат. «Проектування» — конструктор маршрутів, де задається номер маршруту, тип транспорту, напрямок руху, послідовність зупинок та геометрія шляху. «Маршрути» відображає існуючі маршрути з візуалізацією на карті та можливістю активації/деактивації. «Аналітика» надає інструменти для аналізу пасажиропотоку: графіки, топ маршрутів за завантаженістю, тренди за обраний період. «Скарги» дозволяє переглядати звернення громадян та оновлювати їх статус обробки.

## 5.9 Загальна схема навігації системи

Загальна схема навігації системи з урахуванням всіх ролей та переходів між сторінками наведена на рисунку 5.9.

```mermaid
flowchart TB
    subgraph Public["Публічна зона"]
        HOME["Головна<br/>/"]
        MAP["Карта<br/>/map"]
        CONTACTS["Контакти<br/>/contacts"]
    end

    subgraph Auth["Автентифікація"]
        LOGIN["Вхід<br/>/login"]
        REGISTER["Реєстрація<br/>/register"]
    end

    subgraph Roles["Особисті кабінети за ролями"]
        PASSENGER["Пасажир<br/>/passenger"]
        DRIVER["Водій<br/>/driver"]
        CONTROLLER["Контролер<br/>/controller"]
        DISPATCHER["Диспетчер<br/>/dispatcher"]
        MANAGER["Менеджер<br/>/manager"]
        ACCOUNTANT["Бухгалтер<br/>/accountant"]
        MUNICIPALITY["Муніципалітет<br/>/municipality"]
    end

    HOME <--> MAP
    HOME <--> CONTACTS
    HOME --> LOGIN
    HOME --> REGISTER

    LOGIN <--> REGISTER

    LOGIN -->|"ct_passenger_role"| PASSENGER
    LOGIN -->|"ct_driver_role"| DRIVER
    LOGIN -->|"ct_controller_role"| CONTROLLER
    LOGIN -->|"ct_dispatcher_role"| DISPATCHER
    LOGIN -->|"ct_manager_role"| MANAGER
    LOGIN -->|"ct_accountant_role"| ACCOUNTANT
    LOGIN -->|"ct_municipality_role"| MUNICIPALITY

    PASSENGER --> HOME
    DRIVER --> HOME
    CONTROLLER --> HOME
    DISPATCHER --> HOME
    MANAGER --> HOME
    ACCOUNTANT --> HOME
    MUNICIPALITY --> HOME
```

**Рисунок 5.9 – Загальна схема навігації системи**

## 5.10 Модель прикладного компоненту

На рівні прикладного компоненту знаходяться класи, що відповідають за обробку вхідних запитів та координацію бізнес-процесів. Діаграма класів моделей даних наведена на рисунку 5.10.

```mermaid
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

    class Trip {
        +id: Long
        +routeId: Long
        +driverId: Long
        +plannedStartsAt: Timestamp
        +actualStartsAt: Timestamp
        +status: String
        +passengerCount: Integer
    }

    class Fine {
        +id: Long
        +userId: Long
        +status: String
        +amount: Decimal
        +reason: String
        +issuedBy: String
        +tripId: Long
    }

    class Budget {
        +id: Long
        +month: Date
        +plannedIncome: Decimal
        +actualIncome: Decimal
    }

    class Income {
        +id: Long
        +source: String
        +amount: Decimal
    }

    class Expense {
        +id: Long
        +category: String
        +amount: Decimal
    }
```

**Рисунок 5.10 – Діаграма моделей даних інформаційної системи з атрибутами**

Атрибути кожного класу відповідають полям відповідних реляційних таблиць та результатам виконання збережених процедур PostgreSQL. Класи VehicleGpsLog та UserGpsLog пов'язані з відповідними логами GPS-трекінгу серверної частини СУБД. Класи конфігурації сесії (SessionService, DbService) не мають відображення у фізичних таблицях БД і призначені для реалізації безпечного перемикання підключень до бази даних залежно від ролі користувача в поточній сесії.

## 5.11 Діаграма зв'язків моделей даних

На рисунку 5.11 наведені модельні класи із зазначенням ключових зв'язків між ними.

```mermaid
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

**Рисунок 5.11 – Діаграма моделей даних інформаційної системи зі зв'язками**

Реалізація цих зв'язків відображає специфіку функціонування предметної області «Міський транспорт» та організовує коректний обмін даними між ключовими об'єктами системи. Кожна асоціація в моделі, як-от ідентифікація водія та конкретного транспортного засобу в межах одного призначення, або прив'язка квитка до конкретного рейсу та транспортної картки, є критично важливою для забезпечення логічної цілісності бізнес-процесів.

## 5.12 Сервісний рівень застосунку

Класи-сервіси виступають центральною ланкою прикладного шару застосунку, де зосереджена основна бізнес-поведінка системи. Вони виконують роль координаторів: приймають запити від контролерів, перевіряють права доступу та делегують виконання складних операцій базі даних. Головною особливістю цього шару є інкапсуляція механізмів виклику збережених процедур і функцій PostgreSQL. Такий підхід дозволяє перенести важкі обчислення та перевірки обмежень безпосередньо на бік сервера бази даних.

Сервіси забезпечують атомарність операцій за допомогою управління транзакціями на рівні бази даних. Це гарантує, що при виконанні комплексних дій — наприклад, при одночасному створенні рейсу, призначенні водія та оновленні розкладу — дані залишаться в узгодженому стані навіть у разі виникнення помилок. Структурна організація сервісів наведена на рисунку 5.12.

```mermaid
classDiagram
    class CtGuestService {
        <<Public>>
        + listTransportTypes()
        + listRoutes()
        + getStopsNear()
        + getRouteStops()
        + submitComplaint()
    }

    class CtPassengerService {
        <<Profile & Cards>>
        + getMyProfile()
        + getMyCard()
        + topUpCard()
        + getMyFines()
        + payFine()
        + createAppeal()
    }

    class CtDriverService {
        <<Trip Management>>
        + getProfile()
        + getSchedule()
        + getActiveTrip()
        + startTrip()
        + finishTrip()
        + logGps()
    }

    class CtControllerService {
        <<Verification>>
        + checkCard()
        + getActiveTrips()
        + issueFine()
    }

    class CtDispatcherService {
        <<Operations>>
        + listSchedules()
        + createSchedule()
        + listTrips()
        + generateDailyTrips()
        + monitorVehicle()
    }

    class CtManagerService {
        <<HR & Fleet>>
        + hireDriver()
        + addVehicle()
        + createStaffUser()
    }

    class CtAccountantService {
        <<Finance>>
        + createIncome()
        + createExpense()
        + createSalary()
        + getReport()
    }

    class CtMunicipalityService {
        <<Planning>>
        + createRoute()
        + createStop()
        + getPassengerFlow()
        + updateComplaintStatus()
    }
```

**Рисунок 5.12 – Діаграма сервісів інформаційної системи**

## 5.13 Контролери REST API

Класи контролерів виступають фундаментальними компонентами прикладного рівня, що виконують роль посередника між інтерфейсом користувача та логікою обробки даних. Основна функція контролерів полягає в перехопленні вхідних HTTP-запитів, валідації параметрів та координації подальшої взаємодії з сервісним шаром.

В архітектурі системи використовується REST API підхід до побудови контролерів на базі NestJS framework. Всі контролери працюють виключно з JSON-форматом даних, що споживається клієнтським SPA-застосунком на React. Такий підхід дозволяє реалізувати динамічне оновлення інтерфейсу без повного перезавантаження сторінок. Структура контролерів наведена на рисунку 5.13.

```mermaid
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
        + GET /routes/schedule
        + POST /complaints
    }

    class CtPassengerController {
        <<@Controller /passenger>>
        + GET /profile
        + GET /card
        + POST /cards/top-up
        + GET /fines
        + POST /fines/pay
        + POST /fines/appeals
    }

    class CtDriverController {
        <<@Controller /driver>>
        + GET /me
        + GET /schedule
        + GET /active-trip
        + POST /trips/start
        + POST /trips/finish
        + POST /trips/gps
    }

    class CtControllerController {
        <<@Controller /controller>>
        + GET /vehicles
        + GET /cards/check
        + POST /fines
    }

    class CtDispatcherController {
        <<@Controller /dispatcher>>
        + GET /schedules
        + POST /schedules
        + GET /trips
        + POST /trips/generate
        + GET /monitoring
    }

    class CtManagerController {
        <<@Controller /manager>>
        + GET /drivers
        + POST /drivers
        + GET /vehicles
        + POST /vehicles
        + POST /staff
    }

    class CtAccountantController {
        <<@Controller /accountant>>
        + GET /budgets
        + POST /incomes
        + POST /expenses
        + POST /salaries
        + GET /report
    }

    class CtMunicipalityController {
        <<@Controller /municipality>>
        + GET /stops
        + POST /stops
        + GET /routes
        + POST /routes
        + GET /passenger-flow
        + GET /complaints
    }
```

**Рисунок 5.13 – Діаграма контролерів інформаційної системи**

Сервіси та контролери в розробленій інформаційній системі не мають прямого наслідування, оскільки виконують різні функціональні ролі. Їх ідентифікація та підключення до контексту виконання здійснюється за допомогою декораторів NestJS: @Controller для контролерів та @Injectable для сервісів. Взаємодія між ними базується на принципі впровадження залежностей (Dependency Injection), що забезпечується фреймворком NestJS.

Ієрархії сторінок для всіх ролей наведені в додатку Д.
