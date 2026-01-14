import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { transformToCamelCase } from '../../common/utils/transform-to-camel-case';
import { DbService } from '../../db/db.service';
import { IssueFineDto } from './dto/issue-fine.dto';

type CardDetailsRow = {
  id: number;
  cardNumber: string;
  balance: string;
  userFullName: string;
  lastUsageAt: string | null;
  lastRouteNumber: string | null;
  lastTransportType: string | null;
};

@Injectable()
export class CtControllerService {
  constructor(private readonly dbService: DbService) {}

  async checkCard(cardNumber: string) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        card_number,
        balance,
        user_full_name,
        last_usage_at,
        last_route_number,
        last_transport_type
      from controller_api.v_card_details
      where card_number = ${cardNumber}
      limit 1
    `)) as unknown as { rows: CardDetailsRow[] };

    const card = transformToCamelCase(result.rows)[0];
    if (!card) {
      throw new NotFoundException(`Card ${cardNumber} not found`);
    }

    return card;
  }

  async issueFine(payload: IssueFineDto) {
    const checkedAt = payload.checkedAt ?? new Date();
    const result = (await this.dbService.db.execute(sql`
      select controller_api.issue_fine(
        ${payload.cardNumber},
        ${payload.amount},
        ${payload.reason},
        ${payload.fleetNumber ?? null},
        ${checkedAt.toISOString()},
        ${payload.tripId ?? null}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    const fineId = result.rows[0]?.id;

    if (!fineId) {
      throw new NotFoundException('Failed to issue fine');
    }

    return { fineId };
  }

  async getActiveTrips(fleetNumber: string, checkedAt?: string) {
    const checkedAtValue = checkedAt ? new Date(checkedAt) : null;
    if (checkedAt && Number.isNaN(checkedAtValue?.getTime() ?? NaN)) {
      throw new BadRequestException('Invalid checkedAt');
    }

    const result = checkedAtValue
      ? await this.dbService.db.execute(sql`
          select
            trip_id,
            planned_starts_at,
            actual_starts_at,
            route_number,
            transport_type,
            driver_name,
            status
          from controller_api.get_active_trips(
            ${fleetNumber},
            ${checkedAtValue.toISOString()}
          )
        `)
      : await this.dbService.db.execute(sql`
          select
            trip_id,
            planned_starts_at,
            actual_starts_at,
            route_number,
            transport_type,
            driver_name,
            status
          from controller_api.get_active_trips(${fleetNumber})
        `);

    const rows = (
      result as unknown as {
        rows: Array<{
          tripId: number;
          plannedStartsAt: Date;
          actualStartsAt: Date | null;
          routeNumber: string;
          transportType: string;
          driverName: string;
          status: string;
        }>;
      }
    ).rows;

    return transformToCamelCase(rows) as Array<{
      tripId: number;
      plannedStartsAt: Date;
      actualStartsAt: Date | null;
      routeNumber: string;
      transportType: string;
      driverName: string;
      status: string;
    }>;
  }

  async getRoutes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        transport_type
      from controller_api.v_routes
    `)) as unknown as {
      rows: Array<{ id: number; number: string; transportType: string }>;
    };

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      number: string;
      transportType: string;
    }>;
  }

  async getVehicles(routeId?: number) {
    const query = routeId
      ? sql`
          select
            id,
            fleet_number,
            route_id,
            route_number,
            transport_type,
            model_name
          from controller_api.v_vehicles
          where route_id = ${routeId}
        `
      : sql`
          select
            id,
            fleet_number,
            route_id,
            route_number,
            transport_type,
            model_name
          from controller_api.v_vehicles
        `;

    const result = (await this.dbService.db.execute(query)) as unknown as {
      rows: Array<{
        id: number;
        fleetNumber: string;
        routeId: number;
        routeNumber: string;
        transportType: string;
        modelName: string;
      }>;
    };

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      fleetNumber: string;
      routeId: number;
      routeNumber: string;
      transportType: string;
      modelName: string;
    }>;
  }
}
