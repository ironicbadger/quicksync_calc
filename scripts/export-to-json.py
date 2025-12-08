#!/usr/bin/env python3
"""
Export Turso database to JSON file for R2 storage.
Run with: uv run --with libsql-experimental python3 scripts/export-to-json.py
"""

import json
import os
import sys
from datetime import datetime

try:
    import libsql_experimental as libsql
except ImportError:
    print("Error: libsql-experimental not installed")
    print("Run: uv run --with libsql-experimental python3 scripts/export-to-json.py")
    sys.exit(1)


def get_connection():
    """Connect to Turso database using environment variables."""
    url = os.environ.get("TURSO_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN")

    if not url or not token:
        print("Error: TURSO_URL and TURSO_AUTH_TOKEN environment variables required")
        print("Run: eval \"$(sops -d secrets.enc.yaml | grep -E '^turso_' | sed 's/: /=/g' | sed 's/^/export /g')\"")
        sys.exit(1)

    return libsql.connect(url, auth_token=token)


def fetch_all_as_dicts(conn, query):
    """Execute query and return results as list of dicts."""
    cursor = conn.execute(query)
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    return [dict(zip(columns, row)) for row in rows]


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


def main():
    print("Connecting to Turso...")
    conn = get_connection()

    # Fetch benchmark results
    print("Fetching benchmark_results...")
    results = fetch_all_as_dicts(conn, """
        SELECT
            id, submitted_at, submitter_id,
            cpu_raw, cpu_brand, cpu_model, cpu_generation, architecture,
            test_name, test_file, bitrate_kbps, time_seconds,
            avg_fps, avg_speed, avg_watts, fps_per_watt,
            result_hash, vendor
        FROM benchmark_results
        ORDER BY id
    """)
    print(f"  Found {len(results)} benchmark results")

    # Fetch concurrency results
    print("Fetching concurrency_results...")
    concurrency = fetch_all_as_dicts(conn, """
        SELECT
            id, submitted_at, submitter_id,
            cpu_raw, cpu_brand, cpu_model, cpu_generation, architecture,
            test_name, test_file, speeds_json, max_concurrency,
            result_hash, vendor
        FROM concurrency_results
        ORDER BY id
    """)
    print(f"  Found {len(concurrency)} concurrency results")

    # Apply data quality flagging to benchmark results
    print("Applying data quality flags...")
    flagged_count = 0
    for result in results:
        flag_data_quality(result)
        if result.get('data_quality_flags'):
            flagged_count += 1
    print(f"  Flagged {flagged_count} results with data quality issues")

    # Parse speeds_json for concurrency results
    for row in concurrency:
        if row.get("speeds_json"):
            try:
                row["speeds_json"] = json.loads(row["speeds_json"])
            except json.JSONDecodeError:
                pass  # Keep as string if not valid JSON

    # Fetch architectures
    print("Fetching cpu_architectures...")
    architectures = fetch_all_as_dicts(conn, """
        SELECT
            id, pattern, architecture, codename,
            release_year, release_quarter, sort_order,
            h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
            igpu_name, igpu_codename, process_nm,
            max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count,
            vendor
        FROM cpu_architectures
        ORDER BY sort_order
    """)
    print(f"  Found {len(architectures)} architecture patterns")

    # Fetch CPU features
    print("Fetching cpu_features...")
    features_list = fetch_all_as_dicts(conn, """
        SELECT cpu_raw, ecc_support
        FROM cpu_features
    """)
    # Convert to dict keyed by cpu_raw
    cpu_features = {f["cpu_raw"]: {"ecc_support": bool(f["ecc_support"])} for f in features_list}
    print(f"  Found {len(cpu_features)} CPU feature entries")

    # Compute meta stats
    unique_cpus = set(r["cpu_raw"] for r in results)
    unique_archs = set(r["architecture"] for r in results if r["architecture"])

    # Count unique submissions (submitted_at + cpu_raw combination)
    unique_submissions = set((r["submitted_at"], r["cpu_raw"]) for r in results)

    meta = {
        "totalResults": len(unique_submissions),
        "uniqueCpus": len(unique_cpus),
        "architecturesCount": len(unique_archs),
        "uniqueTests": len(set(r["test_name"] for r in results)),
    }

    # Build final JSON structure
    data = {
        "version": 1,
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "meta": meta,
        "architectures": architectures,
        "results": results,
        "concurrencyResults": concurrency,
        "cpuFeatures": cpu_features,
    }

    # Write to file
    output_file = "benchmarks.json"
    print(f"\nWriting to {output_file}...")
    with open(output_file, "w") as f:
        json.dump(data, f, indent=2)

    # Report file size
    size_bytes = os.path.getsize(output_file)
    size_kb = size_bytes / 1024
    print(f"  Size: {size_kb:.1f} KB ({size_bytes:,} bytes)")

    print("\nDone! Upload to R2 with:")
    print(f"  wrangler r2 object put quicksync-data/benchmarks.json --file {output_file}")


if __name__ == "__main__":
    main()
