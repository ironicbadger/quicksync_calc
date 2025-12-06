# ECC Support Detection - Implementation Plan

This document outlines the approach for automatically gathering ECC memory support data for CPUs in the benchmark database.

## Problem Statement

We need to automatically determine ECC memory support for all CPUs in the database without manual lookup. Currently, ECC data is manually seeded in `scripts/seed-ecc-data.sql`.

---

## Data Sources Evaluated

### Sources WITH ECC Data

| Source | API? | Headless Scrapable? | Coverage | Notes |
|--------|------|---------------------|----------|-------|
| **Intel ARK** | No | Yes (Playwright) | Intel only | Authoritative source, existing scraper |
| **TechPowerUp** | No | Yes (simple HTML) | Intel + AMD | Explicit "ECC Memory: Yes/No" field |
| **WikiChip** | Yes (Semantic MediaWiki) | N/A | Very limited (25 CPUs) | Not comprehensive enough |

### Sources WITHOUT ECC Data

- Zyla Labs CPU Database API (performance metrics only)
- RapidAPI CPU Data (no ECC field)
- PassMark/Geekbench (benchmarks only)

### Not Useful

- **intel-ark-api** (GitHub) - Archived April 2025, dead project
- **dmidecode at scrape-time** - Only detects if ECC is *active* on a running system, not CPU capability

---

## Recommended Approach: Hybrid Detection

### 1. Runtime Detection (Benchmark Script)

Add ECC detection to `quicksync-benchmark.sh` to detect if ECC is active on the system running the benchmark.

**Key insight:**
- If ECC is active → CPU definitely supports ECC
- If ECC is not active → Inconclusive (might be ECC-capable CPU with non-ECC RAM)

#### Detection Methods (Priority Order)

##### Method 1: EDAC Kernel Interface (No sudo required!)
```bash
# Check if EDAC driver loaded (indicates ECC active)
ls /sys/devices/system/edac/mc/ 2>/dev/null
```
- **Pros:** Kernel-level, definitively shows ECC is functioning, no sudo
- **Cons:** May require specific kernel modules to be loaded

##### Method 2: dmidecode (Memory Width Check)
```bash
# ECC RAM = Total Width 72 bits, Data Width 64 bits (8 parity bits)
sudo dmidecode -t memory 2>/dev/null | grep -E "Total Width|Data Width"
```
- **Pros:** Common tool, shows RAM capability
- **Cons:** Shows RAM capability not necessarily active; requires sudo

##### Method 3: lshw
```bash
sudo lshw -class memory 2>/dev/null | grep -q "ecc"
# Also check: configuration: errordetection=multi-bit-ecc
```
- **Pros:** Reliably shows if ECC is *active*
- **Cons:** Requires sudo, may not be installed

#### Proposed Implementation

```bash
detect_ecc_status() {
  local ecc_status="unknown"

  # Method 1: Check EDAC (most definitive for active ECC, no sudo)
  if [ -d "/sys/devices/system/edac/mc" ]; then
    local mc_count=$(ls -1 /sys/devices/system/edac/mc/ 2>/dev/null | wc -l)
    if [ "$mc_count" -gt 0 ]; then
      ecc_status="active"
      echo "$ecc_status"
      return
    fi
  fi

  # Method 2: Check dmidecode for 72-bit width (ECC RAM installed)
  if command -v dmidecode &>/dev/null; then
    local total_width=$(sudo dmidecode -t memory 2>/dev/null | grep "Total Width" | head -1 | grep -oE '[0-9]+')
    local data_width=$(sudo dmidecode -t memory 2>/dev/null | grep "Data Width" | head -1 | grep -oE '[0-9]+')
    if [ -n "$total_width" ] && [ -n "$data_width" ]; then
      if [ "$total_width" -gt "$data_width" ]; then
        ecc_status="detected"  # ECC RAM present, likely active
      else
        ecc_status="no"  # Non-ECC RAM
      fi
    fi
  fi

  echo "$ecc_status"
}
```

#### Detection Results Interpretation

| Runtime Result | Meaning | Can Infer CPU ECC Support? |
|----------------|---------|---------------------------|
| `active` | EDAC driver loaded, ECC functioning | **Yes** - CPU supports ECC |
| `detected` | 72-bit RAM width (ECC RAM installed) | **Likely** - needs compatible CPU |
| `no` | 64-bit RAM width (non-ECC RAM) | **Unknown** - CPU might still support ECC |
| `unknown` | Couldn't detect | **Unknown** |

#### Database Update Logic

When benchmark results are submitted:
- `ecc_status=active` or `detected` → Mark CPU as `ecc_support=1` in `cpu_features` table
- `ecc_status=no` or `unknown` → Don't update (can't conclude CPU doesn't support ECC)

This provides **crowdsourced ground truth** for ECC support from real running systems.

---

### 2. Web Scraping (Periodic Batch Job)

For CPUs where runtime detection was inconclusive, use web scraping to fill gaps.

#### Primary: TechPowerUp
- URL pattern: `https://www.techpowerup.com/cpu-specs/{slug}.c{id}`
- ECC field: Explicit "ECC Memory: Yes/No" in structured HTML
- Coverage: Intel + AMD
- Simpler than Intel ARK (static HTML, no heavy JS)

#### Fallback: Intel ARK
- Existing scraper: `scripts/scrape-ecc-data.py`
- Uses Playwright for JS-rendered content
- Intel only

#### Implementation

Enhance `scripts/scrape-ecc-data.py` to:
1. Query Turso DB for CPUs missing ECC data
2. Try TechPowerUp first (faster, covers AMD)
3. Fall back to Intel ARK for failures
4. Output SQL for `seed-ecc-data.sql`

---

### 3. Manual Override

Keep `scripts/seed-ecc-data.sql` for:
- Corrections to scraped/detected data
- Known patterns (e.g., all Xeons support ECC)
- Edge cases

---

## Files to Modify

| File | Changes |
|------|---------|
| `quicksync-benchmark.sh` | Add `detect_ecc_status()` function, include in submission payload |
| `api/src/routes/submit.ts` | Accept `ecc_status` field, auto-update `cpu_features` table |
| `scripts/scrape-ecc-data.py` | Add TechPowerUp scraper as primary source |
| `scripts/seed-ecc-data.sql` | Continue as manual override source |

---

## Implementation Phases

### Phase 1: Runtime Detection
1. Add `detect_ecc_status()` to benchmark script
2. Include `ecc_status` in submission data
3. Update API to accept and store `ecc_status`
4. Auto-populate `cpu_features.ecc_support` when ECC detected

### Phase 2: Enhanced Scraping
1. Add TechPowerUp scraper to `scrape-ecc-data.py`
2. Query DB for CPUs needing ECC data
3. Run scraper periodically via GitHub Action

### Phase 3: Automation
1. GitHub Action to run scraper monthly
2. Auto-generate PR with updated ECC data
3. Detect new CPUs from benchmark submissions

---

## References

- [Intel ARK - How to Find ECC Memory Support](https://www.intel.com/content/www/us/en/support/articles/000096922/processors.html)
- [TechPowerUp CPU Database](https://www.techpowerup.com/cpu-specs/)
- [Linux EDAC Documentation](https://www.kernel.org/doc/html/latest/driver-api/edac.html)
- [nixCraft - How To Identify Server ECC Memory Modules](https://www.cyberciti.biz/faq/ecc-memory-modules/)
- [Stack Overflow - How to understand if a CPU supports ECC](https://stackoverflow.com/questions/50881522/how-to-understand-if-a-cpu-support-ecc)
