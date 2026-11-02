#!/usr/bin/env python3
"""Guarded, dry-run-first remediation planner; performs no Kubernetes mutation."""
import argparse
import json
import sys


def plan(namespace, pod, ready_peers, restart_count, rollout_running, dry_run=True):
    reasons = []
    if not namespace or not pod:
        reasons.append("namespace and pod are required")
    if ready_peers < 1:
        reasons.append("no healthy peer remains")
    if restart_count > 1:
        reasons.append("restart limit exceeded")
    if rollout_running:
        reasons.append("rollout is running")
    action = "restart_one_pod" if not reasons else "escalate"
    return {"dry_run": dry_run, "action": action, "namespace": namespace, "pod": pod, "reasons": reasons}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--namespace", required=True)
    parser.add_argument("--pod", required=True)
    parser.add_argument("--ready-peers", type=int, required=True)
    parser.add_argument("--restart-count", type=int, required=True)
    parser.add_argument("--rollout-running", action="store_true")
    args = parser.parse_args()
    print(json.dumps(plan(args.namespace, args.pod, args.ready_peers, args.restart_count, args.rollout_running), sort_keys=True))


if __name__ == "__main__":
    main()
