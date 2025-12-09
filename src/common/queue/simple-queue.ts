import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

type QueueConfig = {
  retryMax: number;
  retryBackoffBaseMs: number;
  retryTtlMs: number;
  dlqTtlDays: number;
  alertWebhookUrl?: string | null;
};

export type SimpleJobHandler<T> = (data: T) => Promise<void>;

type RegisterOptions = {
  concurrency?: number;
};

type DeadLetterPayload<T> = {
  data: T;
  error?: string;
  stack?: string;
  attempts: number;
  timestamp: number;
};

@Injectable()
export class SimpleQueue<T> implements OnModuleDestroy {
  private readonly queueName: string;
  private readonly dlqName: string;
  private readonly config: QueueConfig;
  private readonly skipConnection: boolean;
  private readonly connection?: IORedis;
  private queue?: Queue<T>;
  private worker?: Worker<T>;
  private handler?: SimpleJobHandler<T>;
  private dlq?: Queue<DeadLetterPayload<T>>;
  private readonly inMemoryDlq: DeadLetterPayload<T>[] = [];
  private workerConcurrency = 1;
  private readonly inlineInflight = new Set<string>();

  constructor(
    queueName: string,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.queueName = queueName;
    this.dlqName = `${queueName}-dlq`;

    const retryMax = this.configService?.get<number>('queue.retryMax') ?? 3;
    const retryBackoffBaseMs =
      this.configService?.get<number>('queue.retryBackoffBaseMs') ?? 1_500;
    const retryTtlMs =
      this.configService?.get<number>('queue.retryTtlMs') ?? 2 * 60 * 60 * 1000;
    const dlqTtlDays = this.configService?.get<number>('queue.dlqTtlDays') ?? 7;
    const alertWebhookUrl =
      this.configService?.get<string>('queue.alertWebhookUrl') ?? null;

    this.config = {
      retryMax,
      retryBackoffBaseMs,
      retryTtlMs,
      dlqTtlDays,
      alertWebhookUrl,
    };

    const redisUrl =
      this.configService?.get<string>('redis.url') ??
      process.env.REDIS_URL ??
      'redis://localhost:6379';
    const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
    const isVitest = typeof process.env.VITEST_WORKER_ID !== 'undefined';
    const skipFlag = this.configService?.get<boolean>('redis.skipConnection');
    const envSkip =
      typeof process.env.REDIS_SKIP_CONNECTION === 'string'
        ? process.env.REDIS_SKIP_CONNECTION === 'true'
        : undefined;
    this.skipConnection =
      typeof skipFlag === 'boolean'
        ? skipFlag
        : typeof envSkip === 'boolean'
          ? envSkip
          : isVitest || nodeEnv === 'test';

    // Redis를 건너뛰면 인라인/인메모리 모드로 동작한다.
    this.connection = this.skipConnection
      ? undefined
      : new IORedis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });
  }

  registerHandler(
    handler: SimpleJobHandler<T>,
    options?: RegisterOptions,
  ): void {
    this.handler = handler;
    this.workerConcurrency = options?.concurrency ?? 1;
    if (!this.skipConnection) {
      this.ensureWorker(handler, this.workerConcurrency);
    }
  }

  async enqueue(
    data: T,
    options?: { delayMs?: number; jobId?: string },
  ): Promise<void> {
    if (!this.handler) {
      throw new Error('Queue handler is not registered');
    }

    if (this.skipConnection || !this.connection) {
      await this.runInline(data, options?.jobId);
      return;
    }

    const queue = this.ensureQueue();
    await (queue as unknown as Queue<any>).add('job' as never, data as never, {
      ...this.buildJobOptions(),
      delay: options?.delayMs ?? 0,
      jobId: options?.jobId,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.dlq?.close();
    await this.connection?.quit();
  }

  private ensureQueue(): Queue<T> {
    if (this.queue) return this.queue;
    this.queue = new Queue<T>(this.queueName, {
      connection: this.connection as never,
      defaultJobOptions: this.buildJobOptions(),
    } as never);
    return this.queue;
  }

  private ensureWorker(
    handler: SimpleJobHandler<T>,
    concurrency: number,
  ): void {
    if (this.worker) return;
    this.worker = new Worker<T>(
      this.queueName,
      async (job) => {
        try {
          await handler(job.data);
        } catch (error) {
          if (job.attemptsMade + 1 >= this.config.retryMax) {
            await this.sendToDlq(job.data, error, job.attemptsMade + 1);
          }
          throw error;
        }
      },
      {
        connection: this.connection as never,
        concurrency,
      },
    );
  }

  private async runInline(data: T, jobId?: string): Promise<void> {
    if (jobId) {
      if (this.inlineInflight.has(jobId)) {
        return;
      }
      this.inlineInflight.add(jobId);
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.config.retryMax; attempt += 1) {
      try {
        await this.handler?.(data);
        if (jobId) this.inlineInflight.delete(jobId);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    if (jobId) this.inlineInflight.delete(jobId);
    await this.sendToDlq(data, lastError, this.config.retryMax);
  }

  private buildJobOptions(): JobsOptions {
    return {
      attempts: this.config.retryMax,
      backoff: {
        type: 'exponential',
        delay: this.config.retryBackoffBaseMs,
      },
      removeOnComplete: true,
      removeOnFail: {
        age: this.config.dlqTtlDays * 24 * 60 * 60,
      },
      timeout: this.config.retryTtlMs,
    } as JobsOptions;
  }

  private async sendToDlq(
    data: T,
    error: unknown,
    attempts: number,
  ): Promise<void> {
    const payload: DeadLetterPayload<T> = {
      data,
      attempts,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (!this.connection || this.skipConnection) {
      this.inMemoryDlq.push(payload);
      await this.notifyAlert(payload);
      return;
    }

    const dlq = this.ensureDlq();
    await dlq.add('dead-letter', payload, {
      removeOnComplete: {
        age: this.config.dlqTtlDays * 24 * 60 * 60,
      },
      removeOnFail: false,
      attempts: 1,
      backoff: { type: 'fixed', delay: 0 },
    });
    await this.notifyAlert(payload);
  }

  private ensureDlq(): Queue<DeadLetterPayload<T>> {
    if (this.dlq) return this.dlq;
    this.dlq = new Queue<DeadLetterPayload<T>>(this.dlqName, {
      connection: this.connection as never,
    } as never);
    return this.dlq;
  }

  private async notifyAlert(payload: DeadLetterPayload<T>): Promise<void> {
    if (!this.config.alertWebhookUrl) return;
    try {
      await fetch(this.config.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue: this.queueName,
          dlq: this.dlqName,
          ...payload,
        }),
      });
    } catch (error) {
      // 알림 실패는 큐 동작에 영향을 주지 않도록 무시
      if (process.env.NODE_ENV !== 'test') {
        console.warn(
          `[SimpleQueue:${this.queueName}] alert webhook failed`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  // 테스트/디버깅용: 인메모리 DLQ 확인
  getInMemoryDlq(): DeadLetterPayload<T>[] {
    return [...this.inMemoryDlq];
  }

  /**
   * DLQ에 쌓인 작업을 다시 메인 큐로 재등록한다.
   * - skipConnection인 경우 인메모리 DLQ에서 재시도 후 제거
   * - Redis 사용 시 dead-letter 큐의 대기/지연/실패 상태를 조회해 재등록
   */
  async requeueDlq(limit = 100): Promise<number> {
    let requeued = 0;

    if (this.skipConnection || !this.connection) {
      const items = this.inMemoryDlq.splice(0, limit);
      for (const item of items) {
        await this.enqueue(item.data);
        requeued += 1;
      }
      return requeued;
    }

    const dlq = this.ensureDlq();
    const jobs = await dlq.getJobs(
      ['waiting', 'delayed', 'failed', 'paused'],
      0,
      limit - 1,
    );
    for (const job of jobs) {
      const payload = job.data;
      await this.enqueue(payload.data);
      await job.remove();
      requeued += 1;
    }
    return requeued;
  }

  /**
   * DLQ 내용을 확인용으로 가져온다 (최대 limit).
   */
  async listDlq(limit = 50): Promise<DeadLetterPayload<T>[]> {
    if (this.skipConnection || !this.connection) {
      return this.inMemoryDlq.slice(0, limit);
    }
    const dlq = this.ensureDlq();
    const jobs = await dlq.getJobs(
      ['waiting', 'delayed', 'failed', 'paused'],
      0,
      limit - 1,
    );
    return jobs.map((job) => job.data);
  }
}
