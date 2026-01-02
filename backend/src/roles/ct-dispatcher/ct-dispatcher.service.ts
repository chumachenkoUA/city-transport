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
import { VehicleGpsLogsService } from '../../modules/vehicle-gps-logs/vehicle-gps-logs.service';
import { VehiclesService } from '../../modules/vehicles/vehicles.service';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CreateDispatcherScheduleDto } from './dto/create-schedule.dto';
import { DetectDeviationDto } from './dto/deviation.dto';
import { UpdateDispatcherScheduleDto } from './dto/update-schedule.dto';

const AVERAGE_SPEED_KMH = 25;

@Injectable()
export class CtDispatcherService {
  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly routesService: RoutesService,
    private readonly vehiclesService: VehiclesService,
    private readonly routeStopsService: RouteStopsService,
    private readonly routePointsService: RoutePointsService,
    private readonly driverVehicleAssignmentsService: DriverVehicleAssignmentsService,
    private readonly vehicleGpsLogsService: VehicleGpsLogsService,
    private readonly driversService: DriversService,
  ) {}

  async createSchedule(payload: CreateDispatcherScheduleDto) {
    const routeId = await this.resolveRouteId(payload);

    if (payload.fleetNumber) {
      const vehicle = await this.vehiclesService.findByFleetNumber(
        payload.fleetNumber,
      );

      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${payload.fleetNumber} not found`);
      }

      if (vehicle.routeId !== routeId) {
        throw new BadRequestException(
          `Vehicle ${payload.fleetNumber} is not assigned to route ${routeId}`,
        );
      }
    }

    return this.schedulesService.create({
      routeId,
      workStartTime: payload.workStartTime,
      workEndTime: payload.workEndTime,
      intervalMin: payload.intervalMin,
    });
  }

  async updateSchedule(id: number, payload: UpdateDispatcherScheduleDto) {
    const updates: {
      routeId?: number;
      workStartTime?: string;
      workEndTime?: string;
      intervalMin?: number;
    } = {};

    if (payload.routeId !== undefined) {
      updates.routeId = payload.routeId;
    } else if (payload.routeNumber || payload.transportTypeId) {
      updates.routeId = await this.resolveRouteId(payload);
    }

    if (payload.workStartTime !== undefined) {
      updates.workStartTime = payload.workStartTime;
    }
    if (payload.workEndTime !== undefined) {
      updates.workEndTime = payload.workEndTime;
    }
    if (payload.intervalMin !== undefined) {
      updates.intervalMin = payload.intervalMin;
    }

    return this.schedulesService.update(id, updates);
  }

  async getScheduleDetails(id: number) {
    const schedule = await this.schedulesService.findOne(id);
    const route = await this.routesService.findOne(schedule.routeId);
    const vehicles = await this.vehiclesService.findByRouteId(route.id);
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
      id: schedule.id,
      route: {
        id: route.id,
        number: route.number,
        transportTypeId: route.transportTypeId,
        direction: route.direction,
      },
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        fleetNumber: vehicle.fleetNumber,
      })),
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      intervalMin: schedule.intervalMin,
      stops: stopsWithIntervals,
    };
  }

  async assignDriver(payload: AssignDriverDto) {
    await this.driversService.findOne(payload.driverId);
    const vehicle = await this.resolveVehicle(payload);

    if (payload.routeNumber || payload.transportTypeId) {
      const routeId = await this.resolveRouteId(payload);
      if (vehicle.routeId !== routeId) {
        throw new BadRequestException(
          `Vehicle ${vehicle.fleetNumber} is not assigned to route ${routeId}`,
        );
      }
    }

    return this.driverVehicleAssignmentsService.create({
      driverId: payload.driverId,
      vehicleId: vehicle.id,
      assignedAt: payload.assignedAt,
    });
  }

  async monitorVehicle(fleetNumber: string) {
    const vehicle = await this.vehiclesService.findByFleetNumber(fleetNumber);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${fleetNumber} not found`);
    }

    const route = await this.routesService.findOne(vehicle.routeId);
    const routePoints = await this.routePointsService.findByRouteId(route.id);
    const currentPosition =
      await this.vehicleGpsLogsService.findLatestByVehicleId(vehicle.id);

    return {
      vehicle: {
        id: vehicle.id,
        fleetNumber: vehicle.fleetNumber,
        routeId: vehicle.routeId,
      },
      route: {
        id: route.id,
        number: route.number,
        transportTypeId: route.transportTypeId,
        direction: route.direction,
      },
      routePoints: routePoints.map((point) => ({
        id: point.id,
        lon: point.lon,
        lat: point.lat,
      })),
      currentPosition: currentPosition
        ? {
            lon: currentPosition.lon,
            lat: currentPosition.lat,
            recordedAt: currentPosition.recordedAt,
          }
        : null,
    };
  }

  async detectDeviation(fleetNumber: string, payload: DetectDeviationDto) {
    const vehicle = await this.vehiclesService.findByFleetNumber(fleetNumber);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${fleetNumber} not found`);
    }

    const schedule = await this.schedulesService.findByRouteId(vehicle.routeId);
    if (!schedule) {
      throw new NotFoundException(
        `Schedule for route ${vehicle.routeId} not found`,
      );
    }

    const currentTime = payload.currentTime ?? this.currentTimeString();
    const currentMinutes = this.parseTimeToMinutes(currentTime);
    const startMinutes = this.parseTimeToMinutes(schedule.workStartTime);
    const endMinutes = this.parseTimeToMinutes(schedule.workEndTime);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return {
        status: 'out_of_schedule',
        vehicleId: vehicle.id,
        fleetNumber: vehicle.fleetNumber,
        routeId: vehicle.routeId,
        currentTime,
        workStartTime: schedule.workStartTime,
        workEndTime: schedule.workEndTime,
      };
    }

    const passed = currentMinutes - startMinutes;
    const bucket = Math.floor(passed / schedule.intervalMin);
    const plannedMinutes = startMinutes + bucket * schedule.intervalMin;
    const deviationMin = this.roundTo1(currentMinutes - plannedMinutes);

    return {
      status: 'ok',
      vehicleId: vehicle.id,
      fleetNumber: vehicle.fleetNumber,
      routeId: vehicle.routeId,
      currentTime,
      plannedTime: this.formatMinutes(plannedMinutes),
      deviationMin,
      intervalMin: schedule.intervalMin,
    };
  }

  private async resolveRouteId(payload: {
    routeId?: number;
    routeNumber?: string;
    transportTypeId?: number;
    direction?: 'forward' | 'reverse';
  }) {
    if (payload.routeId) {
      return payload.routeId;
    }

    if (!payload.routeNumber || !payload.transportTypeId) {
      throw new BadRequestException(
        'routeId or routeNumber + transportTypeId is required',
      );
    }

    const route = await this.routesService.findByNumberAndType(
      payload.routeNumber,
      payload.transportTypeId,
      payload.direction ?? 'forward',
    );

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

  private parseTimeToMinutes(value: string) {
    const parts = value.split(':').map((part) => Number(part));

    if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
      throw new BadRequestException(`Invalid time value: ${value}`);
    }

    const [hours, minutes, seconds = 0] = parts;

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      throw new BadRequestException(`Invalid time value: ${value}`);
    }

    return hours * 60 + minutes + seconds / 60;
  }

  private formatMinutes(totalMinutes: number) {
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${this.pad2(hours)}:${this.pad2(minutes)}:${this.pad2(seconds)}`;
  }

  private currentTimeString() {
    const now = new Date();
    return `${this.pad2(now.getHours())}:${this.pad2(now.getMinutes())}:${this.pad2(
      now.getSeconds(),
    )}`;
  }

  private pad2(value: number) {
    return value.toString().padStart(2, '0');
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }
}
