#!/usr/bin/env python3
"""
Add data quality flags to existing benchmark results in R2 JSON file.
Run with: uv run python3 scripts/flag-r2-data.py
"""

import json
import subprocess
import sys
from datetime import datetime


def flag_data_quality(result):
    """Add data quality flags to a benchmark result."""
    flags = []

    # Flag 1: Power too low (measurement error)
    if result.get('avg_watts') is not None:
        if result['avg_watts'] < 3.0:
            flags.append('power_too_low')

    # Flag 2: Efficiency outlier (derived from bad power or other issues)
    if result.get('fps_per_watt') is not None:
        if result['fps_per_watt'] > 400:  # Hard cap above highest legitimate (N150: 327.9 fps/W)
            flags.append('efficiency_outlier')

    # Flag 3: Arrow Lake architecture warning (known issue)
    if result.get('architecture') == 'Arrow Lake':
        flags.append('arrow_lake_power_issue')

    result['data_quality_flags'] = flags if flags else None
    return result


def download_from_r2():
    """Download benchmarks.json from R2."""
    print("Downloading benchmarks.json from R2...")

    # Download to local file
    temp_file = "benchmarks-download.json"
    result = subprocess.run(
        ["npx", "wrangler", "r2", "object", "get", "quicksync-data/benchmarks.json",
         "--file", temp_file, "--remote"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"Error downloading from R2: {result.stderr}")
        sys.exit(1)

    # Read the downloaded file
    with open(temp_file, "r") as f:
        data = json.load(f)

    return data


def upload_to_r2(data):
    """Upload modified benchmarks.json to R2."""
    print("Uploading modified benchmarks.json to R2...")

    # Write to temporary file
    temp_file = "benchmarks.json"
    with open(temp_file, "w") as f:
        json.dump(data, f, indent=2)

    # Upload to R2
    result = subprocess.run(
        ["npx", "wrangler", "r2", "object", "put", "quicksync-data/benchmarks.json",
         "--file", temp_file, "--remote"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"Error uploading to R2: {result.stderr}")
        sys.exit(1)

    print("Upload successful!")


def main():
    # Download current data
    data = download_from_r2()

    # Apply data quality flagging to benchmark results
    print("\nApplying data quality flags...")
    flagged_count = 0
    results = data.get("results", [])

    for result in results:
        before_flags = result.get('data_quality_flags')
        flag_data_quality(result)
        after_flags = result.get('data_quality_flags')

        if after_flags:
            flagged_count += 1

    print(f"  Flagged {flagged_count} results with data quality issues")

    # Update lastUpdated timestamp
    data["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

    # Show summary
    print("\nFlag breakdown:")
    power_too_low = sum(1 for r in results if r.get('data_quality_flags') and 'power_too_low' in r['data_quality_flags'])
    efficiency_outlier = sum(1 for r in results if r.get('data_quality_flags') and 'efficiency_outlier' in r['data_quality_flags'])
    arrow_lake_issue = sum(1 for r in results if r.get('data_quality_flags') and 'arrow_lake_power_issue' in r['data_quality_flags'])

    print(f"  power_too_low: {power_too_low}")
    print(f"  efficiency_outlier: {efficiency_outlier}")
    print(f"  arrow_lake_power_issue: {arrow_lake_issue}")

    # Upload modified data
    upload_to_r2(data)

    print("\n✅ Done! Data quality flags have been permanently added to R2 JSON file.")


if __name__ == "__main__":
    main()
