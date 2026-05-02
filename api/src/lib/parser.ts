/**
 * Parser for benchmark script output.
 * Handles pipe-delimited format from quicksync-benchmark.sh and nvenc-benchmark.sh
 */

import { parseCPU, CPUInfo } from './cpu-parser';

/**
 * Generate SHA-256 hash using Web Crypto API (Cloudflare Workers compatible)
 */
async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Strip frequency suffix (e.g., "@ 3.90GHz") from CPU string.
 */
function stripFrequencySuffix(cpuStr: string): string {
  return cpuStr.replace(/\s*@\s*\d+(\.\d+)?\s*GHz/i, '').trim();
}

/**
 * Normalize CPU string by removing common markers for consistency.
 * Removes: Intel(R), Core(TM), "CPU", generation prefixes, and extra whitespace.
 * Result: "i5-13500" instead of "13th Gen Intel Core i5-13500"
 */
function normalizeCPUString(cpuStr: string): string {
  return cpuStr
    .replace(/\(R\)/gi, '')
    .replace(/\(TM\)/gi, '')
    .replace(/\bCPU\b/gi, '')
    .replace(/^\d{1,2}th Gen Intel Core\s+/i, '')  // "13th Gen Intel Core i5-13500" -> "i5-13500"
    .replace(/^Intel Core\s+(?=i[3579]-)/i, '')    // "Intel Core i5-13500" -> "i5-13500"
    .replace(/^Intel Core\s+(?=Ultra)/i, '')       // "Intel Core Ultra 5 225" -> "Ultra 5 225"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect vendor from hardware string.
 * Returns 'nvidia' for NVIDIA GPUs, 'intel' for Intel CPUs/Arc GPUs, 'amd' for AMD.
 */
function detectVendor(hardwareStr: string): 'intel' | 'nvidia' | 'amd' {
  const upper = hardwareStr.toUpperCase();
  if (upper.includes('NVIDIA') || upper.includes('GEFORCE') || upper.includes('RTX') || upper.includes('GTX') || upper.includes('QUADRO') || upper.includes('TESLA')) {
    return 'nvidia';
  }
  if (upper.includes('AMD') || upper.includes('RADEON') || upper.includes('EPYC') || upper.includes('RYZEN')) {
    return 'amd';
  }
  return 'intel';
}

/**
 * Check if hardware string is an Intel Arc GPU.
 */
function isIntelArc(hardwareStr: string): boolean {
  return /\bArc\b/i.test(hardwareStr);
}

/**
 * Parse Intel Arc GPU info from GPU name string.
 */
interface ArcGPUInfo {
  brand: string | null;
  model: string | null;
  generation: number | null;
  architecture: string | null;
}

function parseIntelArc(gpuStr: string): ArcGPUInfo {
  // Arc A-series (Alchemist) - 2022
  // A770, A750, A580, A380, A310 (desktop)
  // A770M, A730M, A550M, A370M, A350M (mobile)
  // A40, A50 Pro (workstation/data center)
  if (/Arc\s*(A\d{2,3})\s*(Pro)?/i.test(gpuStr)) {
    const match = gpuStr.match(/Arc\s*(A\d{2,3})\s*(Pro)?/i);
    const model = match ? `${match[1]}${match[2] ? ' Pro' : ''}` : null;
    return { brand: 'Arc', model, generation: 1, architecture: 'Alchemist' };
  }

  // Arc B-series (Battlemage) - 2024
  // B580, B570 (desktop)
  if (/Arc\s*(B\d{3})/i.test(gpuStr)) {
    const model = gpuStr.match(/Arc\s*(B\d{3})/i)?.[1] || null;
    return { brand: 'Arc', model, generation: 2, architecture: 'Battlemage' };
  }

  // Fallback for unknown Arc
  return { brand: 'Arc', model: null, generation: null, architecture: 'Arc' };
}

/**
 * Parse NVIDIA GPU info from GPU name string.
 */
interface GPUInfo {
  brand: string | null;
  model: string | null;
  generation: number | null;
  architecture: string | null;
}

function parseNvidiaGPU(gpuStr: string): GPUInfo {
  // RTX 40 series - Ada Lovelace (2022)
  if (/RTX\s*40[0-9]{2}/i.test(gpuStr) || /RTX\s*4090/i.test(gpuStr) || /RTX\s*4080/i.test(gpuStr)) {
    const model = gpuStr.match(/RTX\s*(\d{4})/i)?.[1] || null;
    return { brand: 'RTX', model, generation: 40, architecture: 'Ada Lovelace' };
  }

  // RTX A series workstation - Ampere (2020)
  if (/RTX\s*A\d{4}/i.test(gpuStr)) {
    const model = gpuStr.match(/RTX\s*(A\d{4})/i)?.[1] || null;
    return { brand: 'RTX A', model, generation: 30, architecture: 'Ampere' };
  }

  // RTX 30 series - Ampere (2020)
  if (/RTX\s*30[0-9]{2}/i.test(gpuStr) || /RTX\s*3090/i.test(gpuStr) || /RTX\s*3080/i.test(gpuStr)) {
    const model = gpuStr.match(/RTX\s*(\d{4})/i)?.[1] || null;
    return { brand: 'RTX', model, generation: 30, architecture: 'Ampere' };
  }

  // RTX 20 series - Turing (2018)
  if (/RTX\s*20[0-9]{2}/i.test(gpuStr)) {
    const model = gpuStr.match(/RTX\s*(\d{4})/i)?.[1] || null;
    return { brand: 'RTX', model, generation: 20, architecture: 'Turing' };
  }

  // GTX 16 series - Turing (2019)
  if (/GTX\s*16[0-9]{2}/i.test(gpuStr)) {
    const model = gpuStr.match(/GTX\s*(\d{4})/i)?.[1] || null;
    return { brand: 'GTX', model, generation: 16, architecture: 'Turing' };
  }

  // GTX 10 series - Pascal (2016)
  if (/GTX\s*10[0-9]{2}/i.test(gpuStr)) {
    const model = gpuStr.match(/GTX\s*(\d{4})/i)?.[1] || null;
    return { brand: 'GTX', model, generation: 10, architecture: 'Pascal' };
  }

  // GTX 9 series - Maxwell (2014)
  if (/GTX\s*9[0-9]{2}/i.test(gpuStr)) {
    const model = gpuStr.match(/GTX\s*(\d{3})/i)?.[1] || null;
    return { brand: 'GTX', model, generation: 9, architecture: 'Maxwell' };
  }

  // Fallback - try to extract any model number
  const anyModel = gpuStr.match(/\d{3,4}/)?.[0] || null;
  return { brand: null, model: anyModel, generation: null, architecture: null };
}

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
export async function parseResults(body: string): Promise<ParsedResult[]> {
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

    const [cpuRawInput, testName, testFile, bitrateStr, timeStr, fpsStr, speedStr, wattsStr] = parts.map(p => p.trim());

    // Clean CPU string: strip frequency suffix and normalize markers
    const cpuRaw = normalizeCPUString(stripFrequencySuffix(cpuRawInput));

    // Detect vendor and parse hardware info appropriately
    const vendor = detectVendor(cpuRaw);
    let hwInfo: { brand: string | null; model: string | null; generation: number | null; architecture: string | null };

    if (vendor === 'nvidia') {
      hwInfo = parseNvidiaGPU(cpuRaw.trim());
    } else if (isIntelArc(cpuRaw)) {
      hwInfo = parseIntelArc(cpuRaw.trim());
    } else {
      hwInfo = parseCPU(cpuRaw.trim());
    }

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
    const wattsClean = wattsStr.replace(/W$/i, '').trim();
    if (wattsClean && wattsClean.toUpperCase() !== 'N/A') {
      watts = parseFloat(wattsClean);
      // Allow up to 500W for high-end NVIDIA GPUs
      if (isNaN(watts) || watts <= 0 || watts > 500) {
        watts = null;
      }
    }

    // Compute fps_per_watt
    const fpsPerWatt = watts && watts > 0 ? fps / watts : null;

    // Generate hash for deduplication (use cleaned CPU string)
    const hashInput = `${cpuRaw}|${testName}|${testFile}|${bitrate}|${fps}|${watts}`;
    const resultHash = await generateHash(hashInput);

    results.push({
      cpu_raw: cpuRaw,
      cpu_brand: hwInfo.brand,
      cpu_model: hwInfo.model,
      cpu_generation: hwInfo.generation,
      architecture: hwInfo.architecture,
      test_name: testName.trim(),
      test_file: testFile.trim(),
      bitrate_kbps: bitrate,
      time_seconds: time,
      avg_fps: fps,
      avg_speed: speed,
      avg_watts: watts,
      fps_per_watt: fpsPerWatt,
      result_hash: resultHash,
      vendor: vendor,
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

export async function parseConcurrencyResults(body: string): Promise<ParsedConcurrencyResult[]> {
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

    const [cpuRawInput, testName, testFile, ...speedParts] = parts;

    // Clean CPU string: strip frequency suffix and normalize markers
    const cpuRaw = normalizeCPUString(stripFrequencySuffix(cpuRawInput.trim()));

    // Detect vendor and parse hardware info appropriately
    const vendor = detectVendor(cpuRaw);
    let hwInfo: { brand: string | null; model: string | null; generation: number | null; architecture: string | null };

    if (vendor === 'nvidia') {
      hwInfo = parseNvidiaGPU(cpuRaw.trim());
    } else if (isIntelArc(cpuRaw)) {
      hwInfo = parseIntelArc(cpuRaw.trim());
    } else {
      hwInfo = parseCPU(cpuRaw.trim());
    }

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

    // Generate hash (use cleaned CPU string)
    const hashInput = `${cpuRaw}|${testName}|${testFile}|${speeds.join(',')}`;
    const resultHash = await generateHash(hashInput);

    results.push({
      cpu_raw: cpuRaw,
      cpu_brand: hwInfo.brand,
      cpu_model: hwInfo.model,
      cpu_generation: hwInfo.generation,
      architecture: hwInfo.architecture,
      test_name: testName.trim(),
      test_file: testFile.trim(),
      speeds_json: JSON.stringify(speeds),
      max_concurrency: maxConcurrency,
      result_hash: resultHash,
      vendor: vendor,
    });
  }

  return results;
}
