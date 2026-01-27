import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DropService } from '../dungeon/drops/drop.service';
import { DropInventoryService } from '../dungeon/drops/drop-inventory.service';

@Module({
  imports: [PrismaModule],
  providers: [DropService, DropInventoryService],
  exports: [DropService, DropInventoryService],
})
export class SharedModule {}
