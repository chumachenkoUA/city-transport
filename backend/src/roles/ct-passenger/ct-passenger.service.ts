import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { CtGuestService } from '../ct-guest/ct-guest.service';
import { RouteLookupDto } from '../ct-guest/dto/route-lookup.dto';
import { RouteScheduleDto } from '../ct-guest/dto/route-schedule.dto';
import { RoutesBetweenDto } from '../ct-guest/dto/routes-between.dto';
import { StopsNearDto } from '../ct-guest/dto/stops-near.dto';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { CreatePassengerComplaintDto } from './dto/create-complaint.dto';
import { TopUpDto } from './dto/top-up.dto';
import { BuyTicketDto } from './dto/buy-ticket.dto';

import { PayFineDto } from './dto/pay-fine.dto';

type MyCardRow = {
  id: number;
  card_number: string;
  balance: string;
  last_top_up: string | null;
};

type MyTripRow = {
  ticket_id: number;
  purchased_at: string;
  price: string;
  route_number: string;
  transport_type: string;
  starts_at: string;
};

type MyFineRow = {
  id: number;
  amount: string;
  reason: string;
  status: string;
  issued_at: string;
};

type MyTopUpRow = {
  id: number;
  amount: string;
  topped_up_at: string;
};

type StopNearRow = {
  id: number;
  name: string;
  lon: string;
  lat: string;
  distance_m: number;
};

type RouteBetweenRow = {
  route_id: number;
  route_number: string;
  transport_type: string;
  start_stop_name: string;
  end_stop_name: string;
};

// TransportAtStopRow removed - using guest service instead

@Injectable()
export class CtPassengerService {
  constructor(
    private readonly dbService: DbService,
    private readonly guestService: CtGuestService,
  ) {}

  async payFine(fineId: number, payload: PayFineDto) {
    await this.dbService.db.execute(sql`
      select passenger_api.pay_fine(${fineId}::bigint, ${payload.cardId}::bigint)
    `);
  }

  async getStopsNear(payload: StopsNearDto) {
    // Use guest_api function (available to all roles including passenger)
    const result = (await this.dbService.db.execute(sql`
      select id, name, lon, lat, distance_m
      from guest_api.find_nearby_stops(
        ${payload.lon},
        ${payload.lat},
        ${payload.radius ?? 1000},
        ${payload.limit ?? 10}
      )
    `)) as unknown as { rows: StopNearRow[] };

    return result.rows;
  }

  getRoutesByStop(stopId: number) {
    // Use guest service (provides better implementation with nextArrivalMin)
    return this.guestService.getRoutesByStop(stopId);
  }

  getRouteStops(query: RouteLookupDto) {
    return this.guestService.getRouteStops(query);
  }

  getRoutePoints(query: RouteLookupDto) {
    return this.guestService.getRoutePoints(query);
  }

  async planRoute(payload: {
    lonA: number;
    latA: number;
    lonB: number;
    latB: number;
    radius?: number;
    maxWaitMin?: number;
    maxResults?: number;
  }) {
    return this.guestService.planRoute(payload);
  }

  getSchedule(query: RouteScheduleDto) {
    return this.guestService.getSchedule(query);
  }

  async createComplaint(payload: CreatePassengerComplaintDto) {
    await this.dbService.db.execute(sql`
      select passenger_api.submit_complaint(
        ${payload.type}::text,
        ${payload.message}::text,
        ${payload.routeNumber ?? null}::text,
        ${payload.transportType ?? null}::text,
        ${payload.vehicleNumber ?? null}::text
      )
    `);
  }

  async getMyProfile() {
    const result = (await this.dbService.db.execute(sql`
      SELECT id, login, full_name, email, phone, registered_at
      FROM passenger_api.v_my_profile
    `)) as unknown as {
      rows: Array<{
        id: number;
        login: string;
        full_name: string;
        email: string;
        phone: string;
        registered_at: string;
      }>;
    };

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      login: row.login,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      registeredAt: row.registered_at,
    };
  }

  async getMyCard() {
    const result = (await this.dbService.db.execute(sql`
      select id, card_number, balance, last_top_up from passenger_api.v_my_cards
    `)) as unknown as { rows: MyCardRow[] };

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      cardNumber: row.card_number,
      balance: row.balance,
      lastUsedAt: row.last_top_up,
      issuedAt: new Date().toISOString(), // Placeholder
    };
  }

  async topUpCard(cardNumber: string, payload: TopUpDto) {
    await this.dbService.db.execute(sql`
      select passenger_api.top_up_card(${cardNumber}::text, ${payload.amount}::numeric)
    `);
  }

  async getMyTopUps(limit: number = 3) {
    const result = (await this.dbService.db.execute(sql`
      select id, amount, topped_up_at
      from passenger_api.v_my_top_ups
      limit ${limit}
    `)) as unknown as { rows: MyTopUpRow[] };

    return result.rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      toppedUpAt: row.topped_up_at,
    }));
  }

  async buyTicket(payload: BuyTicketDto) {
    const result = (await this.dbService.db.execute(sql`
      select passenger_api.buy_ticket(${payload.cardId}::bigint, ${payload.tripId}::bigint, ${payload.price}::numeric)
    `)) as unknown as { rows: { buy_ticket: number }[] };

    return { ticketId: result.rows[0].buy_ticket };
  }

  async getMyTrips() {
    const result = (await this.dbService.db.execute(sql`
      select ticket_id, purchased_at, price, route_number, transport_type, starts_at 
      from passenger_api.v_my_trips
    `)) as unknown as { rows: MyTripRow[] };

    return result.rows.map((row) => ({
      id: row.ticket_id,
      routeNumber: row.route_number,
      transportType: row.transport_type,
      cost: row.price,
      startedAt: row.starts_at,
      endedAt: null,
    }));
  }

  async getMyFines() {
    const result = (await this.dbService.db.execute(sql`
      select id, amount, reason, status, issued_at from passenger_api.v_my_fines
    `)) as unknown as { rows: MyFineRow[] };

    return result.rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      reason: row.reason,
      status: row.status,
      issuedAt: row.issued_at,
    }));
  }

  async getFineDetails(fineId: number) {
    const result = (await this.dbService.db.execute(sql`
      select id, amount, reason, status, issued_at 
      from passenger_api.v_my_fines 
      where id = ${fineId}
    `)) as unknown as { rows: MyFineRow[] };

    const fine = result.rows[0];
    if (!fine) {
      throw new NotFoundException(`Fine ${fineId} not found`);
    }

    return {
      id: fine.id,
      amount: fine.amount,
      reason: fine.reason,
      status: fine.status,
      issuedAt: fine.issued_at,
    };
  }

  async createAppeal(fineId: number, payload: CreateAppealDto) {
    const result = (await this.dbService.db.execute(sql`
      select passenger_api.submit_fine_appeal(${fineId}::bigint, ${payload.message}::text)
    `)) as unknown as { rows: { submit_fine_appeal: number }[] };

    return { appealId: result.rows[0].submit_fine_appeal };
  }
}
