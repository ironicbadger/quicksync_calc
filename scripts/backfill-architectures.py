#!/usr/bin/env python3
"""
Backfill architecture and cpu_generation for existing benchmark results.

This script:
1. Fetches all records with missing architecture
2. Applies the CPU pattern matching to determine architecture
3. Updates the database with the correct values

Usage:
    # Dry run (no database writes)
    python backfill-architectures.py --dry-run

    # Full backfill
    TURSO_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=xxx python backfill-architectures.py
"""

import os
import sys
import re
import argparse
from typing import Optional, Tuple

# Try to import libsql - optional for dry run
try:
    import libsql_experimental as libsql
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False


# CPU architecture patterns - must match cpu-parser.ts
CPU_PATTERNS = [
    # Core series (check specific patterns first)
    (r'i[3579]-2\d{3}', 'Sandy Bridge', 2),
    (r'i[3579]-3\d{3}', 'Ivy Bridge', 3),
    (r'i[3579]-4\d{3}', 'Haswell', 4),
    (r'i[3579]-5\d{3}', 'Broadwell', 5),
    (r'i[3579]-6\d{3}', 'Skylake', 6),
    (r'i[3579]-7\d{3}', 'Kaby Lake', 7),
    (r'i[3579]-8\d{3}', 'Coffee Lake', 8),
    (r'i[3579]-9\d{3}', 'Coffee Lake Refresh', 9),
    (r'i[3579]-10\d{2}G', 'Ice Lake', 10),  # Check G suffix first
    (r'i[3579]-10\d{3}[A-Z]?$', 'Comet Lake', 10),
    (r'i[3579]-11\d{2}G', 'Tiger Lake', 11),  # Check G suffix first
    (r'i[3579]-11\d{3}', 'Rocket Lake', 11),
    (r'i[3579]-12\d{3}', 'Alder Lake', 12),
    (r'i[3579]-13\d{3}', 'Raptor Lake', 13),
    (r'i[3579]-14\d{3}', 'Raptor Lake Refresh', 14),

    # Ultra series
    (r'Ultra [3579] 1\d{2}[HUP]?', 'Meteor Lake', 1),  # Series 1
    (r'Ultra [3579] 2\d{2}[KFS]', 'Arrow Lake', 2),    # Series 2 desktop
    (r'Ultra [3579] 2\d{2}[VU]', 'Lunar Lake', 2),     # Series 2 mobile

    # Xeon E3 with version suffixes (check these before generic E3 pattern)
    (r'Xeon.*E3-\d{4}\s*v6', 'Kaby Lake', 7),
    (r'Xeon.*E3-\d{4}\s*v5', 'Skylake', 6),
    (r'Xeon.*E3-\d{4}\s*v4', 'Broadwell', 5),
    (r'Xeon.*E3-\d{4}\s*v3', 'Haswell', 4),
    (r'Xeon.*E3-1[23]\d{2}', 'Xeon E3', None),  # Generic E3 (no gen)

    # Xeon E series
    (r'Xeon.*E-2[123]\d{2}', 'Xeon E', 8),
    (r'E-2[123]\d{2}G?', 'Xeon E', 8),  # Standalone without "Xeon" prefix

    # Pentium
    (r'Pentium.*G[567]\d{3}', 'Pentium Gold', 8),
    (r'G4\d{3}[T]?', 'Coffee Lake', 8),  # G4900T etc

    # Celeron
    (r'Celeron.*G[4567]\d{3}', 'Celeron', None),

    # N-series and J-series
    (r'N[456]\d{3}', 'Jasper Lake', None),  # N5105, N5095
    (r'N[12]\d{2}', 'Alder Lake-N', 12),    # N100, N200
    (r'N\d{2}$', 'Alder Lake-N', 12),       # N95, N97
    (r'i3-N\d{3}', 'Alder Lake-N', 12),     # i3-N305
    (r'J[456]\d{3}', 'Gemini Lake', None),  # J4105, J4125, J5005

    # Core M series
    (r'm3-\d{4}Y', 'Amber Lake', 8),        # m3-8100Y
    (r'M-5Y\d{2}', 'Broadwell', 5),         # M-5Y10c

    # Pentium/Celeron Silver
    (r'Pentium.*Silver', 'Gemini Lake', None),
    (r'Silver.*\d{4}', 'Gemini Lake', None),

    # Arc GPU
    (r'Arc A\d{3}', 'Arc Alchemist', None),

    # Intel Processor N-series
    (r'Processor N\d{3}', 'Alder Lake-N', 12),
]


def parse_cpu(cpu_raw: str) -> Tuple[Optional[str], Optional[int]]:
    """Parse CPU string to extract architecture and generation."""
    for pattern, architecture, generation in CPU_PATTERNS:
        if re.search(pattern, cpu_raw):
            return architecture, generation
    return None, None


def backfill_architectures(turso_url: str, turso_token: str, dry_run: bool = False) -> Tuple[int, int, int]:
    """Update architecture for records missing it."""
    if not HAS_LIBSQL:
        raise RuntimeError("libsql_experimental not installed. Run: pip install libsql-experimental")

    conn = libsql.connect(turso_url, auth_token=turso_token)

    # Find records needing update
    cursor = conn.execute("""
        SELECT id, cpu_raw, architecture, cpu_generation
        FROM benchmark_results
        WHERE architecture IS NULL OR architecture = ''
    """)
    rows = cursor.fetchall()
    print(f"Found {len(rows)} records without architecture")

    updated = 0
    not_matched = 0
    unmatched_cpus = set()

    for row in rows:
        record_id, cpu_raw, current_arch, current_gen = row
        architecture, generation = parse_cpu(cpu_raw)

        if architecture:
            if not dry_run:
                if generation is not None:
                    conn.execute(
                        "UPDATE benchmark_results SET architecture = ?, cpu_generation = ? WHERE id = ?",
                        (architecture, generation, record_id)
                    )
                else:
                    conn.execute(
                        "UPDATE benchmark_results SET architecture = ? WHERE id = ?",
                        (architecture, record_id)
                    )
            updated += 1
            if dry_run:
                print(f"  Would update: '{cpu_raw}' -> {architecture} (gen {generation})")
        else:
            not_matched += 1
            unmatched_cpus.add(cpu_raw)

    if not dry_run:
        conn.commit()

    # Also check how many already have architecture
    cursor = conn.execute("""
        SELECT COUNT(*) FROM benchmark_results
        WHERE architecture IS NOT NULL AND architecture != ''
    """)
    already_set = cursor.fetchone()[0]

    if unmatched_cpus:
        print(f"\nUnmatched CPUs ({len(unmatched_cpus)}):")
        for cpu in sorted(unmatched_cpus):
            print(f"  - {cpu}")

    return updated, not_matched, already_set


def main():
    parser = argparse.ArgumentParser(description='Backfill architecture from CPU patterns')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be updated without making changes')
    args = parser.parse_args()

    # Get database credentials
    turso_url = os.environ.get('TURSO_URL')
    turso_token = os.environ.get('TURSO_AUTH_TOKEN')

    if not turso_url or not turso_token:
        if not args.dry_run:
            print("Error: TURSO_URL and TURSO_AUTH_TOKEN environment variables required")
            print("Set these or use --dry-run for testing")
            sys.exit(1)
        else:
            print("Note: No database credentials - testing pattern matching only")
            # Test with known problematic CPUs
            test_cpus = [
                'E-2144G',
                'E-2288G',
                'E3-1245v6',
                'G4900T',
                'i3-N305',
                'J4105',
                'J4125',
                'M-5Y10c',
                'm3-8100Y',
                'N95',
                'Silver',
                'Intel(R) Xeon(R) E-2288G CPU @ 3.40GHz',
                'Intel(R) Core(TM) i5-8500 CPU @ 3.00GHz',
                'Intel(R) Core(TM) i3-N305',
            ]
            print("\nPattern matching test:")
            for cpu in test_cpus:
                arch, gen = parse_cpu(cpu)
                status = "OK" if arch else "UNMATCHED"
                print(f"  [{status}] '{cpu}' -> {arch} (gen {gen})")
            return

    # Backfill
    mode = "[DRY RUN] " if args.dry_run else ""
    print(f"{mode}Backfilling architecture...")
    updated, not_matched, already_set = backfill_architectures(turso_url, turso_token, args.dry_run)

    print(f"\nResults:")
    print(f"  Updated: {updated}")
    print(f"  Not matched: {not_matched}")
    print(f"  Already had architecture: {already_set}")


if __name__ == '__main__':
    main()
