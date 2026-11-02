import { sleep } from 'k6';
import { options as loadOptions } from '../lib/options.js';
import { request, expectedStatus, requireWriteApproval, orderPayload } from '../lib/common.js';

export const options = loadOptions({ stages: [{ duration: '1m', target: 5 }, { duration: '5m', target: 20 }, { duration: '1m', target: 0 }] });

export default function () {
  const products = request('GET', String(__ENV.PRODUCTS_PATH || '/api/v1/products'));
  expectedStatus(products, 200, 'products returns 200');
  if (String(__ENV.RUN_WRITE_TEST || '').toLowerCase() === 'true') {
    requireWriteApproval();
    const order = request('POST', String(__ENV.ORDERS_PATH || '/api/v1/orders'), orderPayload(), { headers: { 'Content-Type': 'application/json' } });
    expectedStatus(order, 201, 'order returns 201');
  }
  sleep(Number(__ENV.THINK_TIME_SECONDS || 1));
}
