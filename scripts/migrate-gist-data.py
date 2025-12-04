#!/usr/bin/env python3
"""
Migrate benchmark results from GitHub Gist comments to Turso database.

This script:
1. Fetches all comments from the benchmark gist
2. Parses the results using existing analysis.py logic
3. Extracts CPU architecture information
4. Computes derived metrics (fps_per_watt)
5. Generates unique hashes for deduplication
6. Inserts into Turso database

Usage:
    # Dry run (no database writes)
    python migrate-gist-data.py --dry-run

    # Full migration
    TURSO_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=xxx python migrate-gist-data.py

    # With submitter ID from GitHub username
    python migrate-gist-data.py --include-github-user
"""

import os
import re
import sys
import json
import hashlib
import argparse
from io import StringIO
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass

import requests
import pandas as pd

# Try to import libsql - optional for dry run
try:
    import libsql_experimental as libsql
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

GIST_ID = "5da9b321acbe6b6b53070437023b844d"


@dataclass
class CPUArchitecture:
    """CPU architecture lookup result."""
    architecture: str
    codename: str
    release_year: int
    sort_order: int


# CPU architecture patterns (subset for migration, full list in database)
CPU_PATTERNS = [
    (r'i[3579]-2\d{3}', 'Sandy Bridge', 'SNB', 2011, 20),
    (r'i[3579]-3\d{3}', 'Ivy Bridge', 'IVB', 2012, 30),
    (r'i[3579]-4\d{3}', 'Haswell', 'HSW', 2013, 40),
    (r'i[3579]-5\d{3}', 'Broadwell', 'BDW', 2014, 50),
    (r'i[3579]-6\d{3}', 'Skylake', 'SKL', 2015, 60),
    (r'i[3579]-7\d{3}', 'Kaby Lake', 'KBL', 2017, 70),
    (r'i[3579]-8\d{3}', 'Coffee Lake', 'CFL', 2018, 80),
    (r'i[3579]-9\d{3}', 'Coffee Lake Refresh', 'CFL-R', 2019, 90),
    (r'i[3579]-10\d{3}', 'Comet Lake', 'CML', 2020, 100),
    (r'i[3579]-10\d{2}G', 'Ice Lake', 'ICL', 2019, 95),
    (r'i[3579]-11\d{2}G', 'Tiger Lake', 'TGL', 2020, 105),
    (r'i[3579]-11\d{3}', 'Rocket Lake', 'RKL', 2021, 110),
    (r'i[3579]-12\d{3}', 'Alder Lake', 'ADL', 2021, 120),
    (r'i[3579]-13\d{3}', 'Raptor Lake', 'RPL', 2022, 130),
    (r'i[3579]-14\d{3}', 'Raptor Lake Refresh', 'RPL-R', 2023, 140),
    (r'Ultra [3579] 1\d{2}', 'Meteor Lake', 'MTL', 2023, 150),
    (r'Ultra [3579] 2\d{2}[KFS]', 'Arrow Lake', 'ARL', 2024, 200),
    (r'Ultra [3579] 2\d{2}[VU]', 'Lunar Lake', 'LNL', 2024, 210),
    (r'Xeon.*E3-1[23]\d{2}', 'Xeon E3', 'Various', 2015, 55),
    (r'Xeon.*E-2[123]\d{2}', 'Xeon E', 'CFL', 2018, 85),
    (r'Pentium.*G[567]\d{3}', 'Pentium Gold', 'CFL', 2018, 82),
    (r'Celeron.*G[4567]\d{3}', 'Celeron', 'Various', 2017, 65),
    (r'N[12]\d{2}', 'Alder Lake-N', 'ADL-N', 2023, 125),
]


def get_comments() -> List[Dict]:
    """Fetch all comments from GitHub Gist."""
    comments = []
    page = 1

    print(f"Fetching comments from gist {GIST_ID}...")

    while True:
        r = requests.get(
            f"https://api.github.com/gists/{GIST_ID}/comments",
            params={"page": page, "per_page": 100}
        )
        r.raise_for_status()
        data = r.json()
        comments.extend(data)

        print(f"  Page {page}: {len(data)} comments")

        if len(data) < 100:
            break
        page += 1

    print(f"Total: {len(comments)} comments fetched")
    return comments


def extract_results(comments: List[Dict]) -> pd.DataFrame:
    """Extract benchmark results from gist comments."""
    expected_cols = ['CPU', 'TEST', 'FILE', 'BITRATE', 'TIME', 'AVG_FPS',
                     'AVG_SPEED', 'AVG_WATTS', 'user']
    dfs = []

    for comment in comments:
        lines = comment['body'].splitlines()
        for i, line in enumerate(lines):
            if line.startswith("CPU"):
                try:
                    df = pd.read_fwf(StringIO('\n'.join(lines[i:i+6])))
                    if comment['user']:
                        df['user'] = comment['user']['login']
                    else:
                        df['user'] = 'ghost'
                    if df.shape == (5, 9) and df.columns.to_list() == expected_cols:
                        dfs.append(df)
                except Exception:
                    pass  # Skip malformed entries

    if not dfs:
        return pd.DataFrame()

    return pd.concat(dfs).reset_index(drop=True)


def parse_cpu_info(cpu_raw: str) -> Tuple[Optional[str], Optional[str], Optional[int]]:
    """Extract brand, model, and generation from CPU string."""
    # Try to extract brand (i3, i5, i7, i9, Ultra 5, etc.)
    brand_match = re.search(r'(i[3579]|Ultra [3579])', cpu_raw)
    brand = brand_match.group(1) if brand_match else None

    # Try to extract model number
    model_match = re.search(r'(i\d)-(.*?)(?:\s|$)', cpu_raw)
    if model_match:
        model = model_match.group(2).strip()
    else:
        model_match = re.search(r'Ultra \d (\d+[A-Z]?)', cpu_raw)
        model = model_match.group(1) if model_match else None

    # Try to extract generation (for legacy CPUs)
    gen_match = re.search(r'(\d{4,5})', model or '')
    if gen_match:
        gen_str = gen_match.group(1)
        generation = int(gen_str[:-3]) if len(gen_str) >= 4 else None
    else:
        generation = None

    return brand, model, generation


def lookup_architecture(cpu_raw: str) -> Optional[CPUArchitecture]:
    """Look up CPU architecture from patterns."""
    for pattern, arch, codename, year, sort_order in CPU_PATTERNS:
        if re.search(pattern, cpu_raw):
            return CPUArchitecture(arch, codename, year, sort_order)
    return None


def generate_result_hash(row: Dict) -> str:
    """Generate unique hash for deduplication."""
    hash_input = f"{row['cpu_raw']}|{row['test_name']}|{row['test_file']}|{row['bitrate_kbps']}|{row['avg_fps']}|{row['avg_watts']}"
    return hashlib.sha256(hash_input.encode()).hexdigest()


def process_dataframe(df: pd.DataFrame, include_github_user: bool = False) -> List[Dict]:
    """Process DataFrame into records ready for database insertion."""
    records = []

    skipped = 0
    for _, row in df.iterrows():
        try:
            cpu_raw = str(row['CPU']).strip()
            brand, model, generation = parse_cpu_info(cpu_raw)
            arch_info = lookup_architecture(cpu_raw)

            # Parse bitrate (remove 'kb/s' suffix)
            bitrate_str = str(row['BITRATE']).strip()
            bitrate_kbps = int(bitrate_str.replace('kb/s', '').strip())

            # Parse time (remove 's' suffix)
            time_str = str(row['TIME']).strip()
            time_seconds = float(time_str.replace('s', '').strip())

            # Parse avg_fps
            fps_str = str(row['AVG_FPS']).strip()
            avg_fps = float(fps_str)

            # Parse avg_speed (remove 'x' suffix)
            speed_str = str(row['AVG_SPEED']).strip()
            if speed_str and speed_str != 'x' and speed_str.lower() != 'nan':
                avg_speed = float(speed_str.rstrip('x'))
            else:
                avg_speed = None

            # Parse avg_watts
            watts_str = str(row['AVG_WATTS']).strip()
            if watts_str and watts_str.upper() != 'N/A' and watts_str.lower() != 'nan':
                try:
                    avg_watts = float(watts_str)
                    # Filter unreasonable values
                    if avg_watts <= 0 or avg_watts > 500:
                        avg_watts = None
                except ValueError:
                    avg_watts = None
            else:
                avg_watts = None

            # Compute fps_per_watt
            fps_per_watt = avg_fps / avg_watts if avg_watts and avg_watts > 0 else None

            record = {
                'submitter_id': row['user'] if include_github_user else None,
                'cpu_raw': cpu_raw,
                'cpu_brand': brand,
                'cpu_model': model,
                'cpu_generation': generation,
                'architecture': arch_info.architecture if arch_info else None,
                'test_name': row['TEST'],
                'test_file': row['FILE'],
                'bitrate_kbps': bitrate_kbps,
                'time_seconds': time_seconds,
                'avg_fps': avg_fps,
                'avg_speed': avg_speed,
                'avg_watts': avg_watts,
                'fps_per_watt': fps_per_watt,
                'vendor': 'intel',
            }
            record['result_hash'] = generate_result_hash(record)
            records.append(record)
        except (ValueError, TypeError, KeyError) as e:
            skipped += 1
            continue

    if skipped > 0:
        print(f"Skipped {skipped} malformed rows")

    return records


def insert_records(records: List[Dict], turso_url: str, turso_token: str) -> Tuple[int, int]:
    """Insert records into Turso database."""
    if not HAS_LIBSQL:
        raise RuntimeError("libsql_experimental not installed. Run: pip install libsql-experimental")

    conn = libsql.connect(turso_url, auth_token=turso_token)

    inserted = 0
    skipped = 0

    for record in records:
        try:
            conn.execute("""
                INSERT INTO benchmark_results (
                    submitter_id, cpu_raw, cpu_brand, cpu_model, cpu_generation,
                    architecture, test_name, test_file, bitrate_kbps, time_seconds,
                    avg_fps, avg_speed, avg_watts, fps_per_watt, result_hash, vendor
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record['submitter_id'],
                record['cpu_raw'],
                record['cpu_brand'],
                record['cpu_model'],
                record['cpu_generation'],
                record['architecture'],
                record['test_name'],
                record['test_file'],
                record['bitrate_kbps'],
                record['time_seconds'],
                record['avg_fps'],
                record['avg_speed'],
                record['avg_watts'],
                record['fps_per_watt'],
                record['result_hash'],
                record['vendor'],
            ))
            inserted += 1
        except Exception as e:
            if 'UNIQUE constraint' in str(e):
                skipped += 1
            else:
                print(f"Error inserting record: {e}")
                skipped += 1

    conn.commit()
    return inserted, skipped


def main():
    parser = argparse.ArgumentParser(description='Migrate gist data to Turso database')
    parser.add_argument('--dry-run', action='store_true', help='Parse data without database writes')
    parser.add_argument('--include-github-user', action='store_true',
                        help='Include GitHub username as submitter_id')
    parser.add_argument('--output-json', type=str, help='Output parsed records as JSON file')
    args = parser.parse_args()

    # Fetch and parse
    comments = get_comments()
    df = extract_results(comments)

    if df.empty:
        print("No valid results found in gist comments")
        return

    print(f"Parsed {len(df)} benchmark results")

    # Process into records
    records = process_dataframe(df, include_github_user=args.include_github_user)
    print(f"Processed {len(records)} records")

    # Summary statistics
    architectures = {}
    for r in records:
        arch = r['architecture'] or 'Unknown'
        architectures[arch] = architectures.get(arch, 0) + 1

    print("\nArchitecture breakdown:")
    for arch, count in sorted(architectures.items(), key=lambda x: -x[1]):
        print(f"  {arch}: {count}")

    # Output JSON if requested
    if args.output_json:
        with open(args.output_json, 'w') as f:
            json.dump(records, f, indent=2, default=str)
        print(f"\nWrote {len(records)} records to {args.output_json}")

    # Dry run stops here
    if args.dry_run:
        print("\nDry run complete. No database changes made.")
        return

    # Get database credentials
    turso_url = os.environ.get('TURSO_URL')
    turso_token = os.environ.get('TURSO_AUTH_TOKEN')

    if not turso_url or not turso_token:
        print("\nError: TURSO_URL and TURSO_AUTH_TOKEN environment variables required")
        print("Set these or use --dry-run for testing")
        sys.exit(1)

    # Insert into database
    print(f"\nInserting into database...")
    inserted, skipped = insert_records(records, turso_url, turso_token)
    print(f"Inserted: {inserted}, Skipped (duplicates): {skipped}")


if __name__ == '__main__':
    main()
