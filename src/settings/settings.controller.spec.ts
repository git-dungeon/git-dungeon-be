/// <reference types="vitest" />
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createActiveSession } from '../test-support/fixtures';
import type { PrismaService } from '../prisma/prisma.service';
import { SettingsController } from './settings.controller';
import type { SettingsProfileResponse } from './dto/settings-profile.response';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const USER_ID_1 = '00000000-0000-4000-8000-000000000001';

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
  };

  const service = new SettingsService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
  });

  it('프로필 정보를 반환해야 한다', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID_1,
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

    const result = await service.getProfile(createActiveSession());

    expect(result).toEqual<SettingsProfileResponse>({
      profile: {
        userId: USER_ID_1,
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
        },
      },
    });
  });

  it('GitHub 연결이 없으면 lastSyncAt이 null이어야 한다', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID_1,
      email: 'mock@example.com',
      name: 'Mock User',
      image: 'https://example.com/avatar.png',
      createdAt: new Date('2023-11-02T12:00:00.000Z'),
      accounts: [],
    });

    const result = await service.getProfile(createActiveSession());

    expect(result.connections.github).toEqual({
      connected: false,
      lastSyncAt: null,
    });
  });

  it('사용자를 찾지 못하면 권한 예외를 던져야 한다', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.getProfile(createActiveSession()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('응답 검증 실패 시 예외를 변환해야 한다', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID_1,
      email: 42,
      name: 'Mock User',
      image: 'https://example.com/avatar.png',
      createdAt: new Date('2023-11-02T12:00:00.000Z'),
      accounts: [],
    });

    const loggerSpy = vi.spyOn(
      (
        service as unknown as {
          logger: { error: (...params: unknown[]) => void };
        }
      ).logger,
      'error',
    );
    loggerSpy.mockImplementation(() => undefined);

    await expect(
      service.getProfile(createActiveSession()),
    ).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: {
        code: 'SETTINGS_PROFILE_UNEXPECTED',
      },
    });

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    loggerSpy.mockRestore();
  });
});

describe('SettingsController', () => {
  const USER_ID_1 = '00000000-0000-4000-8000-000000000001';
  const REQUEST_ID_1 = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

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

  const createRequest = (overrides: Partial<{ id: string }> = {}) => ({
    id: overrides.id ?? REQUEST_ID_1,
  });

  beforeEach(() => {
    serviceMock.getProfile.mockReset();
  });

  it('쿠키와 헤더를 설정하고 ApiResponse 구조로 반환해야 한다', async () => {
    const controller = new SettingsController(
      serviceMock as unknown as SettingsService,
    );

    const session = createActiveSession({
      cookies: [
        'better-auth.session_token=fresh; Path=/; HttpOnly',
        'better-auth.session_data=fresh; Path=/; HttpOnly',
      ],
    });

    const profileResponse: SettingsProfileResponse = {
      profile: {
        userId: USER_ID_1,
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
        },
      },
    };

    serviceMock.getProfile.mockResolvedValue(profileResponse);

    const response = createResponse();
    const request = createRequest({ id: REQUEST_ID_1 }) as Request & {
      id?: string;
    };
    const result = await controller.getProfile(
      session,
      request,
      response as unknown as Response,
    );

    expect(serviceMock.getProfile).toHaveBeenCalledWith(session);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(response.append).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(profileResponse);
    expect(result.meta.generatedAt).toEqual(expect.any(String));
    const generatedAt = result.meta.generatedAt!;
    expect(new Date(generatedAt).toISOString()).toBe(generatedAt);
    expect(result.meta.requestId).toBe(REQUEST_ID_1);
  });
});
