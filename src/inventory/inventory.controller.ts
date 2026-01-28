import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { TypedBody, TypedRoute } from '@nestia/core';
import type { Request, Response } from 'express';
import {
  successResponseWithGeneratedAt,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import {
  appendCookies,
  applyNoCacheHeaders,
} from '../common/http/response-helpers';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import type { InventoryResponse } from './dto/inventory.response';
import { InventoryService } from './inventory.service';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import type { InventoryItemMutationRequest } from './dto/inventory.request';

@Controller('api')
export class InventoryController {
  private static readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(private readonly inventoryService: InventoryService) {}

  @TypedRoute.Get<ApiSuccessResponse<InventoryResponse>>('inventory')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async getInventory(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<InventoryResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const inventory = await this.inventoryService.getInventory(
      session.view.session.userId,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }

  @TypedRoute.Post<ApiSuccessResponse<InventoryResponse>>('inventory/equip')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async equipInventoryItem(
    @CurrentAuthSession() session: ActiveSessionResult,
    @TypedBody() body: InventoryItemMutationRequest,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<InventoryResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);
    this.assertInventoryMutationRequest(body);

    const inventory = await this.inventoryService.equipItem(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }

  @TypedRoute.Post<ApiSuccessResponse<InventoryResponse>>('inventory/unequip')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async unequipInventoryItem(
    @CurrentAuthSession() session: ActiveSessionResult,
    @TypedBody() body: InventoryItemMutationRequest,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<InventoryResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);
    this.assertInventoryMutationRequest(body);

    const inventory = await this.inventoryService.unequipItem(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }

  @TypedRoute.Post<ApiSuccessResponse<InventoryResponse>>('inventory/discard')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async discardInventoryItem(
    @CurrentAuthSession() session: ActiveSessionResult,
    @TypedBody() body: InventoryItemMutationRequest,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<InventoryResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);
    this.assertInventoryMutationRequest(body);

    const inventory = await this.inventoryService.discardItem(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }

  @TypedRoute.Post<ApiSuccessResponse<InventoryResponse>>('inventory/dismantle')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async dismantleInventoryItem(
    @CurrentAuthSession() session: ActiveSessionResult,
    @TypedBody() body: InventoryItemMutationRequest,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<InventoryResponse>> {
    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);
    this.assertInventoryMutationRequest(body);

    const inventory = await this.inventoryService.dismantleItem(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }

  private assertInventoryMutationRequest(
    body: InventoryItemMutationRequest,
  ): void {
    if (!InventoryController.UUID_PATTERN.test(body.itemId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'itemId 형식이 잘못되었습니다.',
        details: {
          field: 'itemId',
        },
      });
    }

    if (!this.isNonNegativeInteger(body.expectedVersion)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'expectedVersion 형식이 잘못되었습니다.',
        details: {
          field: 'expectedVersion',
        },
      });
    }

    if (!this.isNonNegativeInteger(body.inventoryVersion)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'inventoryVersion 형식이 잘못되었습니다.',
        details: {
          field: 'inventoryVersion',
        },
      });
    }
  }

  private isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
}
