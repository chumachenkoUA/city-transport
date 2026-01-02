import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComplaintsSuggestionsService } from '../../modules/complaints-suggestions/complaints-suggestions.service';
import { RoutePointsService } from '../../modules/route-points/route-points.service';
import { RouteStopsService } from '../../modules/route-stops/route-stops.service';
import { RoutesService } from '../../modules/routes/routes.service';
import { SchedulesService } from '../../modules/schedules/schedules.service';
import { StopsService } from '../../modules/stops/stops.service';
import { CreateGuestComplaintDto } from './dto/create-complaint.dto';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { RoutesBetweenDto } from './dto/routes-between.dto';
import { StopsNearDto } from './dto/stops-near.dto';

const AVERAGE_SPEED_KMH = 25;

@Injectable()
export class CtGuestService {
  constructor(
    private readonly stopsService: StopsService,
    private readonly routeStopsService: RouteStopsService,
    private readonly routePointsService: RoutePointsService,
    private readonly routesService: RoutesService,
    private readonly schedulesService: SchedulesService,
    private readonly complaintsSuggestionsService: ComplaintsSuggestionsService,
  ) {}

  getStopsNear(query: StopsNearDto) {
    return this.stopsService.findNearby(
      query.lon,
      query.lat,
      query.radius ?? 500,
      query.limit ?? 10,
    );
  }

  async getRoutesByStop(stopId: number) {
    const routes = await this.routeStopsService.findRoutesByStopId(stopId);

    if (routes.length === 0) {
      throw new NotFoundException(`No routes found for stop ${stopId}`);
    }

    const scheduleByRoute = new Map<number, number | null>();
    await Promise.all(
      routes.map(async (route) => {
        const schedule = await this.schedulesService.findByRouteId(
          route.routeId,
        );
        scheduleByRoute.set(route.routeId, schedule?.intervalMin ?? null);
      }),
    );

    return routes.map((route) => ({
      routeId: route.routeId,
      routeNumber: route.routeNumber,
      transportTypeId: route.transportTypeId,
      transportType: route.transportTypeName,
      direction: route.direction,
      approxArrivalMin: scheduleByRoute.get(route.routeId) ?? null,
    }));
  }

  async getRouteStops(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    return this.routeStopsService.findStopsByRouteId(routeId);
  }

  async getRoutePoints(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    return this.routePointsService.findByRouteId(routeId);
  }

  async getRoutesBetween(payload: RoutesBetweenDto) {
    const stopA = await this.stopsService.findNearest(
      payload.lonA,
      payload.latA,
      payload.radius ?? 500,
    );
    const stopB = await this.stopsService.findNearest(
      payload.lonB,
      payload.latB,
      payload.radius ?? 500,
    );

    if (!stopA || !stopB) {
      throw new NotFoundException('Nearest stops not found for given points');
    }

    const routesA = await this.routeStopsService.findRoutesByStopId(stopA.id);
    const routesB = await this.routeStopsService.findRoutesByStopId(stopB.id);

    const routesMap = new Map(routesA.map((route) => [route.routeId, route]));

    const candidates = routesB
      .map((route) => routesMap.get(route.routeId))
      .filter((route): route is NonNullable<typeof route> => Boolean(route));

    const results = [] as Array<{
      routeId: number;
      routeNumber: string;
      transportTypeId: number;
      transportType: string;
      direction: string;
      fromStopId: number;
      toStopId: number;
      distanceKm: number | null;
      travelMinutes: number | null;
    }>;

    for (const route of candidates) {
      const orderedStops = await this.routeStopsService.findStopsByRouteId(
        route.routeId,
      );
      const indexA = orderedStops.findIndex((stop) => stop.stopId === stopA.id);
      const indexB = orderedStops.findIndex((stop) => stop.stopId === stopB.id);

      if (indexA === -1 || indexB === -1 || indexA >= indexB) {
        continue;
      }

      const segment = orderedStops.slice(indexA, indexB);
      const hasMissingDistance = segment.some(
        (stop) => stop.distanceToNextKm === null,
      );

      let distanceKm: number | null = null;
      let travelMinutes: number | null = null;

      if (!hasMissingDistance) {
        distanceKm = segment.reduce(
          (sum, stop) => sum + Number(stop.distanceToNextKm),
          0,
        );
        travelMinutes = this.roundTo1((distanceKm / AVERAGE_SPEED_KMH) * 60);
      }

      results.push({
        routeId: route.routeId,
        routeNumber: route.routeNumber,
        transportTypeId: route.transportTypeId,
        transportType: route.transportTypeName,
        direction: route.direction,
        fromStopId: stopA.id,
        toStopId: stopB.id,
        distanceKm,
        travelMinutes,
      });
    }

    if (results.length === 0) {
      throw new NotFoundException('No routes found between these stops');
    }

    return {
      fromStop: stopA,
      toStop: stopB,
      routes: results,
    };
  }

  async getSchedule(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    const schedule = await this.schedulesService.findByRouteId(routeId);

    if (!schedule) {
      throw new NotFoundException(`Schedule for route ${routeId} not found`);
    }

    return schedule;
  }

  createComplaint(payload: CreateGuestComplaintDto) {
    return this.complaintsSuggestionsService.create({
      userId: payload.userId,
      type: payload.type,
      message: payload.message,
      tripId: payload.tripId,
      status: 'Подано',
    });
  }

  private async resolveRouteId(payload: RouteLookupDto) {
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

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }
}
