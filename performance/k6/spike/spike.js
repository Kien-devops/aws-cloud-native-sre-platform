import { sleep } from 'k6';
import { options as spikeOptions } from '../lib/options.js';
import { request, expectedStatus } from '../lib/common.js';

export const options = spikeOptions({ stages: [{ duration: '10s', target: 1 }, { duration: '10s', target: 50 }, { duration: '30s', target: 50 }, { duration: '10s', target: 1 }, { duration: '10s', target: 0 }] });

export default function () {
  const response = request('GET', String(__ENV.PRODUCTS_PATH || '/api/v1/products'));
  expectedStatus(response, 200, 'products recovers after spike');
  sleep(1);
}
