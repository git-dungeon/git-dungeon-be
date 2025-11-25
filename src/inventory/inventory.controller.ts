import { Controller, Req, Res, UseGuards } from '@nestjs/common';
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

    const inventory = await this.inventoryService.equipItem(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }

  @TypedRoute.Post<ApiSuccessResponse<InventoryResponse>>('inventory/unequip')
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

    const inventory = await this.inventoryService.unequipItem(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }

  @TypedRoute.Post<ApiSuccessResponse<InventoryResponse>>('inventory/discard')
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

    const inventory = await this.inventoryService.discardItem(
      session.view.session.userId,
      body,
    );

    return successResponseWithGeneratedAt(inventory, {
      requestId: request.id,
    });
  }
}
