import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  registeredAt: timestamp('registered_at').notNull().defaultNow(),
});

export const drivers = pgTable('drivers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  driverLicenseNumber: text('driver_license_number').notNull().unique(),
  passportData: jsonb('passport_data').notNull(),
});

export const stops = pgTable(
  'stops',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: text('name').notNull(),
    lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
    lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  },
  (table) => ({
    stopsNameLonLatUnique: unique('stops_name_lon_lat_unique').on(
      table.name,
      table.lon,
      table.lat,
    ),
  }),
);

export const transportTypes = pgTable('transport_types', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull().unique(),
});

export const routes = pgTable(
  'routes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transportTypeId: bigint('transport_type_id', { mode: 'number' })
      .notNull()
      .references(() => transportTypes.id),
    number: text('number').notNull(),
    direction: text('direction').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    routesTransportTypeNumberDirectionUnique: unique(
      'routes_transport_type_number_direction_unique',
    ).on(table.transportTypeId, table.number, table.direction),
    routesDirectionCheck: check(
      'routes_direction_check',
      sql.raw(`"direction" in ('forward', 'reverse')`),
    ),
  }),
);

export const routeStops = pgTable(
  'route_stops',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    stopId: bigint('stop_id', { mode: 'number' })
      .notNull()
      .references(() => stops.id),
    prevRouteStopId: bigint('prev_route_stop_id', { mode: 'number' }).unique(),
    nextRouteStopId: bigint('next_route_stop_id', { mode: 'number' }).unique(),
    distanceToNextKm: numeric('distance_to_next_km', {
      precision: 10,
      scale: 3,
    }),
  },
  (table) => ({
    routeStopsRouteStopUnique: unique('route_stops_route_stop_unique').on(
      table.routeId,
      table.stopId,
    ),
    routeStopsPrevStopFk: foreignKey({
      columns: [table.prevRouteStopId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
    routeStopsNextStopFk: foreignKey({
      columns: [table.nextRouteStopId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
    routeStopsDistanceCheck: check(
      'route_stops_distance_check',
      sql.raw('"distance_to_next_km" >= 0'),
    ),
  }),
);

export const routePoints = pgTable(
  'route_points',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
    lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
    prevRoutePointId: bigint('prev_route_point_id', {
      mode: 'number',
    }).unique(),
    nextRoutePointId: bigint('next_route_point_id', {
      mode: 'number',
    }).unique(),
  },
  (table) => ({
    routePointsRouteLonLatUnique: unique(
      'route_points_route_lon_lat_unique',
    ).on(table.routeId, table.lon, table.lat),
    routePointsPrevPointFk: foreignKey({
      columns: [table.prevRoutePointId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
    routePointsNextPointFk: foreignKey({
      columns: [table.nextRoutePointId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
  }),
);

export const vehicles = pgTable(
  'vehicles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fleetNumber: text('fleet_number').notNull().unique(),
    transportTypeId: bigint('transport_type_id', { mode: 'number' })
      .notNull()
      .references(() => transportTypes.id),
    capacity: integer('capacity').notNull(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id),
  },
  () => ({
    vehiclesCapacityCheck: check(
      'vehicles_capacity_check',
      sql.raw('"capacity" > 0'),
    ),
  }),
);

export const driverVehicleAssignments = pgTable(
  'driver_vehicle_assignments',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    driverId: bigint('driver_id', { mode: 'number' })
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    vehicleId: bigint('vehicle_id', { mode: 'number' })
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (table) => ({
    driverVehicleAssignmentsUnique: unique(
      'driver_vehicle_assignments_unique',
    ).on(table.driverId, table.vehicleId, table.assignedAt),
  }),
);

export const schedules = pgTable(
  'schedules',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => routes.id),
    workStartTime: time('work_start_time').notNull(),
    workEndTime: time('work_end_time').notNull(),
    intervalMin: integer('interval_min').notNull(),
  },
  () => ({
    schedulesIntervalCheck: check(
      'schedules_interval_check',
      sql.raw('"interval_min" > 0'),
    ),
  }),
);

export const trips = pgTable(
  'trips',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id),
    vehicleId: bigint('vehicle_id', { mode: 'number' })
      .notNull()
      .references(() => vehicles.id),
    driverId: bigint('driver_id', { mode: 'number' })
      .notNull()
      .references(() => drivers.id),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    passengerCount: integer('passenger_count').notNull().default(0),
  },
  (table) => ({
    tripsVehicleTimeUnique: unique('trips_vehicle_time_unique').on(
      table.vehicleId,
      table.startsAt,
      table.endsAt,
    ),
    tripsEndsAfterStartsCheck: check(
      'trips_ends_after_starts_check',
      sql.raw('"ends_at" > "starts_at"'),
    ),
    tripsPassengerCountCheck: check(
      'trips_passenger_count_check',
      sql.raw('"passenger_count" >= 0'),
    ),
  }),
);

export const transportCards = pgTable(
  'transport_cards',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    balance: numeric('balance', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    cardNumber: text('card_number').notNull().unique(),
  },
  () => ({
    transportCardsBalanceCheck: check(
      'transport_cards_balance_check',
      sql.raw('"balance" >= 0'),
    ),
  }),
);

export const cardTopUps = pgTable(
  'card_top_ups',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cardId: bigint('card_id', { mode: 'number' })
      .notNull()
      .references(() => transportCards.id),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    toppedUpAt: timestamp('topped_up_at').notNull().defaultNow(),
  },
  () => ({
    cardTopUpsAmountCheck: check(
      'card_top_ups_amount_check',
      sql.raw('"amount" > 0'),
    ),
  }),
);

export const tickets = pgTable(
  'tickets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tripId: bigint('trip_id', { mode: 'number' })
      .notNull()
      .references(() => trips.id),
    cardId: bigint('card_id', { mode: 'number' })
      .notNull()
      .references(() => transportCards.id),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    purchasedAt: timestamp('purchased_at').notNull().defaultNow(),
  },
  () => ({
    ticketsPriceCheck: check('tickets_price_check', sql.raw('"price" >= 0')),
  }),
);

export const fines = pgTable(
  'fines',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    status: text('status').notNull(),
    tripId: bigint('trip_id', { mode: 'number' })
      .notNull()
      .references(() => trips.id),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
  },
  () => ({
    finesStatusCheck: check(
      'fines_status_check',
      sql.raw(
        `"status" in ('В процесі', 'Оплачено', 'Відмінено', 'Прострочено')`,
      ),
    ),
  }),
);

export const fineAppeals = pgTable(
  'fine_appeals',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fineId: bigint('fine_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => fines.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  () => ({
    fineAppealsStatusCheck: check(
      'fine_appeals_status_check',
      sql.raw(
        `"status" in ('Подано', 'Перевіряється', 'Відхилено', 'Прийнято')`,
      ),
    ),
  }),
);

export const complaintsSuggestions = pgTable(
  'complaints_suggestions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    message: text('message').notNull(),
    tripId: bigint('trip_id', { mode: 'number' }).references(() => trips.id),
    status: text('status').notNull(),
  },
  () => ({
    complaintsSuggestionsStatusCheck: check(
      'complaints_suggestions_status_check',
      sql.raw(`"status" in ('Подано', 'Розглядається', 'Розглянуто')`),
    ),
  }),
);

export const userGpsLogs = pgTable('user_gps_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});

export const vehicleGpsLogs = pgTable('vehicle_gps_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  vehicleId: bigint('vehicle_id', { mode: 'number' })
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});
