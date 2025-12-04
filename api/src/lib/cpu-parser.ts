/**
 * CPU parsing utilities for Intel processors.
 * Handles both legacy naming (i5-12500) and new naming (Core Ultra 7 265K).
 */

export interface CPUInfo {
  brand: string | null;      // i3, i5, i7, i9, Ultra 5, Ultra 7, etc.
  model: string | null;      // 12500, 265K, etc.
  generation: number | null; // 12, 13, 14 for legacy naming
  architecture: string | null;
}

interface ArchitecturePattern {
  pattern: RegExp;
  architecture: string;
  codename: string;
  releaseYear: number;
  sortOrder: number;
}

// CPU architecture patterns for runtime matching
const CPU_PATTERNS: ArchitecturePattern[] = [
  { pattern: /i[3579]-2\d{3}/, architecture: 'Sandy Bridge', codename: 'SNB', releaseYear: 2011, sortOrder: 20 },
  { pattern: /i[3579]-3\d{3}/, architecture: 'Ivy Bridge', codename: 'IVB', releaseYear: 2012, sortOrder: 30 },
  { pattern: /i[3579]-4\d{3}/, architecture: 'Haswell', codename: 'HSW', releaseYear: 2013, sortOrder: 40 },
  { pattern: /i[3579]-5\d{3}/, architecture: 'Broadwell', codename: 'BDW', releaseYear: 2014, sortOrder: 50 },
  { pattern: /i[3579]-6\d{3}/, architecture: 'Skylake', codename: 'SKL', releaseYear: 2015, sortOrder: 60 },
  { pattern: /i[3579]-7\d{3}/, architecture: 'Kaby Lake', codename: 'KBL', releaseYear: 2017, sortOrder: 70 },
  { pattern: /i[3579]-8\d{3}/, architecture: 'Coffee Lake', codename: 'CFL', releaseYear: 2018, sortOrder: 80 },
  { pattern: /i[3579]-9\d{3}/, architecture: 'Coffee Lake Refresh', codename: 'CFL-R', releaseYear: 2019, sortOrder: 90 },
  { pattern: /i[3579]-10\d{3}[A-Z]?$/, architecture: 'Comet Lake', codename: 'CML', releaseYear: 2020, sortOrder: 100 },
  { pattern: /i[3579]-10\d{2}G/, architecture: 'Ice Lake', codename: 'ICL', releaseYear: 2019, sortOrder: 95 },
  { pattern: /i[3579]-11\d{2}G/, architecture: 'Tiger Lake', codename: 'TGL', releaseYear: 2020, sortOrder: 105 },
  { pattern: /i[3579]-11\d{3}/, architecture: 'Rocket Lake', codename: 'RKL', releaseYear: 2021, sortOrder: 110 },
  { pattern: /i[3579]-12\d{3}/, architecture: 'Alder Lake', codename: 'ADL', releaseYear: 2021, sortOrder: 120 },
  { pattern: /i[3579]-13\d{3}/, architecture: 'Raptor Lake', codename: 'RPL', releaseYear: 2022, sortOrder: 130 },
  { pattern: /i[3579]-14\d{3}/, architecture: 'Raptor Lake Refresh', codename: 'RPL-R', releaseYear: 2023, sortOrder: 140 },
  { pattern: /Ultra [3579] 1\d{2}[HUP]?/, architecture: 'Meteor Lake', codename: 'MTL', releaseYear: 2023, sortOrder: 150 },
  { pattern: /Ultra [3579] 2\d{2}[KFS]/, architecture: 'Arrow Lake', codename: 'ARL', releaseYear: 2024, sortOrder: 200 },
  { pattern: /Ultra [3579] 2\d{2}[VU]/, architecture: 'Lunar Lake', codename: 'LNL', releaseYear: 2024, sortOrder: 210 },
  { pattern: /Xeon.*E3-1[23]\d{2}/, architecture: 'Xeon E3', codename: 'Various', releaseYear: 2015, sortOrder: 55 },
  { pattern: /Xeon.*E-2[123]\d{2}/, architecture: 'Xeon E', codename: 'CFL', releaseYear: 2018, sortOrder: 85 },
  { pattern: /Pentium.*G[567]\d{3}/, architecture: 'Pentium Gold', codename: 'CFL', releaseYear: 2018, sortOrder: 82 },
  { pattern: /Celeron.*G[4567]\d{3}/, architecture: 'Celeron', codename: 'Various', releaseYear: 2017, sortOrder: 65 },
  { pattern: /N[456]\d{3}/, architecture: 'Jasper Lake', codename: 'JSL', releaseYear: 2021, sortOrder: 108 }, // N4xxx, N5xxx, N6xxx (e.g., N5105, N5095, N6005)
  { pattern: /N[12]\d{2}/, architecture: 'Alder Lake-N', codename: 'ADL-N', releaseYear: 2023, sortOrder: 125 },
];

/**
 * Parse CPU string to extract brand, model, and generation.
 */
export function parseCPU(cpuRaw: string): CPUInfo {
  let brand: string | null = null;
  let model: string | null = null;
  let generation: number | null = null;
  let architecture: string | null = null;

  // Extract brand
  const brandMatch = cpuRaw.match(/(i[3579]|Ultra [3579])/);
  if (brandMatch) {
    brand = brandMatch[1];
  }

  // Extract model for legacy naming (i5-12500)
  const legacyMatch = cpuRaw.match(/i\d-(\S+)/);
  if (legacyMatch) {
    model = legacyMatch[1];
  } else {
    // Extract model for new naming (Ultra 7 265K)
    const ultraMatch = cpuRaw.match(/Ultra \d (\d+[A-Z]?)/);
    if (ultraMatch) {
      model = ultraMatch[1];
    }
  }

  // Extract generation for legacy naming
  if (model) {
    const genMatch = model.match(/^(\d{4,5})/);
    if (genMatch) {
      const genStr = genMatch[1];
      generation = parseInt(genStr.slice(0, -3), 10);
    }
  }

  // Look up architecture
  for (const { pattern, architecture: arch } of CPU_PATTERNS) {
    if (pattern.test(cpuRaw)) {
      architecture = arch;
      break;
    }
  }

  return { brand, model, generation, architecture };
}

/**
 * Get all known architectures for filtering UI.
 */
export function getArchitectures(): string[] {
  return [...new Set(CPU_PATTERNS.map(p => p.architecture))].sort();
}
