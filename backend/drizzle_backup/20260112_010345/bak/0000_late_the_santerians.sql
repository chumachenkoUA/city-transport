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
CREATE TABLE "card_top_ups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"card_id" bigint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"topped_up_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_top_ups_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "complaints_suggestions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"trip_id" bigint,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "complaints_suggestions_status_check" CHECK ("status" in ('Подано', 'Розглядається', 'Розглянуто'))
);
--> statement-breakpoint
CREATE TABLE "driver_vehicle_assignments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"driver_id" bigint NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_vehicle_assignments_unique" UNIQUE("driver_id","vehicle_id","assigned_at")
);
--> statement-breakpoint
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
CREATE TABLE "route_points" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route_id" bigint NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"prev_route_point_id" bigint,
	"next_route_point_id" integer
);
--> statement-breakpoint
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
CREATE TABLE "salary_payments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"driver_id" bigint,
	"employee_name" text,
	"employee_role" text,
	"rate" numeric(12, 2),
	"units" integer,
	"total" numeric(12, 2) NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "salary_payments_total_check" CHECK ("total" > 0),
	CONSTRAINT "salary_payments_rate_check" CHECK ("rate" is null or "rate" > 0),
	CONSTRAINT "salary_payments_units_check" CHECK ("units" is null or "units" > 0),
	CONSTRAINT "salary_payments_employee_check" CHECK ("driver_id" is not null or "employee_name" is not null)
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route_id" bigint NOT NULL,
	"work_start_time" time NOT NULL,
	"work_end_time" time NOT NULL,
	"interval_min" integer NOT NULL,
	CONSTRAINT "schedules_route_id_unique" UNIQUE("route_id"),
	CONSTRAINT "schedules_interval_check" CHECK ("interval_min" > 0)
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	CONSTRAINT "stops_name_lon_lat_unique" UNIQUE("name","lon","lat")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trip_id" bigint NOT NULL,
	"card_id" bigint NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_price_check" CHECK ("price" >= 0)
);
--> statement-breakpoint
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
CREATE TABLE "transport_types" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "transport_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route_id" bigint NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"driver_id" bigint NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"passenger_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "trips_vehicle_time_unique" UNIQUE("vehicle_id","starts_at","ends_at"),
	CONSTRAINT "trips_ends_after_starts_check" CHECK ("ends_at" is null or "ends_at" > "starts_at"),
	CONSTRAINT "trips_passenger_count_check" CHECK ("passenger_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_gps_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "vehicle_gps_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type_id" integer NOT NULL,
	"capacity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fleet_number" text NOT NULL,
	"vehicle_model_id" bigint,
	"route_id" bigint NOT NULL,
	CONSTRAINT "vehicles_fleet_number_unique" UNIQUE("fleet_number")
);
--> statement-breakpoint
ALTER TABLE "card_top_ups" ADD CONSTRAINT "card_top_ups_card_id_transport_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."transport_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints_suggestions" ADD CONSTRAINT "complaints_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints_suggestions" ADD CONSTRAINT "complaints_suggestions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_card_id_transport_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."transport_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_cards" ADD CONSTRAINT "transport_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_gps_logs" ADD CONSTRAINT "user_gps_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gps_logs" ADD CONSTRAINT "vehicle_gps_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_type_id_transport_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."transport_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_model_id_vehicle_models_id_fk" FOREIGN KEY ("vehicle_model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;