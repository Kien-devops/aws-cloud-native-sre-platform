#!/usr/bin/env python3
"""Compare repeated k6 summary JSON files without inventing measurements."""
import argparse
import json
from pathlib import Path


def metric(summary, key):
    value = summary.get('metrics', {}).get(key, {}).get('values', {}).get('value')
    return value if isinstance(value, (int, float)) else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True)
    args = parser.parse_args()
    baseline = json.loads(args.baseline.read_text(encoding='utf-8'))
    candidate = json.loads(args.candidate.read_text(encoding='utf-8'))
    for key in ('http_reqs', 'http_req_duration', 'http_req_failed'):
        left, right = metric(baseline, key), metric(candidate, key)
        print(f'{key}=' + ('NOT_MEASURED' if left is None or right is None else f'baseline={left};candidate={right};delta={right-left}'))
    print('decision=REVIEW_WITH_REPEATED_RUNS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
