#!/usr/bin/env python3
"""Render a measured-only reliability report from a JSON evidence file."""
import argparse
import json
from pathlib import Path


def render(data):
    lines = ["# Reliability report", "", f"Window: {data.get('window', 'NOT_MEASURED')}", ""]
    for key in ("availability", "latency", "error_budget_remaining", "incident_count", "mttd", "mtta", "mttr"):
        value = data.get(key, "NOT_MEASURED")
        lines.append(f"- {key}: {value}")
    lines += ["", "Source evidence: " + str(data.get("evidence", "NOT_MEASURED"))]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.write_text(render(json.loads(args.input.read_text(encoding="utf-8"))), encoding="utf-8")


if __name__ == "__main__":
    main()
