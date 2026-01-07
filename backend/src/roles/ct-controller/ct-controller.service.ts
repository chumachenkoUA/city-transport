import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { IssueFineDto } from './dto/issue-fine.dto';

type CardDetailsRow = {
  id: number;
  cardNumber: string;
  balance: string;
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
        id as "id",
        card_number as "cardNumber",
        balance as "balance",
        last_usage_at as "lastUsageAt",
        last_route_number as "lastRouteNumber",
        last_transport_type as "lastTransportType"
      from controller_api.v_card_details
      where card_number = ${cardNumber}
      limit 1
    `)) as unknown as { rows: CardDetailsRow[] };

    const card = result.rows[0];
    if (!card) {
      throw new NotFoundException(`Card ${cardNumber} not found`);
    }

    return card;
  }

  async issueFine(payload: IssueFineDto) {
    const result = (await this.dbService.db.execute(sql`
      select controller_api.issue_fine(
        ${payload.cardNumber},
        ${payload.amount},
        ${payload.reason},
        ${payload.fleetNumber ?? null}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    const fineId = result.rows[0]?.id;

    if (!fineId) {
      throw new NotFoundException('Failed to issue fine');
    }

    return { fineId };
  }
}
