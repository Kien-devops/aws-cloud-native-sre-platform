#!/usr/bin/env python3
"""Calculate replicas and headroom from measured capacity inputs."""
import argparse
import math


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--peak-rps', type=float, required=True)
    parser.add_argument('--sustainable-rps-per-replica', type=float, required=True)
    parser.add_argument('--headroom-percent', type=float, default=30.0)
    parser.add_argument('--available-replicas', type=float)
    args = parser.parse_args()
    if args.peak_rps < 0 or args.sustainable_rps_per_replica <= 0 or args.headroom_percent < 0:
        parser.error('peak-rps must be >= 0; sustainable-rps-per-replica must be > 0; headroom-percent must be >= 0')
    adjusted_peak = args.peak_rps * (1 + args.headroom_percent / 100)
    required = math.ceil(adjusted_peak / args.sustainable_rps_per_replica)
    result = {'status': 'MEASURED_INPUTS_REQUIRED', 'peak_rps': args.peak_rps, 'headroom_percent': args.headroom_percent, 'adjusted_peak_rps': adjusted_peak, 'required_replicas': required}
    if args.available_replicas is not None:
        if args.available_replicas < 0:
            parser.error('available-replicas must be >= 0')
        result['available_replicas'] = args.available_replicas
        result['headroom_rps'] = (args.available_replicas * args.sustainable_rps_per_replica) - adjusted_peak
    for key, value in result.items():
        print(f'{key}={value}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
