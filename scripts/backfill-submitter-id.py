#!/usr/bin/env python3
"""
Backfill submitter_id from GitHub Gist usernames for existing benchmark results.

This script:
1. Fetches all comments from the benchmark gist
2. Extracts GitHub username and result data
3. Matches against existing database records by result_hash
4. Updates submitter_id for records that don't have one

Usage:
    # Dry run (no database writes)
    python backfill-submitter-id.py --dry-run

    # Full backfill
    TURSO_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=xxx python backfill-submitter-id.py
"""

import os
import sys
import hashlib
import argparse
from io import StringIO
from typing import Dict, List

import requests
import pandas as pd

# Try to import libsql - optional for dry run
try:
    import libsql_experimental as libsql
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

GIST_ID = "5da9b321acbe6b6b53070437023b844d"


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


def extract_results_with_users(comments: List[Dict]) -> List[Dict]:
    """Extract benchmark results with GitHub usernames from gist comments."""
    expected_cols = ['CPU', 'TEST', 'FILE', 'BITRATE', 'TIME', 'AVG_FPS',
                     'AVG_SPEED', 'AVG_WATTS']
    results = []

    for comment in comments:
        username = comment['user']['login'] if comment['user'] else 'ghost'
        lines = comment['body'].splitlines()

        for i, line in enumerate(lines):
            if line.startswith("CPU"):
                try:
                    df = pd.read_fwf(StringIO('\n'.join(lines[i:i+6])))
                    # Handle both with and without 'user' column from original data
                    if df.shape[0] == 5 and len(df.columns) >= 8:
                        cols = df.columns.to_list()[:8]
                        if cols == expected_cols:
                            for _, row in df.iterrows():
                                results.append({
                                    'username': username,
                                    'cpu_raw': str(row['CPU']).strip(),
                                    'test_name': row['TEST'],
                                    'test_file': row['FILE'],
                                    'bitrate_kbps': int(str(row['BITRATE']).replace('kb/s', '').strip()),
                                    'avg_fps': float(row['AVG_FPS']),
                                    'avg_watts': row['AVG_WATTS'],
                                })
                except Exception:
                    pass  # Skip malformed entries

    return results


def generate_result_hash(row: Dict) -> str:
    """Generate unique hash for matching (same logic as migrate script)."""
    # Parse avg_watts
    watts_str = str(row['avg_watts']).strip()
    if watts_str and watts_str.upper() != 'N/A' and watts_str.lower() != 'nan':
        try:
            avg_watts = float(watts_str)
            if avg_watts <= 0 or avg_watts > 500:
                avg_watts = None
        except ValueError:
            avg_watts = None
    else:
        avg_watts = None

    hash_input = f"{row['cpu_raw']}|{row['test_name']}|{row['test_file']}|{row['bitrate_kbps']}|{row['avg_fps']}|{avg_watts}"
    return hashlib.sha256(hash_input.encode()).hexdigest()


def backfill_submitter_ids(results: List[Dict], turso_url: str, turso_token: str, dry_run: bool = False) -> tuple[int, int, int]:
    """Update submitter_id for matching records."""
    if not HAS_LIBSQL:
        raise RuntimeError("libsql_experimental not installed. Run: pip install libsql-experimental")

    conn = libsql.connect(turso_url, auth_token=turso_token)

    # Build hash -> username mapping
    hash_to_user = {}
    for result in results:
        result_hash = generate_result_hash(result)
        hash_to_user[result_hash] = result['username']

    print(f"\nBuilt mapping for {len(hash_to_user)} unique result hashes")

    # Find records needing update
    cursor = conn.execute("""
        SELECT id, result_hash, submitter_id
        FROM benchmark_results
        WHERE submitter_id IS NULL OR submitter_id = ''
    """)
    rows = cursor.fetchall()
    print(f"Found {len(rows)} records without submitter_id")

    updated = 0
    not_found = 0
    already_set = 0

    for row in rows:
        record_id, result_hash, current_submitter = row

        if result_hash in hash_to_user:
            username = hash_to_user[result_hash]
            if not dry_run:
                conn.execute(
                    "UPDATE benchmark_results SET submitter_id = ? WHERE id = ?",
                    (username, record_id)
                )
            updated += 1
        else:
            not_found += 1

    if not dry_run:
        conn.commit()

    # Also check how many already have submitter_id
    cursor = conn.execute("""
        SELECT COUNT(*) FROM benchmark_results
        WHERE submitter_id IS NOT NULL AND submitter_id != ''
    """)
    already_set = cursor.fetchone()[0]

    return updated, not_found, already_set


def main():
    parser = argparse.ArgumentParser(description='Backfill submitter_id from GitHub gist usernames')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be updated without making changes')
    args = parser.parse_args()

    # Fetch and parse
    comments = get_comments()
    results = extract_results_with_users(comments)

    if not results:
        print("No valid results found in gist comments")
        return

    print(f"Parsed {len(results)} benchmark results with usernames")

    # Show username breakdown
    usernames = {}
    for r in results:
        usernames[r['username']] = usernames.get(r['username'], 0) + 1

    print("\nGitHub username breakdown (top 20):")
    for username, count in sorted(usernames.items(), key=lambda x: -x[1])[:20]:
        print(f"  {username}: {count}")

    if args.dry_run:
        print("\n[DRY RUN] Would update records in database")
        print("Run without --dry-run to apply changes")
        return

    # Get database credentials
    turso_url = os.environ.get('TURSO_URL')
    turso_token = os.environ.get('TURSO_AUTH_TOKEN')

    if not turso_url or not turso_token:
        print("\nError: TURSO_URL and TURSO_AUTH_TOKEN environment variables required")
        print("Set these or use --dry-run for testing")
        sys.exit(1)

    # Backfill
    print(f"\nBackfilling submitter_id...")
    updated, not_found, already_set = backfill_submitter_ids(results, turso_url, turso_token)

    print(f"\nResults:")
    print(f"  Updated: {updated}")
    print(f"  Not found in gist: {not_found}")
    print(f"  Already had submitter_id: {already_set}")


if __name__ == '__main__':
    main()
