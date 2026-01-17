# Опис усіх наявних зв'язків між таблицями

## Основні зв'язки (з FK-обмеженнями)

### Користувачі та автентифікація

• Зв'язок між **transport_cards** та **users**. Кожен зареєстрований пасажир отримує одну транспортну картку для оплати проїзду. Отже, між сутностями transport_cards та users існує зв'язок **one-to-one**. Для формалізації використано transport_cards.user_id -> users.id (з UNIQUE constraint на user_id).

• Зв'язок між **user_gps_logs** та **users**. Система відстежує GPS-координати користувачів для пошуку найближчих зупинок. Один користувач може мати багато записів GPS. Отже, між сутностями user_gps_logs та users існує зв'язок **one-to-many**. Для формалізації використано user_gps_logs.user_id -> users.id.

### Транспортний парк

• Зв'язок між **vehicle_models** та **transport_types**. Кожна модель транспорту належить до певного типу (автобус, тролейбус, трамвай). Один тип може мати багато моделей. Отже, між сутностями vehicle_models та transport_types існує зв'язок **one-to-many**. Для формалізації використано vehicle_models.type_id -> transport_types.id.

• Зв'язок між **vehicles** та **vehicle_models**. Кожен транспортний засіб може мати визначену модель. Одна модель може бути у багатьох транспортних засобів. Зв'язок необов'язковий для vehicles (vehicle_model_id може бути NULL). Отже, між сутностями vehicles та vehicle_models існує зв'язок **one-to-many**. Для формалізації використано vehicles.vehicle_model_id -> vehicle_models.id.

• Зв'язок між **vehicles** та **routes**. Кожен транспортний засіб призначений на певний маршрут. Один маршрут може обслуговуватися багатьма транспортними засобами. Отже, між сутностями vehicles та routes існує зв'язок **one-to-many**. Для формалізації використано vehicles.route_id -> routes.id.

• Зв'язок між **vehicle_gps_logs** та **vehicles**. Система записує GPS-координати транспорту для моніторингу в реальному часі. Один транспорт може мати багато записів GPS. Отже, між сутностями vehicle_gps_logs та vehicles існує зв'язок **one-to-many**. Для формалізації використано vehicle_gps_logs.vehicle_id -> vehicles.id.

### Маршрутна мережа

• Зв'язок між **routes** та **transport_types**. Кожен маршрут обслуговується певним типом транспорту (автобус, тролейбус, трамвай). Один тип транспорту може мати багато маршрутів. Отже, між сутностями routes та transport_types існує зв'язок **one-to-many**. Для формалізації використано routes.transport_type_id -> transport_types.id.

• Зв'язок між **routes** та **stops** (через проміжну таблицю **route_stops**). Маршрут проходить через декілька зупинок, і одна зупинка може бути на багатьох маршрутах. Отже, між сутностями routes та stops існує зв'язок **many-to-many**. Для формалізації використано проміжну таблицю route_stops з route_stops.route_id -> routes.id та route_stops.stop_id -> stops.id.

• Зв'язок таблиці **route_stops** із самою собою. Зупинки на маршруті впорядковані у вигляді двозв'язного списку для визначення послідовності руху. Кожен запис посилається на попередню та наступну зупинку маршруту. Отже, існує зв'язок **one-to-one** для визначення порядку. Для формалізації використано route_stops.prev_route_stop_id -> route_stops.id та route_stops.next_route_stop_id -> route_stops.id (обидва з UNIQUE constraint).

• Зв'язок між **route_points** та **routes**. Точки маршруту визначають GPS-геометрію для відображення на карті. Один маршрут може мати багато точок. Отже, між сутностями route_points та routes існує зв'язок **one-to-many**. Для формалізації використано route_points.route_id -> routes.id.

• Зв'язок таблиці **route_points** із самою собою. Точки маршруту впорядковані у вигляді двозв'язного списку для побудови лінії маршруту. Кожна точка посилається на попередню та наступну. Отже, існує зв'язок **one-to-one** для визначення порядку. Для формалізації використано route_points.prev_route_point_id -> route_points.id та route_points.next_route_point_id -> route_points.id (обидва з UNIQUE constraint).

### Розклад та рейси

• Зв'язок між **schedules** та **routes**. Розклад визначає робочі години та інтервали руху для маршруту. Один маршрут може мати декілька розкладів (для різних транспортних засобів). Отже, між сутностями schedules та routes існує зв'язок **one-to-many**. Для формалізації використано schedules.route_id -> routes.id.

• Зв'язок між **schedules** та **vehicles**. Розклад може бути прив'язаний до конкретного транспортного засобу. Зв'язок необов'язковий (vehicle_id може бути NULL). Отже, між сутностями schedules та vehicles існує зв'язок **one-to-many**. Для формалізації використано schedules.vehicle_id -> vehicles.id.

• Зв'язок між **trips** та **routes**. Кожен рейс виконується по певному маршруту. Один маршрут може мати багато рейсів. Отже, між сутностями trips та routes існує зв'язок **one-to-many**. Для формалізації використано trips.route_id -> routes.id.

• Зв'язок між **trips** та **drivers**. Кожен рейс виконується певним водієм. Один водій може виконати багато рейсів. Отже, між сутностями trips та drivers існує зв'язок **one-to-many**. Для формалізації використано trips.driver_id -> drivers.id.

### Водії та призначення

• Зв'язок між **drivers** та **vehicles** (через проміжну таблицю **driver_vehicle_assignments**). Водій призначається на транспортний засіб, і ця історія зберігається. Один водій може бути призначений на різні транспортні засоби (в різний час), і один транспорт може мати різних водіїв. Отже, між сутностями drivers та vehicles існує зв'язок **many-to-many**. Для формалізації використано проміжну таблицю driver_vehicle_assignments з driver_vehicle_assignments.driver_id -> drivers.id та driver_vehicle_assignments.vehicle_id -> vehicles.id.

• Зв'язок між **salary_payments** та **drivers**. Кожна виплата зарплати прив'язана до водія. Один водій може мати багато виплат. Отже, між сутностями salary_payments та drivers існує зв'язок **one-to-many**. Для формалізації використано salary_payments.driver_id -> drivers.id.

### Оплата проїзду

• Зв'язок між **card_top_ups** та **transport_cards**. Кожне поповнення картки записується в історію. Одна картка може мати багато поповнень. Отже, між сутностями card_top_ups та transport_cards існує зв'язок **one-to-many**. Для формалізації використано card_top_ups.card_id -> transport_cards.id.

• Зв'язок між **tickets** та **trips**. Квиток купується на певний рейс. Один рейс може мати багато проданих квитків. Отже, між сутностями tickets та trips існує зв'язок **one-to-many**. Для формалізації використано tickets.trip_id -> trips.id.

• Зв'язок між **tickets** та **transport_cards**. Квиток оплачується з транспортної картки. Одна картка може мати багато куплених квитків. Отже, між сутностями tickets та transport_cards існує зв'язок **one-to-many**. Для формалізації використано tickets.card_id -> transport_cards.id.

### Система штрафів

• Зв'язок між **fines** та **users**. Штраф виписується на конкретного користувача (пасажира). Один користувач може мати багато штрафів. Отже, між сутностями fines та users існує зв'язок **one-to-many**. Для формалізації використано fines.user_id -> users.id.

• Зв'язок між **fines** та **trips**. Штраф виписується під час конкретного рейсу. Один рейс може мати багато виписаних штрафів. Отже, між сутностями fines та trips існує зв'язок **one-to-many**. Для формалізації використано fines.trip_id -> trips.id.

• Зв'язок між **fine_appeals** та **fines**. Пасажир може подати апеляцію на штраф. Один штраф може мати тільки одну апеляцію (UNIQUE constraint). Отже, між сутностями fine_appeals та fines існує зв'язок **one-to-one**. Для формалізації використано fine_appeals.fine_id -> fines.id (з UNIQUE constraint на fine_id).

### Зворотній зв'язок

• Зв'язок між **complaints_suggestions** та **users**. Авторизований користувач може подати скаргу або пропозицію. Зв'язок необов'язковий (анонімні скарги мають user_id = NULL). Один користувач може подати багато скарг. Отже, між сутностями complaints_suggestions та users існує зв'язок **one-to-many**. Для формалізації використано complaints_suggestions.user_id -> users.id.

• Зв'язок між **complaints_suggestions** та **trips**. Скарга може бути пов'язана з конкретним рейсом. Зв'язок необов'язковий (trip_id може бути NULL). Отже, між сутностями complaints_suggestions та trips існує зв'язок **one-to-many**. Для формалізації використано complaints_suggestions.trip_id -> trips.id.

• Зв'язок між **complaints_suggestions** та **routes**. Скарга може бути пов'язана з конкретним маршрутом. Зв'язок необов'язковий (route_id може бути NULL). Отже, між сутностями complaints_suggestions та routes існує зв'язок **one-to-many**. Для формалізації використано complaints_suggestions.route_id -> routes.id.

• Зв'язок між **complaints_suggestions** та **vehicles**. Скарга може бути пов'язана з конкретним транспортним засобом. Зв'язок необов'язковий (vehicle_id може бути NULL). Отже, між сутностями complaints_suggestions та vehicles існує зв'язок **one-to-many**. Для формалізації використано complaints_suggestions.vehicle_id -> vehicles.id.

### Фінансова система

• Зв'язок між **financial_transactions** та **budgets**. Кожна фінансова транзакція автоматично прив'язується до місячного бюджету. Один бюджет може мати багато транзакцій. Зв'язок реалізований через природний ключ (budget_month -> month). Отже, між сутностями financial_transactions та budgets існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.budget_month -> budgets.month (FK на UNIQUE поле).

• Зв'язок між **financial_transactions** та **tickets**. Транзакція доходу може бути пов'язана з купівлею квитка. Зв'язок необов'язковий. Отже, між сутностями financial_transactions та tickets існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.ticket_id -> tickets.id.

• Зв'язок між **financial_transactions** та **fines**. Транзакція доходу може бути пов'язана з оплатою штрафу. Зв'язок необов'язковий. Отже, між сутностями financial_transactions та fines існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.fine_id -> fines.id.

• Зв'язок між **financial_transactions** та **salary_payments**. Транзакція витрат може бути пов'язана з виплатою зарплати. Зв'язок необов'язковий. Отже, між сутностями financial_transactions та salary_payments існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.salary_payment_id -> salary_payments.id.

• Зв'язок між **financial_transactions** та **trips**. Транзакція може бути пов'язана з рейсом для аналітики. Зв'язок необов'язковий. Отже, між сутностями financial_transactions та trips існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.trip_id -> trips.id.

• Зв'язок між **financial_transactions** та **routes**. Транзакція може бути пов'язана з маршрутом для аналітики. Зв'язок необов'язковий. Отже, між сутностями financial_transactions та routes існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.route_id -> routes.id.

• Зв'язок між **financial_transactions** та **drivers**. Транзакція може бути пов'язана з водієм для аналітики. Зв'язок необов'язковий. Отже, між сутностями financial_transactions та drivers існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.driver_id -> drivers.id.

• Зв'язок між **financial_transactions** та **transport_cards**. Транзакція може бути пов'язана з карткою для аналітики. Через картку можна отримати користувача (card_id -> transport_cards.user_id). Зв'язок необов'язковий. Отже, між сутностями financial_transactions та transport_cards існує зв'язок **one-to-many**. Для формалізації використано financial_transactions.card_id -> transport_cards.id.

---

## Неявні зв'язки (без FK-обмежень)

• Зв'язок між **fines** та **drivers** (через поле issued_by). Штраф виписується контролером, ім'я якого зберігається в issued_by як session_user. Формально це VARCHAR поле без FK на drivers чи окрему таблицю контролерів.

• Зв'язок між **financial_transactions** та **users** (через поле created_by). Транзакція створюється користувачем, ім'я якого зберігається як current_user. Формально це TEXT поле без FK.

• Зв'язок між **trips** та **vehicles**. Транспортний засіб для рейсу визначається опосередковано через driver_vehicle_assignments (водій -> його поточне призначення -> транспорт). Прямого FK trips.vehicle_id не існує.

---

## Підсумкова таблиця зв'язків

| Тип зв'язку | Кількість |
|-------------|-----------|
| one-to-one | 4 |
| one-to-many | 27 |
| many-to-many | 2 |
| self-reference | 2 |
| **Всього** | **35** |
