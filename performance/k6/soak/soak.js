import { sleep } from 'k6';
import { options as soakOptions } from '../lib/options.js';
import { request, expectedStatus } from '../lib/common.js';

export const options = soakOptions({ stages: [{ duration: '2m', target: 10 }, { duration: '30m', target: 10 }, { duration: '2m', target: 0 }] });

export default function () {
  const response = request('GET', String(__ENV.PRODUCTS_PATH || '/api/v1/products'));
  expectedStatus(response, 200, 'products remains available during soak');
  sleep(Number(__ENV.THINK_TIME_SECONDS || 1));
}
