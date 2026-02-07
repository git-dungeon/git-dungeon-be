import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { RuntimeValidationError } from '../common/validation/runtime-validation';
import { PrismaService } from '../prisma/prisma.service';
import type { SettingsProfileResponse } from './dto/settings-profile.response';
import { assertSettingsProfileResponse } from './settings-profile.validator';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(
    session: ActiveSessionResult,
  ): Promise<SettingsProfileResponse> {
    const userId = session.view.session.userId;
    if (!userId) {
      throw new InternalServerErrorException({
        code: 'SETTINGS_PROFILE_UNEXPECTED',
        message: '세션에서 사용자 정보를 찾을 수 없습니다.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        accounts: {
          where: { providerId: 'github' },
          select: {
            updatedAt: true,
          },
        },
        githubSyncState: {
          select: {
            lastSuccessfulSyncAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'SETTINGS_PROFILE_UNAUTHORIZED',
        message: '프로필 정보를 조회할 수 없습니다.',
      });
    }

    const githubAccount = user.accounts.at(0);
    const lastSuccessfulSyncAt =
      user.githubSyncState?.lastSuccessfulSyncAt ??
      githubAccount?.updatedAt ??
      null;
    const sessionView = session.view.session;

    const response: SettingsProfileResponse = {
      profile: {
        userId: user.id,
        username: sessionView.username,
        displayName: sessionView.displayName,
        avatarUrl: sessionView.avatarUrl,
        email: user.email,
        joinedAt: user.createdAt.toISOString(),
      },
      connections: {
        github: {
          connected: Boolean(githubAccount),
          lastSyncAt: lastSuccessfulSyncAt?.toISOString() ?? null,
        },
      },
    };

    try {
      return assertSettingsProfileResponse(response);
    } catch (error) {
      if (error instanceof RuntimeValidationError) {
        // 로거로만 에러의 상세를 남기고, 외부로는 일반적인 에러만 반환한다.
        this.logger.error(
          `SettingsProfileResponse validation failed: ${JSON.stringify({
            path: error.path,
            expected: error.expected,
            value: error.value,
          })}`,
        );

        throw new InternalServerErrorException({
          code: 'SETTINGS_PROFILE_UNEXPECTED',
          message: '프로필 응답 스키마가 유효하지 않습니다.',
          details: {
            path: error.path,
            expected: error.expected,
          },
        });
      }

      throw error;
    }
  }
}
