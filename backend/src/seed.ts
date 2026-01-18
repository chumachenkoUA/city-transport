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
        salary_payments, financial_transactions, budgets,
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

        for (const [serviceId, count] of serviceCounts.entries()) {
          if (count > bestCount || (count === bestCount && serviceId !== '')) {
            selectedServiceId = serviceId;
            bestCount = count;
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
        // IMPORTANT: Use the same trip that was used for shapes to ensure consistency
        const representativeTrip = tripWithShape || tripCandidates[0];
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

          // Default all days to true (routes operate daily)
          await db.insert(schema.schedules).values({
            routeId: routeDb.id,
            workStartTime: minToTime(minStart),
            workEndTime: minToTime(maxEnd),
            intervalMin: interval,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: true,
          });
        } else {
          await db.insert(schema.schedules).values({
            routeId: routeDb.id,
            workStartTime: '06:00:00',
            workEndTime: '23:00:00',
            intervalMin: 15,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: true,
          });
        }
      }
    }
    console.log(`✅ Seeded ${routeCounter} Routes.`);
    // Note: paired_route_id is set automatically by routes_auto_pair_trigger

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
        email: 'petro.kovalenko@ct.lviv.ua',
        phone: '+380671234567',
        fullName: 'Коваленко Петро Іванович',
        driverLicenseNumber: 'ВАА123456',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'КА', number: '123456' },
      },
      {
        login: 'driver2',
        email: 'andrii.shevchenko@ct.lviv.ua',
        phone: '+380672345678',
        fullName: 'Шевченко Андрій Миколайович',
        driverLicenseNumber: 'ВАВ234567',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'КВ', number: '234567' },
      },
      {
        login: 'driver3',
        email: 'olha.melnyk@ct.lviv.ua',
        phone: '+380673456789',
        fullName: 'Мельник Ольга Василівна',
        driverLicenseNumber: 'ВАС345678',
        licenseCategories: ['B', 'C', 'D'],
        passportData: { series: 'КС', number: '345678' },
      },
      {
        login: 'driver4',
        email: 'ivan.bondarenko@ct.lviv.ua',
        phone: '+380674567890',
        fullName: 'Бондаренко Іван Петрович',
        driverLicenseNumber: 'ВАD456789',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'КD', number: '456789' },
      },
      {
        login: 'driver5',
        email: 'yuliia.tkachenko@ct.lviv.ua',
        phone: '+380675678901',
        fullName: 'Ткаченко Юлія Олександрівна',
        driverLicenseNumber: 'ВАЕ567890',
        licenseCategories: ['B', 'D'],
        passportData: { series: 'КЕ', number: '567890' },
      },
    ];

    const passengerSeeds = [
      {
        login: 'passenger1',
        email: 'ivan.ivanchenko@gmail.com',
        phone: '+380501234567',
        fullName: 'Іванченко Іван Васильович',
      },
      {
        login: 'passenger2',
        email: 'mariia.kravchenko@gmail.com',
        phone: '+380502345678',
        fullName: 'Кравченко Марія Олексіївна',
      },
      {
        login: 'passenger3',
        email: 'oleksii.sydorenko@gmail.com',
        phone: '+380503456789',
        fullName: 'Сидоренко Олексій Ігорович',
      },
      {
        login: 'passenger4',
        email: 'dmytro.poliakov@gmail.com',
        phone: '+380504567890',
        fullName: 'Поляков Дмитро Андрійович',
      },
      {
        login: 'passenger5',
        email: 'olena.moroz@gmail.com',
        phone: '+380505678901',
        fullName: 'Мороз Олена Сергіївна',
      },
      {
        login: 'passenger6',
        email: 'iryna.petrova@gmail.com',
        phone: '+380506789012',
        fullName: 'Петрова Ірина Миколаївна',
      },
      {
        login: 'passenger7',
        email: 'maksym.savchenko@gmail.com',
        phone: '+380507890123',
        fullName: 'Савченко Максим Олегович',
      },
      {
        login: 'passenger8',
        email: 'viktoriia.zaitseva@gmail.com',
        phone: '+380508901234',
        fullName: 'Зайцева Вікторія Павлівна',
      },
      {
        login: 'passenger9',
        email: 'oleh.honcharenko@gmail.com',
        phone: '+380509012345',
        fullName: 'Гончаренко Олег Вікторович',
      },
      {
        login: 'passenger10',
        email: 'sofiia.rudenko@gmail.com',
        phone: '+380670123456',
        fullName: 'Руденко Софія Дмитрівна',
      },
      {
        login: 'passenger11',
        email: 'pavlo.klymenko@gmail.com',
        phone: '+380671234567',
        fullName: 'Клименко Павло Романович',
      },
      {
        login: 'passenger12',
        email: 'iryna.koval@gmail.com',
        phone: '+380672345678',
        fullName: 'Коваль Ірина Юріївна',
      },
    ];

    // Generate 800 drivers total with Ukrainian names
    const ukrainianFirstNamesMale = [
      'Олександр', 'Андрій', 'Петро', 'Іван', 'Сергій', 'Василь', 'Михайло', 'Юрій',
      'Володимир', 'Богдан', 'Тарас', 'Микола', 'Олег', 'Віктор', 'Роман', 'Дмитро',
      'Максим', 'Артем', 'Євген', 'Павло', 'Денис', 'Віталій', 'Ігор', 'Анатолій',
      'Степан', 'Григорій', 'Леонід', 'Борис', 'Ярослав', 'Назар', 'Руслан', 'Олексій',
    ];
    const ukrainianFirstNamesFemale = [
      'Олена', 'Наталія', 'Ірина', 'Оксана', 'Тетяна', 'Людмила', 'Світлана', 'Марія',
      'Галина', 'Юлія', 'Вікторія', 'Катерина', 'Анна', 'Ольга', 'Софія', 'Дарина',
    ];
    const ukrainianLastNames = [
      'Коваленко', 'Шевченко', 'Бондаренко', 'Ткаченко', 'Кравченко', 'Олійник', 'Шевчук',
      'Поліщук', 'Бойко', 'Ткачук', 'Мельник', 'Марченко', 'Григоренко', 'Кравчук',
      'Савченко', 'Руденко', 'Петренко', 'Іванченко', 'Козак', 'Лисенко', 'Гриценко',
      'Романенко', 'Кузьменко', 'Павленко', 'Федоренко', 'Назаренко', 'Тимошенко',
      'Яременко', 'Захарченко', 'Демченко', 'Семенченко', 'Прокопенко', 'Остапенко',
      'Власенко', 'Даниленко', 'Юрченко', 'Харченко', 'Василенко', 'Левченко', 'Сидоренко',
    ];
    const ukrainianPatronymicsMale = [
      'Іванович', 'Петрович', 'Олександрович', 'Миколайович', 'Васильович', 'Андрійович',
      'Сергійович', 'Михайлович', 'Юрійович', 'Володимирович', 'Богданович', 'Тарасович',
      'Олегович', 'Вікторович', 'Романович', 'Дмитрович', 'Павлович', 'Ігорович',
    ];
    const ukrainianPatronymicsFemale = [
      'Іванівна', 'Петрівна', 'Олександрівна', 'Миколаївна', 'Василівна', 'Андріївна',
      'Сергіївна', 'Михайлівна', 'Юріївна', 'Володимирівна', 'Богданівна', 'Тарасівна',
      'Олегівна', 'Вікторівна', 'Романівна', 'Дмитрівна', 'Павлівна', 'Ігорівна',
    ];

    // Generate 795 more drivers (total 800)
    const totalDrivers = 800;
    for (let i = 6; i <= totalDrivers; i++) {
      const isFemale = i % 5 === 0; // ~20% female drivers
      const firstName = isFemale
        ? ukrainianFirstNamesFemale[i % ukrainianFirstNamesFemale.length]
        : ukrainianFirstNamesMale[i % ukrainianFirstNamesMale.length];
      const lastName = ukrainianLastNames[i % ukrainianLastNames.length];
      const patronymic = isFemale
        ? ukrainianPatronymicsFemale[i % ukrainianPatronymicsFemale.length]
        : ukrainianPatronymicsMale[i % ukrainianPatronymicsMale.length];

      const fullName = `${lastName} ${firstName} ${patronymic}`;
      const seriesLetter = String.fromCharCode(65 + (i % 26)); // A-Z

      driverSeeds.push({
        login: `driver${i}`,
        email: `driver${i}@ct.lviv.ua`,
        phone: `+38067${String(1000000 + i).slice(0, 7)}`,
        fullName,
        driverLicenseNumber: `ВА${seriesLetter}${String(100000 + i).slice(0, 6)}`,
        licenseCategories: ['B', 'D'],
        passportData: { series: `К${seriesLetter}`, number: String(i).padStart(6, '0') },
      });
    }
    console.log(`   Prepared ${driverSeeds.length} driver seeds`);

    // Ukrainian names for extra passengers
    const extraPassengerNames = [
      'Литвиненко Анна Олегівна',
      'Степаненко Богдан Вікторович',
      'Федоренко Катерина Андріївна',
      'Назаренко Артем Ігорович',
      'Тимошенко Людмила Сергіївна',
      'Яременко Олександра Миколаївна',
      'Захарченко Євген Олександрович',
      'Демченко Оксана Василівна',
      'Семенченко Роман Петрович',
      'Прокопенко Валентина Юріївна',
      'Остапенко Ігор Тарасович',
      'Власенко Світлана Ігорівна',
      'Даниленко Микита Дмитрович',
      'Юрченко Галина Олексіївна',
      'Харченко Андрій Романович',
      'Василенко Тетяна Миколаївна',
      'Ковальчук Денис Сергійович',
      'Левченко Марина Павлівна',
    ];
    for (let i = 0; i < extraPassengerNames.length; i++) {
      const index = i + 13;
      passengerSeeds.push({
        login: `passenger${index}`,
        email: `passenger${index}@gmail.com`,
        phone: `+38050${(9000000 + index * 111).toString()}`,
        fullName: extraPassengerNames[i],
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

    // Generate realistic transport card numbers (like Lviv City Card)
    const cardSeeds: Array<typeof schema.transportCards.$inferInsert> =
      passengers.map((p, index) => ({
        userId: p.id,
        cardNumber: `7700${String(1000000 + index * 12345).slice(0, 8)}${String(index).padStart(4, '0')}`,
        balance:
          p.login === 'passenger1' ? '150.00' : randomInt(10, 500).toFixed(2),
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

    // I. Vehicles & Active Data - 750 vehicles total
    // Distribution: 120 trams, 100 trolleybuses, 530 buses
    console.log('🚌 Seeding 750 Vehicles...');

    const allRoutes = await db
      .select()
      .from(schema.routes)
      .orderBy(asc(schema.routes.id));

    const vehicles: Array<typeof schema.vehicles.$inferSelect> = [];
    const vehiclesByRoute = new Map<
      number,
      Array<typeof schema.vehicles.$inferSelect>
    >();
    const vehicleModelsByType = new Map<number, number[]>(); // Multiple models per type

    // Fleet number prefixes by transport type (realistic Lviv style)
    const fleetPrefixes: Record<string, string> = {
      Трамвай: 'Т',
      Тролейбус: 'ТБ',
      Автобус: 'А',
      Метро: 'М',
    };

    // Vehicle models by transport type (realistic Ukrainian models)
    const vehicleModelConfigs: Record<string, { name: string; capacity: number }[]> = {
      Трамвай: [
        { name: 'Електрон Т5L64', capacity: 180 },
        { name: 'Tatra KT4SU', capacity: 150 },
        { name: 'Tatra T4SU', capacity: 120 },
        { name: 'Електрон Т3L44', capacity: 140 },
      ],
      Тролейбус: [
        { name: 'Електрон Т19101', capacity: 115 },
        { name: 'ЛАЗ Е183', capacity: 100 },
        { name: 'БКМ 321', capacity: 105 },
        { name: 'Богдан Т70117', capacity: 95 },
      ],
      Автобус: [
        { name: 'МАЗ 203', capacity: 90 },
        { name: 'Електрон А185', capacity: 100 },
        { name: 'ЛАЗ А183', capacity: 85 },
        { name: 'Mercedes Citaro', capacity: 95 },
        { name: 'MAN Lions City', capacity: 90 },
        { name: 'Богдан А144', capacity: 45 },
        { name: 'Богдан А092', capacity: 30 },
        { name: 'Рута 25 Next', capacity: 25 },
      ],
      Метро: [
        { name: 'Метровагон 81-717', capacity: 300 },
      ],
    };

    // Create vehicle models for each type
    for (const [typeName, configs] of Object.entries(vehicleModelConfigs)) {
      const typeId = Array.from(ttNameById.entries()).find(([, name]) => name === typeName)?.[0];
      if (!typeId) continue;

      const modelIds: number[] = [];
      for (const config of configs) {
        const [model] = await db
          .insert(schema.vehicleModels)
          .values({
            name: config.name,
            typeId,
            capacity: config.capacity,
          })
          .onConflictDoNothing()
          .returning();
        if (model) modelIds.push(model.id);
      }
      vehicleModelsByType.set(typeId, modelIds);
    }

    // Target vehicle counts by type
    const vehicleTargets: Record<string, number> = {
      Трамвай: 120,
      Тролейбус: 100,
      Автобус: 530,
    };

    // Group routes by transport type
    const routesByType = new Map<number, typeof allRoutes>();
    for (const route of allRoutes) {
      const list = routesByType.get(route.transportTypeId) ?? [];
      list.push(route);
      routesByType.set(route.transportTypeId, list);
    }

    // Create vehicles distributed across routes
    let totalVehicleCount = 0;
    for (const [typeId, routes] of routesByType.entries()) {
      const typeName = ttNameById.get(typeId) || 'Автобус';
      const targetCount = vehicleTargets[typeName] || 0;
      if (targetCount === 0 || routes.length === 0) continue;

      const modelIds = vehicleModelsByType.get(typeId) || [];
      if (modelIds.length === 0) continue;

      const prefix = fleetPrefixes[typeName] || 'ТЗ';
      const vehiclesPerRouteBase = Math.floor(targetCount / routes.length);
      let remainder = targetCount % routes.length;

      for (const route of routes) {
        const vehicleCount = vehiclesPerRouteBase + (remainder-- > 0 ? 1 : 0);

        for (let i = 0; i < vehicleCount; i++) {
          const modelId = modelIds[i % modelIds.length];
          // Fleet number format: prefix-XXX where XXX is sequential number
          const fleetNumber = `${prefix}-${String(totalVehicleCount + 1).padStart(4, '0')}`;

          const [vehicle] = await db
            .insert(schema.vehicles)
            .values({
              fleetNumber,
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
            totalVehicleCount++;
          }
        }
      }
      console.log(`   Created ${typeName}: ${totalVehicleCount} vehicles so far`);
    }
    console.log(`✅ Total vehicles created: ${vehicles.length}`);

    // Create driver-vehicle mappings
    // Assign 700 drivers to vehicles (leaving ~100 free drivers for flexibility)
    // IMPORTANT: assignedAt must be BEFORE historical trips (60 days ago)
    // so that view queries (assigned_at <= planned_starts_at) find the assignments
    const assignmentDate = daysAgo(60);

    const driverVehicleMap = new Map<
      number,
      { vehicleId: number; routeId: number }
    >();

    // Assign drivers to vehicles (1:1 mapping for first 700 drivers)
    const driversToAssign = 700;
    const assignableCount = Math.min(driversToAssign, vehicles.length, drivers.length);

    // Batch insert for performance
    const assignmentBatch: Array<typeof schema.driverVehicleAssignments.$inferInsert> = [];

    for (let index = 0; index < assignableCount; index++) {
      const driverEntry = drivers[index];
      const vehicle = vehicles[index];
      if (!driverEntry || !vehicle) continue;

      assignmentBatch.push({
        driverId: driverEntry.id,
        vehicleId: vehicle.id,
        assignedAt: assignmentDate,
      });

      // Store mapping for trip generation
      driverVehicleMap.set(driverEntry.id, {
        vehicleId: vehicle.id,
        routeId: vehicle.routeId,
      });
    }

    // Insert in batches
    if (assignmentBatch.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < assignmentBatch.length; i += batchSize) {
        const batch = assignmentBatch.slice(i, i + batchSize);
        await db.insert(schema.driverVehicleAssignments).values(batch).onConflictDoNothing();
      }
    }

    const freeDriversCount = drivers.length - assignableCount;
    console.log(`✅ Assigned ${assignableCount} drivers to vehicles (leaving ${freeDriversCount} free drivers)`);

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
            plannedStartsAt: Date;
            actualStartsAt: Date;
            actualEndsAt: Date;
            durationMin: number;
          }> = [];

          for (let i = 0; i < historyTripCount; i++) {
            const route = historyRoutes[i % historyRoutes.length];

            const tripDate = new Date(baseDate);
            tripDate.setDate(baseDate.getDate() + i * 2);
            const startHour = startHours[i % startHours.length];
            const startMinute = (i * 7) % 50;
            tripDate.setHours(startHour, startMinute, 0, 0);

            const durationMinutes = 18 + (i % 5) * 7;
            // Add small random delay for actual start (-5 to +15 minutes)
            const delayMinutes = randomInt(-5, 15);
            const plannedStartsAt = new Date(tripDate);
            const plannedEndsAt = new Date(
              tripDate.getTime() + durationMinutes * 60 * 1000,
            );
            const actualStartsAt = new Date(
              tripDate.getTime() + delayMinutes * 60 * 1000,
            );
            const actualEndsAt = new Date(
              actualStartsAt.getTime() + durationMinutes * 60 * 1000,
            );

            tripsToInsert.push({
              routeId: route.id,
              driverId: driver.id,
              plannedStartsAt,
              plannedEndsAt,
              actualStartsAt,
              actualEndsAt,
              status: 'completed',
              passengerCount: 5 + (i % 12),
            });
            tripTimes.push({
              plannedStartsAt,
              actualStartsAt,
              actualEndsAt,
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
                meta.actualStartsAt.getTime() + purchaseOffsetMin * 60 * 1000,
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
                meta.actualStartsAt.getTime() +
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

    if (allRoutes.length > 0 && vehicles.length > 0 && drivers.length > 0) {
      // Generate ~300 historical completed trips over last 30 days
      const historicalTripCount = 300;
      const tripInserts: Array<typeof schema.trips.$inferInsert> = [];

      // Build array of assigned drivers with their routes
      const assignedDrivers = Array.from(driverVehicleMap.entries()).map(
        ([driverId, assignment]) => ({
          driverId,
          routeId: assignment.routeId,
        }),
      );

      for (let i = 0; i < historicalTripCount; i++) {
        // Use driver-route pairs from assignments (1:1 mapping)
        const assignment = assignedDrivers[i % assignedDrivers.length];
        if (!assignment) continue;

        const daysBack = randomInt(1, 30);
        const plannedStartsAt = daysAgo(daysBack);
        plannedStartsAt.setHours(randomInt(6, 22), randomInt(0, 50), 0, 0);
        const durationMinutes = randomInt(20, 60);
        const plannedEndsAt = addMinutes(plannedStartsAt, durationMinutes);

        // Add realistic delay for actual times (-5 to +15 minutes)
        const delayMinutes = randomInt(-5, 15);
        const actualStartsAt = addMinutes(plannedStartsAt, delayMinutes);
        const actualDuration = durationMinutes + randomInt(-5, 10);
        const actualEndsAt = addMinutes(actualStartsAt, actualDuration);

        tripInserts.push({
          routeId: assignment.routeId,
          driverId: assignment.driverId,
          plannedStartsAt,
          plannedEndsAt,
          actualStartsAt,
          actualEndsAt,
          status: 'completed',
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

      // Create 3 active trips using driver-route assignments (1:1)
      // IMPORTANT: Exclude driver1 as they will have their own demo schedule
      const activeTripsCount = Math.min(3, assignedDrivers.length);
      const usedDriverIds = new Set<number>();
      if (driver) usedDriverIds.add(driver.id); // Reserve driver1 for demo schedule

      for (let i = 0; i < activeTripsCount; i++) {
        // Find an assigned driver not already in use for active trips
        const assignment = assignedDrivers.find(
          (a) => !usedDriverIds.has(a.driverId),
        );
        if (!assignment) continue;

        usedDriverIds.add(assignment.driverId);
        const vehicleInfo = driverVehicleMap.get(assignment.driverId);

        // Trip planned 30-40 minutes ago, started with 5-10 min delay
        const minutesAgo = 30 + i * 10; // 30, 40, 50 minutes ago
        const plannedStartsAt = addMinutes(new Date(), -minutesAgo);
        const plannedEndsAt = addMinutes(plannedStartsAt, 45); // 45 min planned duration
        const delayMinutes = randomInt(3, 10);
        const actualStartsAt = addMinutes(plannedStartsAt, delayMinutes);

        const [activeTrip] = await db
          .insert(schema.trips)
          .values({
            routeId: assignment.routeId, // Use driver's assigned route
            driverId: assignment.driverId,
            plannedStartsAt,
            plannedEndsAt,
            actualStartsAt,
            actualEndsAt: null, // Not finished yet
            status: 'in_progress',
            passengerCount: randomInt(5, 30),
          })
          .returning();

        // Generate GPS logs using the driver's assigned vehicle
        if (activeTrip && vehicleInfo) {
          const firstStopResult = (await db.execute(sql`
            SELECT s.lon, s.lat
            FROM ${sql.raw('route_stops')} rs
            JOIN ${sql.raw('stops')} s ON s.id = rs.stop_id
            WHERE rs.route_id = ${assignment.routeId}
              AND rs.prev_route_stop_id IS NULL
            LIMIT 1
          `)) as unknown as { rows: Array<{ lon: string; lat: string }> };
          const firstStop = firstStopResult.rows[0];

          if (firstStop?.lon && firstStop?.lat) {
            for (let j = 0; j < 4; j++) {
              await db.insert(schema.vehicleGpsLogs).values({
                vehicleId: vehicleInfo.vehicleId,
                lon: firstStop.lon,
                lat: firstStop.lat,
                recordedAt: addMinutes(new Date(), -j * 3),
              });
            }
          }
        }
      }

      // Create scheduled trips for today + 3 days ahead using driver-route assignments
      console.log('📅 Seeding scheduled trips for 4 days...');
      const now = new Date();
      const currentHour = now.getHours();
      const todayBase = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const scheduledTrips: Array<typeof schema.trips.$inferInsert> = [];

      // Schedule configuration
      const workStartHour = 6;
      const workEndHour = 22;
      const intervalMinutes = 30; // Trip every 30 minutes

      // Generate trips for 4 days (today + 3 days ahead)
      for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
        const tripDate = new Date(todayBase);
        tripDate.setDate(tripDate.getDate() + dayOffset);

        // For today, start from next hour; for future days, start from workStartHour
        const startHour =
          dayOffset === 0
            ? Math.max(currentHour + 1, workStartHour)
            : workStartHour;

        // Generate trips at regular intervals
        // Filter out driver1 - they have their own demo schedule
        const schedulableDrivers = driver
          ? assignedDrivers.filter((a) => a.driverId !== driver.id)
          : assignedDrivers;

        for (let hour = startHour; hour < workEndHour; hour++) {
          for (let minute = 0; minute < 60; minute += intervalMinutes) {
            // Use driver-route pairs from assignments (1:1 mapping)
            if (schedulableDrivers.length === 0) continue;
            const tripIndex = scheduledTrips.length;
            const assignment =
              schedulableDrivers[tripIndex % schedulableDrivers.length];
            if (!assignment) continue;

            const plannedStartsAt = new Date(tripDate);
            plannedStartsAt.setHours(hour, minute, 0, 0);

            // Skip if this time is in the past
            if (plannedStartsAt <= now) continue;

            const plannedEndsAt = addMinutes(
              plannedStartsAt,
              randomInt(35, 50),
            );

            scheduledTrips.push({
              routeId: assignment.routeId, // Use driver's assigned route
              driverId: assignment.driverId,
              plannedStartsAt,
              plannedEndsAt,
              actualStartsAt: null,
              actualEndsAt: null,
              status: 'scheduled',
              passengerCount: 0,
            });
          }
        }
      }

      console.log(`   Created ${scheduledTrips.length} scheduled trips`);
      if (scheduledTrips.length > 0) {
        // Insert in batches to avoid timeout
        const batchSize = 100;
        for (let i = 0; i < scheduledTrips.length; i += batchSize) {
          const batch = scheduledTrips.slice(i, i + batchSize);
          await db.insert(schema.trips).values(batch);
        }
      }

      // Create comprehensive demo schedule for driver1
      console.log('🎯 Creating demo schedule for driver1...');
      if (driver && driverVehicleMap.has(driver.id)) {
        const driver1Assignment = driverVehicleMap.get(driver.id)!;
        const driver1Trips: Array<typeof schema.trips.$inferInsert> = [];

        // Create trips for driver1 for demonstration:
        // - 5 completed trips in the past few days
        // - 1 active trip (in_progress)
        // - 8 scheduled trips for today (every hour from next hour)
        // - 6 scheduled trips for tomorrow

        // Past completed trips (last 5 days)
        for (let daysBack = 1; daysBack <= 5; daysBack++) {
          const tripDate = daysAgo(daysBack);
          // Morning trip
          tripDate.setHours(8, 0, 0, 0);
          const morningStart = new Date(tripDate);
          const morningDelay = randomInt(-3, 8);
          const morningDuration = randomInt(40, 55);

          driver1Trips.push({
            routeId: driver1Assignment.routeId,
            driverId: driver.id,
            plannedStartsAt: morningStart,
            plannedEndsAt: addMinutes(morningStart, morningDuration),
            actualStartsAt: addMinutes(morningStart, morningDelay),
            actualEndsAt: addMinutes(morningStart, morningDelay + morningDuration + randomInt(-5, 10)),
            status: 'completed',
            passengerCount: randomInt(25, 65),
          });

          // Afternoon trip
          tripDate.setHours(14, 30, 0, 0);
          const afternoonStart = new Date(tripDate);
          const afternoonDelay = randomInt(-2, 10);
          const afternoonDuration = randomInt(35, 50);

          driver1Trips.push({
            routeId: driver1Assignment.routeId,
            driverId: driver.id,
            plannedStartsAt: afternoonStart,
            plannedEndsAt: addMinutes(afternoonStart, afternoonDuration),
            actualStartsAt: addMinutes(afternoonStart, afternoonDelay),
            actualEndsAt: addMinutes(afternoonStart, afternoonDelay + afternoonDuration + randomInt(-3, 8)),
            status: 'completed',
            passengerCount: randomInt(30, 70),
          });
        }

        // Today's schedule for driver1
        const todayForDriver1 = new Date(todayBase);
        const driver1CurrentHour = now.getHours();

        // Completed trips today (before current hour)
        for (let hour = 6; hour < driver1CurrentHour - 1; hour += 2) {
          const tripStart = new Date(todayForDriver1);
          tripStart.setHours(hour, 0, 0, 0);
          const delay = randomInt(-2, 8);
          const duration = randomInt(40, 55);

          driver1Trips.push({
            routeId: driver1Assignment.routeId,
            driverId: driver.id,
            plannedStartsAt: tripStart,
            plannedEndsAt: addMinutes(tripStart, duration),
            actualStartsAt: addMinutes(tripStart, delay),
            actualEndsAt: addMinutes(tripStart, delay + duration),
            status: 'completed',
            passengerCount: randomInt(20, 55),
          });
        }

        // Active trip (current)
        const activeStart = new Date(todayForDriver1);
        activeStart.setHours(driver1CurrentHour - 1, 30, 0, 0);
        const activeDelay = randomInt(2, 7);

        driver1Trips.push({
          routeId: driver1Assignment.routeId,
          driverId: driver.id,
          plannedStartsAt: activeStart,
          plannedEndsAt: addMinutes(activeStart, 50),
          actualStartsAt: addMinutes(activeStart, activeDelay),
          actualEndsAt: null,
          status: 'in_progress',
          passengerCount: randomInt(15, 40),
        });

        // Scheduled trips for rest of today
        for (let hour = driver1CurrentHour + 1; hour <= 21; hour += 2) {
          const tripStart = new Date(todayForDriver1);
          tripStart.setHours(hour, 0, 0, 0);
          const duration = randomInt(40, 55);

          driver1Trips.push({
            routeId: driver1Assignment.routeId,
            driverId: driver.id,
            plannedStartsAt: tripStart,
            plannedEndsAt: addMinutes(tripStart, duration),
            actualStartsAt: null,
            actualEndsAt: null,
            status: 'scheduled',
            passengerCount: 0,
          });
        }

        // Scheduled trips for tomorrow
        const tomorrowForDriver1 = new Date(todayBase);
        tomorrowForDriver1.setDate(tomorrowForDriver1.getDate() + 1);

        for (let hour = 6; hour <= 20; hour += 2) {
          const tripStart = new Date(tomorrowForDriver1);
          tripStart.setHours(hour, 0, 0, 0);
          const duration = randomInt(40, 55);

          driver1Trips.push({
            routeId: driver1Assignment.routeId,
            driverId: driver.id,
            plannedStartsAt: tripStart,
            plannedEndsAt: addMinutes(tripStart, duration),
            actualStartsAt: null,
            actualEndsAt: null,
            status: 'scheduled',
            passengerCount: 0,
          });
        }

        // Insert driver1 trips
        if (driver1Trips.length > 0) {
          await db.insert(schema.trips).values(driver1Trips);
          console.log(`   ✅ Created ${driver1Trips.length} trips for driver1 (completed: ${driver1Trips.filter(t => t.status === 'completed').length}, active: ${driver1Trips.filter(t => t.status === 'in_progress').length}, scheduled: ${driver1Trips.filter(t => t.status === 'scheduled').length})`);
        }

        // Generate GPS logs for driver1's active trip
        const vehicleInfo = driverVehicleMap.get(driver.id);
        if (vehicleInfo) {
          const firstStopResult = (await db.execute(sql`
            SELECT s.lon, s.lat
            FROM ${sql.raw('route_stops')} rs
            JOIN ${sql.raw('stops')} s ON s.id = rs.stop_id
            WHERE rs.route_id = ${driver1Assignment.routeId}
              AND rs.prev_route_stop_id IS NULL
            LIMIT 1
          `)) as unknown as { rows: Array<{ lon: string; lat: string }> };
          const firstStop = firstStopResult.rows[0];

          if (firstStop?.lon && firstStop?.lat) {
            // Generate 10 GPS points for demo
            for (let j = 0; j < 10; j++) {
              await db.insert(schema.vehicleGpsLogs).values({
                vehicleId: vehicleInfo.vehicleId,
                lon: String(Number(firstStop.lon) + (Math.random() - 0.5) * 0.01),
                lat: String(Number(firstStop.lat) + (Math.random() - 0.5) * 0.01),
                recordedAt: addMinutes(new Date(), -j * 2),
              });
            }
            console.log(`   ✅ Generated 10 GPS logs for driver1's vehicle`);
          }
        }
      }
    }

    // L. Finance & Tickets
    console.log('💳 Seeding finance data...');

    // Realistic expense descriptions by category
    const expenseDescriptions: Record<string, string[]> = {
      fuel: [
        'Дизпаливо для автобусів (АЗС ОККО)',
        'Паливо для службових авто',
        'Електроенергія для тролейбусів',
        'Електроенергія для трамваїв',
      ],
      maintenance: [
        'Планове ТО автобусів МАЗ',
        'Ремонт гальмівної системи',
        'Заміна шин (сезонна)',
        'Ремонт кондиціонерів',
        'Діагностика електрообладнання',
        'Заміна акумуляторів',
      ],
      other_expense: [
        'Канцелярські товари',
        'Миючі засоби для салонів',
        'Спецодяг для водіїв',
        'Оренда приміщення диспетчерської',
        'Комунальні послуги депо',
      ],
    };

    const expensesCategories = ['fuel', 'maintenance', 'other_expense'];
    const expensesToInsert: Array<
      typeof schema.financialTransactions.$inferInsert
    > = [];
    const expensesCount = randomInt(30, 50);

    for (let i = 0; i < expensesCount; i++) {
      const category = randomChoice(expensesCategories);
      const descriptions = expenseDescriptions[category] || ['Інші витрати'];
      const description = randomChoice(descriptions);

      // Realistic amounts by category
      let amount: number;
      if (category === 'fuel') {
        amount = randomInt(5000, 25000);
      } else if (category === 'maintenance') {
        amount = randomInt(2000, 15000);
      } else {
        amount = randomInt(500, 5000);
      }

      expensesToInsert.push({
        txType: 'expense',
        source: category,
        amount: amount.toFixed(2),
        description,
        occurredAt: daysAgo(randomInt(1, 30)),
        createdBy: 'accountant1',
      });
    }

    if (expensesToInsert.length > 0) {
      await db.insert(schema.financialTransactions).values(expensesToInsert);
    }

    // Generate salary payments for last 3 months
    const salaryPayments: Array<typeof schema.salaryPayments.$inferInsert> = [];

    for (let monthsBack = 1; monthsBack <= 3; monthsBack++) {
      const paymentMonth = new Date();
      paymentMonth.setMonth(paymentMonth.getMonth() - monthsBack);

      for (const driverEntry of drivers) {
        // Realistic Ukrainian driver hourly rates (100-150 UAH/hour)
        const rate = randomInt(100, 150);
        // Typical monthly hours (160-200 hours)
        const units = randomInt(160, 200);
        const total = rate * units;

        salaryPayments.push({
          driverId: driverEntry.id,
          rate: rate.toFixed(2),
          units,
          total: total.toFixed(2),
          paidAt: new Date(
            paymentMonth.getFullYear(),
            paymentMonth.getMonth(),
            randomInt(5, 10), // Salary paid 5-10th of next month
          ),
        });
      }
    }

    if (salaryPayments.length > 0) {
      await db.insert(schema.salaryPayments).values(salaryPayments);
    }
    console.log(`   Created ${salaryPayments.length} salary payments for ${drivers.length} drivers (3 months)`);

    // Get completed trips for ticket generation
    const ticketTrips = historicalTrips.length
      ? historicalTrips
      : await db
          .select()
          .from(schema.trips)
          .where(eq(schema.trips.status, 'completed'));
    const ticketCards = cards.length
      ? cards
      : await db.select().from(schema.transportCards);

    if (ticketTrips.length > 0 && ticketCards.length > 0) {
      const ticketsToInsert: Array<typeof schema.tickets.$inferInsert> = [];
      // Generate ~500 tickets for completed trips
      for (let i = 0; i < 500; i++) {
        const trip = randomChoice(ticketTrips);
        const card = randomChoice(ticketCards);
        // Use actualStartsAt/actualEndsAt for completed trips
        const start = trip.actualStartsAt
          ? new Date(trip.actualStartsAt)
          : new Date(trip.plannedStartsAt);
        const end = trip.actualEndsAt
          ? new Date(trip.actualEndsAt)
          : addMinutes(start, 30);
        const maxMinutes = Math.max(
          3,
          Math.round((end.getTime() - start.getTime()) / 60000) - 2,
        );
        const purchasedAt = addMinutes(start, randomInt(2, maxMinutes));

        ticketsToInsert.push({
          tripId: trip.id,
          cardId: card.id,
          price: randomChoice(['10.00', '12.00', '14.00', '16.00']), // Realistic Lviv prices 2024-2025
          purchasedAt,
        });
      }

      await db.insert(schema.tickets).values(ticketsToInsert);
    }

    // M. Fines & Complaints
    console.log('🧾 Seeding fines and complaints...');
    if (ticketTrips.length > 0 && passengers.length > 0) {
      const fineStatuses: Array<(typeof schema.fines.$inferInsert)['status']> =
        ['Очікує сплати', 'Оплачено', 'В процесі', 'Відмінено'];
      const fineReasons = [
        'Проїзд без квитка',
        'Непідтверджена оплата через термінал',
        'Безквитковий проїзд при перевірці',
        'Пошкодження майна транспортного засобу',
        'Порушення правил перевезення багажу',
      ];
      const fineCount = randomInt(15, 25);
      const finesToInsert: Array<typeof schema.fines.$inferInsert> = [];

      for (let i = 0; i < fineCount; i++) {
        const trip = randomChoice(ticketTrips);
        const user = randomChoice(passengers);
        const tripStart = trip.actualStartsAt
          ? new Date(trip.actualStartsAt)
          : new Date(trip.plannedStartsAt);
        finesToInsert.push({
          userId: user.id,
          tripId: trip.id,
          status: fineStatuses[i % fineStatuses.length],
          amount: randomChoice(['170.00', '255.00', '340.00', '510.00']), // Ukrainian fine amounts (1-3 неоподатковуваних мінімумів)
          reason: fineReasons[i % fineReasons.length],
          issuedAt: addMinutes(tripStart, randomInt(5, 20)),
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
      const route = allRoutes.length ? randomChoice(allRoutes) : undefined;
      const vehicle = vehicles.length ? randomChoice(vehicles) : undefined;
      const user = passengers.length ? randomChoice(passengers) : undefined;
      const isSuggestion =
        complaintTopics[i % complaintTopics.length] === 'Пропозиція маршруту';
      complaintsToInsert.push({
        userId: user?.id,
        type: isSuggestion ? 'suggestion' : 'complaint',
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
        plannedIncome: totalIncome.toFixed(2),
        plannedExpenses: totalExpenses.toFixed(2),
        actualIncome: (totalIncome * 0.9).toFixed(2), // ~90% виконання плану
        actualExpenses: totalExpenses.toFixed(2),
        note: budgetNotes[i] || 'Плановий бюджет',
      });
    }

    await db.insert(schema.budgets).values(budgetEntries).onConflictDoNothing();

    // === INCOMES (Доходи - державне фінансування) ===
    console.log('💰 Seeding incomes...');

    const incomeEntries: Array<
      typeof schema.financialTransactions.$inferInsert
    > = [];

    // Державне фінансування за останні 6 місяців
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - i,
        randomInt(1, 15),
      );

      // Державний бюджет - основне фінансування
      incomeEntries.push({
        txType: 'income',
        source: 'government',
        amount: randomInt(150000, 200000).toFixed(2),
        description: `Державне фінансування за ${new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(monthDate)}`,
        occurredAt: monthDate,
        createdBy: 'seed',
      });

      // Компенсація за пільгові перевезення
      if (i % 2 === 0) {
        const compensationDate = new Date(monthDate);
        compensationDate.setDate(randomInt(16, 28));
        incomeEntries.push({
          txType: 'income',
          source: 'government',
          amount: randomInt(30000, 50000).toFixed(2),
          description: 'Компенсація за пільгові перевезення',
          occurredAt: compensationDate,
          createdBy: 'seed',
        });
      }
    }

    await db
      .insert(schema.financialTransactions)
      .values(incomeEntries)
      .onConflictDoNothing();

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
