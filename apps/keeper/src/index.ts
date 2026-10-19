import { buildServer } from './server.js';
import { loadConfig } from './config.js';
import { BRAND_NAME } from '@ballast/shared';

async function start() {
  const config = loadConfig();
  const server = buildServer();

  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(
      `${BRAND_NAME} keeper listening on ${host}:${port} (Chain ID: ${config.chainId})`,
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
