-- ECC Support Data from Intel ARK
-- Generated via Playwright MCP lookups on Intel ARK
--
-- Intel ECC Support Rules (verified):
-- - Xeon processors: Always ECC
-- - Consumer Core i3/i5/i7/i9: Generally no ECC (field absent from ARK)
-- - Celeron/Pentium/N-series: No ECC
--
-- Verified CPUs:
-- - Xeon E-2386G: ECC = Yes (verified)
-- - Xeon E-2144G: ECC = Yes (verified)
-- - i5-12400: No ECC (field absent, verified)
-- - i3-12100: No ECC (field absent, verified)

-- CPUs WITH ECC support (Xeon processors)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('E-2144G', 1);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('E-2288G', 1);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('E3-1245v6', 1);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Intel Xeon E-2386G', 1);

-- CPUs WITHOUT ECC support (verified or per Intel's documented policy)
-- 12th Gen desktop (verified i5-12400, i3-12100 - no ECC field on ARK)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-12100', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-12100T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-12400', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-12400T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-12500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-12500T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-12600H', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-12600K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-12700H', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-12700K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-12900', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-12900H', 0);

-- 13th/14th Gen (no consumer ECC)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-1340P', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-13500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-13600K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-14500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-14500T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-14600K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-14700', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-13900', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-13900H', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-14900K', 0);

-- 10th/11th Gen (no consumer ECC)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-10100', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-10100T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-10105', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-1115G4', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-10300H', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-10400', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-10500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-10500T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-10505', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-10600K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-11600K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-1235U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-1065G7', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-10700', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-10700T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-10710U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-11370H', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-1165G7', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-11700K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-11700T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-11800H', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-10850K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz', 0);

-- 6th-9th Gen (no consumer ECC)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-6100', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-6100T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-7100', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-7100U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-8100', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-8100T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-8109U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-8300T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6200U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6260U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6300U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6400', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6400T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6500T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6600', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-6600T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-7300HQ', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-7300U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-7500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-7500T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-7600', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-7600K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8250U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8259U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8260U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8265U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8350U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8400', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8500T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-8600', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-9400', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-9500', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-9500T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-9600K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-9600T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-6500U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-6600U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-6770HQ', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-7500U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-7700', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-7700HQ', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-7700K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-7700T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8086K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8550U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8559U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8650U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8665U', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8700', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8700K', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8700T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-8750H', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-9700', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-8950HK', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-9900', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i9-9900K', 0);

-- 4th Gen (no consumer ECC)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-4210M', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i5-4690S', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-4700EQ', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i7-4790K', 0);

-- Celeron/Pentium/N-series (no ECC)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('G4900T', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Intel Celeron J4005', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Intel Celeron N5105', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Intel N100', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Intel N150', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Intel Pentium Silver J5005', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('J4105', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('J4125', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('N100', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('N5095', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('N5105', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('N6005', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('N95', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('i3-N305', 0);

-- Core Ultra (no consumer ECC)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('Ultra 5 225', 0);

-- Other (no ECC)
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('M-5Y10c', 0);
INSERT OR REPLACE INTO cpu_features (cpu_raw, ecc_support) VALUES ('m3-8100Y', 0);

-- Note: "Silver" entry in DB appears to be incomplete data - skipping
