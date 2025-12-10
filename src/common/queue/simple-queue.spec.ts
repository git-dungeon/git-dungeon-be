import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleQueue, type QueueEvent } from './simple-queue';
import type { ConfigService } from '@nestjs/config';

type MockConfigService = Pick<ConfigService, 'get'>;

const createConfigService = (
  overrides?: Record<string, unknown>,
): MockConfigService => {
  const defaults: Record<string, unknown> = {
    'queue.retryMax': 3,
    'queue.retryBackoffBaseMs': 10,
    'queue.retryTtlMs': 1000,
    'queue.dlqTtlDays': 1,
    'queue.alertWebhookUrl': 'http://localhost/webhook',
    'queue.alertFailureThreshold': 2,
    'redis.skipConnection': true,
  };

  return {
    get: vi.fn((key: string) => {
      if (overrides && key in overrides) return overrides[key];
      return defaults[key];
    }),
  };
};

describe('SimpleQueue 인라인 모드', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('성공 시 핸들러가 한 번 실행되고 성공 이벤트가 발행된다', async () => {
    const configService = createConfigService();
    const monitor = { onEvent: vi.fn() };
    const queue = new SimpleQueue<{ foo: string }>(
      'test-queue',
      configService as unknown as ConfigService,
    );
    queue.setMonitor(monitor);

    const handler = vi.fn(async (data: { foo: string }) => {
      expect(data.foo).toBe('bar');
      await Promise.resolve();
    });
    queue.registerHandler(handler);

    await queue.enqueue({ foo: 'bar' }, { jobId: 'job-1' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(monitor.onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'success',
        jobId: 'job-1',
        attempts: 1,
      }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('재시도 후 실패하면 failure/dlq 이벤트와 웹훅이 발행된다', async () => {
    const configService = createConfigService({ 'queue.retryMax': 2 });
    const monitor = {
      onEvent: vi.fn<(event: QueueEvent<{ foo: string }>) => void>(),
    };
    const queue = new SimpleQueue<{ foo: string }>(
      'test-queue',
      configService as unknown as ConfigService,
    );
    queue.setMonitor(monitor);

    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'));
    queue.registerHandler(handler);

    await queue.enqueue({ foo: 'baz' }, { jobId: 'job-2' });

    const events = monitor.onEvent.mock.calls.map(([event]) => event);
    expect(events.map((e) => e.outcome)).toEqual(['retry', 'failure', 'dlq']);

    expect(global.fetch).toHaveBeenCalledTimes(2); // failure 알림 + dlq 알림
    const dlqEvent = events.find(
      (event) =>
        event.outcome === 'dlq' &&
        event.jobId === 'job-2' &&
        typeof event.failureCount === 'undefined',
    );
    expect(dlqEvent).toBeDefined();
  });

  it('DLQ에 쌓인 작업을 requeue 하면 성공 이벤트가 발행된다', async () => {
    const configService = createConfigService({ 'queue.retryMax': 1 });
    const monitor = { onEvent: vi.fn() };
    const queue = new SimpleQueue<{ foo: string }>(
      'test-queue',
      configService as unknown as ConfigService,
    );
    queue.setMonitor(monitor);

    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);
    queue.registerHandler(handler);

    await queue.enqueue({ foo: 'dlq' }, { jobId: 'job-3' });
    const requeued = await queue.requeueDlq();

    const events = monitor.onEvent.mock.calls.map(
      (call) => call[0] as QueueEvent<{ foo: string }>,
    );
    expect(events.map((e) => e.outcome)).toEqual(['failure', 'dlq', 'success']);
    expect(requeued).toBe(1);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('재시도 시 백오프 후 성공한다', async () => {
    vi.useFakeTimers();
    const configService = createConfigService({
      'queue.retryMax': 2,
      'queue.retryBackoffBaseMs': 50,
    });
    const monitor = {
      onEvent: vi.fn<(event: QueueEvent<{ foo: string }>) => void>(),
    };
    const queue = new SimpleQueue<{ foo: string }>(
      'test-queue',
      configService as unknown as ConfigService,
    );
    queue.setMonitor(monitor);

    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce(undefined);
    queue.registerHandler(handler);

    const promise = queue.enqueue({ foo: 'retry' }, { jobId: 'job-4' });
    await vi.advanceTimersByTimeAsync(50);
    await promise;

    expect(handler).toHaveBeenCalledTimes(2);
    const outcomes = monitor.onEvent.mock.calls.map(([event]) => event.outcome);
    expect(outcomes).toEqual(['retry', 'success']);

    vi.useRealTimers();
  });

  it('타임아웃 시 AbortSignal로 중단되고 DLQ로 이동한다', async () => {
    vi.useFakeTimers();
    const configService = createConfigService({
      'queue.retryMax': 1,
      'queue.retryTtlMs': 5,
    });
    const monitor = {
      onEvent: vi.fn<(event: QueueEvent<{ foo: string }>) => void>(),
    };
    const queue = new SimpleQueue<{ foo: string }>(
      'test-queue',
      configService as unknown as ConfigService,
    );
    queue.setMonitor(monitor);

    const handler = vi.fn(
      (_data: { foo: string }, signal?: AbortSignal) =>
        new Promise<void>((_, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    queue.registerHandler(handler);

    const promise = queue.enqueue({ foo: 'timeout' }, { jobId: 'job-5' });
    await vi.advanceTimersByTimeAsync(5);
    await promise;

    expect(handler).toHaveBeenCalledTimes(1);
    const outcomes = monitor.onEvent.mock.calls.map(([event]) => event.outcome);
    expect(outcomes).toEqual(['failure', 'dlq']);

    vi.useRealTimers();
  });
});
