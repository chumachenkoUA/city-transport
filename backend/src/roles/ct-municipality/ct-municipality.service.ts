import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStopDto } from '../../modules/stops/dto/create-stop.dto';
import { RoutePointsService } from '../../modules/route-points/route-points.service';
import { RouteStopsService } from '../../modules/route-stops/route-stops.service';
import { RoutesService } from '../../modules/routes/routes.service';
import { StopsService } from '../../modules/stops/stops.service';
import { TransportTypesService } from '../../modules/transport-types/transport-types.service';
import { TripsService } from '../../modules/trips/trips.service';
import { ComplaintsSuggestionsService } from '../../modules/complaints-suggestions/complaints-suggestions.service';
import { MunicipalityComplaintsQueryDto } from './dto/complaints-query.dto';
import {
  CreateMunicipalityRouteDto,
  RoutePointInputDto,
  RouteStopInputDto,
} from './dto/create-route.dto';
import { PassengerFlowQueryDto } from './dto/passenger-flow-query.dto';

@Injectable()
export class CtMunicipalityService {
  constructor(
    private readonly stopsService: StopsService,
    private readonly routesService: RoutesService,
    private readonly routeStopsService: RouteStopsService,
    private readonly routePointsService: RoutePointsService,
    private readonly transportTypesService: TransportTypesService,
    private readonly tripsService: TripsService,
    private readonly complaintsSuggestionsService: ComplaintsSuggestionsService,
  ) {}

  createStop(payload: CreateStopDto) {
    return this.stopsService.create(payload);
  }

  async createRoute(payload: CreateMunicipalityRouteDto) {
    await this.transportTypesService.findOne(payload.transportTypeId);

    const route = await this.routesService.create({
      transportTypeId: payload.transportTypeId,
      number: payload.number,
      direction: payload.direction,
      isActive: payload.isActive ?? true,
    });

    const routeStops = await this.createRouteStops(route.id, payload.stops);
    const routePoints = await this.createRoutePoints(route.id, payload.points);

    return {
      route,
      routeStops,
      routePoints,
    };
  }

  async getPassengerFlow(query: PassengerFlowQueryDto) {
    const { from, to } = this.parsePeriod(query);
    return this.tripsService.getPassengerFlow(
      from,
      to,
      query.routeNumber,
      query.transportTypeId,
    );
  }

  async getComplaints(query: MunicipalityComplaintsQueryDto) {
    const { from, to } = this.parsePeriod(query);
    return this.complaintsSuggestionsService.findByPeriod(
      from,
      to,
      query.routeNumber,
      query.transportTypeId,
      query.fleetNumber,
    );
  }

  private async createRouteStops(routeId: number, stops: RouteStopInputDto[]) {
    const createdStops = [] as Array<{
      id: number;
      stopId: number;
      prevRouteStopId: number | null;
      nextRouteStopId: number | null;
      distanceToNextKm: string | null;
    }>;

    let prevRouteStopId: number | null = null;

    for (const stopInput of stops) {
      const stopId = await this.resolveStopId(stopInput);

      const created = await this.routeStopsService.create({
        routeId,
        stopId,
        prevRouteStopId: prevRouteStopId ?? undefined,
        distanceToNextKm: stopInput.distanceToNextKm,
      });

      if (prevRouteStopId) {
        await this.routeStopsService.update(prevRouteStopId, {
          nextRouteStopId: created.id,
        });
      }

      createdStops.push(created);
      prevRouteStopId = created.id;
    }

    return createdStops;
  }

  private async createRoutePoints(
    routeId: number,
    points: RoutePointInputDto[],
  ) {
    const createdPoints = [] as Array<{
      id: number;
      lon: string;
      lat: string;
      prevRoutePointId: number | null;
      nextRoutePointId: number | null;
    }>;

    let prevRoutePointId: number | null = null;

    for (const point of points) {
      const created = await this.routePointsService.create({
        routeId,
        lon: point.lon,
        lat: point.lat,
        prevRoutePointId: prevRoutePointId ?? undefined,
      });

      if (prevRoutePointId) {
        await this.routePointsService.update(prevRoutePointId, {
          nextRoutePointId: created.id,
        });
      }

      createdPoints.push(created);
      prevRoutePointId = created.id;
    }

    return createdPoints;
  }

  private async resolveStopId(stopInput: RouteStopInputDto) {
    if (stopInput.stopId) {
      await this.stopsService.findOne(stopInput.stopId);
      return stopInput.stopId;
    }

    if (
      !stopInput.name ||
      stopInput.lon === undefined ||
      stopInput.lat === undefined
    ) {
      throw new BadRequestException(
        'stopId or stop details (name, lon, lat) are required',
      );
    }

    const stop = await this.stopsService.create({
      name: stopInput.name,
      lon: stopInput.lon,
      lat: stopInput.lat,
    });

    return stop.id;
  }

  private parsePeriod(query: { from: string; to: string }) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }

    if (from > to) {
      throw new BadRequestException('from must be before to');
    }

    return { from, to };
  }
}
