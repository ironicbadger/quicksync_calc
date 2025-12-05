-- QuickSync Benchmark Database Schema
-- For use with Turso (libSQL) or SQLite

-- Main benchmark results table
CREATE TABLE IF NOT EXISTS benchmark_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    submitter_id TEXT,              -- Optional user-provided identifier (Phoronix model)

    -- CPU info
    cpu_raw TEXT NOT NULL,          -- Full CPU string from /proc/cpuinfo
    cpu_brand TEXT,                 -- Extracted: i3, i5, i7, i9, Ultra 5, Ultra 7, etc.
    cpu_model TEXT,                 -- Extracted: 12500, 285K, etc.
    cpu_generation INTEGER,         -- Parsed generation number (legacy CPUs only)
    architecture TEXT,              -- Looked up from cpu_architectures: Alder Lake, Arrow Lake, etc.

    -- Test parameters
    test_name TEXT NOT NULL,        -- h264_1080p, h264_4k, hevc_8bit, hevc_4k_10bit, h264_1080p_cpu
    test_file TEXT NOT NULL,        -- ribblehead_1080p_h264, ribblehead_4k_h264, etc.

    -- Results
    bitrate_kbps INTEGER NOT NULL,
    time_seconds REAL NOT NULL,
    avg_fps REAL NOT NULL,
    avg_speed REAL,                 -- Can be NULL for CPU tests
    avg_watts REAL,                 -- Can be NULL for CPU tests
    fps_per_watt REAL,              -- Computed: avg_fps / avg_watts

    -- Deduplication & future-proofing
    result_hash TEXT UNIQUE NOT NULL,  -- SHA256 of (cpu_raw + test_name + test_file + bitrate + fps + watts)
    vendor TEXT DEFAULT 'intel',       -- For future AMD/NVIDIA support

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Concurrency benchmark results table (from PR #10)
CREATE TABLE IF NOT EXISTS concurrency_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    submitter_id TEXT,              -- Optional user-provided identifier

    -- CPU info (same structure as benchmark_results)
    cpu_raw TEXT NOT NULL,
    cpu_brand TEXT,
    cpu_model TEXT,
    cpu_generation INTEGER,
    architecture TEXT,

    -- Test parameters
    test_name TEXT NOT NULL,        -- h264_1080p, hevc_8bit, etc.
    test_file TEXT NOT NULL,

    -- Concurrency results
    speeds_json TEXT NOT NULL,      -- JSON array: [7.02, 4.04, 2.51, 1.86, 1.47, 1.14, 0.95]
    max_concurrency INTEGER NOT NULL, -- Highest concurrency level maintaining >= 1.0x speed

    -- Deduplication & future-proofing
    result_hash TEXT UNIQUE NOT NULL,
    vendor TEXT DEFAULT 'intel',

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- CPU architecture lookup table
-- Maps CPU strings to architecture metadata for proper sorting and codec capability display
CREATE TABLE IF NOT EXISTS cpu_architectures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,           -- Regex pattern to match CPU string
    architecture TEXT NOT NULL,      -- Human-readable: "Alder Lake", "Arrow Lake"
    codename TEXT,                   -- Short code: "ADL", "ARL"
    release_year INTEGER NOT NULL,
    release_quarter INTEGER,         -- 1-4
    sort_order INTEGER NOT NULL,     -- For chronological sorting

    -- Hardware codec ENCODING capabilities (from Wikipedia Quick Sync chart)
    h264_encode BOOLEAN DEFAULT 1,
    hevc_8bit_encode BOOLEAN DEFAULT 0,
    hevc_10bit_encode BOOLEAN DEFAULT 0,
    vp9_encode BOOLEAN DEFAULT 0,
    av1_encode BOOLEAN DEFAULT 0,

    -- Integrated GPU info (for generation detail pages)
    igpu_name TEXT,                  -- "Intel UHD 630", "Intel Xe Graphics", "Arc Graphics"
    igpu_codename TEXT,              -- "Gen9.5", "Xe-LP", "Xe-LPG"
    process_nm TEXT,                 -- "14nm", "Intel 7", "Intel 4" (TEXT for marketing names)
    max_p_cores INTEGER,             -- Max performance cores for this architecture
    max_e_cores INTEGER,             -- Max efficiency cores (NULL for pre-Alder Lake)
    tdp_range TEXT,                  -- "35-125W", "15-45W"
    die_layout TEXT,                 -- "Monolithic", "Hybrid (P+E cores)", "Chiplet (4 tiles)"
    gpu_eu_count TEXT,               -- "24 EU", "32 EU", "128 EU"

    -- Vendor support
    vendor TEXT DEFAULT 'intel',

    UNIQUE(pattern, vendor)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_results_cpu_generation ON benchmark_results(cpu_generation);
CREATE INDEX IF NOT EXISTS idx_results_architecture ON benchmark_results(architecture);
CREATE INDEX IF NOT EXISTS idx_results_test_name ON benchmark_results(test_name);
CREATE INDEX IF NOT EXISTS idx_results_submitter ON benchmark_results(submitter_id);
CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON benchmark_results(submitted_at);
CREATE INDEX IF NOT EXISTS idx_results_vendor ON benchmark_results(vendor);

CREATE INDEX IF NOT EXISTS idx_concurrency_cpu_generation ON concurrency_results(cpu_generation);
CREATE INDEX IF NOT EXISTS idx_concurrency_architecture ON concurrency_results(architecture);
CREATE INDEX IF NOT EXISTS idx_concurrency_test_name ON concurrency_results(test_name);
CREATE INDEX IF NOT EXISTS idx_concurrency_submitter ON concurrency_results(submitter_id);
CREATE INDEX IF NOT EXISTS idx_concurrency_vendor ON concurrency_results(vendor);

CREATE INDEX IF NOT EXISTS idx_arch_pattern ON cpu_architectures(pattern);
CREATE INDEX IF NOT EXISTS idx_arch_sort_order ON cpu_architectures(sort_order);
CREATE INDEX IF NOT EXISTS idx_arch_vendor ON cpu_architectures(vendor);

-- CPU features table for per-CPU metadata (ECC support, etc.)
-- Tracks features that vary by specific CPU model, not by architecture
CREATE TABLE IF NOT EXISTS cpu_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu_raw TEXT UNIQUE NOT NULL,   -- Exact CPU string from benchmark (matches benchmark_results.cpu_raw)
    ecc_support BOOLEAN DEFAULT 0,  -- Whether this CPU supports ECC memory
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cpu_features_cpu_raw ON cpu_features(cpu_raw);
