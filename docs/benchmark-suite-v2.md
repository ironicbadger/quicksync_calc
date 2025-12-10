# QuickSync Benchmark Suite v2 - Implementation Plan

## Overview

Enhancements to the QuickSync benchmark suite to address what users actually care about:

1. **Concurrency Testing** - "How many simultaneous streams can my CPU handle?"
2. **Modern Codecs** - VP9/AV1 support for newer hardware

---

## Current Test Suite

### Tests (v1)

| Test | Input | Output | Resolution | What It Measures |
|------|-------|--------|------------|------------------|
| h264_1080p_cpu | H.264 | H.264 (CPU) | 1080p | Software baseline |
| h264_1080p | H.264 | H.264 QSV | 1080p | Basic QSV encode |
| h264_4k | H.264 | H.264 QSV | 4K | Resolution scaling |
| hevc_8bit | HEVC | HEVC QSV | 1080p | Modern codec (Kaby Lake+) |
| hevc_4k_10bit | HEVC | HEVC QSV | 4K | Premium codec (Tiger Lake+) |

### Test Files

| File | Codec | Resolution | Bit Depth | Bitrate | Duration |
|------|-------|------------|-----------|---------|----------|
| ribblehead_1080p_h264.mp4 | H.264 High | 1920x1080 | 8-bit | 18.9 Mbps | 116s |
| ribblehead_1080p_hevc_8bit.mp4 | HEVC Main | 1920x1080 | 8-bit | 14.9 Mbps | 116s |
| ribblehead_4k_h264.mp4 | H.264 High | 3840x2160 | 8-bit | 46.9 Mbps | 116s |
| ribblehead_4k_hevc_10bit.mp4 | HEVC Main 10 | 3840x2160 | 10-bit | 44.6 Mbps | 116s |

### Metrics Collected (v1)

- FPS (frames per second)
- Speed (realtime multiplier)
- Watts (GPU power via intel_gpu_top)
- FPS/Watt (efficiency, derived)

---

## New Features (v2)

### 1. Concurrency Testing

**Goal**: Find maximum simultaneous streams while maintaining realtime performance.

**Method**: Binary search to find highest N where all streams maintain ≥1.0x speed.

**Output**:
```
max_concurrent_h264_1080p: 11
max_concurrent_hevc_1080p: 6
max_concurrent_av1_1080p: 3
```

**Example** (i5-12600H Alder Lake):

| Concurrent Streams | Speed per Stream | Status |
|--------------------|------------------|--------|
| 1 | 9.2x | OK |
| 4 | 3.0x | OK |
| 8 | 1.5x | OK |
| 12 | 1.0x | Limit |

### 2. Modern Codec Tests (Experimental)

**New tests**:
- `vp9_1080p` - VP9 encode (Tiger Lake+ / 11th gen)
- `av1_1080p` - AV1 encode (Arc / Meteor Lake+ only)

**Behavior**: Skip gracefully if codec not supported.

---

## Test Order (v2)

### Default run
```bash
./quicksync-benchmark.sh
```

1. Core tests (existing, ~5-7 min)
2. VP9/AV1 tests (if supported, ~2-3 min)
3. Concurrency tests (~3-5 min)

**Total**: ~10-12 minutes

---

## Data Architecture

```
API (Cloudflare Workers) ──writes──> R2 Bucket (benchmarks.json)
                                            │
                                            v
                                    Web Frontend (reads)
```

### JSON Structure

```typescript
interface BenchmarkData {
  version: number;
  lastUpdated: string;
  meta: BenchmarkMeta;
  architectures: CpuArchitecture[];
  results: BenchmarkResult[];           // Main results
  concurrencyResults: ConcurrencyResult[]; // Concurrency data
  cpuFeatures: Record<string, CpuFeatures>;
}
```

### Backwards Compatibility

- `concurrencyResults` array already exists (empty)
- New test types (`vp9_1080p`, `av1_1080p`) are just new entries
- Existing data unchanged

---

## Implementation Phases

### Phase 1: Concurrency Testing
- Integrate PR #10 logic into main benchmark
- Binary search for efficiency
- Submit to `concurrencyResults` array

### Phase 2: VP9/AV1 Tests
- Add codec detection
- Graceful fallback if unsupported
- New entries in `results` array

### Phase 3: Web Display
- Show max concurrency per CPU
- Concurrency leaderboard
- Per-CPU detail pages

---

## Files Modified

| File | Changes |
|------|---------|
| quicksync-benchmark.sh | Add --concurrency flag, VP9/AV1 tests |
| api/src/lib/r2.ts | Add ConcurrencyResult interface |
| api/src/routes/submit.ts | Accept concurrency results |
| web/src/lib/dataLoader.ts | Load concurrency data |
| web/src/pages/index.astro | Display concurrency leaderboard |

---

## Experimental Results

### Concurrency (i5-12600H)

```
H.264 1080p QSV: max 10 simultaneous streams at realtime
HEVC 1080p QSV: max 4 simultaneous streams at realtime
```
