# 7 ЗАПИТИ ДО БАЗИ ДАНИХ ДЛЯ РОЗВ-ЯЗАННЯ ПОСТАВЛЕНИХ ЗАДАЧ

У розділі наведено приклади SQL-запитів і викликів функцій, що реалізують задачі користувачів системи міського транспорту. Доступ до даних організовано через VIEW і SECURITY DEFINER функції відповідних API-схем, тому приклади орієнтовані саме на ці об-єкти. Запити згруповано за ролями користувачів і відповідають задачам з документа "Задачі користувачів а також опис сутностей".

## 7.1 Гість

Задача: перегляд найближчих зупинок за координатами користувача.

```sql
SELECT *
FROM guest_api.find_nearby_stops(:lon, :lat, :radius_m, :limit);
```

Лістинг 7.1 - Пошук найближчих зупинок

Функція `guest_api.find_nearby_stops` приймає координати та радіус пошуку. Повертаються id, назва, координати та відстань до зупинки у метрах. Параметри :lon і :lat надходять з GPS, а :radius_m і :limit задаються інтерфейсом карти. Виклик виконується з правами функції і не потребує прямого доступу гостя до `public.stops`.

Джерело: 0002_guest_api.sql

Задача: планування поїздки з точки А в точку Б.

```sql
SELECT route_option
FROM guest_api.plan_route(
  :lon_a,
  :lat_a,
  :lon_b,
  :lat_b,
  :radius_m,
  :max_wait_min,
  :max_results
);
```

Лістинг 7.2 - Планування маршруту між двома точками

Функція `guest_api.plan_route` повертає варіанти маршруту у вигляді JSONB. Координати точок А і Б беруться з інтерфейсу, а :radius_m задає зону пошуку найближчих зупинок. Параметр :max_wait_min обмежує час очікування, :max_results - кількість варіантів. Результат містить сегменти маршруту та може використовуватись для побудови підказок на карті.

Джерело: 0002_guest_api.sql

Задача: перегляд розкладу руху по обраному маршруту.

```sql
SELECT r.number, r.transport_type_name, s.work_start_time, s.work_end_time, s.interval_min
FROM guest_api.v_routes r
JOIN guest_api.v_schedules s ON s.route_id = r.id
WHERE r.number = :route_number AND r.transport_type_name = :transport_type;
```

Лістинг 7.3 - Перегляд розкладу руху маршруту

Запит використовує `guest_api.v_routes` і `guest_api.v_schedules`, тому гостю не потрібен прямий доступ до базових таблиць. Умови WHERE відбирають маршрут за номером і типом транспорту, які вводяться користувачем. Поля work_start_time, work_end_time та interval_min відповідають часу початку, завершення та інтервалу руху. Результат застосовується для показу розкладу на клієнтській стороні.

Джерело: 0002_guest_api.sql

Задача: подати скаргу або пропозицію.

```sql
SELECT guest_api.submit_complaint(
  :type,
  :message,
  :contact_info,
  :route_number,
  :transport_type,
  :vehicle_number
);
```

Лістинг 7.4 - Подання скарги або пропозиції гостем

Функція `guest_api.submit_complaint` приймає тип звернення, текст, контактні дані та опціональні дані про маршрут і транспорт. Запис створюється у `public.complaints_suggestions` зі статусом "Подано" і поточним часом. Для гостя user_id дорівнює NULL, що відповідає анонімному зверненню. Параметри :route_number, :transport_type та :vehicle_number дозволяють пов-язати скаргу з конкретним маршрутом або транспортом.

Джерело: 0002_guest_api.sql

## 7.2 Пасажир

Задача: переглянути транспортну картку та баланс.

```sql
SELECT id, card_number, balance, last_top_up
FROM passenger_api.v_my_cards;
```

Лістинг 7.5 - Перегляд транспортної картки пасажира

Представлення `passenger_api.v_my_cards` повертає картки поточного користувача за session_user. Поля card_number і balance використовуються для показу ідентифікатора картки та залишку. Поле last_top_up обчислюється як час останнього поповнення. Таким чином пасажир бачить лише власні дані без доступу до `public.transport_cards`.

Джерело: 0003_passenger_api.sql

Задача: переглянути список здійснених поїздок.

```sql
SELECT ticket_id, purchased_at, price, route_number, transport_type
FROM passenger_api.v_my_trips
ORDER BY purchased_at DESC;
```

Лістинг 7.6 - Перегляд історії поїздок

`passenger_api.v_my_trips` об-єднує квитки, рейси та маршрути, тому пасажир одразу отримує контекст поїздки. Вибірка обмежена поточним користувачем через session_user. Поля route_number і transport_type зручні для відображення у застосунку. Сортування за purchased_at DESC показує останні поїздки першими.

Джерело: 0003_passenger_api.sql

Задача: оскаржити штраф.

```sql
SELECT passenger_api.submit_fine_appeal(:fine_id, :message) AS appeal_id;
```

Лістинг 7.7 - Подання апеляції на штраф

Функція `passenger_api.submit_fine_appeal` створює запис у `public.fine_appeals`. Вона перевіряє, що штраф належить поточному користувачу і має допустимий статус. Після створення апеляції статус штрафу змінюється на "В процесі". Параметри :fine_id і :message вводяться пасажиром у формі апеляції.

Джерело: 0003_passenger_api.sql

Задача: оплатити штраф.

```sql
SELECT passenger_api.pay_fine(:fine_id, :card_id);
```

Лістинг 7.8 - Оплата штрафу пасажиром

Функція `passenger_api.pay_fine` списує кошти з картки та оновлює статус штрафу. Вона блокує рядок картки через FOR UPDATE і перевіряє, що картка належить пасажиру. Операція оновлює `public.transport_cards` і `public.fines` в одній транзакції. Параметри :fine_id і :card_id надходять з інтерфейсу оплати.

Джерело: 0003_passenger_api.sql

Задача: обмежити доступ пасажира до власних карток через RLS.

```sql
ALTER TABLE transport_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY passenger_cards_select
ON transport_cards
FOR SELECT
TO ct_passenger_role
USING (user_id = (SELECT id FROM users WHERE login = session_user));
```

Лістинг 7.9 - Приклад політики RLS для карток

Команда ENABLE ROW LEVEL SECURITY активує політики для таблиці `public.transport_cards`. Політика `passenger_cards_select` дозволяє SELECT тільки для рядків, де user_id збігається з поточним session_user. Це гарантує, що пасажир бачить лише свою картку навіть при доступі через VIEW. Такий підхід відповідає вимогам безпеки thick database.

Джерело: 0001_api_structure.sql

## 7.3 Водій

Задача: перегляд робочого графіка на сьогодні.

```sql
SELECT trip_id, fleet_number, route_number, direction, transport_type,
       planned_starts_at, planned_ends_at, status
FROM driver_api.v_my_today_schedule
ORDER BY planned_starts_at;
```

Лістинг 7.10 - Перегляд робочого графіка водія

Представлення `driver_api.v_my_today_schedule` показує рейси поточного водія. Вибірка базується на session_user і містить тільки scheduled та in_progress рейси. Поля planned_starts_at і planned_ends_at використовуються для побудови графіка. Дані про маршрут і транспорт зібрані через JOIN усередині VIEW.

Джерело: 0004_operational_api.sql

Задача: перегляд зупинок маршруту.

```sql
SELECT stop_id, stop_name, lon, lat, distance_to_next_km, sort_order
FROM guest_api.v_route_stops_ordered
WHERE route_id = :route_id
ORDER BY sort_order;
```

Лістинг 7.11 - Перегляд зупинок маршруту водієм

Представлення `guest_api.v_route_stops_ordered` будує впорядкований список зупинок через рекурсивний CTE. Фільтр за route_id задається з інтерфейсу водія при виборі маршруту. Поля lon, lat і distance_to_next_km потрібні для навігації та оцінки інтервалів між зупинками. Сортування за sort_order гарантує правильний порядок проходження маршруту.

Джерело: 0002_guest_api.sql

Задача: відмітка "Початок рейсу".

```sql
SELECT driver_api.start_trip(:trip_id, :started_at) AS trip_id;
```

Лістинг 7.12 - Початок рейсу

Функція `driver_api.start_trip` запускає рейс і повертає його ідентифікатор. Вона знаходить водія за session_user і перевіряє відсутність іншого активного рейсу. Запис у `public.trips` оновлюється: status стає 'in_progress', а actual_starts_at отримує значення :started_at. Якщо :trip_id не передано, обирається найближчий scheduled рейс.

Джерело: 0004_operational_api.sql

Задача: відмітка "Завершення рейсу".

```sql
SELECT driver_api.finish_trip(:ended_at) AS trip_id;
```

Лістинг 7.13 - Завершення рейсу

`driver_api.finish_trip` завершує активний рейс поточного водія. Функція знаходить останній in_progress рейс і оновлює `public.trips`. Поле actual_ends_at встановлюється у значення :ended_at, а статус змінюється на 'completed'. Результатом є id завершеного рейсу для підтвердження операції.

Джерело: 0004_operational_api.sql

## 7.4 Диспетчер

Задача: створення нового розкладу.

```sql
SELECT dispatcher_api.create_schedule(
  :route_id,
  :vehicle_id,
  :work_start_time,
  :work_end_time,
  :interval_min,
  :monday,
  :tuesday,
  :wednesday,
  :thursday,
  :friday,
  :saturday,
  :sunday
) AS schedule_id;
```

Лістинг 7.14 - Створення розкладу диспетчером

Функція `dispatcher_api.create_schedule` додає запис у `public.schedules`. Вона перевіряє, що транспорт належить маршруту, і що час завершення більший за час початку. Параметри днів тижня дозволяють налаштувати дні роботи маршруту. Повертається id створеного розкладу для подальших операцій.

Джерело: 0005_dispatcher_api.sql

Задача: перегляд конкретного розкладу.

```sql
SELECT id, route_id, route_number, direction, transport_type,
       work_start_time, work_end_time, interval_min, fleet_number
FROM dispatcher_api.v_schedules_list
WHERE id = :schedule_id;
```

Лістинг 7.15 - Перегляд розкладу за ідентифікатором

`dispatcher_api.v_schedules_list` об-єднує розклади з маршрутами та транспортом. Умовою WHERE відбирається потрібний запис за :schedule_id. Поля work_start_time, work_end_time та interval_min відповідають основним параметрам руху. Це дозволяє показати деталі розкладу без прямого доступу до `public.schedules`.

Джерело: 0005_dispatcher_api.sql

Задача: призначення водія на транспорт.

```sql
SELECT dispatcher_api.assign_driver_v2(:driver_id, :fleet_number);
```

Лістинг 7.16 - Призначення водія на транспорт

Функція `dispatcher_api.assign_driver_v2` створює запис у `public.driver_vehicle_assignments`. Вона знаходить vehicle_id за бортовим номером :fleet_number. Поле assigned_at встановлюється як поточний час. Призначення використовується у всіх диспетчерських і водійських представленнях.

Джерело: 0005_dispatcher_api.sql

Задача: моніторинг позиції транспорту.

```sql
SELECT id, fleet_number, route_number, transport_type,
       last_lon, last_lat, last_recorded_at, status, current_driver_name
FROM dispatcher_api.v_vehicle_monitoring
ORDER BY fleet_number;
```

Лістинг 7.17 - Моніторинг транспорту диспетчером

Представлення `dispatcher_api.v_vehicle_monitoring` показує актуальні GPS-дані транспорту. Поля last_lon, last_lat і last_recorded_at заповнюються тригером після логування GPS. Значення status визначається за часом останнього запису і дозволяє відрізнити активний транспорт. Дані використовуються для відображення транспорту на карті диспетчера.

Джерело: 0005_dispatcher_api.sql

## 7.5 Контролер

Задача: перевірка транспортної картки пасажира.

```sql
SELECT *
FROM controller_api.check_card(:card_number);
```

Лістинг 7.18 - Перевірка картки контролером

Функція `controller_api.check_card` повертає баланс картки та дані про останню поїздку. Вхідний параметр :card_number зчитується з фізичної картки або QR-коду. Результат містить інформацію про власника та маршрут останнього квитка. Це дозволяє контролеру швидко перевірити валідність проїзду.

Джерело: 0009_controller_api.sql

Задача: визначення активного рейсу за номером транспорту для оформлення штрафу.

```sql
SELECT *
FROM controller_api.get_active_trips(:fleet_number, :checked_at);
```

Лістинг 7.19 - Отримання активного рейсу для транспорту

Функція `controller_api.get_active_trips` шукає рейси зі статусом in_progress. Параметр :fleet_number задає транспорт, а :checked_at передається як час перевірки. Вибірка використовує призначення водія на транспорт через `driver_vehicle_assignments`. Отримані trip_id застосовуються під час виписування штрафу.

Джерело: 0009_controller_api.sql

Задача: реєстрація штрафу.

```sql
SELECT controller_api.issue_fine(
  :card_number,
  :amount,
  :reason,
  :fleet_number,
  :checked_at,
  :trip_id
) AS fine_id;
```

Лістинг 7.20 - Реєстрація штрафу контролером

Функція `controller_api.issue_fine` створює запис у `public.fines`. Вона перевіряє існування картки, знаходить активний рейс і фіксує issued_by як session_user. Поле status встановлюється у значення "Очікує сплати". Повернений fine_id використовується для подальших операцій пасажира.

Джерело: 0009_controller_api.sql

## 7.6 Менеджер

Задача: прийняття на роботу водія.

```sql
SELECT manager_api.hire_driver(
  :login,
  :password,
  :email,
  :phone,
  :full_name,
  :license_number,
  :categories_json,
  :passport_json
) AS driver_id;
```

Лістинг 7.21 - Найм водія

Функція `manager_api.hire_driver` створює роль PostgreSQL для водія і надає їй `ct_driver_role`. Далі створюється запис у `public.drivers` з персональними даними. Параметри :categories_json і :passport_json передаються як jsonb та зберігаються у відповідних полях. Результатом є id водія, що використовується для подальших призначень.

Джерело: 0007_manager_api.sql

Задача: додавання транспорту.

```sql
SELECT manager_api.add_vehicle_v2(:fleet_number, :model_id, :route_id, NULL) AS vehicle_id;
```

Лістинг 7.22 - Додавання транспортного засобу

`manager_api.add_vehicle_v2` створює запис у `public.vehicles`. Функція перевіряє існування моделі та відповідного типу транспорту. Параметр :route_id пов-язує транспорт з маршрутом і використовується у плануванні рейсів. Повернений vehicle_id застосовується у розкладах і призначеннях водіїв.

Джерело: 0007_manager_api.sql

Задача: створення нового акаунта персоналу.

```sql
SELECT manager_api.create_staff_user(
  :login,
  :password,
  :role,
  :full_name,
  :email,
  :phone
);
```

Лістинг 7.23 - Створення акаунта персоналу

Функція `manager_api.create_staff_user` створює роль для працівника і надає їй потрібні права. Параметр :role обмежений списком дозволених ролей (dispatcher, controller, accountant, municipality). Створений обліковий запис використовується як session_user у відповідних API-схемах. Операція виконується без прямого доступу до системних таблиць ролей.

Джерело: 0007_manager_api.sql

## 7.7 Представник мерії

Задача: створення зупинки.

```sql
SELECT municipality_api.create_stop(:name, :lon, :lat) AS stop_id;
```

Лістинг 7.24 - Створення зупинки

Функція `municipality_api.create_stop` вставляє запис у `public.stops`. Параметри :lon і :lat перевіряються CHECK-обмеженнями таблиці. Повернений stop_id використовується при проектуванні маршрутів. Операція виконується як SECURITY DEFINER, тому роль мерії не має прямого доступу до таблиці.

Джерело: 0008_municipality_api.sql

Задача: проектування нового маршруту.

```sql
SELECT municipality_api.create_route_full(
  :number,
  :transport_type_id,
  :direction,
  :stops_json,
  :points_json
) AS route_id;
```

Лістинг 7.25 - Створення маршруту з зупинками і точками

Функція `municipality_api.create_route_full` створює запис у `public.routes` і наповнює таблиці `public.route_stops` та `public.route_points`. Параметри :stops_json і :points_json містять масиви зупинок та координат точок, що надходять з інтерфейсу планування. У процесі створюються зв-язки prev/next між зупинками і точками. Після вставки виконується `municipality_api.recalculate_route_stop_distances` для обчислення відстаней.

Джерело: 0008_municipality_api.sql

Задача: аналітика пасажиро-потоку.

```sql
SELECT *
FROM municipality_api.get_passenger_flow(:start_date, :end_date, :route_number, :transport_type);
```

Лістинг 7.26 - Отримання пасажиро-потоку

Функція `municipality_api.get_passenger_flow` повертає дані по завершених рейсах. Діапазон дат задається параметрами :start_date та :end_date. Додатково можна фільтрувати за :route_number і :transport_type. Результат включає дату, маршрут, тип транспорту, бортовий номер та кількість пасажирів.

Джерело: 0008_municipality_api.sql

Задача: перегляд скарг і пропозицій за період.

```sql
SELECT id, type, message, status, created_at, route_number, transport_type, fleet_number, contact_info
FROM municipality_api.v_complaints_dashboard
WHERE created_at >= :from_date AND created_at < :to_date
ORDER BY created_at DESC;
```

Лістинг 7.27 - Перегляд звернень громадян

`municipality_api.v_complaints_dashboard` об-єднує скарги з маршрутами та транспортом. Фільтр за періодом дозволяє отримати звернення за потрібний інтервал. Поля route_number і transport_type допомагають групувати звернення по маршрутах. Цей запит використовується для аналізу якості перевезень.

Джерело: 0008_municipality_api.sql

## 7.8 Бухгалтер

Задача: введення або коригування місячного бюджету.

```sql
SELECT accountant_api.upsert_budget(:month, :planned_income, :planned_expenses, :note) AS budget_id;
```

Лістинг 7.28 - Оновлення бюджету

Функція `accountant_api.upsert_budget` вставляє або оновлює запис у `public.budgets`. Параметр :month визначає місяць бюджету, а :planned_income і :planned_expenses - планові значення. При конфлікті по month виконується оновлення полів. Повернений budget_id використовується для подальших операцій.

Джерело: 0006_accountant_api.sql

Задача: облік витрат.

```sql
SELECT accountant_api.add_expense(:category, :amount, :description, :occurred_at) AS expense_id;
```

Лістинг 7.29 - Додавання витрати

Функція `accountant_api.add_expense` створює запис у `public.financial_transactions`. Категорія витрати мапиться на source (fuel, maintenance, other_expense). Поле description формується з категорії та коментаря для подальшої аналітики. Повернений expense_id використовується для обліку витрат за документами.

Джерело: 0006_accountant_api.sql

Задача: формування фінансового звіту.

```sql
SELECT report_date, category, amount, type
FROM accountant_api.v_financial_report
WHERE report_date BETWEEN :start_date AND :end_date
ORDER BY report_date, category;
```

Лістинг 7.30 - Перегляд фінансового звіту

`accountant_api.v_financial_report` агрегує дані з `public.financial_transactions` за датою і джерелом. Поле type відображає дохід або витрату, а category подається у бізнес-орієнтованому вигляді. Фільтр за датами дозволяє будувати звіт за потрібний період. Результат використовується для підсумкового аналізу бюджету.

Джерело: 0006_accountant_api.sql

Задача: нарахування заробітної плати водію.

```sql
SELECT accountant_api.pay_salary(:driver_id, :rate, :units, NULL) AS salary_payment_id;
```

Лістинг 7.31 - Нарахування зарплати

Функція `accountant_api.pay_salary` створює запис у `public.salary_payments`. Вона обчислює суму з параметрів :rate і :units, якщо :total не задано. Вставка у salary_payments запускає тригер `trg_salary_expense` AFTER INSERT ON public.salary_payments, який додає витрату у `public.financial_transactions`. Повернений salary_payment_id використовується для історії виплат.

Джерело: 0006_accountant_api.sql

Наведені приклади демонструють застосування представлень і функцій для вирішення ключових задач користувачів. Запити на читання виконуються через VIEW, що агрегують дані з кількох таблиць та забезпечують контроль доступу. Операції зміни даних реалізовано через SECURITY DEFINER функції, де зосереджено валідацію і бізнес-правила. Для фінансових операцій застосовано тригери, що автоматично синхронізують проводки. Контроль доступу додатково посилюється RLS політиками для персональних даних. Повні тексти функцій, тригерів і представлень доцільно винести в додатки, зокрема у вигляді файлів міграцій 0000_init.sql, 0001_api_structure.sql, 0002_guest_api.sql, 0003_passenger_api.sql, 0004_operational_api.sql, 0005_dispatcher_api.sql, 0006_accountant_api.sql, 0007_manager_api.sql, 0008_municipality_api.sql, 0009_controller_api.sql, 0010_security_hardening.sql.
