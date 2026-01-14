-- ============================================================================
-- 0000_init.sql - Базова структура бази даних City Transport
-- ============================================================================
-- Цей файл створює всі основні таблиці системи міського транспорту.
-- Drizzle ORM генерує цей файл автоматично на основі схеми в /src/db/schema/
--
-- ВАЖЛИВО: Всі бізнес-ролі НЕ мають прямого доступу до цих таблиць!
-- Доступ здійснюється тільки через VIEW та SECURITY DEFINER функції.
-- ============================================================================

-- ============================================================================
-- ФІНАНСОВІ ТАБЛИЦІ
-- ============================================================================

-- Бюджети: місячні записи доходів/витрат для бухгалтера
-- Використовується: ct_accountant_role через accountant_api
CREATE TABLE "budgets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"month" date NOT NULL,
	"income" numeric(14, 2) DEFAULT '0' NOT NULL,
	"expenses" numeric(14, 2) DEFAULT '0' NOT NULL,
	"note" text,
	CONSTRAINT "budgets_month_unique" UNIQUE("month"),
	CONSTRAINT "budgets_income_check" CHECK ("income" >= 0),
	CONSTRAINT "budgets_expenses_check" CHECK ("expenses" >= 0)
);
--> statement-breakpoint

-- Поповнення транспортних карток: історія всіх транзакцій поповнення
-- Використовується: ct_passenger_role для перегляду своїх поповнень
-- RLS: пасажир бачить тільки свої поповнення
CREATE TABLE "card_top_ups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"card_id" bigint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"topped_up_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_top_ups_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint

-- ============================================================================
-- ЗВОРОТНІЙ ЗВ'ЯЗОК
-- ============================================================================

-- Скарги та пропозиції: зворотній зв'язок від пасажирів та анонімних користувачів
-- Використовується: ct_guest_role (анонімні), ct_passenger_role (авторизовані)
-- Обробляється: ct_municipality_role
-- RLS: пасажир бачить тільки свої, муніципалітет бачить усі
CREATE TABLE "complaints_suggestions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"trip_id" bigint,
	"route_id" integer,
	"vehicle_id" bigint,
	"contact_info" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "complaints_suggestions_status_check" CHECK ("status" in ('Подано', 'Розглядається', 'Розглянуто'))
);
--> statement-breakpoint

-- ============================================================================
-- КАДРОВІ ТАБЛИЦІ
-- ============================================================================

-- Призначення водіїв на транспорт: історія всіх призначень
-- Створюється: ct_dispatcher_role через dispatcher_api.assign_driver_v2()
-- Використовується для відстеження, хто на якому транспорті працює
CREATE TABLE "driver_vehicle_assignments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"driver_id" bigint NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_vehicle_assignments_unique" UNIQUE("driver_id","vehicle_id","assigned_at")
);
--> statement-breakpoint

-- Водії: персональні дані та ліцензії водіїв
-- Створюється: ct_manager_role через manager_api.hire_driver()
-- Має окремий PostgreSQL login для автентифікації (thick database)
-- ВАЖЛИВО: login поле = ім'я PostgreSQL ролі водія
CREATE TABLE "drivers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"full_name" text NOT NULL,
	"driver_license_number" text NOT NULL,
	"license_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"passport_data" jsonb NOT NULL,
	CONSTRAINT "drivers_login_unique" UNIQUE("login"),
	CONSTRAINT "drivers_email_unique" UNIQUE("email"),
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "drivers_driver_license_number_unique" UNIQUE("driver_license_number")
);
--> statement-breakpoint

-- ============================================================================
-- ФІНАНСОВІ ОПЕРАЦІЇ
-- ============================================================================

-- Витрати: облік всіх витрат компанії
-- Створюється: ct_accountant_role через accountant_api.record_expense()
-- Категорії: паливо, ремонт, зарплата, тощо
CREATE TABLE "expenses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"document_ref" text,
	CONSTRAINT "expenses_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint

-- ============================================================================
-- СИСТЕМА ШТРАФІВ
-- ============================================================================

-- Апеляції на штрафи: оскарження штрафів пасажирами
-- Створюється: ct_passenger_role через passenger_api.submit_fine_appeal()
-- Один штраф = одна апеляція (UNIQUE fine_id)
CREATE TABLE "fine_appeals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fine_id" bigint NOT NULL,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fine_appeals_fine_id_unique" UNIQUE("fine_id"),
	CONSTRAINT "fine_appeals_status_check" CHECK ("status" in ('Подано', 'Перевіряється', 'Відхилено', 'Прийнято'))
);
--> statement-breakpoint

-- Штрафи: штрафи виписані контролерами
-- Створюється: ct_controller_role через controller_api.issue_fine()
-- ВАЖЛИВО: issued_by = session_user (контролер, що виписав штраф)
-- ВАЖЛИВО: trip_id обов'язковий (штраф не може бути без активного рейсу)
-- RLS: пасажир бачить тільки свої штрафи
CREATE TABLE "fines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"status" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"issued_by" text DEFAULT current_user NOT NULL,
	"trip_id" bigint NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fines_amount_check" CHECK ("amount" > 0),
	CONSTRAINT "fines_status_check" CHECK ("status" in ('Очікує сплати', 'В процесі', 'Оплачено', 'Відмінено', 'Прострочено'))
);
--> statement-breakpoint

-- ============================================================================
-- МАРШРУТНА МЕРЕЖА
-- ============================================================================

-- Точки маршруту: GPS координати для відображення геометрії маршруту на карті
-- Створюється: ct_municipality_role через municipality_api
-- Двозв'язний список (prev_route_point_id, next_route_point_id) для порядку точок
-- CHECK constraints: координати в межах [-180,180] для lon, [-90,90] для lat
CREATE TABLE "route_points" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route_id" bigint NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"prev_route_point_id" bigint,
	"next_route_point_id" bigint,
	CONSTRAINT "route_points_prev_route_point_id_unique" UNIQUE("prev_route_point_id"),
	CONSTRAINT "route_points_next_route_point_id_unique" UNIQUE("next_route_point_id"),
	CONSTRAINT "route_points_lon_check" CHECK ("lon" >= -180 AND "lon" <= 180),
	CONSTRAINT "route_points_lat_check" CHECK ("lat" >= -90 AND "lat" <= 90)
);
--> statement-breakpoint

-- Зупинки на маршруті: зв'язок маршрут-зупинка з порядком
-- Двозв'язний список для порядку зупинок на маршруті
-- distance_to_next_km - відстань до наступної зупинки (для розрахунку часу)
-- Використовується guest_api.plan_route() для побудови маршрутів
CREATE TABLE "route_stops" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route_id" bigint NOT NULL,
	"stop_id" bigint NOT NULL,
	"prev_route_stop_id" bigint,
	"next_route_stop_id" bigint,
	"distance_to_next_km" numeric(10, 3),
	CONSTRAINT "route_stops_prev_route_stop_id_unique" UNIQUE("prev_route_stop_id"),
	CONSTRAINT "route_stops_next_route_stop_id_unique" UNIQUE("next_route_stop_id"),
	CONSTRAINT "route_stops_route_stop_unique" UNIQUE("route_id","stop_id"),
	CONSTRAINT "route_stops_distance_check" CHECK ("distance_to_next_km" >= 0)
);
--> statement-breakpoint

-- Маршрути: основна таблиця маршрутів міського транспорту
-- Створюється: ct_municipality_role через municipality_api.create_route()
-- direction: 'forward' (прямий) або 'reverse' (зворотній)
-- UNIQUE(transport_type_id, number, direction) - один номер маршруту може мати 2 напрямки
CREATE TABLE "routes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transport_type_id" bigint NOT NULL,
	"number" text NOT NULL,
	"direction" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "routes_transport_type_number_direction_unique" UNIQUE("transport_type_id","number","direction"),
	CONSTRAINT "routes_direction_check" CHECK ("direction" in ('forward', 'reverse'))
);
--> statement-breakpoint

-- ============================================================================
-- ЗАРПЛАТА ТА РОЗКЛАД
-- ============================================================================

-- Виплати зарплати: облік виплат водіям та персоналу
-- Створюється: ct_accountant_role через accountant_api.record_salary_payment()
-- Може бути прив'язана до водія (driver_id) або до іменованого працівника (employee_name)
CREATE TABLE "salary_payments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"driver_id" bigint NOT NULL REFERENCES "drivers"("id"),
	"rate" numeric(12, 2),
	"units" integer,
	"total" numeric(12, 2) NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "salary_payments_total_check" CHECK ("total" > 0),
	CONSTRAINT "salary_payments_rate_check" CHECK ("rate" is null or "rate" > 0),
	CONSTRAINT "salary_payments_units_check" CHECK ("units" is null or "units" > 0)
);
--> statement-breakpoint

-- Розклади: робочі години та інтервали руху на маршрутах
-- Створюється: ct_dispatcher_role через dispatcher_api.create_schedule()
-- work_start_time/work_end_time - час роботи маршруту
-- interval_min - інтервал між рейсами в хвилинах
-- Дні тижня (monday-sunday) - чи працює маршрут в цей день
-- valid_from/valid_to - період дії розкладу (опціонально)
CREATE TABLE "schedules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route_id" bigint NOT NULL,
	"vehicle_id" bigint,
	"work_start_time" time NOT NULL,
	"work_end_time" time NOT NULL,
	"interval_min" integer NOT NULL,
	"monday" boolean DEFAULT false NOT NULL,
	"tuesday" boolean DEFAULT false NOT NULL,
	"wednesday" boolean DEFAULT false NOT NULL,
	"thursday" boolean DEFAULT false NOT NULL,
	"friday" boolean DEFAULT false NOT NULL,
	"saturday" boolean DEFAULT false NOT NULL,
	"sunday" boolean DEFAULT false NOT NULL,
	"valid_from" date,
	"valid_to" date,
	CONSTRAINT "schedules_interval_check" CHECK ("interval_min" > 0),
	CONSTRAINT "schedules_time_check" CHECK ("work_end_time" > "work_start_time"),
	CONSTRAINT "schedules_route_vehicle_period_unique" UNIQUE("route_id", "vehicle_id", "valid_from")
);
--> statement-breakpoint

-- ============================================================================
-- ЗУПИНКИ ТА КВИТКИ
-- ============================================================================

-- Зупинки: всі зупинки міського транспорту
-- Створюється: ct_municipality_role
-- CHECK constraints: координати в межах [-180,180] для lon, [-90,90] для lat
-- Індекс gin_trgm_ops для пошуку по назві (guest_api.search_stops_by_name)
CREATE TABLE "stops" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	CONSTRAINT "stops_name_lon_lat_unique" UNIQUE("name","lon","lat"),
	CONSTRAINT "stops_lon_check" CHECK ("lon" >= -180 AND "lon" <= 180),
	CONSTRAINT "stops_lat_check" CHECK ("lat" >= -90 AND "lat" <= 90)
);
--> statement-breakpoint

-- Квитки: історія покупок квитків пасажирами
-- Створюється: ct_passenger_role через passenger_api.buy_ticket()
-- Прив'язується до рейсу (trip_id) та картки (card_id)
-- RLS: пасажир бачить тільки свої квитки
CREATE TABLE "tickets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trip_id" bigint NOT NULL,
	"card_id" bigint NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_price_check" CHECK ("price" >= 0)
);
--> statement-breakpoint

-- Транспортні картки: картки для оплати проїзду
-- Одна картка на одного користувача (UNIQUE user_id)
-- balance - поточний баланс картки
-- card_number - унікальний номер картки (для контролерів)
-- RLS: пасажир бачить тільки свою картку
CREATE TABLE "transport_cards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"card_number" text NOT NULL,
	CONSTRAINT "transport_cards_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "transport_cards_card_number_unique" UNIQUE("card_number"),
	CONSTRAINT "transport_cards_balance_check" CHECK ("balance" >= 0)
);
--> statement-breakpoint

-- ============================================================================
-- ДОВІДНИКИ
-- ============================================================================

-- Типи транспорту: Автобус, Тролейбус, Трамвай, тощо
-- Довідникова таблиця, заповнюється при ініціалізації
CREATE TABLE "transport_types" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "transport_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- ============================================================================
-- РЕЙСИ (TRIPS)
-- ============================================================================

-- Рейси: кожен запис = один рейс транспорту по маршруту
-- Створюється: ct_dispatcher_role через dispatcher_api.create_trip() з плановими часами
-- Виконується: ct_driver_role через driver_api.start_trip() / finish_trip()
--
-- НОВИЙ ПІДХІД (Варіант 2):
-- - planned_starts_at / planned_ends_at - план від диспетчера
-- - actual_starts_at / actual_ends_at - факт від водія
-- - status - статус рейсу: scheduled → in_progress → completed / cancelled
--
-- RLS: водій бачить свої рейси, диспетчер бачить усі
-- vehicle_id отримується через driver_vehicle_assignments (жорстка прив'язка)
CREATE TABLE "trips" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route_id" bigint NOT NULL,
	"driver_id" bigint NOT NULL,

	-- Планові часи (диспетчер створює)
	"planned_starts_at" timestamp NOT NULL,
	"planned_ends_at" timestamp,

	-- Фактичні часи (водій заповнює)
	"actual_starts_at" timestamp,
	"actual_ends_at" timestamp,

	-- Статус рейсу
	"status" text DEFAULT 'scheduled' NOT NULL,

	"passenger_count" integer DEFAULT 0 NOT NULL,

	CONSTRAINT "trips_status_check" CHECK ("status" in ('scheduled', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "trips_actual_ends_after_starts_check" CHECK ("actual_ends_at" is null or "actual_starts_at" is null or "actual_ends_at" > "actual_starts_at"),
	CONSTRAINT "trips_passenger_count_check" CHECK ("passenger_count" >= 0)
);
--> statement-breakpoint

-- ============================================================================
-- PARTIAL UNIQUE INDEX для trips
-- ============================================================================
-- ЧОМУ ЦЕ ВАЖЛИВО:
-- Один водій не може вести два рейси одночасно
-- vehicle_id більше не в trips - він отримується через driver_vehicle_assignments
-- Тому якщо водій унікальний, то і транспорт автоматично унікальний
--
-- WHERE status = 'in_progress' - фільтр тільки для активних рейсів
-- Це дозволяє мати багато завершених/запланованих рейсів з одним driver_id,
-- але тільки один активний рейс на водія
--
-- Альтернатива CHECK constraint - неможлива, бо перевірка міжрядкова
-- Альтернатива тригер - повільніше та менш надійно

CREATE UNIQUE INDEX IF NOT EXISTS trips_active_driver_unique
  ON trips (driver_id) WHERE status = 'in_progress';
--> statement-breakpoint

-- ============================================================================
-- GPS ЛОГИ
-- ============================================================================

-- GPS логи користувачів (пасажирів): для відстеження місцезнаходження
-- Створюється: ct_passenger_role через passenger_api.log_my_gps()
-- Використовується для пошуку найближчих зупинок та аналітики
-- RLS: пасажир може INSERT/SELECT тільки свої логи
-- CHECK constraints: координати в межах [-180,180] для lon, [-90,90] для lat
CREATE TABLE "user_gps_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_gps_logs_lon_check" CHECK ("lon" >= -180 AND "lon" <= 180),
	CONSTRAINT "user_gps_logs_lat_check" CHECK ("lat" >= -90 AND "lat" <= 90)
);
--> statement-breakpoint

-- ============================================================================
-- КОРИСТУВАЧІ (ПАСАЖИРИ)
-- ============================================================================

-- Користувачі (пасажири): зареєстровані пасажири системи
-- Створюється: auth.register_passenger() через ct_guest_role
-- ВАЖЛИВО: login = ім'я PostgreSQL ролі користувача (thick database)
-- При реєстрації створюється PostgreSQL роль з GRANT ct_passenger_role
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"full_name" text NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_unique" UNIQUE("login"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint

-- GPS логи транспорту: відстеження місцезнаходження транспорту в реальному часі
-- Створюється: ct_driver_role через driver_api.log_vehicle_gps()
-- Автоматично оновлює last_lon/last_lat/last_recorded_at в vehicles (через тригер)
-- Використовується диспетчером для моніторингу та виявлення відхилень
CREATE TABLE "vehicle_gps_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_gps_logs_lon_check" CHECK ("lon" >= -180 AND "lon" <= 180),
	CONSTRAINT "vehicle_gps_logs_lat_check" CHECK ("lat" >= -90 AND "lat" <= 90)
);
--> statement-breakpoint

-- ============================================================================
-- ТРАНСПОРТНИЙ ПАРК
-- ============================================================================

-- Моделі транспорту: довідник моделей (ЛАЗ, Богдан, Електрон, тощо)
-- capacity - місткість транспорту (кількість пасажирів)
-- type_id - зв'язок з типом транспорту (автобус/тролейбус/трамвай)
CREATE TABLE "vehicle_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type_id" integer NOT NULL,
	"capacity" integer NOT NULL
);
--> statement-breakpoint

-- Транспортні засоби: весь транспорт компанії
-- Створюється: ct_manager_role через manager_api.add_vehicle()
-- fleet_number - унікальний бортовий номер (використовується контролерами)
-- route_id - призначений маршрут
-- vehicle_model_id - модель транспорту
CREATE TABLE "vehicles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fleet_number" text NOT NULL,
	"vehicle_model_id" bigint,
	"route_id" bigint NOT NULL,
	CONSTRAINT "vehicles_fleet_number_unique" UNIQUE("fleet_number")
);
--> statement-breakpoint

-- ============================================================================
-- ЗОВНІШНІ КЛЮЧІ (FOREIGN KEYS)
-- ============================================================================
-- Забезпечують цілісність даних між таблицями
-- ON DELETE cascade - при видаленні батьківського запису видаляються дочірні
-- ON DELETE no action - забороняє видалення якщо є зв'язані записи
-- ON DELETE set null - при видаленні батьківського запису встановлює NULL

ALTER TABLE "card_top_ups" ADD CONSTRAINT "card_top_ups_card_id_transport_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."transport_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints_suggestions" ADD CONSTRAINT "complaints_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints_suggestions" ADD CONSTRAINT "complaints_suggestions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints_suggestions" ADD CONSTRAINT "complaints_suggestions_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints_suggestions" ADD CONSTRAINT "complaints_suggestions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_vehicle_assignments" ADD CONSTRAINT "driver_vehicle_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_vehicle_assignments" ADD CONSTRAINT "driver_vehicle_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fine_appeals" ADD CONSTRAINT "fine_appeals_fine_id_fines_id_fk" FOREIGN KEY ("fine_id") REFERENCES "public"."fines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fines" ADD CONSTRAINT "fines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fines" ADD CONSTRAINT "fines_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_prev_route_point_id_route_points_id_fk" FOREIGN KEY ("prev_route_point_id") REFERENCES "public"."route_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_next_route_point_id_route_points_id_fk" FOREIGN KEY ("next_route_point_id") REFERENCES "public"."route_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_prev_route_stop_id_route_stops_id_fk" FOREIGN KEY ("prev_route_stop_id") REFERENCES "public"."route_stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_next_route_stop_id_route_stops_id_fk" FOREIGN KEY ("next_route_stop_id") REFERENCES "public"."route_stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_transport_type_id_transport_types_id_fk" FOREIGN KEY ("transport_type_id") REFERENCES "public"."transport_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_card_id_transport_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."transport_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_cards" ADD CONSTRAINT "transport_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_gps_logs" ADD CONSTRAINT "user_gps_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gps_logs" ADD CONSTRAINT "vehicle_gps_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_type_id_transport_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."transport_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_model_id_vehicle_models_id_fk" FOREIGN KEY ("vehicle_model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;

-- ============================================================================
-- UTILITY FUNCTIONS (public schema)
-- ============================================================================
-- Ці функції замінюють дублюючий TypeScript код в сервісах

-- Distance calculation using PostGIS (replaces haversineKm in 3+ services)
CREATE OR REPLACE FUNCTION public.distance_km(
  lon1 numeric, lat1 numeric,
  lon2 numeric, lat2 numeric
) RETURNS numeric AS $$
  SELECT COALESCE(ST_DistanceSphere(
    ST_MakePoint(lon1::float, lat1::float),
    ST_MakePoint(lon2::float, lat2::float)
  ) / 1000.0, 0)::numeric;
$$ LANGUAGE SQL IMMUTABLE;

-- Time parsing: converts time to total minutes (replaces parseTimeToMinutes in 4+ services)
CREATE OR REPLACE FUNCTION public.parse_time_to_minutes(time_val time)
RETURNS numeric AS $$
  SELECT EXTRACT(HOUR FROM time_val) * 60 + EXTRACT(MINUTE FROM time_val);
$$ LANGUAGE SQL IMMUTABLE;

-- Format minutes to HH:MM string (replaces formatMinutes in 3+ services)
CREATE OR REPLACE FUNCTION public.format_minutes_to_time(total_minutes numeric)
RETURNS text AS $$
  SELECT LPAD((total_minutes::int / 60 % 24)::text, 2, '0') || ':' ||
         LPAD((total_minutes::int % 60)::text, 2, '0');
$$ LANGUAGE SQL IMMUTABLE;