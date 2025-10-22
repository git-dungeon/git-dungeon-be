import 'reflect-metadata';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { NoTransformConfigurationError } from '@nestia/core/lib/decorators/NoTransformConfigurationError.js';
import { NestiaSdkApplication, type INestiaConfig } from '@nestia/sdk';
import { pathToFileURL } from 'node:url';

NoTransformConfigurationError.throws = false;

const normalizeConfigs = (
  value: INestiaConfig | INestiaConfig[],
): INestiaConfig[] => (Array.isArray(value) ? value : [value]);

const ensureOutput = async (entry: INestiaConfig) => {
  if (entry.output) {
    await fs.promises.mkdir(entry.output, { recursive: true });
  }
  const swaggerOutput = entry.swagger?.output;
  if (swaggerOutput) {
    const dir = path.dirname(swaggerOutput);
    await fs.promises.mkdir(dir, { recursive: true });
  }
};

type ConfigModule =
  | INestiaConfig
  | INestiaConfig[]
  | { default: INestiaConfig | INestiaConfig[] };

const isModuleWithDefault = (
  value: ConfigModule,
): value is { default: INestiaConfig | INestiaConfig[] } =>
  typeof value === 'object' && value !== null && 'default' in value;

const main = async () => {
  const mode = process.argv[2] ?? 'all';
  const configPath = path.resolve(__dirname, '../config/nestia.config.ts');
  const moduleValue = (await import(
    pathToFileURL(configPath).href
  )) as ConfigModule;
  const rawConfig = isModuleWithDefault(moduleValue)
    ? moduleValue.default
    : moduleValue;
  const configs = normalizeConfigs(rawConfig);
  console.log(`[nestia] loaded configurations`, configs);

  for (const entry of configs) {
    await ensureOutput(entry);
    const app = new NestiaSdkApplication(entry);
    if (mode === 'sdk' || mode === 'all') {
      await app.sdk();
    }
    if (mode === 'swagger' || mode === 'all') {
      await app.swagger();
    }
  }
};

main().catch((error) => {
  console.error('Contract generation failed:', error);
  process.exitCode = 1;
});
