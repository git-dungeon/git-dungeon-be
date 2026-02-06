import {
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiSuccessResponse } from '../common/http/api-response';
import { successResponseWithGeneratedAt } from '../common/http/api-response';
import {
  appendCookies,
  applyNoCacheHeaders,
} from '../common/http/response-helpers';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { CurrentAuthSession } from '../auth/decorators/current-auth-session.decorator';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { AuthenticatedThrottlerGuard } from '../common/guards/authenticated-throttler.guard';
import type { ChestOpenResponse } from './dto/chest.response';
import { ChestService } from './chest.service';

@Controller('api')
export class ChestController {
  constructor(private readonly chestService: ChestService) {}

  @Post('chest/open')
  @Authenticated()
  @UseGuards(AuthenticatedThrottlerGuard)
  async openChest(
    @CurrentAuthSession({ optional: true }) session: ActiveSessionResult | null,
    @Req() request: Request & { id?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<ChestOpenResponse>> {
    if (!session?.view?.session?.userId) {
      throw new UnauthorizedException({
        code: 'CHEST_UNAUTHORIZED',
        message: '인증이 필요합니다.',
      });
    }
    const userId = session.view.session.userId;

    applyNoCacheHeaders(response);
    appendCookies(response, session.cookies);

    const result = await this.chestService.open(userId);

    return successResponseWithGeneratedAt(result, {
      requestId: request.id,
    });
  }
}
