/**
 * Parser for benchmark script output.
 * Handles pipe-delimited format from quicksync-benchmark.sh
 */

import { createHash } from 'crypto';
import { parseCPU, CPUInfo } from './cpu-parser';

export interface ParsedResult {
  cpu_raw: string;
  cpu_brand: string | null;
  cpu_model: string | null;
  cpu_generation: number | null;
  architecture: string | null;
  test_name: string;
  test_file: string;
  bitrate_kbps: number;
  time_seconds: number;
  avg_fps: number;
  avg_speed: number | null;
  avg_watts: number | null;
  fps_per_watt: number | null;
  result_hash: string;
  vendor: string;
}

/**
 * Parse pipe-delimited benchmark output.
 *
 * Expected format:
 * CPU|TEST|FILE|BITRATE|TIME|AVG_FPS|AVG_SPEED|AVG_WATTS
 * Intel(R) Core(TM) i5-12500 CPU @ 3.00GHz|h264_1080p|ribblehead_1080p_h264|4500kb/s|10.5s|120.5|2.5x|15.2
 */
export function parseResults(body: string): ParsedResult[] {
  const lines = body.trim().split('\n');
  const results: ParsedResult[] = [];

  for (const line of lines) {
    // Skip header line
    if (line.startsWith('CPU|') || line.trim() === '') {
      continue;
    }

    const parts = line.split('|');
    if (parts.length < 8) {
      continue; // Invalid line
    }

    const [cpuRaw, testName, testFile, bitrateStr, timeStr, fpsStr, speedStr, wattsStr] = parts.map(p => p.trim());

    // Parse CPU info
    const cpuInfo = parseCPU(cpuRaw.trim());

    // Parse bitrate (remove 'kb/s' suffix)
    const bitrate = parseInt(bitrateStr.replace(/kb\/s/i, '').trim(), 10);
    if (isNaN(bitrate)) continue;

    // Parse time (remove 's' suffix)
    const time = parseFloat(timeStr.replace(/s$/i, '').trim());
    if (isNaN(time)) continue;

    // Parse FPS
    const fps = parseFloat(fpsStr.trim());
    if (isNaN(fps)) continue;

    // Parse speed (remove 'x' suffix, may be 'N/A')
    let speed: number | null = null;
    const speedClean = speedStr.replace(/x$/i, '').trim();
    if (speedClean && speedClean.toUpperCase() !== 'N/A') {
      speed = parseFloat(speedClean);
      if (isNaN(speed)) speed = null;
    }

    // Parse watts (may be 'N/A')
    let watts: number | null = null;
    const wattsClean = wattsStr.trim();
    if (wattsClean && wattsClean.toUpperCase() !== 'N/A') {
      watts = parseFloat(wattsClean);
      if (isNaN(watts) || watts <= 0 || watts > 100) {
        watts = null;
      }
    }

    // Compute fps_per_watt
    const fpsPerWatt = watts && watts > 0 ? fps / watts : null;

    // Generate hash for deduplication
    const hashInput = `${cpuRaw.trim()}|${testName}|${testFile}|${bitrate}|${fps}|${watts}`;
    const resultHash = createHash('sha256').update(hashInput).digest('hex');

    results.push({
      cpu_raw: cpuRaw.trim(),
      cpu_brand: cpuInfo.brand,
      cpu_model: cpuInfo.model,
      cpu_generation: cpuInfo.generation,
      architecture: cpuInfo.architecture,
      test_name: testName.trim(),
      test_file: testFile.trim(),
      bitrate_kbps: bitrate,
      time_seconds: time,
      avg_fps: fps,
      avg_speed: speed,
      avg_watts: watts,
      fps_per_watt: fpsPerWatt,
      result_hash: resultHash,
      vendor: 'intel',
    });
  }

  return results;
}

/**
 * Parse concurrency benchmark output.
 *
 * Expected format:
 * CPU|TEST|FILE|1x|2x|3x|4x|5x|6x|7x...
 * Intel Core i5-8500|h264_1080p|ribblehead_1080p_h264|7.02x|4.04x|2.51x|1.86x|1.47x|1.14x|.95x
 */
export interface ParsedConcurrencyResult {
  cpu_raw: string;
  cpu_brand: string | null;
  cpu_model: string | null;
  cpu_generation: number | null;
  architecture: string | null;
  test_name: string;
  test_file: string;
  speeds_json: string;
  max_concurrency: number;
  result_hash: string;
  vendor: string;
}

export function parseConcurrencyResults(body: string): ParsedConcurrencyResult[] {
  const lines = body.trim().split('\n');
  const results: ParsedConcurrencyResult[] = [];

  for (const line of lines) {
    // Skip header line
    if (line.startsWith('CPU|') || line.trim() === '') {
      continue;
    }

    const parts = line.split('|');
    if (parts.length < 4) {
      continue;
    }

    const [cpuRaw, testName, testFile, ...speedParts] = parts;

    // Parse CPU info
    const cpuInfo = parseCPU(cpuRaw.trim());

    // Parse speeds (remove 'x' suffix, convert to numbers)
    const speeds: number[] = [];
    let maxConcurrency = 0;

    for (let i = 0; i < speedParts.length; i++) {
      const speedStr = speedParts[i].replace(/x$/i, '').trim();
      if (speedStr === '-' || speedStr === '') {
        speeds.push(0);
        continue;
      }

      const speed = parseFloat(speedStr);
      if (isNaN(speed)) {
        speeds.push(0);
      } else {
        speeds.push(speed);
        // Max concurrency is the highest level with speed >= 1.0
        if (speed >= 1.0) {
          maxConcurrency = i + 1;
        }
      }
    }

    // Generate hash
    const hashInput = `${cpuRaw.trim()}|${testName}|${testFile}|${speeds.join(',')}`;
    const resultHash = createHash('sha256').update(hashInput).digest('hex');

    results.push({
      cpu_raw: cpuRaw.trim(),
      cpu_brand: cpuInfo.brand,
      cpu_model: cpuInfo.model,
      cpu_generation: cpuInfo.generation,
      architecture: cpuInfo.architecture,
      test_name: testName.trim(),
      test_file: testFile.trim(),
      speeds_json: JSON.stringify(speeds),
      max_concurrency: maxConcurrency,
      result_hash: resultHash,
      vendor: 'intel',
    });
  }

  return results;
}
