import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { loadEnvironment } from '../config/environment.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly skipConnection: boolean;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const fallbackEnv = configService ? undefined : loadEnvironment();
    const logQueries = configService
      ? configService.get<boolean>('database.logQueries', false)
      : (fallbackEnv?.databaseLogQueries ?? false);

    super({
      log: logQueries ? [{ emit: 'stdout', level: 'query' }] : undefined,
    });

    this.skipConnection = configService
      ? configService.get<boolean>('database.skipConnection', false)
      : (fallbackEnv?.databaseSkipConnection ?? false);
  }

  async onModuleInit(): Promise<void> {
    if (this.skipConnection) {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.skipConnection) {
      return;
    }

    await this.$disconnect();
  }
}
