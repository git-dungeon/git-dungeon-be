import { Injectable } from '@nestjs/common';
import type { InventoryDelta } from '../../common/logs/dungeon-log-delta';
import type { DropResult } from './drop-table';
import { getCatalogItemMeta } from './drop.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import type { InventoryRarity, InventorySlot, Prisma } from '@prisma/client';

type ApplyDropsInput = {
  userId: string;
  drops: DropResult[];
};

@Injectable()
export class DropInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async applyDrops(
    input: ApplyDropsInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryDelta['added']> {
    const added: InventoryDelta['added'] = [];

    const applyWithClient = async (client: Prisma.TransactionClient) => {
      const result = await client.inventoryItem.aggregate({
        where: { userId: input.userId },
        _max: { version: true },
      });
      let versionCounter = result._max.version ?? 0;

      for (const drop of input.drops) {
        const meta = getCatalogItemMeta(drop.code);
        const slot = meta?.slot
          ? (meta.slot.toUpperCase() as InventorySlot)
          : ('CONSUMABLE' as InventorySlot);
        const rarity = meta?.rarity
          ? (meta.rarity.toUpperCase() as InventoryRarity)
          : ('COMMON' as InventoryRarity);
        const modifiers: Prisma.JsonValue = meta?.modifiers ?? [];
        const quantity = Math.max(1, drop.quantity ?? 1);

        for (let i = 0; i < quantity; i += 1) {
          const id = randomUUID();
          versionCounter += 1;
          await client.inventoryItem.create({
            data: {
              id,
              userId: input.userId,
              code: drop.code,
              slot,
              rarity,
              modifiers,
              isEquipped: false,
              version: versionCounter,
            },
          });

          added.push({
            itemId: id,
            code: drop.code,
            slot: slot.toLowerCase(),
            rarity: rarity.toLowerCase(),
            quantity: 1,
          });
        }
      }
    };

    if (tx) {
      await applyWithClient(tx);
    } else {
      await this.prisma.$transaction(async (transaction) => {
        await applyWithClient(transaction);
      });
    }

    return added;
  }
}
