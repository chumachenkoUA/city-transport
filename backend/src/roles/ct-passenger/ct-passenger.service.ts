import { Injectable, NotFoundException } from '@nestjs/common';
import { CardTopUpsService } from '../../modules/card-top-ups/card-top-ups.service';
import { ComplaintsSuggestionsService } from '../../modules/complaints-suggestions/complaints-suggestions.service';
import { FineAppealsService } from '../../modules/fine-appeals/fine-appeals.service';
import { FinesService } from '../../modules/fines/fines.service';
import { TicketsService } from '../../modules/tickets/tickets.service';
import { TransportCardsService } from '../../modules/transport-cards/transport-cards.service';
import { CtGuestService } from '../ct-guest/ct-guest.service';
import { RouteLookupDto } from '../ct-guest/dto/route-lookup.dto';
import { RoutesBetweenDto } from '../ct-guest/dto/routes-between.dto';
import { StopsNearDto } from '../ct-guest/dto/stops-near.dto';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { CreatePassengerComplaintDto } from './dto/create-complaint.dto';
import { TopUpDto } from './dto/top-up.dto';

@Injectable()
export class CtPassengerService {
  constructor(
    private readonly guestService: CtGuestService,
    private readonly transportCardsService: TransportCardsService,
    private readonly cardTopUpsService: CardTopUpsService,
    private readonly ticketsService: TicketsService,
    private readonly finesService: FinesService,
    private readonly fineAppealsService: FineAppealsService,
    private readonly complaintsSuggestionsService: ComplaintsSuggestionsService,
  ) {}

  getStopsNear(query: StopsNearDto) {
    return this.guestService.getStopsNear(query);
  }

  getRoutesByStop(stopId: number) {
    return this.guestService.getRoutesByStop(stopId);
  }

  getRouteStops(query: RouteLookupDto) {
    return this.guestService.getRouteStops(query);
  }

  getRoutePoints(query: RouteLookupDto) {
    return this.guestService.getRoutePoints(query);
  }

  getRoutesBetween(query: RoutesBetweenDto) {
    return this.guestService.getRoutesBetween(query);
  }

  getSchedule(query: RouteLookupDto) {
    return this.guestService.getSchedule(query);
  }

  createComplaint(payload: CreatePassengerComplaintDto) {
    return this.complaintsSuggestionsService.create({
      userId: payload.userId,
      type: payload.type,
      message: payload.message,
      tripId: payload.tripId,
      status: 'Подано',
    });
  }

  async getCard(userId: number) {
    const card = await this.transportCardsService.findByUserId(userId);

    if (!card) {
      throw new NotFoundException(
        `Transport card for user ${userId} not found`,
      );
    }

    const lastTopUp = await this.cardTopUpsService.findLatestByCardId(card.id);

    return {
      card,
      lastTopUpAt: lastTopUp?.toppedUpAt ?? null,
    };
  }

  async topUpCard(cardNumber: string, payload: TopUpDto) {
    return this.transportCardsService.topUpByCardNumber(
      cardNumber,
      payload.amount,
      payload.toppedUpAt,
    );
  }

  async getTrips(userId: number) {
    const trips = await this.ticketsService.findTripsByUserId(userId);
    return {
      total: trips.length,
      trips,
    };
  }

  async getFines(userId: number) {
    const fines = await this.finesService.findByUserId(userId);
    return {
      total: fines.length,
      fines,
    };
  }

  async getFine(userId: number, fineId: number) {
    const fine = await this.finesService.findOneByUserId(userId, fineId);

    if (!fine) {
      throw new NotFoundException(
        `Fine ${fineId} not found for user ${userId}`,
      );
    }

    return fine;
  }

  async createAppeal(userId: number, fineId: number, payload: CreateAppealDto) {
    const fine = await this.finesService.findOneByUserId(userId, fineId);

    if (!fine) {
      throw new NotFoundException(
        `Fine ${fineId} not found for user ${userId}`,
      );
    }

    return this.fineAppealsService.create({
      fineId: fine.id,
      message: payload.message,
      status: 'Подано',
    });
  }
}
