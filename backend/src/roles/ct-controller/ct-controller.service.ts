import { Injectable, NotFoundException } from '@nestjs/common';
import { FinesService } from '../../modules/fines/fines.service';
import { TicketsService } from '../../modules/tickets/tickets.service';
import { TransportCardsService } from '../../modules/transport-cards/transport-cards.service';
import { IssueFineDto } from './dto/issue-fine.dto';

@Injectable()
export class CtControllerService {
  constructor(
    private readonly transportCardsService: TransportCardsService,
    private readonly ticketsService: TicketsService,
    private readonly finesService: FinesService,
  ) {}

  async getLastTripByCardNumber(cardNumber: string) {
    const card = await this.transportCardsService.findByCardNumber(cardNumber);

    if (!card) {
      throw new NotFoundException(`Card ${cardNumber} not found`);
    }

    const lastTrip = await this.ticketsService.findLastTripByCardId(card.id);

    if (!lastTrip) {
      throw new NotFoundException(`No trips found for card ${cardNumber}`);
    }

    return lastTrip;
  }

  async issueFine(payload: IssueFineDto) {
    const card = await this.transportCardsService.findByCardNumber(
      payload.cardNumber,
    );

    if (!card) {
      throw new NotFoundException(`Card ${payload.cardNumber} not found`);
    }

    return this.finesService.create({
      userId: card.userId,
      status: payload.status,
      amount: payload.amount,
      reason: payload.reason,
      tripId: payload.tripId,
      issuedAt: payload.issuedAt,
    });
  }
}
