# 3. ІНФОРМАЦІЙНЕ МОДЕЛЮВАННЯ ПРЕДМЕТНОЇ ОБЛАСТІ

## 3.1 Повний список таблиць

Таблиця 3.1 – Перелік сутностей бази даних ІС «Міський транспорт»

| Схема.Таблиця | Призначення | Первинний ключ |
|---------------|-------------|----------------|
| public.users | Зареєстровані пасажири системи | id |
| public.drivers | Водії транспорту | id |
| public.transport_types | Довідник типів транспорту | id |
| public.vehicle_models | Довідник моделей транспортних засобів | id |
| public.vehicles | Транспортні засоби підприємства | id |
| public.routes | Маршрути міського транспорту | id |
| public.stops | Зупинки громадського транспорту | id |
| public.route_stops | Зв'язок маршрутів із зупинками | id |
| public.route_points | Точки геометрії маршруту для карти | id |
| public.schedules | Розклади руху транспорту | id |
| public.trips | Рейси транспорту | id |
| public.driver_vehicle_assignments | Призначення водіїв на транспорт | id |
| public.transport_cards | Транспортні картки пасажирів | id |
| public.card_top_ups | Історія поповнень карток | id |
| public.tickets | Придбані квитки | id |
| public.fines | Штрафи пасажирам | id |
| public.fine_appeals | Апеляції на штрафи | id |
| public.budgets | Місячні бюджети підприємства | id |
| public.salary_payments | Виплати заробітної плати | id |
| public.financial_transactions | Єдина книга фінансових операцій | id |
| public.complaints_suggestions | Скарги та пропозиції | id |
| public.user_gps_logs | GPS-логи користувачів | id |
| public.vehicle_gps_logs | GPS-логи транспорту | id |

**Примітка:** Схеми `guest_api`, `passenger_api`, `driver_api`, `controller_api`, `dispatcher_api`, `accountant_api`, `manager_api`, `municipality_api` містять лише VIEW та функції (SECURITY DEFINER), таблиць не мають.

---

## 3.2 Опис сутностей

### public.users

Зареєстровані пасажири системи. Поле login відповідає імені PostgreSQL ролі.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор користувача | PK |
| login | Логін (= ім'я PostgreSQL ролі) | NOT NULL, UNIQUE |
| email | Електронна пошта | NOT NULL, UNIQUE |
| phone | Номер телефону | NOT NULL, UNIQUE |
| full_name | Повне ім'я (ПІБ) | NOT NULL |
| registered_at | Дата та час реєстрації | NOT NULL, DEFAULT now() |

---

### public.drivers

Водії транспорту з персональними даними та ліцензіями.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор водія | PK |
| login | Логін водія (= ім'я PostgreSQL ролі) | NOT NULL, UNIQUE |
| email | Електронна пошта | NOT NULL, UNIQUE |
| phone | Номер телефону | NOT NULL, UNIQUE |
| full_name | Повне ім'я (ПІБ) | NOT NULL |
| driver_license_number | Номер водійського посвідчення | NOT NULL, UNIQUE |
| license_categories | Відкриті категорії прав (JSON-масив) | NOT NULL, DEFAULT '[]' |
| passport_data | Паспортні дані (JSON) | NOT NULL |

---

### public.transport_types

Довідник типів міського транспорту.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор типу | PK |
| name | Назва типу (Автобус, Тролейбус, Трамвай) | NOT NULL, UNIQUE |

---

### public.vehicle_models

Довідник моделей транспортних засобів.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор моделі | PK |
| name | Назва моделі (ЛАЗ, Богдан, Електрон) | NOT NULL |
| type_id | Тип транспорту | NOT NULL, FK → public.transport_types(id) |
| capacity | Місткість (кількість пасажирів) | NOT NULL, CHECK > 0 |

---

### public.vehicles

Транспортні засоби підприємства.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор ТЗ | PK |
| fleet_number | Бортовий (інвентарний) номер | NOT NULL, UNIQUE |
| vehicle_model_id | Модель транспорту | FK → public.vehicle_models(id) |
| route_id | Призначений маршрут | NOT NULL, FK → public.routes(id) |

---

### public.routes

Маршрути міського транспорту.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор маршруту | PK |
| transport_type_id | Тип транспорту | NOT NULL, FK → public.transport_types(id) |
| number | Номер маршруту (напр. "5А") | NOT NULL |
| direction | Напрямок руху | NOT NULL, CHECK IN ('forward', 'reverse') |
| is_active | Ознака активності маршруту | NOT NULL, DEFAULT true |

**Складені обмеження:** UNIQUE(transport_type_id, number, direction)

---

### public.stops

Зупинки громадського транспорту.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор зупинки | PK |
| name | Назва зупинки | NOT NULL |
| lon | Довгота (longitude) | NOT NULL, CHECK [-180, 180] |
| lat | Широта (latitude) | NOT NULL, CHECK [-90, 90] |

**Складені обмеження:** UNIQUE(name, lon, lat)

---

### public.route_stops

Зв'язок маршрутів із зупинками (двозв'язний список).

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор запису | PK |
| route_id | Маршрут | NOT NULL, FK → public.routes(id) ON DELETE CASCADE |
| stop_id | Зупинка | NOT NULL, FK → public.stops(id) |
| prev_route_stop_id | Попередня зупинка на маршруті | UNIQUE, FK → public.route_stops(id) ON DELETE SET NULL |
| next_route_stop_id | Наступна зупинка на маршруті | UNIQUE, FK → public.route_stops(id) ON DELETE SET NULL |
| distance_to_next_km | Відстань до наступної зупинки (км) | CHECK >= 0 |

**Складені обмеження:** UNIQUE(route_id, stop_id)

---

### public.route_points

Точки геометрії маршруту для відображення на карті (двозв'язний список).

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор точки | PK |
| route_id | Маршрут | NOT NULL, FK → public.routes(id) ON DELETE CASCADE |
| lon | Довгота | NOT NULL, CHECK [-180, 180] |
| lat | Широта | NOT NULL, CHECK [-90, 90] |
| prev_route_point_id | Попередня точка | UNIQUE, FK → public.route_points(id) ON DELETE SET NULL |
| next_route_point_id | Наступна точка | UNIQUE, FK → public.route_points(id) ON DELETE SET NULL |

---

### public.schedules

Розклади руху транспорту по днях тижня.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор розкладу | PK |
| route_id | Маршрут | NOT NULL, FK → public.routes(id) |
| vehicle_id | Транспортний засіб | FK → public.vehicles(id) |
| work_start_time | Час початку роботи | NOT NULL |
| work_end_time | Час закінчення роботи | NOT NULL |
| interval_min | Інтервал руху (хвилин) | NOT NULL, CHECK > 0 |
| monday | Працює в понеділок | NOT NULL, DEFAULT false |
| tuesday | Працює у вівторок | NOT NULL, DEFAULT false |
| wednesday | Працює в середу | NOT NULL, DEFAULT false |
| thursday | Працює в четвер | NOT NULL, DEFAULT false |
| friday | Працює в п'ятницю | NOT NULL, DEFAULT false |
| saturday | Працює в суботу | NOT NULL, DEFAULT false |
| sunday | Працює в неділю | NOT NULL, DEFAULT false |

**Складені обмеження:** UNIQUE(route_id, vehicle_id), CHECK(work_end_time > work_start_time)

---

### public.trips

Рейси транспорту по маршруту.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор рейсу | PK |
| route_id | Маршрут | NOT NULL, FK → public.routes(id) |
| driver_id | Водій | NOT NULL, FK → public.drivers(id) |
| planned_starts_at | Плановий час початку | NOT NULL |
| planned_ends_at | Плановий час закінчення | — |
| actual_starts_at | Фактичний час початку | — |
| actual_ends_at | Фактичний час закінчення | CHECK > actual_starts_at |
| status | Статус рейсу | NOT NULL, DEFAULT 'scheduled', CHECK IN ('scheduled', 'in_progress', 'completed', 'cancelled') |
| passenger_count | Кількість пасажирів | NOT NULL, DEFAULT 0, CHECK >= 0 |

**Індекси:** UNIQUE INDEX (driver_id) WHERE status = 'in_progress' — один водій не може мати два активних рейси одночасно

---

### public.driver_vehicle_assignments

Історія призначень водіїв на транспортні засоби.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| driver_id | Водій | NOT NULL, FK → public.drivers(id) ON DELETE CASCADE |
| vehicle_id | Транспортний засіб | NOT NULL, FK → public.vehicles(id) ON DELETE CASCADE |
| assigned_at | Дата та час призначення | NOT NULL, DEFAULT now() |

**Складені обмеження:** UNIQUE(driver_id, vehicle_id, assigned_at)

---

### public.transport_cards

Транспортні картки для оплати проїзду.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор картки | PK |
| user_id | Власник картки | NOT NULL, UNIQUE, FK → public.users(id) ON DELETE CASCADE |
| balance | Поточний баланс (грн) | NOT NULL, DEFAULT 0, CHECK >= 0 |
| card_number | Номер картки | NOT NULL, UNIQUE |

---

### public.card_top_ups

Історія поповнень транспортних карток.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| card_id | Картка | NOT NULL, FK → public.transport_cards(id) |
| amount | Сума поповнення (грн) | NOT NULL, CHECK > 0 |
| topped_up_at | Дата та час поповнення | NOT NULL, DEFAULT now() |

---

### public.tickets

Придбані квитки на проїзд.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор квитка | PK |
| trip_id | Рейс | NOT NULL, FK → public.trips(id) |
| card_id | Транспортна картка | NOT NULL, FK → public.transport_cards(id) |
| price | Вартість квитка (грн) | NOT NULL, CHECK >= 0 |
| purchased_at | Дата та час покупки | NOT NULL, DEFAULT now() |

---

### public.fines

Штрафи, виписані контролерами.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор штрафу | PK |
| user_id | Пасажир-порушник | NOT NULL, FK → public.users(id) |
| status | Статус штрафу | NOT NULL, CHECK IN ('Очікує сплати', 'В процесі', 'Оплачено', 'Відмінено', 'Прострочено') |
| amount | Сума штрафу (грн) | NOT NULL, CHECK > 0 |
| reason | Причина штрафу | NOT NULL |
| issued_by | Логін контролера | NOT NULL, DEFAULT current_user |
| trip_id | Рейс, під час якого виписано | NOT NULL, FK → public.trips(id) |
| issued_at | Дата та час виписування | NOT NULL, DEFAULT now() |
| paid_at | Дата та час оплати | — |

---

### public.fine_appeals

Апеляції на штрафи від пасажирів.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор апеляції | PK |
| fine_id | Штраф, що оскаржується | NOT NULL, UNIQUE, FK → public.fines(id) ON DELETE CASCADE |
| message | Текст апеляції | NOT NULL |
| status | Статус розгляду | NOT NULL, CHECK IN ('Подано', 'Перевіряється', 'Відхилено', 'Прийнято') |
| created_at | Дата та час подання | NOT NULL, DEFAULT now() |

---

### public.budgets

Місячні бюджети підприємства.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| month | Місяць бюджету (перше число місяця) | NOT NULL, UNIQUE |
| planned_income | Планові доходи (грн) | NOT NULL, DEFAULT 0, CHECK >= 0 |
| planned_expenses | Планові витрати (грн) | NOT NULL, DEFAULT 0, CHECK >= 0 |
| actual_income | Фактичні доходи (грн) | NOT NULL, DEFAULT 0, CHECK >= 0 |
| actual_expenses | Фактичні витрати (грн) | NOT NULL, DEFAULT 0, CHECK >= 0 |
| note | Примітка | — |

---

### public.salary_payments

Виплати заробітної плати водіям.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| driver_id | Водій-отримувач | NOT NULL, FK → public.drivers(id) |
| rate | Ставка (грн/од.) | CHECK > 0 |
| units | Кількість одиниць (годин/змін) | CHECK > 0 |
| total | Загальна сума виплати (грн) | NOT NULL, CHECK > 0 |
| paid_at | Дата та час виплати | NOT NULL, DEFAULT now() |

---

### public.financial_transactions

Єдина книга фінансових операцій (доходи та витрати).

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| tx_type | Тип операції | NOT NULL, CHECK IN ('income', 'expense') |
| source | Джерело операції | NOT NULL, CHECK IN ('ticket', 'fine', 'government', 'other', 'salary', 'fuel', 'maintenance', 'other_expense') |
| amount | Сума операції (грн) | NOT NULL, CHECK > 0 |
| occurred_at | Дата та час операції | NOT NULL, DEFAULT now() |
| description | Опис операції | — |
| created_by | Логін користувача, що створив запис | NOT NULL, DEFAULT current_user |
| ticket_id | Квиток (для доходів від квитків) | FK → public.tickets(id) ON DELETE SET NULL |
| fine_id | Штраф (для доходів від штрафів) | FK → public.fines(id) ON DELETE SET NULL |
| salary_payment_id | Виплата ЗП (для витрат на ЗП) | FK → public.salary_payments(id) ON DELETE SET NULL |
| trip_id | Рейс (контекст) | FK → public.trips(id) ON DELETE SET NULL |
| route_id | Маршрут (контекст) | FK → public.routes(id) ON DELETE SET NULL |
| driver_id | Водій (контекст) | FK → public.drivers(id) ON DELETE SET NULL |
| card_id | Транспортна картка (контекст) | FK → public.transport_cards(id) ON DELETE SET NULL |
| user_id | Користувач (контекст) | FK → public.users(id) ON DELETE SET NULL |
| budget_month | Місяць бюджету для агрегації | FK → public.budgets(month) ON DELETE SET NULL |

**Індекси:**
- idx_ft_occurred (occurred_at)
- idx_ft_type_source (tx_type, source)
- idx_ft_budget_month (budget_month)
- idx_ft_ticket (ticket_id) WHERE ticket_id IS NOT NULL
- idx_ft_fine (fine_id) WHERE fine_id IS NOT NULL
- idx_ft_user (user_id) WHERE user_id IS NOT NULL

---

### public.complaints_suggestions

Скарги та пропозиції від користувачів.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| user_id | Автор (якщо авторизований) | FK → public.users(id) |
| type | Тип звернення (скарга/пропозиція) | NOT NULL, CHECK IN ('complaint', 'suggestion') |
| message | Текст звернення | NOT NULL |
| trip_id | Рейс (якщо стосується) | FK → public.trips(id) |
| route_id | Маршрут (якщо стосується) | FK → public.routes(id) |
| vehicle_id | Транспортний засіб (якщо стосується) | FK → public.vehicles(id) |
| contact_info | Контактна інформація | — |
| status | Статус розгляду | NOT NULL, CHECK IN ('Подано', 'Розглядається', 'Розглянуто') |
| created_at | Дата та час створення | NOT NULL, DEFAULT now() |

---

### public.user_gps_logs

GPS-логи користувачів для пошуку найближчих зупинок.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| user_id | Користувач | NOT NULL, FK → public.users(id) ON DELETE CASCADE |
| lon | Довгота | NOT NULL, CHECK [-180, 180] |
| lat | Широта | NOT NULL, CHECK [-90, 90] |
| recorded_at | Дата та час запису | NOT NULL, DEFAULT now() |

---

### public.vehicle_gps_logs

GPS-логи транспорту для моніторингу в реальному часі.

| Атрибут | Опис | Обмеження |
|---------|------|-----------|
| id | Унікальний ідентифікатор | PK |
| vehicle_id | Транспортний засіб | NOT NULL, FK → public.vehicles(id) ON DELETE CASCADE |
| lon | Довгота | NOT NULL, CHECK [-180, 180] |
| lat | Широта | NOT NULL, CHECK [-90, 90] |
| recorded_at | Дата та час запису | NOT NULL, DEFAULT now() |

---

## 3.3 Виявлені особливості

### Архітектурні рішення

1. **Thick Database Pattern** — поле `login` у таблицях `users` та `drivers` відповідає імені PostgreSQL ролі для автентифікації на рівні СУБД.

2. **Двозв'язні списки** — для збереження порядку точок маршруту (`route_points`) та зупинок (`route_stops`) використовуються посилання `prev_*/next_*` замість числового індексу.

3. **Partial Unique Index** — таблиця `trips` має частковий унікальний індекс `WHERE status = 'in_progress'` для забезпечення правила "один водій — один активний рейс".

4. **Уніфікована фінансова система** — `financial_transactions` є єдиною "книгою проводок" з множинними nullable FK для зв'язку з різними джерелами операцій, замість окремих таблиць `incomes`/`expenses`.

### Примітки

- **vehicles.vehicle_model_id** — nullable FK дозволяє ТЗ без прив'язки до моделі.

- **salary_payments.rate та units** — обидва nullable, але `total` обов'язковий (можна записати лише загальну суму без деталізації).
