import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import * as schema from './db/schema';

// --- 1. Robust CSV Parser ---
async function readCsv(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const headers = headerLine
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((h) => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    return headers.reduce(
      (acc, header, index) => {
        let val = values[index] ? values[index].trim() : '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        acc[header] = val;
        return acc;
      },
      {} as Record<string, string>,
    );
  });
}

// --- 2. Helpers ---

function getTransportTypeName(routeType: string): string {
  switch (routeType) {
    case '0':
      return 'Трамвай';
    case '1':
      return 'Метро';
    case '3':
      return 'Автобус';
    case '11':
      return 'Тролейбус';
    case '800':
      return 'Тролейбус';
    case '900':
      return 'Трамвай';
    default:
      return 'Автобус';
  }
}

function getTransportCapacity(name: string): number {
  switch (name) {
    case 'Трамвай':
      return 150;
    case 'Тролейбус':
      return 100;
    case 'Автобус':
      return 80;
    case 'Метро':
      return 1000;
    default:
      return 50;
  }
}

function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Convert HH:MM:SS to minutes (handles 25:00:00 correctly for calculation)
function timeToMin(timeStr: string) {
  if (!timeStr) return Number.NaN;
  const [h, m, s] = timeStr.split(':').map(Number);
  if ([h, m, s].some((value) => Number.isNaN(value))) return Number.NaN;
  return h * 60 + m + (s || 0) / 60;
}

// Format minutes back to HH:MM:SS, clamped to 00:00:00-23:59:59 for Postgres Time
function minToTime(totalMin: number) {
  if (!Number.isFinite(totalMin)) return '00:00:00';
  let totalSeconds = Math.round(totalMin * 60);
  if (totalSeconds < 0) totalSeconds = 0;
  const maxSeconds = 24 * 60 * 60 - 1;
  if (totalSeconds > maxSeconds) totalSeconds = maxSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(value: string | undefined) {
  if (!value || value.length !== 8) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

// --- 3. Main Seed Function ---

export async function seedDatabase() {
  const databaseUrl =
    process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('🌱 Starting seed...');

  try {
    // A. Clean Database
    console.log('🧹 Cleaning tables...');
    await db.execute(sql`
      TRUNCATE TABLE 
        vehicle_gps_logs, user_gps_logs, complaints_suggestions, fine_appeals, fines,
        tickets, card_top_ups, transport_cards, driver_vehicle_assignments,
        salary_payments, expenses, budgets,
        route_stops, route_points, trips, schedules, 
        vehicles, vehicle_models, routes, stops, transport_types, 
        drivers, users
      CASCADE
    `);

    // B. Locate GTFS files
    const staticCandidates = [
      path.resolve(process.cwd(), 'static'),
      path.resolve(process.cwd(), 'backend', 'static'),
      path.resolve(__dirname, '../static'),
      path.resolve(__dirname, '../../static'),
    ];
    const staticDir = staticCandidates.find((candidate) =>
      fs.existsSync(path.join(candidate, 'stops.txt')),
    );

    if (!staticDir) {
      throw new Error(
        `GTFS files not found. Checked: ${staticCandidates.join(', ')}`,
      );
    }

    console.log(`📂 Reading GTFS from ${staticDir}...`);

    const stopsData = await readCsv(path.join(staticDir, 'stops.txt'));
    const routesData = await readCsv(path.join(staticDir, 'routes.txt'));
    const shapesData = await readCsv(path.join(staticDir, 'shapes.txt'));
    const tripsData = await readCsv(path.join(staticDir, 'trips.txt'));
    const stopTimesData = await readCsv(path.join(staticDir, 'stop_times.txt'));
    const calendarData = await readCsv(path.join(staticDir, 'calendar.txt'));

    // C. Parse calendar.txt
    console.log('📅 Parsing calendar.txt...');
    const calendarMap = new Map<
      string,
      {
        days: {
          monday: boolean;
          tuesday: boolean;
          wednesday: boolean;
          thursday: boolean;
          friday: boolean;
          saturday: boolean;
          sunday: boolean;
        };
        activeDays: number;
        validFrom: string | null;
        validTo: string | null;
      }
    >();

    if (calendarData.length > 0) {
      for (const cal of calendarData) {
        const days = {
          monday: cal.monday === '1',
          tuesday: cal.tuesday === '1',
          wednesday: cal.wednesday === '1',
          thursday: cal.thursday === '1',
          friday: cal.friday === '1',
          saturday: cal.saturday === '1',
          sunday: cal.sunday === '1',
        };
        const activeDays = Object.values(days).filter(Boolean).length;
        calendarMap.set(cal.service_id, {
          days,
          activeDays,
          validFrom: formatDate(cal.start_date),
          validTo: formatDate(cal.end_date),
        });
      }
    } else {
      console.warn(
        '⚠️ calendar.txt empty or missing. Schedule days will be empty.',
      );
    }

    // D. Seed Transport Types
    console.log('🚌 Seeding Transport Types...');
    const uniqueTypes = new Set(['Трамвай', 'Тролейбус', 'Автобус', 'Метро']);
    const ttMap = new Map<string, number>();
    const ttNameById = new Map<number, string>();

    for (const name of uniqueTypes) {
      const [res] = await db
        .insert(schema.transportTypes)
        .values({ name })
        .returning();
      ttMap.set(name, res.id);
      ttNameById.set(res.id, name);
    }

    // E. Seed Stops
    console.log(`🚏 Seeding ${stopsData.length} Stops...`);
    const stopIdMap = new Map<string, number>();
    const stopCoordsMap = new Map<number, { lat: number; lon: number }>();
    const stopKeyMap = new Map<string, number>();

    for (const s of stopsData) {
      const lat = Number(s.stop_lat);
      const lon = Number(s.stop_lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }
      const latValue = lat.toFixed(7);
      const lonValue = lon.toFixed(7);
      const name = s.stop_name?.trim();
      if (!name) {
        continue;
      }
      const stopKey = `${name}|${lonValue}|${latValue}`;
      let dbId: number | undefined = stopKeyMap.get(stopKey);

      if (!dbId) {
        const [res] = await db
          .insert(schema.stops)
          .values({
            name,
            lon: lonValue,
            lat: latValue,
          })
          .onConflictDoNothing()
          .returning({ id: schema.stops.id });

        if (res) {
          dbId = res.id;
          stopKeyMap.set(stopKey, dbId);
        } else {
          dbId = stopKeyMap.get(stopKey);
        }
      }

      if (dbId) {
        stopIdMap.set(s.stop_id, dbId);
        stopCoordsMap.set(dbId, { lat, lon });
      }
    }

    // F. Pre-processing Data
    console.log('🔄 Indexing Trips & Shapes...');

    const shapesMap = new Map<string, typeof shapesData>();
    for (const pt of shapesData) {
      if (!shapesMap.has(pt.shape_id)) shapesMap.set(pt.shape_id, []);
      shapesMap.get(pt.shape_id)!.push(pt);
    }

    const routeTripsMap = new Map<string, Map<string, typeof tripsData>>();

    for (const t of tripsData) {
      if (!routeTripsMap.has(t.route_id))
        routeTripsMap.set(t.route_id, new Map());
      const dir = t.direction_id ?? '0';
      const dirMap = routeTripsMap.get(t.route_id)!;
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push(t);
    }

    const stopTimesByTrip = new Map<string, typeof stopTimesData>();
    for (const st of stopTimesData) {
      if (!stopTimesByTrip.has(st.trip_id)) stopTimesByTrip.set(st.trip_id, []);
      stopTimesByTrip.get(st.trip_id)!.push(st);
    }

    // G. Seed Routes
    console.log(`🛣️ Seeding Routes...`);
    let routeCounter = 0;
    const seenRouteKeys = new Set<string>();

    for (const r of routesData) {
      const routeNumber =
        r.route_short_name?.trim() || r.route_long_name?.trim() || r.route_id;
      if (!routeNumber) continue;

      const ttName = getTransportTypeName(r.route_type);
      const ttId = ttMap.get(ttName);
      if (!ttId) continue;

      const dirMap = routeTripsMap.get(r.route_id);
      if (!dirMap) continue;

      for (const [directionId, trips] of dirMap.entries()) {
        if (trips.length === 0) continue;

        const dbDirection = directionId === '1' ? 'reverse' : 'forward';
        const routeKey = `${ttId}:${routeNumber}:${dbDirection}`;
        if (seenRouteKeys.has(routeKey)) continue;
        seenRouteKeys.add(routeKey);

        const [routeDb] = await db
          .insert(schema.routes)
          .values({
            number: routeNumber,
            transportTypeId: ttId,
            direction: dbDirection,
            isActive: true,
          })
          .returning();

        routeCounter++;

        // Pick the most common service_id for this route/direction
        const serviceCounts = new Map<string, number>();
        for (const t of trips) {
          const serviceId = t.service_id || '';
          serviceCounts.set(serviceId, (serviceCounts.get(serviceId) || 0) + 1);
        }

        let selectedServiceId = '';
        let bestCount = -1;
        let bestHasCalendar = false;
        let bestActiveDays = -1;
        let bestNonEmpty = false;

        for (const [serviceId, count] of serviceCounts.entries()) {
          const calendarInfo = calendarMap.get(serviceId);
          const hasCalendar = Boolean(calendarInfo);
          const activeDays = calendarInfo?.activeDays ?? -1;
          const nonEmpty = serviceId !== '';

          let isBetter = false;
          if (count > bestCount) {
            isBetter = true;
          } else if (count === bestCount) {
            if (hasCalendar && !bestHasCalendar) {
              isBetter = true;
            } else if (hasCalendar === bestHasCalendar) {
              if (nonEmpty && !bestNonEmpty) {
                isBetter = true;
              } else if (
                nonEmpty === bestNonEmpty &&
                activeDays > bestActiveDays
              ) {
                isBetter = true;
              }
            }
          }

          if (isBetter) {
            selectedServiceId = serviceId;
            bestCount = count;
            bestHasCalendar = hasCalendar;
            bestActiveDays = activeDays;
            bestNonEmpty = nonEmpty;
          }
        }

        const tripsForSchedule = selectedServiceId
          ? trips.filter((t) => t.service_id === selectedServiceId)
          : trips;
        const tripCandidates = tripsForSchedule.length
          ? tripsForSchedule
          : trips;

        // 1. Shapes
        const tripWithShape =
          tripCandidates.find((t) => t.shape_id && shapesMap.has(t.shape_id)) ||
          tripCandidates[0];
        if (tripWithShape?.shape_id && shapesMap.has(tripWithShape.shape_id)) {
          const points = shapesMap
            .get(tripWithShape.shape_id)!
            .sort(
              (a, b) =>
                Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence),
            );

          let prevPointId: number | null = null;
          const seenPointKeys = new Set<string>();
          for (const pt of points) {
            const lat = Number(pt.shape_pt_lat);
            const lon = Number(pt.shape_pt_lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            const latValue = lat.toFixed(7);
            const lonValue = lon.toFixed(7);
            const pointKey = `${lonValue}|${latValue}`;
            if (seenPointKeys.has(pointKey)) continue;
            seenPointKeys.add(pointKey);

            const newPtRows = (await db
              .insert(schema.routePoints)
              .values({
                routeId: routeDb.id,
                lon: lonValue,
                lat: latValue,
                prevRoutePointId: prevPointId,
              })
              .returning({ id: schema.routePoints.id })) as Array<{
              id: number;
            }>;
            const newPt = newPtRows[0];
            if (!newPt) {
              continue;
            }

            if (prevPointId) {
              await db.execute(sql`
                          UPDATE ${sql.raw('route_points')}
                          SET ${sql.raw('next_route_point_id')} = ${newPt.id}
                          WHERE ${sql.raw('id')} = ${prevPointId}
                        `);
            }
            prevPointId = newPt.id;
          }
        }

        // 2. Stops (Representative Pattern)
        const representativeTrip = tripCandidates[0];
        const tripStops = representativeTrip
          ? stopTimesByTrip.get(representativeTrip.trip_id)
          : undefined;
        if (tripStops) {
          const sortedStops = tripStops.sort(
            (a, b) => Number(a.stop_sequence) - Number(b.stop_sequence),
          );

          let prevRouteStopId: number | null = null;
          let prevStopId: number | null = null;
          const seenStops = new Set<number>();

          for (const st of sortedStops) {
            const stopId = stopIdMap.get(st.stop_id);
            if (!stopId) continue;
            if (seenStops.has(stopId)) continue;
            seenStops.add(stopId);

            let distance = 0;
            if (prevStopId) {
              const c1 = stopCoordsMap.get(prevStopId);
              const c2 = stopCoordsMap.get(stopId);
              if (c1 && c2) {
                distance = getDistanceFromLatLonInKm(
                  c1.lat,
                  c1.lon,
                  c2.lat,
                  c2.lon,
                );
              }
            }

            const newRsRows = (await db
              .insert(schema.routeStops)
              .values({
                routeId: routeDb.id,
                stopId: stopId,
                prevRouteStopId: prevRouteStopId,
                distanceToNextKm: null,
              })
              .returning({ id: schema.routeStops.id })) as Array<{
              id: number;
            }>;
            const newRs = newRsRows[0];
            if (!newRs) {
              continue;
            }

            if (prevRouteStopId) {
              await db.execute(sql`
                          UPDATE ${sql.raw('route_stops')}
                          SET ${sql.raw('next_route_stop_id')} = ${newRs.id},
                              ${sql.raw('distance_to_next_km')} = ${distance.toFixed(3)}
                          WHERE ${sql.raw('id')} = ${prevRouteStopId}
                        `);
            }

            prevRouteStopId = newRs.id;
            prevStopId = stopId;
          }
        }

        // 3. Schedule
        const startTimes: number[] = [];
        const endTimes: number[] = [];

        for (const t of tripsForSchedule.length ? tripsForSchedule : trips) {
          const st = stopTimesByTrip.get(t.trip_id);
          if (!st || st.length === 0) continue;

          const times = st
            .map((row) => row.departure_time || row.arrival_time)
            .filter(Boolean)
            .map((time) => timeToMin(time))
            .filter((value) => Number.isFinite(value));
          if (times.length === 0) continue;

          startTimes.push(Math.min(...times));
          endTimes.push(Math.max(...times));
        }

        if (startTimes.length > 0) {
          const minStart = Math.min(...startTimes);
          const maxStart = Math.max(...startTimes);
          const maxEnd = Math.max(...endTimes);

          let interval = 20;
          if (startTimes.length > 1 && maxStart > minStart) {
            interval = Math.round(
              (maxStart - minStart) / (startTimes.length - 1),
            );
          }
          if (interval <= 0) interval = 15;

          const calendarInfo = selectedServiceId
            ? calendarMap.get(selectedServiceId)
            : undefined;

          await db.insert(schema.schedules).values({
            routeId: routeDb.id,
            workStartTime: minToTime(minStart),
            workEndTime: minToTime(maxEnd),
            intervalMin: interval,
            monday: calendarInfo?.days.monday ?? false,
            tuesday: calendarInfo?.days.tuesday ?? false,
            wednesday: calendarInfo?.days.wednesday ?? false,
            thursday: calendarInfo?.days.thursday ?? false,
            friday: calendarInfo?.days.friday ?? false,
            saturday: calendarInfo?.days.saturday ?? false,
            sunday: calendarInfo?.days.sunday ?? false,
            validFrom: calendarInfo?.validFrom ?? null,
            validTo: calendarInfo?.validTo ?? null,
          });
        } else {
          await db.insert(schema.schedules).values({
            routeId: routeDb.id,
            workStartTime: '06:00:00',
            workEndTime: '23:00:00',
            intervalMin: 15,
          });
        }
      }
    }
    console.log(`✅ Seeded ${routeCounter} Routes.`);

    // H. Create Users & Roles
    console.log('👥 Seeding Users...');

    async function ensureRole(login: string, role: string) {
      try {
        await db.execute(
          sql.raw(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${login}') THEN CREATE ROLE "${login}" LOGIN PASSWORD 'password'; END IF; END $$;`,
          ),
        );
        await db.execute(sql.raw(`GRANT ${role} TO "${login}";`));
      } catch (e) {
        console.warn(`Role setup warning: ${e}`);
      }
    }

    await ensureRole('driver1', 'ct_driver_role');
    await ensureRole('passenger1', 'ct_passenger_role');
    await ensureRole('dispatcher1', 'ct_dispatcher_role');
    await ensureRole('controller1', 'ct_controller_role');

    // Insert Users/Drivers
    const [driver] = await db
      .insert(schema.drivers)
      .values({
        login: 'driver1',
        email: 'driver1@ct.com',
        phone: '+380991112233',
        fullName: 'Petrenko Petro',
        driverLicenseNumber: 'ABC123456',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'AA', number: '123456' },
      })
      .onConflictDoUpdate({
        target: schema.drivers.login,
        set: { email: 'driver1@ct.com' },
      })
      .returning();

    const [passenger] = await db
      .insert(schema.users)
      .values({
        login: 'passenger1',
        email: 'pass@ct.com',
        phone: '+380501112233',
        fullName: 'Ivanov Ivan',
        registeredAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.login,
        set: { email: 'pass@ct.com' },
      })
      .returning();

    if (passenger) {
      await db
        .insert(schema.transportCards)
        .values({
          userId: passenger.id,
          cardNumber: 'CARD-0001',
          balance: '100.00',
        })
        .onConflictDoNothing();
    }

    // I. Vehicles & Active Data
    console.log('🚌 Seeding Vehicles...');
    const someRoute = await db.query.routes.findFirst();

    if (someRoute && driver) {
      const ttName = ttNameById.get(someRoute.transportTypeId) || 'Автобус';

      const [model] = await db
        .insert(schema.vehicleModels)
        .values({
          name: 'Default Model',
          typeId: someRoute.transportTypeId,
          capacity: getTransportCapacity(ttName),
        })
        .returning();

      const [veh] = await db
        .insert(schema.vehicles)
        .values({
          fleetNumber: '1001',
          routeId: someRoute.id,
          vehicleModelId: model.id,
        })
        .onConflictDoNothing()
        .returning();

      if (veh) {
        await db
          .insert(schema.driverVehicleAssignments)
          .values({
            driverId: driver.id,
            vehicleId: veh.id,
            assignedAt: new Date(),
          })
          .onConflictDoNothing();

        // One Active Trip
        await db.insert(schema.trips).values({
          routeId: someRoute.id,
          vehicleId: veh.id,
          driverId: driver.id,
          startsAt: new Date(),
          passengerCount: 0,
        });
      }
    }

    console.log('🏁 Seed completed successfully!');
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void seedDatabase();
}
