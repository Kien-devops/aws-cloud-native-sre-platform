import { sleep } from 'k6';
import { options as stressOptions } from '../lib/options.js';
import { request, expectedStatus } from '../lib/common.js';

export const options = stressOptions({ stages: [{ duration: '1m', target: 10 }, { duration: '2m', target: 30 }, { duration: '2m', target: 60 }, { duration: '1m', target: 0 }] });

export default function () {
  const response = request('GET', String(__ENV.PRODUCTS_PATH || '/api/v1/products'));
  expectedStatus(response, 200, 'products remains available under stress');
  sleep(1);
}
