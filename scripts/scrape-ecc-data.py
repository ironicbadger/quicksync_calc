#!/usr/bin/env python3
"""
Scrape ECC support data from Intel ARK for all CPUs in the benchmark database.

Usage:
  uv run --with playwright --with libsql-experimental python scripts/scrape-ecc-data.py

Output:
  - Generates scripts/seed-ecc-data.sql with INSERT statements
"""
import asyncio
import os
import re
import sys
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# CPU list from benchmark_results (Intel only, excluding AMD/GPU)
CPUS = [
    "E-2144G",
    "E-2288G",
    "E3-1245v6",
    "G4900T",
    "Intel Celeron J4005",
    "Intel Celeron N5105",
    "Intel N100",
    "Intel N150",
    "Intel Pentium Silver J5005",
    "Intel Xeon E-2386G",
    "Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz",
    "J4105",
    "J4125",
    "M-5Y10c",
    "N100",
    "N5095",
    "N5105",
    "N6005",
    "N95",
    "Ultra 5 225",
    "i3-10100",
    "i3-10100T",
    "i3-10105",
    "i3-1115G4",
    "i3-12100",
    "i3-12100T",
    "i3-6100",
    "i3-6100T",
    "i3-7100",
    "i3-7100U",
    "i3-8100",
    "i3-8100T",
    "i3-8109U",
    "i3-8300T",
    "i3-N305",
    "i5-10300H",
    "i5-10400",
    "i5-10500",
    "i5-10500T",
    "i5-10505",
    "i5-10600K",
    "i5-11600K",
    "i5-1235U",
    "i5-12400",
    "i5-12400T",
    "i5-12500",
    "i5-12500T",
    "i5-12600H",
    "i5-12600K",
    "i5-1340P",
    "i5-13500",
    "i5-13600K",
    "i5-14500",
    "i5-14500T",
    "i5-14600K",
    "i5-4210M",
    "i5-4690S",
    "i5-6200U",
    "i5-6260U",
    "i5-6300U",
    "i5-6400",
    "i5-6400T",
    "i5-6500",
    "i5-6500T",
    "i5-6600",
    "i5-6600T",
    "i5-7300HQ",
    "i5-7300U",
    "i5-7500",
    "i5-7500T",
    "i5-7600",
    "i5-7600K",
    "i5-8250U",
    "i5-8259U",
    "i5-8260U",
    "i5-8265U",
    "i5-8350U",
    "i5-8400",
    "i5-8500",
    "i5-8500T",
    "i5-8600",
    "i5-9400",
    "i5-9500",
    "i5-9500T",
    "i5-9600K",
    "i5-9600T",
    "i7-1065G7",
    "i7-10700",
    "i7-10700T",
    "i7-10710U",
    "i7-11370H",
    "i7-1165G7",
    "i7-11700K",
    "i7-11700T",
    "i7-11800H",
    "i7-12700H",
    "i7-12700K",
    "i7-14700",
    "i7-4700EQ",
    "i7-4790K",
    "i7-6500U",
    "i7-6600U",
    "i7-6770HQ",
    "i7-7500U",
    "i7-7700",
    "i7-7700HQ",
    "i7-7700K",
    "i7-7700T",
    "i7-8086K",
    "i7-8550U",
    "i7-8559U",
    "i7-8650U",
    "i7-8665U",
    "i7-8700",
    "i7-8700K",
    "i7-8700T",
    "i7-8750H",
    "i7-9700",
    "i9-10850K",
    "i9-12900",
    "i9-12900H",
    "i9-13900",
    "i9-13900H",
    "i9-14900K",
    "i9-8950HK",
    "i9-9900",
    "i9-9900K",
    "m3-8100Y",
]

# Search term mappings for CPUs that need adjusted search queries
SEARCH_MAPPINGS = {
    "E-2144G": "E-2144G",
    "E-2288G": "E-2288G",
    "E3-1245v6": "E3-1245 v6",
    "Intel Xeon E-2386G": "E-2386G",
    "Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz": "i7-10700K",
    "Intel Celeron J4005": "J4005",
    "Intel Celeron N5105": "N5105",
    "Intel N100": "N100",
    "Intel N150": "N150",
    "Intel Pentium Silver J5005": "J5005",
    "Ultra 5 225": "Core Ultra 5 225",
    "i3-N305": "N305",
}


def get_search_term(cpu_raw: str) -> str:
    """Get the search term to use for a CPU."""
    return SEARCH_MAPPINGS.get(cpu_raw, cpu_raw)


async def check_ecc_support(page, cpu_raw: str) -> tuple[str, bool | None, str]:
    """
    Check if a CPU supports ECC memory via Intel ARK.

    Returns: (cpu_raw, ecc_supported, note)
      - ecc_supported: True if ECC, False if no ECC, None if not found
      - note: Additional info about the lookup
    """
    search_term = get_search_term(cpu_raw)
    search_url = f"https://www.intel.com/content/www/us/en/search.html#q={search_term}&cf-tabfilter=Products"

    try:
        # Navigate to search
        await page.goto(search_url, timeout=30000)
        # Wait longer for JS to render results
        await asyncio.sleep(3)

        # Check for "No results"
        content = await page.content()
        if "No results" in content and "Results 1" not in content:
            return (cpu_raw, None, f"No search results for '{search_term}'")

        # Find first processor link
        processor_links = page.locator('a[href*="/products/sku/"][href*="/specifications.html"]')
        count = await processor_links.count()

        if count == 0:
            # Try alternate selector
            processor_links = page.locator('generic[class*="result"] a')
            count = await processor_links.count()

        if count == 0:
            return (cpu_raw, None, f"No processor links found for '{search_term}'")

        # Click first result
        await processor_links.first.click()
        await page.wait_for_load_state("networkidle", timeout=10000)
        await asyncio.sleep(0.5)

        # Check page content for ECC
        content = await page.content()

        if "ECC Memory Supported" in content:
            # Field exists - check value
            if '"Yes"' in content or '>Yes<' in content:
                return (cpu_raw, True, "ECC Memory Supported: Yes")
            else:
                return (cpu_raw, False, "ECC Memory Supported: No")
        else:
            # Field not present = no ECC support
            return (cpu_raw, False, "ECC field not present (no ECC)")

    except PlaywrightTimeout:
        return (cpu_raw, None, "Timeout during lookup")
    except Exception as e:
        return (cpu_raw, None, f"Error: {str(e)}")


async def main():
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        total = len(CPUS)
        for i, cpu in enumerate(CPUS, 1):
            print(f"[{i}/{total}] Checking {cpu}...", file=sys.stderr)
            result = await check_ecc_support(page, cpu)
            results.append(result)
            print(f"  -> {result[2]}", file=sys.stderr)
            await asyncio.sleep(0.5)  # Rate limiting

        await browser.close()

    # Generate SQL output
    print("-- ECC Support Data from Intel ARK")
    print("-- Generated by scripts/scrape-ecc-data.py")
    print()

    ecc_cpus = [(cpu, note) for cpu, ecc, note in results if ecc is True]
    no_ecc_cpus = [(cpu, note) for cpu, ecc, note in results if ecc is False]
    not_found = [(cpu, note) for cpu, ecc, note in results if ecc is None]

    if ecc_cpus:
        print("-- CPUs WITH ECC support")
        for cpu, note in ecc_cpus:
            escaped_cpu = cpu.replace("'", "''")
            print(f"INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('{escaped_cpu}', 1);")
        print()

    if no_ecc_cpus:
        print("-- CPUs WITHOUT ECC support (explicitly setting to 0)")
        for cpu, note in no_ecc_cpus:
            escaped_cpu = cpu.replace("'", "''")
            print(f"INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('{escaped_cpu}', 0);")
        print()

    if not_found:
        print("-- CPUs that could not be found (manual lookup required)")
        for cpu, note in not_found:
            print(f"-- {cpu}: {note}")
        print()

    # Summary
    print(f"-- Summary: {len(ecc_cpus)} ECC, {len(no_ecc_cpus)} no ECC, {len(not_found)} not found")


if __name__ == "__main__":
    asyncio.run(main())
