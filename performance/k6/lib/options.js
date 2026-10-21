export function options(profile) {
  const durationThreshold = String(__ENV.P95_THRESHOLD || '500');
  const errorThreshold = String(__ENV.ERROR_RATE_THRESHOLD || '0.01');
  return {
    ...profile,
    thresholds: {
      http_req_duration: [`p(95)<${durationThreshold}`],
      http_req_failed: [`rate<${errorThreshold}`],
    },
    discardResponseBodies: String(__ENV.DISCARD_RESPONSE_BODIES || 'false').toLowerCase() === 'true',
    noConnectionReuse: false,
    tags: { service: String(__ENV.SERVICE_NAME || 'app3') },
  };
}
