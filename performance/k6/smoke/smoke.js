import { sleep } from 'k6';
import { options as smokeOptions } from '../lib/options.js';
import { request, expectedStatus, requireWriteApproval, orderPayload } from '../lib/common.js';

export const options = smokeOptions({ vus: 1, duration: '30s' });

export default function () {
  const health = request('GET', String(__ENV.HEALTH_PATH || '/health'));
  expectedStatus(health, 200, 'health is ready');
  const products = request('GET', String(__ENV.PRODUCTS_PATH || '/api/v1/products'));
  expectedStatus(products, 200, 'products endpoint is available');
  if (String(__ENV.RUN_WRITE_TEST || '').toLowerCase() === 'true') {
    requireWriteApproval();
    const order = request('POST', String(__ENV.ORDERS_PATH || '/api/v1/orders'), orderPayload(), { headers: { 'Content-Type': 'application/json' } });
    expectedStatus(order, 201, 'order is created');
  }
  sleep(1);
}
