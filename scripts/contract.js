import process from 'node:process';
import config from '../nestia.config.ts';
import { NestiaSdkApplication } from '@nestia/sdk';
const normalizeConfigs = (value) => Array.isArray(value) ? value : [value];
const main = async () => {
    const mode = process.argv[2] ?? 'all';
    const configs = normalizeConfigs(config);
    for (const entry of configs) {
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
//# sourceMappingURL=contract.js.map