import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import typia, { TypeGuardError } from 'typia';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SettingsProfileResponse } from './dto/settings-profile.response';

@Injectable()
export class SettingsService {
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
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'SETTINGS_PROFILE_UNAUTHORIZED',
        message: '프로필 정보를 조회할 수 없습니다.',
      });
    }

    const githubAccount = user.accounts.at(0);
    const sessionView = session.view.session;

    const response: SettingsProfileResponse = {
      profile: {
        userId: user.id,
        username: sessionView.username ?? null,
        displayName: sessionView.displayName ?? user.name ?? null,
        avatarUrl: sessionView.avatarUrl ?? user.image ?? null,
        email: user.email ?? sessionView.email ?? null,
        joinedAt: user.createdAt.toISOString(),
      },
      connections: {
        github: {
          connected: Boolean(githubAccount),
          lastSyncAt: githubAccount?.updatedAt.toISOString() ?? null,
        },
      },
    };

    try {
      return typia.assert<SettingsProfileResponse>(response);
    } catch (error) {
      if (error instanceof TypeGuardError) {
        throw new InternalServerErrorException({
          code: 'SETTINGS_PROFILE_UNEXPECTED',
          message: '프로필 응답 스키마가 유효하지 않습니다.',
          details: {
            path: error.path,
            expected: error.expected,
            value: error.value,
          },
        });
      }

      throw error;
    }
  }
}
