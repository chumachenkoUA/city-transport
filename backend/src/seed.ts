import 'dotenv/config';
import { asc, eq, sql } from 'drizzle-orm';
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

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
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
      RESTART IDENTITY CASCADE
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
    const uniqueTypes = new Set(['Трамвай', 'Тролейбус', 'Автобус']);
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

    // D2. Seed Vehicle Models from File
    const modelsFile = path.join(staticDir, 'vehicle_models.txt');
    if (fs.existsSync(modelsFile)) {
      console.log('🚌 Seeding Vehicle Models from file...');
      const modelsData = await readCsv(modelsFile);
      for (const m of modelsData) {
        const typeId = ttMap.get(m.transport_type);
        if (typeId) {
          await db
            .insert(schema.vehicleModels)
            .values({
              name: m.model_name,
              typeId: typeId,
              capacity: Number(m.capacity),
            })
            .onConflictDoNothing();
        }
      }
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

      let ttName = getTransportTypeName(r.route_type);
      // Detect Trolleybus by 'Тр' prefix
      if (routeNumber.toUpperCase().startsWith('ТР')) {
        ttName = 'Тролейбус';
      }

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
          let prevCoords: string | null = null;

          for (const pt of points) {
            const lat = Number(pt.shape_pt_lat);
            const lon = Number(pt.shape_pt_lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            const latValue = lat.toFixed(7);
            const lonValue = lon.toFixed(7);
            const coordsKey = `${lonValue},${latValue}`;

            // Skip consecutive duplicate coordinates
            if (coordsKey === prevCoords) {
              continue;
            }

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
            prevCoords = coordsKey;
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

    // Create test users for all roles
    await ensureRole('manager1', 'ct_manager_role');
    await ensureRole('dispatcher1', 'ct_dispatcher_role');
    await ensureRole('municipality1', 'ct_municipality_role');
    await ensureRole('accountant1', 'ct_accountant_role');
    await ensureRole('controller1', 'ct_controller_role');
    // driver1 and passenger1 will be created in the loops below with all other drivers/passengers

    const driverSeeds = [
      {
        login: 'driver1',
        email: 'driver1@ct.com',
        phone: '+380991112233',
        fullName: 'Petrenko Petro',
        driverLicenseNumber: 'ABC123456',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'AA', number: '123456' },
      },
      {
        login: 'driver2',
        email: 'driver2@ct.com',
        phone: '+380991112234',
        fullName: 'Kovalchuk Andrii',
        driverLicenseNumber: 'DEF654321',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'AB', number: '234567' },
      },
      {
        login: 'driver3',
        email: 'driver3@ct.com',
        phone: '+380991112235',
        fullName: 'Shevchenko Olha',
        driverLicenseNumber: 'GHI987654',
        licenseCategories: ['B', 'C', 'D'],
        passportData: { series: 'AC', number: '345678' },
      },
      {
        login: 'driver4',
        email: 'driver4@ct.com',
        phone: '+380991112236',
        fullName: 'Melnyk Ivan',
        driverLicenseNumber: 'JKL123789',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'AD', number: '456789' },
      },
      {
        login: 'driver5',
        email: 'driver5@ct.com',
        phone: '+380991112237',
        fullName: 'Tkachenko Yuliia',
        driverLicenseNumber: 'MNO456123',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'AE', number: '567890' },
      },
    ];

    const passengerSeeds = [
      {
        login: 'passenger1',
        email: 'pass@ct.com',
        phone: '+380501112233',
        fullName: 'Ivanov Ivan',
      },
      {
        login: 'passenger2',
        email: 'passenger2@ct.com',
        phone: '+380501112234',
        fullName: 'Kravchenko Mariia',
      },
      {
        login: 'passenger3',
        email: 'passenger3@ct.com',
        phone: '+380501112235',
        fullName: 'Bondarenko Oleksii',
      },
      {
        login: 'passenger4',
        email: 'passenger4@ct.com',
        phone: '+380501112236',
        fullName: 'Poliakov Dmytro',
      },
      {
        login: 'passenger5',
        email: 'passenger5@ct.com',
        phone: '+380501112237',
        fullName: 'Moroz Olena',
      },
      {
        login: 'passenger6',
        email: 'passenger6@ct.com',
        phone: '+380501112238',
        fullName: 'Petrova Iryna',
      },
      {
        login: 'passenger7',
        email: 'passenger7@ct.com',
        phone: '+380501112239',
        fullName: 'Savchenko Maksym',
      },
      {
        login: 'passenger8',
        email: 'passenger8@ct.com',
        phone: '+380501112240',
        fullName: 'Zaitseva Viktoriia',
      },
      {
        login: 'passenger9',
        email: 'passenger9@ct.com',
        phone: '+380501112241',
        fullName: 'Honchar Oleh',
      },
      {
        login: 'passenger10',
        email: 'passenger10@ct.com',
        phone: '+380501112242',
        fullName: 'Rudenko Sofia',
      },
      {
        login: 'passenger11',
        email: 'passenger11@ct.com',
        phone: '+380501112243',
        fullName: 'Klymenko Pavlo',
      },
      {
        login: 'passenger12',
        email: 'passenger12@ct.com',
        phone: '+380501112244',
        fullName: 'Koval Iryna',
      },
    ];

    const extraDriverCount = 7;
    for (let i = 0; i < extraDriverCount; i++) {
      const index = i + 6;
      driverSeeds.push({
        login: `driver${index}`,
        email: `driver${index}@ct.com`,
        phone: `+3809911122${index.toString().padStart(2, '0')}`,
        fullName: `Driver ${index}`,
        driverLicenseNumber: `DRV${index.toString().padStart(6, '0')}`,
        licenseCategories: ['B', 'D'],
        passportData: { series: 'AF', number: `${index}`.padStart(6, '0') },
      });
    }

    const extraPassengerCount = 18;
    for (let i = 0; i < extraPassengerCount; i++) {
      const index = i + 13;
      passengerSeeds.push({
        login: `passenger${index}`,
        email: `passenger${index}@ct.com`,
        phone: `+3805011122${index.toString().padStart(2, '0')}`,
        fullName: `Passenger ${index}`,
      });
    }

    for (const seed of driverSeeds) {
      await ensureRole(seed.login, 'ct_driver_role');
    }

    for (const seed of passengerSeeds) {
      await ensureRole(seed.login, 'ct_passenger_role');
    }

    const drivers: Array<typeof schema.drivers.$inferSelect> = [];
    for (const seed of driverSeeds) {
      const [created] = await db
        .insert(schema.drivers)
        .values(seed)
        .onConflictDoUpdate({
          target: schema.drivers.login,
          set: { email: seed.email },
        })
        .returning();
      if (created) {
        drivers.push(created);
      }
    }

    const passengers: Array<typeof schema.users.$inferSelect> = [];
    for (const seed of passengerSeeds) {
      const [created] = await db
        .insert(schema.users)
        .values({ ...seed, registeredAt: new Date() })
        .onConflictDoUpdate({
          target: schema.users.login,
          set: { email: seed.email },
        })
        .returning();
      if (created) {
        passengers.push(created);
      }
    }

    const passenger = passengers.find((item) => item.login === 'passenger1');
    const driver = drivers.find((item) => item.login === 'driver1');

    const cardSeeds: Array<typeof schema.transportCards.$inferInsert> =
      passengers.map((p, index) => ({
        userId: p.id,
        cardNumber: `CARD-${String(index + 1).padStart(4, '0')}`,
        balance:
          p.login === 'passenger1' ? '100.00' : randomInt(0, 500).toFixed(2),
      }));

    if (cardSeeds.length > 0) {
      await db
        .insert(schema.transportCards)
        .values(cardSeeds)
        .onConflictDoNothing();
    }

    const cards = await db.select().from(schema.transportCards);
    const cardTopUps: Array<typeof schema.cardTopUps.$inferInsert> = [];
    for (const card of cards) {
      const topUpCount = randomInt(3, 6);
      for (let i = 0; i < topUpCount; i++) {
        const days = randomInt(1, 28);
        cardTopUps.push({
          cardId: card.id,
          amount: randomInt(50, 200).toFixed(2),
          toppedUpAt: daysAgo(days),
        });
      }
    }

    if (cardTopUps.length > 0) {
      await db.insert(schema.cardTopUps).values(cardTopUps);
    }

    // I. Vehicles & Active Data
    console.log('🚌 Seeding Vehicles...');
    const someRoutes = await db
      .select()
      .from(schema.routes)
      .orderBy(asc(schema.routes.id))
      .limit(8);

    const vehicles: Array<typeof schema.vehicles.$inferSelect> = [];
    const vehiclesByRoute = new Map<
      number,
      Array<typeof schema.vehicles.$inferSelect>
    >();
    const vehicleModelsByType = new Map<number, number>();

    const vehiclesPerRoute = 2;
    let vehicleIndex = 0;
    for (const route of someRoutes) {
      const typeName = ttNameById.get(route.transportTypeId) || 'Автобус';
      let modelId = vehicleModelsByType.get(route.transportTypeId);

      if (!modelId) {
        const [model] = await db
          .insert(schema.vehicleModels)
          .values({
            name: `Seed ${typeName} Model`,
            typeId: route.transportTypeId,
            capacity: getTransportCapacity(typeName),
          })
          .returning();
        modelId = model.id;
        vehicleModelsByType.set(route.transportTypeId, modelId);
      }

      for (let i = 0; i < vehiclesPerRoute; i++) {
        const [vehicle] = await db
          .insert(schema.vehicles)
          .values({
            fleetNumber: `SEED-${String(vehicleIndex + 1).padStart(3, '0')}`,
            routeId: route.id,
            vehicleModelId: modelId,
          })
          .onConflictDoNothing()
          .returning();

        if (vehicle) {
          vehicles.push(vehicle);
          const list = vehiclesByRoute.get(route.id) ?? [];
          list.push(vehicle);
          vehiclesByRoute.set(route.id, list);
        }
        vehicleIndex++;
      }
    }

    for (let index = 0; index < vehicles.length; index++) {
      const driverEntry = drivers[index % drivers.length];
      if (!driverEntry) continue;
      await db
        .insert(schema.driverVehicleAssignments)
        .values({
          driverId: driverEntry.id,
          vehicleId: vehicles[index].id,
          assignedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // J. Passenger History (passenger1)
    console.log('🧾 Seeding passenger1 history...');
    if (!passenger || !driver) {
      console.warn('⚠️ passenger1 or driver1 missing, skipping history seed.');
    } else {
      const [card] = await db
        .select()
        .from(schema.transportCards)
        .where(eq(schema.transportCards.userId, passenger.id))
        .limit(1);

      if (!card) {
        console.warn('⚠️ transport card not found for passenger1.');
      } else {
        const historyRoutes = await db
          .select()
          .from(schema.routes)
          .where(eq(schema.routes.isActive, true))
          .orderBy(asc(schema.routes.id))
          .limit(6);

        if (historyRoutes.length === 0) {
          console.warn('⚠️ No routes available for passenger history.');
        } else {
          const modelByTypeId = new Map<number, number>();
          const vehicleByRouteId = new Map<number, number>();
          let fleetNumberCounter = 2001;

          for (const route of historyRoutes) {
            const typeName = ttNameById.get(route.transportTypeId) || 'Автобус';
            let modelId = modelByTypeId.get(route.transportTypeId);

            if (!modelId) {
              const [newModel] = await db
                .insert(schema.vehicleModels)
                .values({
                  name: `History ${typeName} Model`,
                  typeId: route.transportTypeId,
                  capacity: getTransportCapacity(typeName),
                })
                .returning();

              modelId = newModel.id;
              modelByTypeId.set(route.transportTypeId, modelId);
            }

            const [vehicle] = await db
              .insert(schema.vehicles)
              .values({
                fleetNumber: `H-${fleetNumberCounter++}`,
                routeId: route.id,
                vehicleModelId: modelId,
              })
              .returning();

            if (vehicle) {
              vehicleByRouteId.set(route.id, vehicle.id);
            }
          }

          const historyTripCount = 12;
          const baseDate = new Date();
          baseDate.setDate(baseDate.getDate() - 29);
          const startHours = [6, 7, 9, 11, 13, 15, 17, 19, 21];
          const tripsToInsert: Array<typeof schema.trips.$inferInsert> = [];
          const tripTimes: Array<{
            startsAt: Date;
            endsAt: Date;
            durationMin: number;
          }> = [];

          for (let i = 0; i < historyTripCount; i++) {
            const route = historyRoutes[i % historyRoutes.length];
            const vehicleId = vehicleByRouteId.get(route.id);
            if (!vehicleId) continue;

            const tripDate = new Date(baseDate);
            tripDate.setDate(baseDate.getDate() + i * 2);
            const startHour = startHours[i % startHours.length];
            const startMinute = (i * 7) % 50;
            tripDate.setHours(startHour, startMinute, 0, 0);

            const durationMinutes = 18 + (i % 5) * 7;
            const endsAt = new Date(
              tripDate.getTime() + durationMinutes * 60 * 1000,
            );

            tripsToInsert.push({
              routeId: route.id,
              vehicleId,
              driverId: driver.id,
              startsAt: new Date(tripDate),
              endsAt,
              passengerCount: 5 + (i % 12),
            });
            tripTimes.push({
              startsAt: new Date(tripDate),
              endsAt,
              durationMin: durationMinutes,
            });
          }

          if (tripsToInsert.length > 0) {
            const insertedTrips = await db
              .insert(schema.trips)
              .values(tripsToInsert)
              .returning();

            const ticketsToInsert: Array<typeof schema.tickets.$inferInsert> =
              [];
            const finesToInsert: Array<typeof schema.fines.$inferInsert> = [];

            insertedTrips.forEach((trip, index) => {
              const meta = tripTimes[index];
              if (!meta) return;
              const purchaseOffsetMin = Math.min(
                7,
                Math.max(3, Math.floor(meta.durationMin / 3)),
              );
              const purchasedAt = new Date(
                meta.startsAt.getTime() + purchaseOffsetMin * 60 * 1000,
              );

              ticketsToInsert.push({
                tripId: trip.id,
                cardId: card.id,
                price: (8 + (index % 4) * 2).toFixed(2),
                purchasedAt,
              });
            });

            if (ticketsToInsert.length > 0) {
              await db.insert(schema.tickets).values(ticketsToInsert);
            }

            const fineTripIndexes = [
              1,
              Math.floor(insertedTrips.length / 2),
              insertedTrips.length - 1,
            ].filter(
              (value, index, array) =>
                value >= 0 &&
                value < insertedTrips.length &&
                array.indexOf(value) === index,
            );

            const fineStatuses: Array<
              'Оплачено' | 'Очікує сплати' | 'Відмінено'
            > = ['Оплачено', 'Очікує сплати', 'Відмінено'];
            const fineReasons = [
              'Проїзд без квитка',
              'Непідтверджена оплата',
              'Порушення правил перевезення',
            ];
            const fineAmounts = ['60.00', '80.00', '50.00'];

            fineTripIndexes.forEach((tripIndex, index) => {
              const trip = insertedTrips[tripIndex];
              const meta = tripTimes[tripIndex];
              if (!trip || !meta) return;

              const issuedAt = new Date(
                meta.startsAt.getTime() +
                  Math.floor(meta.durationMin / 2) * 60 * 1000,
              );

              finesToInsert.push({
                userId: passenger.id,
                tripId: trip.id,
                status: fineStatuses[index] ?? 'Очікує сплати',
                amount: fineAmounts[index] ?? '50.00',
                reason: fineReasons[index] ?? 'Порушення правил проїзду',
                issuedAt,
              });
            });

            if (finesToInsert.length > 0) {
              await db.insert(schema.fines).values(finesToInsert);
            }
          }
        }
      }
    }

    // K. Extended Operational Data
    console.log('📊 Seeding extended operational data...');
    const historicalTrips: Array<typeof schema.trips.$inferSelect> = [];

    if (someRoutes.length > 0 && vehicles.length > 0 && drivers.length > 0) {
      const historicalTripCount = 120;
      const tripInserts: Array<typeof schema.trips.$inferInsert> = [];

      for (let i = 0; i < historicalTripCount; i++) {
        const route = someRoutes[i % someRoutes.length];
        const routeVehicles = vehiclesByRoute.get(route.id);
        if (!routeVehicles || routeVehicles.length === 0) {
          continue;
        }
        const vehicle = routeVehicles[i % routeVehicles.length];
        const driverEntry = drivers[i % drivers.length];
        const daysBack = randomInt(1, 30);
        const startDate = daysAgo(daysBack);
        startDate.setHours(randomInt(6, 22), randomInt(0, 50), 0, 0);
        const durationMinutes = randomInt(20, 60);

        tripInserts.push({
          routeId: route.id,
          vehicleId: vehicle.id,
          driverId: driverEntry.id,
          startsAt: startDate,
          endsAt: addMinutes(startDate, durationMinutes),
          passengerCount: randomInt(10, 80),
        });
      }

      if (tripInserts.length > 0) {
        const inserted = await db
          .insert(schema.trips)
          .values(tripInserts)
          .returning();
        historicalTrips.push(...inserted);
      }

      const activeTripsCount = Math.min(5, vehicles.length);
      for (let i = 0; i < activeTripsCount; i++) {
        const route = someRoutes[i % someRoutes.length];
        const routeVehicles = vehiclesByRoute.get(route.id);
        if (!routeVehicles || routeVehicles.length === 0) {
          continue;
        }
        const vehicle = routeVehicles[i % routeVehicles.length];
        const driverEntry = drivers[i % drivers.length];
        const startsAt =
          i === 0 ? addMinutes(new Date(), -20) : addMinutes(new Date(), -2);

        const [activeTrip] = await db
          .insert(schema.trips)
          .values({
            routeId: route.id,
            vehicleId: vehicle.id,
            driverId: driverEntry.id,
            startsAt,
            passengerCount: randomInt(5, 20),
          })
          .returning();

        if (activeTrip) {
          const firstStopResult = (await db.execute(sql`
            SELECT s.lon, s.lat
            FROM ${sql.raw('route_stops')} rs
            JOIN ${sql.raw('stops')} s ON s.id = rs.stop_id
            WHERE rs.route_id = ${route.id}
              AND rs.prev_route_stop_id IS NULL
            LIMIT 1
          `)) as unknown as { rows: Array<{ lon: string; lat: string }> };
          const firstStop = firstStopResult.rows[0];

          if (firstStop?.lon && firstStop?.lat) {
            for (let j = 0; j < 4; j++) {
              await db.insert(schema.vehicleGpsLogs).values({
                vehicleId: vehicle.id,
                lon: firstStop.lon,
                lat: firstStop.lat,
                recordedAt: addMinutes(new Date(), -j * 3),
              });
            }
          }
        }
      }
    }

    // L. Finance & Tickets
    console.log('💳 Seeding finance data...');
    const expensesCategories = ['Паливо', 'Ремонт', 'Мийка', 'Запчастини'];
    const expensesToInsert: Array<typeof schema.expenses.$inferInsert> = [];
    const expensesCount = randomInt(20, 30);

    for (let i = 0; i < expensesCount; i++) {
      expensesToInsert.push({
        category: randomChoice(expensesCategories),
        amount: randomInt(500, 5000).toFixed(2),
        description: 'Seed expense',
        occurredAt: daysAgo(randomInt(1, 30)),
      });
    }

    if (expensesToInsert.length > 0) {
      await db.insert(schema.expenses).values(expensesToInsert);
    }

    const salaryPayments: Array<typeof schema.salaryPayments.$inferInsert> = [];
    const previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);

    for (const driverEntry of drivers) {
      const rate = randomInt(120, 200);
      const units = randomInt(120, 180);
      salaryPayments.push({
        driverId: driverEntry.id,
        employeeRole: 'Водій',
        rate: rate.toFixed(2),
        units,
        total: (rate * units).toFixed(2),
        paidAt: new Date(
          previousMonth.getFullYear(),
          previousMonth.getMonth(),
          randomInt(20, 28),
        ),
      });
    }

    if (salaryPayments.length > 0) {
      await db.insert(schema.salaryPayments).values(salaryPayments);
    }

    const ticketTrips = historicalTrips.length
      ? historicalTrips
      : await db
          .select()
          .from(schema.trips)
          .where(sql`${schema.trips.endsAt} is not null`);
    const ticketCards = cards.length
      ? cards
      : await db.select().from(schema.transportCards);

    if (ticketTrips.length > 0 && ticketCards.length > 0) {
      const ticketsToInsert: Array<typeof schema.tickets.$inferInsert> = [];
      for (let i = 0; i < 300; i++) {
        const trip = randomChoice(ticketTrips);
        const card = randomChoice(ticketCards);
        const start = new Date(trip.startsAt);
        const end = trip.endsAt ? new Date(trip.endsAt) : addMinutes(start, 30);
        const maxMinutes = Math.max(
          3,
          Math.round((end.getTime() - start.getTime()) / 60000) - 2,
        );
        const purchasedAt = addMinutes(start, randomInt(2, maxMinutes));

        ticketsToInsert.push({
          tripId: trip.id,
          cardId: card.id,
          price: randomChoice(['8.00', '10.00', '12.00']),
          purchasedAt,
        });
      }

      await db.insert(schema.tickets).values(ticketsToInsert);
    }

    // M. Fines & Complaints
    console.log('🧾 Seeding fines and complaints...');
    if (ticketTrips.length > 0 && passengers.length > 0) {
      const fineStatuses: Array<(typeof schema.fines.$inferInsert)['status']> =
        ['Очікує сплати', 'Оплачено', 'В процесі'];
      const fineReasons = [
        'Проїзд без квитка',
        'Непідтверджена оплата',
        'Порушення правил перевезення',
      ];
      const fineCount = randomInt(12, 18);
      const finesToInsert: Array<typeof schema.fines.$inferInsert> = [];

      for (let i = 0; i < fineCount; i++) {
        const trip = randomChoice(ticketTrips);
        const user = randomChoice(passengers);
        finesToInsert.push({
          userId: user.id,
          tripId: trip.id,
          status: fineStatuses[i % fineStatuses.length],
          amount: randomChoice(['60.00', '80.00', '50.00']),
          reason: fineReasons[i % fineReasons.length],
          issuedAt: addMinutes(new Date(trip.startsAt), randomInt(5, 20)),
        });
      }

      const insertedFines = await db
        .insert(schema.fines)
        .values(finesToInsert)
        .returning();

      const appealsToInsert: Array<typeof schema.fineAppeals.$inferInsert> = [];
      const appealStatuses = [
        'Подано',
        'Перевіряється',
        'Відхилено',
        'Прийнято',
      ];
      for (const fine of insertedFines) {
        if (fine.status !== 'В процесі') continue;
        appealsToInsert.push({
          fineId: fine.id,
          message: 'Seed appeal message',
          status: randomChoice(appealStatuses),
          createdAt: addMinutes(new Date(fine.issuedAt), randomInt(10, 120)),
        });
      }

      if (appealsToInsert.length > 0) {
        await db.insert(schema.fineAppeals).values(appealsToInsert);
      }
    }

    const complaintTopics = [
      'Брудний салон',
      'Водій палив',
      'Запізнення',
      'Пропозиція маршруту',
    ];
    const complaintStatuses = ['Подано', 'Розглянуто'];
    const complaintsCount = randomInt(15, 25);
    const complaintsToInsert: Array<
      typeof schema.complaintsSuggestions.$inferInsert
    > = [];

    for (let i = 0; i < complaintsCount; i++) {
      const route = someRoutes.length ? randomChoice(someRoutes) : undefined;
      const vehicle = vehicles.length ? randomChoice(vehicles) : undefined;
      const user = passengers.length ? randomChoice(passengers) : undefined;
      const isSuggestion =
        complaintTopics[i % complaintTopics.length] === 'Пропозиція маршруту';
      complaintsToInsert.push({
        userId: user?.id,
        type: isSuggestion ? 'Пропозиція' : 'Скарга',
        message: complaintTopics[i % complaintTopics.length],
        status: randomChoice(complaintStatuses),
        routeId: route?.id,
        vehicleId: vehicle?.id,
        contactInfo: user ? user.email : 'guest@ct.com',
        createdAt: daysAgo(randomInt(1, 30)),
      });
    }

    if (complaintsToInsert.length > 0) {
      await db.insert(schema.complaintsSuggestions).values(complaintsToInsert);
    }

    // N. Additional logs and budgets
    console.log('📍 Seeding GPS logs and budgets...');
    const stopCoords = Array.from(stopCoordsMap.values());
    if (stopCoords.length > 0 && passengers.length > 0) {
      const userGpsLogs: Array<typeof schema.userGpsLogs.$inferInsert> = [];
      for (const user of passengers) {
        const logCount = randomInt(3, 6);
        for (let i = 0; i < logCount; i++) {
          const coords = randomChoice(stopCoords);
          userGpsLogs.push({
            userId: user.id,
            lon: coords.lon.toFixed(7),
            lat: coords.lat.toFixed(7),
            recordedAt: daysAgo(randomInt(0, 20)),
          });
        }
      }
      await db.insert(schema.userGpsLogs).values(userGpsLogs);
    }

    if (vehicles.length > 0 && stopCoords.length > 0) {
      const vehicleGpsLogs: Array<typeof schema.vehicleGpsLogs.$inferInsert> =
        [];
      for (const vehicle of vehicles) {
        const logCount = randomInt(4, 8);
        for (let i = 0; i < logCount; i++) {
          const coords = randomChoice(stopCoords);
          vehicleGpsLogs.push({
            vehicleId: vehicle.id,
            lon: coords.lon.toFixed(7),
            lat: coords.lat.toFixed(7),
            recordedAt: daysAgo(randomInt(0, 15)),
          });
        }
      }
      await db.insert(schema.vehicleGpsLogs).values(vehicleGpsLogs);
    }

    // Budget entries with government subsidies breakdown
    const budgetEntries: Array<typeof schema.budgets.$inferInsert> = [];
    const currentMonth = new Date();
    const budgetNotes = [
      'Держбюджет: 180,000 грн | Власні доходи: квитки + штрафи',
      'Держбюджет: 175,000 грн | Субвенція на оновлення парку',
      'Держбюджет: 190,000 грн | Компенсація пільгових перевезень',
      'Держбюджет: 185,000 грн | Базове фінансування',
      'Держбюджет: 200,000 грн | Цільова дотація на паливо',
      'Держбюджет: 170,000 грн | Квартальне фінансування',
    ];

    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - i,
        1,
      );
      // Government budget base: 170-200k, operational income: 50-150k
      const govBudget = randomInt(170000, 200000);
      const operationalIncome = randomInt(50000, 150000);
      const totalIncome = govBudget + operationalIncome;
      // Expenses: salaries ~60%, fuel ~25%, maintenance ~15%
      const salaryExpenses = randomInt(100000, 150000);
      const fuelExpenses = randomInt(40000, 70000);
      const maintenanceExpenses = randomInt(20000, 40000);
      const totalExpenses = salaryExpenses + fuelExpenses + maintenanceExpenses;

      budgetEntries.push({
        month: monthDate.toISOString().slice(0, 10),
        income: totalIncome.toFixed(2),
        expenses: totalExpenses.toFixed(2),
        note: budgetNotes[i] || 'Плановий бюджет',
      });
    }

    await db.insert(schema.budgets).values(budgetEntries).onConflictDoNothing();

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
