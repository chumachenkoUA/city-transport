import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { IssueFineDto } from './dto/issue-fine.dto';

type ControllerLastTrip = {
  cardId: number;
  cardNumber: string;
  tripId: number;
  purchasedAt: Date;
  routeId: number;
  routeNumber: string;
  transportType: string;
  fleetNumber: string;
  vehicleId: number;
  driverId: number;
};

type IssuedFine = {
  id: number;
  user_id: number;
  status: string;
  amount: string;
  reason: string;
  issued_by: string;
  trip_id: number;
  issued_at: Date;
};

@Injectable()
export class CtControllerService {
  constructor(private readonly dbService: DbService) {}

  async getLastTripByCardNumber(cardNumber: string) {
    const result = (await this.dbService.db.execute(sql`
      select
        card_id as "cardId",
        card_number as "cardNumber",
        trip_id as "tripId",
        purchased_at as "purchasedAt",
        route_id as "routeId",
        route_number as "routeNumber",
        transport_type as "transportType",
        fleet_number as "fleetNumber",
        vehicle_id as "vehicleId",
        driver_id as "driverId"
      from controller_api.v_card_last_trip
      where card_number = ${cardNumber}
      limit 1
    `)) as unknown as { rows: ControllerLastTrip[] };

    const lastTrip = result.rows[0];
    if (!lastTrip) {
      throw new NotFoundException(`No trips found for card ${cardNumber}`);
    }

    return lastTrip;
  }

  async issueFine(payload: IssueFineDto) {
    const checkedAt = payload.checkedAt ?? payload.issuedAt ?? null;
    const issuedAt = payload.issuedAt ?? payload.checkedAt ?? null;
    const status = payload.status ?? 'Очікує сплати';

    const result = (await this.dbService.db.execute(sql`
      select *
      from controller_api.issue_fine(
        ${payload.cardNumber},
        ${payload.amount},
        ${payload.reason},
        ${status},
        ${payload.tripId ?? null},
        ${payload.fleetNumber ?? null},
        ${payload.routeNumber ?? null},
        ${checkedAt},
        ${issuedAt}
      )
    `)) as unknown as { rows: IssuedFine[] };

    const fine = result.rows[0];
    if (!fine) {
      throw new NotFoundException('Fine creation failed');
    }

    return {
      id: fine.id,
      status: fine.status,
      amount: fine.amount,
      reason: fine.reason,
      tripId: fine.trip_id,
      issuedAt: fine.issued_at,
    };
  }
}
