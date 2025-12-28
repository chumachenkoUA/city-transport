import {
  bigint,
  bigserial,
  pgTable,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { drivers } from './drivers';
import { vehicles } from './vehicles';

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
