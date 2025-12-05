-- Database cleanup script for CPU data validation
-- Run this against the Turso database to clean up existing junk data

-- 1. Delete entries with virtual/emulated CPUs
DELETE FROM benchmark_results
WHERE cpu_raw LIKE '%QEMU%'
   OR cpu_raw LIKE '%Virtual%'
   OR cpu_raw LIKE '%VMware%'
   OR cpu_raw LIKE '%VirtualBox%'
   OR cpu_raw LIKE '%Hyper-V%'
   OR cpu_raw LIKE '% KVM %';

-- 2. Normalize CPU strings: remove Intel(R), Core(TM), CPU, and frequency suffix
-- This requires multiple UPDATE statements since SQLite lacks regex replace

-- Remove "@ X.XXGHz" frequency suffix
UPDATE benchmark_results
SET cpu_raw = TRIM(SUBSTR(cpu_raw, 1, INSTR(cpu_raw, ' @') - 1))
WHERE cpu_raw LIKE '% @%GHz%';

-- Remove "(R)" markers
UPDATE benchmark_results
SET cpu_raw = REPLACE(cpu_raw, '(R)', '')
WHERE cpu_raw LIKE '%(R)%';

-- Remove "(TM)" markers
UPDATE benchmark_results
SET cpu_raw = REPLACE(cpu_raw, '(TM)', '')
WHERE cpu_raw LIKE '%(TM)%';

-- Remove "CPU" word
UPDATE benchmark_results
SET cpu_raw = REPLACE(cpu_raw, ' CPU ', ' ')
WHERE cpu_raw LIKE '% CPU %';

-- Remove trailing "CPU"
UPDATE benchmark_results
SET cpu_raw = TRIM(SUBSTR(cpu_raw, 1, LENGTH(cpu_raw) - 3))
WHERE cpu_raw LIKE '% CPU';

-- Collapse multiple spaces
UPDATE benchmark_results
SET cpu_raw = REPLACE(cpu_raw, '  ', ' ')
WHERE cpu_raw LIKE '%  %';

-- Final trim
UPDATE benchmark_results
SET cpu_raw = TRIM(cpu_raw);

-- 3. Delete entries with NULL architecture (unrecognized CPUs)
-- Review these first before deleting!
-- SELECT DISTINCT cpu_raw, architecture FROM benchmark_results WHERE architecture IS NULL;

DELETE FROM benchmark_results
WHERE architecture IS NULL;

-- 4. Verify cleanup results
SELECT 'Remaining entries:' AS status, COUNT(*) AS count FROM benchmark_results;
SELECT 'Distinct CPUs:' AS status, COUNT(DISTINCT cpu_raw) AS count FROM benchmark_results;
SELECT 'Sample CPU names:' AS status, cpu_raw FROM benchmark_results GROUP BY cpu_raw LIMIT 10;
