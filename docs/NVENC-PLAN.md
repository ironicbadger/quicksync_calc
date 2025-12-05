# NVIDIA NVENC Support - Implementation Plan

## Overview

Adding NVIDIA NVENC support to the QuickSync benchmark suite. The database schema and API already have `vendor` columns - multi-vendor support was anticipated.

## Phased Approach

### Phase 1: Separate NVIDIA Landing Page (Current Focus)

```
quicksync.ktz.me/           ← Existing Intel QSV page (unchanged)
quicksync.ktz.me/nvenc      ← New NVIDIA NVENC page (separate)
quicksync.ktz.me/submit     ← Shared submission (auto-detects vendor)
```

**Reuse from existing QSV implementation**:
- Same database schema (vendor column already exists)
- Same API endpoints (`/api/submit`, `/api/results?vendor=nvidia`)
- Same test files (Ribblehead clips)
- Same result format (pipe-delimited)

### Phase 2: Combined View (Future)

Once NVIDIA data is validated:
- Add vendor filter to main page
- Combined leaderboards with vendor badges
- Cross-vendor comparison charts

---

## Verified on Test System

**Hardware**: NVIDIA RTX A4000 (Ampere architecture, 16GB VRAM)
**OS**: Arch Linux with nvidia-utils installed
**FFmpeg**: System FFmpeg with NVENC support

### Test Results

| Test | FPS | Speed | Notes |
|------|-----|-------|-------|
| H.264 1080p → H.264 NVENC | 428 fps | 14.3x | Works great |
| H.264 1080p → HEVC NVENC | 362 fps | 12.1x | Works great |
| H.264 1080p → AV1 NVENC | FAILED | - | Ampere doesn't support AV1 encode |

### Power Monitoring

```
# Idle: 7W
# During H.264 encode: 57-61W
```

Command: `nvidia-smi dmon -s p -d 1`

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `nvenc-benchmark.sh` | **Create** | Main NVIDIA benchmark script |
| `web/src/pages/nvenc.astro` | **Create** | NVIDIA landing page |
| `api/src/lib/gpu-parser.ts` | **Create** | NVIDIA GPU pattern matching |
| `scripts/seed-nvidia-architectures.sql` | **Create** | NVIDIA GPU architecture patterns |
| `api/src/lib/parser.ts` | Modify | Auto-detect vendor from GPU string |
| `api/src/routes/submit.ts` | Modify | Accept NVIDIA submissions |

---

## Key Differences: Intel vs NVIDIA

| Aspect | Intel (Current) | NVIDIA (New) |
|--------|-----------------|--------------|
| Hardware detection | `/proc/cpuinfo` | `nvidia-smi --query-gpu=name` |
| Power monitoring | `intel_gpu_top -s 100ms` | `nvidia-smi dmon -s p -d 1` |
| FFmpeg source | Jellyfin container | System FFmpeg with NVENC |
| Device passthrough | `/dev/dri` | `--gpus all` |
| H.264 encoder | `h264_qsv` | `h264_nvenc` |
| HEVC encoder | `hevc_qsv` | `hevc_nvenc` |
| VP9 encoder | Supported (11th+) | **NOT SUPPORTED** |
| AV1 encoder | Arc/Meteor Lake+ | RTX 40+ only |

---

## FFmpeg Command Mapping

### Intel QSV (current)
```bash
/usr/lib/jellyfin-ffmpeg/ffmpeg -y -hide_banner -benchmark -report \
  -c:v h264 -i /config/ribblehead_1080p_h264.mp4 \
  -c:a copy -c:v h264_qsv \
  -preset fast -global_quality 18 -look_ahead 1 \
  -f null -
```

### NVIDIA NVENC (new)
```bash
ffmpeg -y -hide_banner -benchmark \
  -hwaccel cuda -i ribblehead_1080p_h264.mp4 \
  -c:a copy -c:v h264_nvenc \
  -preset p4 -b:v 5M \
  -f null -
```

---

## NVIDIA GPU Architecture Patterns

| Architecture | GPUs | NVENC Capabilities |
|--------------|------|-------------------|
| Ada Lovelace | RTX 40xx | H.264, HEVC, AV1 |
| Ampere | RTX 30xx, RTX Axxxx | H.264, HEVC |
| Turing | RTX 20xx, GTX 16xx | H.264, HEVC |
| Pascal | GTX 10xx | H.264, HEVC 8-bit |
| Maxwell | GTX 9xx | H.264, HEVC 8-bit |

**Note**: NVIDIA does NOT support VP9 encoding on any GPU.

---

## Host Requirements

```bash
# Minimum requirements:
nvidia-smi                           # GPU detection + power monitoring
ffmpeg -encoders | grep nvenc        # Must show h264_nvenc, hevc_nvenc

# On Arch Linux:
pacman -S ffmpeg ffnvcodec-headers nvidia-utils

# On Ubuntu/Debian:
apt install ffmpeg nvidia-cuda-toolkit
```

---

## Decisions

1. **URL structure**: `/nvenc`
2. **AV1 tests**: Skip for Phase 1 (limited GPU support)
3. **Power measurement**: Display raw watts with note about measurement differences
   - Intel `intel_gpu_top` = GPU die power (~15-45W)
   - NVIDIA `nvidia-smi` = Full board power including VRAM, fans (~50-150W+)
