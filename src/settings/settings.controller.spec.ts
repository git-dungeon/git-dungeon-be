import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSessionResult } from '../auth/auth-session.service';
import type { PrismaService } from '../prisma/prisma.service';
import { SettingsController } from './settings.controller';
import type { SettingsProfileResponse } from './dto/settings-profile.response';
import { SettingsService } from './settings.service';

const { typiaAssertMock, MockTypeGuardError } = vi.hoisted(() => {
  const assertMock = vi.fn((value: unknown) => value);

  class HoistedTypeGuardError extends Error {
    constructor(
      public readonly path?: string,
      public readonly expected?: string,
      public readonly value?: unknown,
    ) {
      super('MockTypeGuardError');
    }
  }

  return {
    typiaAssertMock: assertMock,
    MockTypeGuardError: HoistedTypeGuardError,
  } as const;
});

vi.mock('typia', () => ({
  __esModule: true,
  default: {
    assert: typiaAssertMock,
  },
  assert: typiaAssertMock,
  TypeGuardError: MockTypeGuardError,
}));

vi.mock('@nestia/core', async () => {
  const decorators = await import('@nestjs/common');

  const wrap =
    <T extends (...params: never[]) => unknown>(decorator: T) =>
    (...params: Parameters<T>): ReturnType<T> =>
      decorator(...params) as ReturnType<T>;

  return {
    __esModule: true,
    TypedRoute: {
      Get: wrap(decorators.Get),
      Post: wrap(decorators.Post),
      Put: wrap(decorators.Put),
      Patch: wrap(decorators.Patch),
      Delete: wrap(decorators.Delete),
    },
    TypedBody: wrap(decorators.Body),
    TypedParam: wrap(decorators.Param),
    TypedQuery: wrap(decorators.Query),
    TypedHeaders: wrap(decorators.Headers),
  } as const;
});

const createSession = (
  overrides: Partial<ActiveSessionResult> = {},
): ActiveSessionResult => ({
  payload: {
    session: { userId: 'user-1' },
    user: { id: 'user-1' },
  },
  cookies: ['better-auth.session_token=stub; Path=/; HttpOnly'],
  refreshed: false,
  view: {
    session: {
      userId: 'user-1',
      username: 'mock-user',
      displayName: 'Mock User',
      email: 'mock@example.com',
      avatarUrl: 'https://example.com/avatar.png',
    },
    refreshed: false,
  },
  ...overrides,
});

describe('SettingsService', () => {
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
  };

  const service = new SettingsService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    typiaAssertMock.mockReset();
    typiaAssertMock.mockImplementation((value) => value);
  });

  it('프로필 정보를 반환해야 한다', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'mock@example.com',
      name: 'Mock User',
      image: 'https://example.com/avatar.png',
      createdAt: new Date('2023-11-02T12:00:00.000Z'),
      accounts: [
        {
          accountId: 'mock-user',
          updatedAt: new Date('2025-10-17T01:15:00.000Z'),
        },
      ],
    });

    const result = await service.getProfile(createSession());

    expect(result).toEqual<SettingsProfileResponse>({
      profile: {
        userId: 'user-1',
        username: 'mock-user',
        displayName: 'Mock User',
        avatarUrl: 'https://example.com/avatar.png',
        email: 'mock@example.com',
        joinedAt: '2023-11-02T12:00:00.000Z',
      },
      connections: {
        github: {
          connected: true,
          lastSyncAt: '2025-10-17T01:15:00.000Z',
          profileUrl: 'https://github.com/mock-user',
        },
      },
    });

    expect(typiaAssertMock).toHaveBeenCalledTimes(1);
  });

  it('세션에 사용자 ID가 없으면 예외를 던져야 한다', async () => {
    await expect(
      service.getProfile(
        createSession({
          view: {
            session: {
              userId: '',
              username: null,
              displayName: null,
              email: null,
              avatarUrl: null,
            },
            refreshed: false,
          },
        }),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('사용자를 찾지 못하면 권한 예외를 던져야 한다', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.getProfile(createSession())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('Typia 검증 실패 시 예외를 변환해야 한다', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'mock@example.com',
      name: 'Mock User',
      image: 'https://example.com/avatar.png',
      createdAt: new Date('2023-11-02T12:00:00.000Z'),
      accounts: [],
    });

    typiaAssertMock.mockImplementationOnce(() => {
      throw new MockTypeGuardError('profile.email', 'string', 42);
    });

    await expect(service.getProfile(createSession())).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: {
        code: 'SETTINGS_PROFILE_UNEXPECTED',
      },
    });
  });
});

describe('SettingsController', () => {
  const serviceMock = {
    getProfile: vi.fn(),
  };

  const createResponse = () => {
    const headers = new Map<string, string | string[]>();

    return {
      headers,
      setHeader: vi.fn((key: string, value: string) => {
        headers.set(key.toLowerCase(), value);
      }),
      append: vi.fn((key: string, value: string) => {
        const normalized = key.toLowerCase();
        const previous = headers.get(normalized);
        if (!previous) {
          headers.set(normalized, [value]);
          return;
        }

        const next = Array.isArray(previous)
          ? [...previous, value]
          : [previous, value];
        headers.set(normalized, next);
      }),
    };
  };

  beforeEach(() => {
    serviceMock.getProfile.mockReset();
    typiaAssertMock.mockReset();
    typiaAssertMock.mockImplementation((value) => value);
  });

  it('쿠키와 헤더를 설정하고 서비스 결과를 반환해야 한다', async () => {
    const controller = new SettingsController(
      serviceMock as unknown as SettingsService,
    );

    const session = createSession({
      cookies: [
        'better-auth.session_token=fresh; Path=/; HttpOnly',
        'better-auth.session_data=fresh; Path=/; HttpOnly',
      ],
    });

    const profileResponse: SettingsProfileResponse = {
      profile: {
        userId: 'user-1',
        username: 'mock-user',
        displayName: 'Mock User',
        avatarUrl: 'https://example.com/avatar.png',
        email: 'mock@example.com',
        joinedAt: '2023-11-02T12:00:00.000Z',
      },
      connections: {
        github: {
          connected: true,
          lastSyncAt: '2025-10-17T01:15:00.000Z',
          profileUrl: 'https://github.com/mock-user',
        },
      },
    };

    serviceMock.getProfile.mockResolvedValue(profileResponse);

    const response = createResponse();
    const result = await controller.getProfile(
      session,
      response as unknown as Response,
    );

    expect(serviceMock.getProfile).toHaveBeenCalledWith(session);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(response.append).toHaveBeenCalledTimes(2);
    expect(result).toEqual(profileResponse);
  });
});
