import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { CtGuestService } from '../ct-guest/ct-guest.service';
import { RouteLookupDto } from '../ct-guest/dto/route-lookup.dto';
import { RoutesBetweenDto } from '../ct-guest/dto/routes-between.dto';
import { StopsNearDto } from '../ct-guest/dto/stops-near.dto';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { CreatePassengerComplaintDto } from './dto/create-complaint.dto';
import { TopUpDto } from './dto/top-up.dto';
import { BuyTicketDto } from './dto/buy-ticket.dto';

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

type TransportAtStopRow = {
  stop_id: number;
  route_id: number;
  route_number: string;
  transport_type: string;
  approximate_interval: number | null;
};

@Injectable()
export class CtPassengerService {
  constructor(
    private readonly dbService: DbService,
    private readonly guestService: CtGuestService,
  ) {}

  async getStopsNear(payload: StopsNearDto) {
    const result = (await this.dbService.db.execute(sql`
      select id, name, lon, lat, distance_m
      from passenger_api.find_stops_nearby(${payload.lon}, ${payload.lat}, ${payload.radius ?? 1000})
      limit ${payload.limit ?? 10}
    `)) as unknown as { rows: StopNearRow[] };

    return result.rows;
  }

  async getRoutesByStop(stopId: number) {
    const result = (await this.dbService.db.execute(sql`
      select stop_id, route_id, route_number, transport_type, approximate_interval
      from passenger_api.v_transport_at_stops
      where stop_id = ${stopId}
    `)) as unknown as { rows: TransportAtStopRow[] };

    return result.rows;
  }

  getRouteStops(query: RouteLookupDto) {
    return this.guestService.getRouteStops(query);
  }

  getRoutePoints(query: RouteLookupDto) {
    return this.guestService.getRoutePoints(query);
  }

  async getRoutesBetween(payload: RoutesBetweenDto) {
    const result = (await this.dbService.db.execute(sql`
      select route_id, route_number, transport_type, start_stop_name, end_stop_name
      from passenger_api.find_routes_between(
        ${payload.lonA}, ${payload.latA},
        ${payload.lonB}, ${payload.latB},
        ${payload.radius ?? 800}
      )
    `)) as unknown as { rows: RouteBetweenRow[] };

    return result.rows;
  }

  getSchedule(query: RouteLookupDto) {
    return this.guestService.getSchedule(query);
  }

  async createComplaint(payload: CreatePassengerComplaintDto) {
    await this.dbService.db.execute(sql`
      select passenger_api.submit_complaint(
        ${payload.type},
        ${payload.message},
        null,
        ${payload.routeNumber ?? null},
        ${payload.transportType ?? null},
        ${payload.vehicleNumber ?? null}
      )
    `);
  }

  async getMyCards() {
    const result = (await this.dbService.db.execute(sql`
      select id, card_number, balance, last_top_up from passenger_api.v_my_cards
    `)) as unknown as { rows: MyCardRow[] };

    return result.rows;
  }

  async topUpCard(cardNumber: string, payload: TopUpDto) {
    await this.dbService.db.execute(sql`
      select passenger_api.top_up_card(${cardNumber}, ${payload.amount})
    `);
  }

  async buyTicket(payload: BuyTicketDto) {
    const result = (await this.dbService.db.execute(sql`
      select passenger_api.buy_ticket(${payload.cardId}, ${payload.tripId}, ${payload.price})
    `)) as unknown as { rows: { buy_ticket: number }[] };

    return { ticketId: result.rows[0].buy_ticket };
  }

  async getMyTrips() {
    const result = (await this.dbService.db.execute(sql`
      select ticket_id, purchased_at, price, route_number, transport_type, starts_at 
      from passenger_api.v_my_trips
    `)) as unknown as { rows: MyTripRow[] };

    return {
      total: result.rows.length,
      trips: result.rows,
    };
  }

  async getMyFines() {
    const result = (await this.dbService.db.execute(sql`
      select id, amount, reason, status, issued_at from passenger_api.v_my_fines
    `)) as unknown as { rows: MyFineRow[] };

    return {
      total: result.rows.length,
      fines: result.rows,
    };
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

    return fine;
  }

  async createAppeal(fineId: number, payload: CreateAppealDto) {
    const result = (await this.dbService.db.execute(sql`
      select passenger_api.submit_fine_appeal(${fineId}, ${payload.message})
    `)) as unknown as { rows: { submit_fine_appeal: number }[] };

    return { appealId: result.rows[0].submit_fine_appeal };
  }
}
