import http from 'k6/http';
import { check, fail } from 'k6';

const baseUrl = String(__ENV.BASE_URL || 'http://order-service.reliability-shop.svc.cluster.local:8080').replace(/\/$/, '');
const token = String(__ENV.AUTH_TOKEN || '');

export function url(path) {
  return `${baseUrl}${path}`;
}

export function params(extra = {}) {
  const headers = { Accept: 'application/json', ...(extra.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { ...extra, headers, tags: { ...(extra.tags || {}), test_suite: __ENV.TEST_SUITE || 'k6' } };
}

export function request(method, path, body, extra = {}) {
  const response = http.request(method, url(path), body, params(extra));
  check(response, {
    [`${method} ${path} returned an expected status`]: (r) => r.status >= 200 && r.status < 400,
  });
  return response;
}

export function requireWriteApproval() {
  if (String(__ENV.RUN_WRITE_TEST || '').toLowerCase() !== 'true') {
    fail('Write journey disabled. Set RUN_WRITE_TEST=true only for an approved test environment.');
  }
}

export function orderPayload() {
  return JSON.stringify({
    customer: `k6-user-${__VU}`,
    item: String(__ENV.ITEM_ID || 'item-dev-cloud'),
    quantity: 1,
    amount: 49.99
  });
}

export function expectedStatus(response, status, label) {
  return check(response, { [label]: (r) => r.status === status });
}
