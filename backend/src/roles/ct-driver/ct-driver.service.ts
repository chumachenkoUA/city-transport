import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriverVehicleAssignmentsService } from '../../modules/driver-vehicle-assignments/driver-vehicle-assignments.service';
import { DriversService } from '../../modules/drivers/drivers.service';
import { RoutePointsService } from '../../modules/route-points/route-points.service';
import { RouteStopsService } from '../../modules/route-stops/route-stops.service';
import { RoutesService } from '../../modules/routes/routes.service';
import { SchedulesService } from '../../modules/schedules/schedules.service';
import { TripsService } from '../../modules/trips/trips.service';
import { VehiclesService } from '../../modules/vehicles/vehicles.service';
import { FinishTripDto } from './dto/finish-trip.dto';
import { PassengerCountDto } from './dto/passenger-count.dto';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { StartTripDto } from './dto/start-trip.dto';

const AVERAGE_SPEED_KMH = 25;

@Injectable()
export class CtDriverService {
  constructor(
    private readonly driversService: DriversService,
    private readonly assignmentsService: DriverVehicleAssignmentsService,
    private readonly vehiclesService: VehiclesService,
    private readonly routesService: RoutesService,
    private readonly schedulesService: SchedulesService,
    private readonly routeStopsService: RouteStopsService,
    private readonly routePointsService: RoutePointsService,
    private readonly tripsService: TripsService,
  ) {}

  async getSchedule(driverId: number) {
    await this.driversService.findOne(driverId);

    const assignment =
      await this.assignmentsService.findLatestByDriverId(driverId);
    if (!assignment) {
      throw new NotFoundException(
        `No assignments found for driver ${driverId}`,
      );
    }

    const vehicle = await this.vehiclesService.findOne(assignment.vehicleId);
    const route = await this.routesService.findOne(vehicle.routeId);
    const schedule = await this.schedulesService.findByRouteId(route.id);

    if (!schedule) {
      throw new NotFoundException(`Schedule for route ${route.id} not found`);
    }

    const stops = await this.routeStopsService.findStopsByRouteId(route.id);
    const stopsWithIntervals = stops.map((stop) => {
      const distanceKm = stop.distanceToNextKm
        ? Number(stop.distanceToNextKm)
        : null;
      const minutesToNextStop =
        distanceKm !== null
          ? this.roundTo1((distanceKm / AVERAGE_SPEED_KMH) * 60)
          : null;

      return {
        id: stop.stopId,
        name: stop.stopName,
        lon: stop.lon,
        lat: stop.lat,
        distanceToNextKm: distanceKm,
        minutesToNextStop,
      };
    });

    return {
      driverId,
      vehicle: {
        id: vehicle.id,
        fleetNumber: vehicle.fleetNumber,
      },
      route: {
        id: route.id,
        number: route.number,
        transportTypeId: route.transportTypeId,
        direction: route.direction,
      },
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      intervalMin: schedule.intervalMin,
      stops: stopsWithIntervals,
    };
  }

  async getRouteStops(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    return this.routeStopsService.findStopsByRouteId(routeId);
  }

  async getRoutePoints(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    return this.routePointsService.findByRouteId(routeId);
  }

  async startTrip(payload: StartTripDto) {
    await this.driversService.findOne(payload.driverId);
    const vehicle = await this.resolveVehicle(payload);
    const startsAt = payload.startedAt ?? new Date();
    const schedule = await this.schedulesService.findByRouteId(vehicle.routeId);
    const estimatedMinutes = schedule ? schedule.intervalMin : 1;
    const endsAt = new Date(startsAt.getTime() + estimatedMinutes * 60 * 1000);

    return this.tripsService.create({
      routeId: vehicle.routeId,
      vehicleId: vehicle.id,
      driverId: payload.driverId,
      startsAt,
      endsAt,
      passengerCount: 0,
    });
  }

  async finishTrip(payload: FinishTripDto) {
    await this.driversService.findOne(payload.driverId);

    const trip = payload.tripId
      ? await this.tripsService.findOne(payload.tripId)
      : await this.findLatestTrip(payload);

    if (!trip) {
      throw new NotFoundException('No trip found to finish');
    }

    if (trip.driverId !== payload.driverId) {
      throw new BadRequestException('Trip does not belong to this driver');
    }

    const endsAt = payload.endedAt ?? new Date();

    return this.tripsService.update(trip.id, {
      endsAt,
    });
  }

  async setPassengerCount(payload: PassengerCountDto) {
    await this.driversService.findOne(payload.driverId);
    const vehicle = await this.resolveVehicle(payload);

    const trip = await this.tripsService.findLatestByDriverVehicleOnDate(
      payload.driverId,
      vehicle.id,
      payload.date,
    );

    if (trip) {
      return this.tripsService.update(trip.id, {
        passengerCount: payload.passengerCount,
      });
    }

    const startsAt = new Date(`${payload.date}T00:00:00`);
    const endsAt = new Date(`${payload.date}T00:01:00`);

    return this.tripsService.create({
      routeId: vehicle.routeId,
      vehicleId: vehicle.id,
      driverId: payload.driverId,
      startsAt,
      endsAt,
      passengerCount: payload.passengerCount,
    });
  }

  private async resolveRouteId(payload: RouteLookupDto) {
    if (payload.routeId) {
      return payload.routeId;
    }

    if (!payload.routeNumber) {
      throw new BadRequestException('routeId or routeNumber is required');
    }

    const route = payload.transportTypeId
      ? await this.routesService.findByNumberAndType(
          payload.routeNumber,
          payload.transportTypeId,
          payload.direction ?? 'forward',
        )
      : await this.routesService.findByNumber(payload.routeNumber);

    if (!route) {
      throw new NotFoundException(
        `Route ${payload.routeNumber} (${payload.transportTypeId}) not found`,
      );
    }

    return route.id;
  }

  private async resolveVehicle(payload: {
    vehicleId?: number;
    fleetNumber?: string;
  }) {
    if (payload.vehicleId) {
      return this.vehiclesService.findOne(payload.vehicleId);
    }

    if (!payload.fleetNumber) {
      throw new BadRequestException('vehicleId or fleetNumber is required');
    }

    const vehicle = await this.vehiclesService.findByFleetNumber(
      payload.fleetNumber,
    );

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${payload.fleetNumber} not found`);
    }

    return vehicle;
  }

  private async findLatestTrip(payload: {
    driverId: number;
    vehicleId?: number;
    fleetNumber?: string;
  }) {
    const vehicle = await this.resolveVehicle(payload);
    return this.tripsService.findLatestByDriverAndVehicle(
      payload.driverId,
      vehicle.id,
    );
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }
}
