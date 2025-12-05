-- Intel CPU Architecture Seed Data
-- Source: https://en.wikipedia.org/wiki/Intel_Quick_Sync_Video
--
-- Pattern: Regex to match CPU string from /proc/cpuinfo
-- Codec booleans: 1 = hardware ENCODE supported, 0 = not supported (decode may still work)

-- Clear existing data
DELETE FROM cpu_architectures WHERE vendor = 'intel';

-- Sandy Bridge (2nd gen) - H.264 decode only, no hardware encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-2\d{3}', 'Sandy Bridge', 'SNB', 2011, 1, 20, 0, 0, 0, 0, 0,
    'Intel HD Graphics 2000/3000', 'Gen6', '32nm', 4, NULL, '35-95W', 'Monolithic', '6-12 EU', 'intel');

-- Ivy Bridge (3rd gen) - H.264 encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-3\d{3}', 'Ivy Bridge', 'IVB', 2012, 2, 30, 1, 0, 0, 0, 0,
    'Intel HD Graphics 2500/4000', 'Gen7', '22nm', 4, NULL, '35-77W', 'Monolithic', '6-16 EU', 'intel');

-- Haswell (4th gen) - H.264 encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-4\d{3}', 'Haswell', 'HSW', 2013, 2, 40, 1, 0, 0, 0, 0,
    'Intel HD Graphics 4600', 'Gen7.5', '22nm', 4, NULL, '35-84W', 'Monolithic', '20 EU', 'intel');

-- Broadwell (5th gen) - H.264 encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-5\d{3}', 'Broadwell', 'BDW', 2014, 4, 50, 1, 0, 0, 0, 0,
    'Intel HD Graphics 5500/6000', 'Gen8', '14nm', 4, NULL, '15-65W', 'Monolithic', '24-48 EU', 'intel');

-- Skylake (6th gen) - H.264 encode, HEVC decode only
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-6\d{3}', 'Skylake', 'SKL', 2015, 3, 60, 1, 0, 0, 0, 0,
    'Intel HD Graphics 530', 'Gen9', '14nm', 4, NULL, '35-91W', 'Monolithic', '24 EU', 'intel');

-- Kaby Lake (7th gen) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-7\d{3}', 'Kaby Lake', 'KBL', 2017, 1, 70, 1, 1, 0, 0, 0,
    'Intel HD Graphics 630', 'Gen9.5', '14nm', 4, NULL, '35-91W', 'Monolithic', '24 EU', 'intel');

-- Coffee Lake (8th gen) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-8\d{3}', 'Coffee Lake', 'CFL', 2018, 4, 80, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 630', 'Gen9.5', '14nm', 6, NULL, '35-95W', 'Monolithic', '24 EU', 'intel');

-- Coffee Lake Refresh (9th gen) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-9\d{3}', 'Coffee Lake Refresh', 'CFL-R', 2019, 2, 90, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 630', 'Gen9.5', '14nm', 8, NULL, '35-95W', 'Monolithic', '24 EU', 'intel');

-- Comet Lake (10th gen desktop) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-10\d{3}[A-Z]?$', 'Comet Lake', 'CML', 2020, 2, 100, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 630', 'Gen9.5', '14nm', 10, NULL, '35-125W', 'Monolithic', '24 EU', 'intel');

-- Ice Lake (10th gen mobile - ends in G) - H.264 + HEVC 8-bit encode (10-bit decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-10\d{2}G', 'Ice Lake', 'ICL', 2019, 3, 95, 1, 1, 0, 0, 0,
    'Intel Iris Plus Graphics', 'Gen11', '10nm', 4, NULL, '9-28W', 'Monolithic', '64 EU', 'intel');

-- Tiger Lake (11th gen mobile - ends in G) - Full encode: H.264, HEVC 8/10-bit, VP9 (AV1 decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-11\d{2}G', 'Tiger Lake', 'TGL', 2020, 3, 105, 1, 1, 1, 1, 0,
    'Intel Iris Xe Graphics', 'Xe-LP', '10nm SuperFin', 4, NULL, '12-28W', 'Monolithic', '96 EU', 'intel');

-- Rocket Lake (11th gen desktop) - Full encode: H.264, HEVC 8/10-bit, VP9 (AV1 decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[3579]-11\d{3}', 'Rocket Lake', 'RKL', 2021, 1, 110, 1, 1, 1, 1, 0,
    'Intel UHD Graphics 750', 'Xe', '14nm', 8, NULL, '35-125W', 'Monolithic', '32 EU', 'intel');

-- Alder Lake (12th gen) - Split by die variant
-- Lower-tier i3/i5 (i3-12100, i5-12400, i5-12500) use ADL-S E0 die with UHD 730 (24 EU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[35]-12[1-5]\d{2}[^K]?$', 'Alder Lake', 'ADL-S (E0)', 2022, 1, 119, 1, 1, 1, 1, 0,
    'Intel UHD Graphics 730', 'Xe-LP', 'Intel 7', 6, 0, '35-65W', 'P-cores only (no E-cores)', '24 EU', 'intel');

-- Higher-tier 12th gen (i5-12600K+, i7, i9) use ADL-S C0 die with UHD 770 (32 EU) and hybrid architecture
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[579]-12[6-9]\d{2}', 'Alder Lake', 'ADL-S (C0)', 2021, 4, 120, 1, 1, 1, 1, 0,
    'Intel UHD Graphics 770', 'Xe-LP', 'Intel 7', 8, 8, '65-125W', 'Hybrid (P+E cores)', '32 EU', 'intel');

-- Raptor Lake (13th gen) - Split by die variant
-- Lower-tier i3/i5 (i3-13100, i5-13400, i5-13500) actually use Alder Lake B0 die with UHD 730 (24 EU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[35]-13[1-5]\d{2}[^K]?$', 'Raptor Lake', 'RPL-S (B0/ADL die)', 2023, 1, 129, 1, 1, 1, 1, 0,
    'Intel UHD Graphics 730', 'Xe-LP', 'Intel 7', 6, 4, '35-65W', 'Hybrid (uses ADL silicon)', '24 EU', 'intel');

-- Higher-tier 13th gen (i5-13600K+, i7, i9) use true Raptor Lake die with UHD 770 (32 EU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[579]-13[6-9]\d{2}', 'Raptor Lake', 'RPL-S', 2022, 4, 130, 1, 1, 1, 1, 0,
    'Intel UHD Graphics 770', 'Xe-LP', 'Intel 7', 8, 16, '65-125W', 'Hybrid (P+E cores)', '32 EU', 'intel');

-- Raptor Lake Refresh (14th gen) - Split by die variant
-- Lower-tier i3/i5 (i3-14100, i5-14400, i5-14500) use Alder Lake B0 die with UHD 730 (24 EU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[35]-14[1-5]\d{2}[^K]?$', 'Raptor Lake Refresh', 'RPL-R (B0/ADL die)', 2024, 1, 139, 1, 1, 1, 1, 0,
    'Intel UHD Graphics 730', 'Xe-LP', 'Intel 7', 6, 4, '35-65W', 'Hybrid (uses ADL silicon)', '24 EU', 'intel');

-- Higher-tier 14th gen (i5-14600K+, i7, i9) use true Raptor Lake die with UHD 770 (32 EU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i[579]-14[6-9]\d{2}', 'Raptor Lake Refresh', 'RPL-R', 2023, 4, 140, 1, 1, 1, 1, 0,
    'Intel UHD Graphics 770', 'Xe-LP', 'Intel 7', 8, 16, '65-125W', 'Hybrid (P+E cores)', '32 EU', 'intel');

-- Intel Arc Alchemist (discrete GPU) - FULL encode including AV1
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Arc A\d{3}', 'Arc Alchemist', 'DG2', 2022, 4, 145, 1, 1, 1, 1, 1,
    'Intel Arc A-Series', 'Xe-HPG', 'TSMC N6', NULL, NULL, '75-225W', 'Discrete GPU (ACM-G10/G11)', '128-512 EU', 'intel');

-- Intel Arc Battlemage (discrete GPU) - FULL encode including AV1
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Arc B\d{3}', 'Arc Battlemage', 'BMG', 2024, 4, 147, 1, 1, 1, 1, 1,
    'Intel Arc B-Series', 'Xe2-HPG', 'TSMC N4', NULL, NULL, '150W', 'Discrete GPU (BMG-G21)', '160 EU', 'intel');

-- Meteor Lake (Core Ultra Series 1) - FULL encode including AV1
-- Pattern matches: Core Ultra 5 125H, Core Ultra 7 155H, Core Ultra 9 185H, etc.
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Ultra [3579] 1\d{2}[HUP]?', 'Meteor Lake', 'MTL', 2023, 4, 150, 1, 1, 1, 1, 1,
    'Intel Arc Graphics', 'Xe-LPG', 'Intel 4', 6, 8, '15-45W', 'Chiplet (4 tiles: Compute, SoC, GFX, I/O)', '128 EU', 'intel');

-- Arrow Lake (Core Ultra Series 2 desktop) - FULL encode including AV1
-- Pattern matches: Core Ultra 5 245K, Core Ultra 7 265K, Core Ultra 9 285K
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Ultra [3579] 2\d{2}[KFS]', 'Arrow Lake', 'ARL', 2024, 4, 200, 1, 1, 1, 1, 1,
    'Intel Arc Graphics', 'Xe2-LPG', 'Intel 20A / TSMC N3B', 8, 16, '125W', 'Chiplet (Compute + SoC tiles)', '64 EU', 'intel');

-- Lunar Lake (Core Ultra Series 2 mobile) - FULL encode including AV1
-- Pattern matches: Core Ultra 5 225V, Core Ultra 7 255V, Core Ultra 7 256V
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Ultra [3579] 2\d{2}[VU]', 'Lunar Lake', 'LNL', 2024, 3, 210, 1, 1, 1, 1, 1,
    'Intel Arc Graphics', 'Xe2-LPG', 'TSMC N3B', 4, 4, '17-30W', 'Foveros 3D stacked (on-package LPDDR5X)', '64 EU', 'intel');

-- Xeon patterns (common in servers running Jellyfin)
-- Xeon E3 (Haswell through Coffee Lake era)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Xeon.*E3-1[23]\d{2}', 'Xeon E3', 'Various', 2015, 1, 55, 1, 0, 0, 0, 0,
    'Intel HD Graphics P530/P630', 'Gen9', '14nm', 4, NULL, '35-80W', 'Monolithic', '24 EU', 'intel');

-- Xeon E-2100/2200/2300 series (Coffee Lake era iGPU support)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Xeon.*E-2[123]\d{2}', 'Xeon E', 'CFL', 2018, 4, 85, 1, 1, 0, 0, 0,
    'Intel UHD Graphics P630', 'Gen9.5', '14nm', 8, NULL, '35-95W', 'Monolithic', '24 EU', 'intel');

-- Pentium Gold (8th gen+ with iGPU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Pentium.*G[567]\d{3}', 'Pentium Gold', 'CFL', 2018, 4, 82, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 610', 'Gen9.5', '14nm', 2, NULL, '35-58W', 'Monolithic', '24 EU', 'intel');

-- Celeron (various generations with iGPU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Celeron.*G[4567]\d{3}', 'Celeron', 'Various', 2017, 1, 65, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 610', 'Gen9.5', '14nm', 2, NULL, '35-58W', 'Monolithic', '12 EU', 'intel');

-- Intel N-series (Alder Lake-N) - found in mini PCs
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('N[12]\d{2}', 'Alder Lake-N', 'ADL-N', 2023, 1, 125, 1, 1, 1, 1, 0,
    'Intel UHD Graphics', 'Xe-LP', 'Intel 7', 0, 8, '6-15W', 'E-cores only (efficient)', '32 EU', 'intel');

-- Intel Processor N-series (newer naming)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Processor N\d{3}', 'Alder Lake-N', 'ADL-N', 2023, 1, 126, 1, 1, 1, 1, 0,
    'Intel UHD Graphics', 'Xe-LP', 'Intel 7', 0, 8, '6-15W', 'E-cores only (efficient)', '32 EU', 'intel');

-- Intel Core i3-N series (Alder Lake-N)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('i3-N\d{3}', 'Alder Lake-N', 'ADL-N', 2023, 1, 125, 1, 1, 1, 1, 0,
    'Intel UHD Graphics', 'Xe-LP', 'Intel 7', 0, 8, '6-15W', 'E-cores only (efficient)', '32 EU', 'intel');

-- Intel N95/N97/N100 (Alder Lake-N, 2-digit model numbers)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('N\d{2}$', 'Alder Lake-N', 'ADL-N', 2023, 1, 125, 1, 1, 1, 1, 0,
    'Intel UHD Graphics', 'Xe-LP', 'Intel 7', 0, 4, '6-15W', 'E-cores only (efficient)', '24-32 EU', 'intel');

-- Gemini Lake (J4xxx, J5xxx - 2017-2019)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('J[456]\d{3}', 'Gemini Lake', 'GLK', 2017, 4, 72, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 600', 'Gen9.5', '14nm', 4, NULL, '6-10W', 'Monolithic (Atom)', '12-18 EU', 'intel');

-- Xeon E3 v6 (Kaby Lake)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Xeon.*E3-\d{4}\s*v6', 'Kaby Lake', 'KBL', 2017, 1, 70, 1, 1, 0, 0, 0,
    'Intel HD Graphics P630', 'Gen9.5', '14nm', 4, NULL, '35-73W', 'Monolithic', '24 EU', 'intel');

-- Xeon E3 v5 (Skylake)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Xeon.*E3-\d{4}\s*v5', 'Skylake', 'SKL', 2015, 3, 60, 1, 0, 0, 0, 0,
    'Intel HD Graphics P530', 'Gen9', '14nm', 4, NULL, '35-80W', 'Monolithic', '24 EU', 'intel');

-- Xeon E3 v4 (Broadwell)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Xeon.*E3-\d{4}\s*v4', 'Broadwell', 'BDW', 2015, 2, 50, 1, 0, 0, 0, 0,
    'Intel HD Graphics P5700', 'Gen8', '14nm', 4, NULL, '35-65W', 'Monolithic', '48 EU', 'intel');

-- Xeon E3 v3 (Haswell)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Xeon.*E3-\d{4}\s*v3', 'Haswell', 'HSW', 2013, 2, 40, 1, 0, 0, 0, 0,
    'Intel HD Graphics P4600', 'Gen7.5', '22nm', 4, NULL, '35-84W', 'Monolithic', '20 EU', 'intel');

-- Xeon E-21xx/22xx/23xx standalone (matches E-2144G, E-2288G without "Xeon" prefix)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('E-2[123]\d{2}G?', 'Xeon E', 'CFL', 2018, 4, 85, 1, 1, 0, 0, 0,
    'Intel UHD Graphics P630', 'Gen9.5', '14nm', 8, NULL, '35-95W', 'Monolithic', '24 EU', 'intel');

-- Pentium G4xxx (Coffee Lake era)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('G4\d{3}[T]?', 'Coffee Lake', 'CFL', 2018, 4, 80, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 610', 'Gen9.5', '14nm', 2, NULL, '35-54W', 'Monolithic', '24 EU', 'intel');

-- Core m3-8100Y (Amber Lake)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('m3-\d{4}Y', 'Amber Lake', 'AML-Y', 2018, 3, 83, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 615', 'Gen9.5', '14nm', 2, NULL, '5W', 'Monolithic (ultra-mobile)', '24 EU', 'intel');

-- Core M-5Yxx (Broadwell-Y)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('M-5Y\d{2}', 'Broadwell', 'BDW-Y', 2014, 4, 50, 1, 0, 0, 0, 0,
    'Intel HD Graphics 5300', 'Gen8', '14nm', 2, NULL, '4.5W', 'Monolithic (ultra-mobile)', '24 EU', 'intel');

-- Pentium Silver (Gemini Lake)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Pentium.*Silver', 'Gemini Lake', 'GLK', 2017, 4, 72, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 605', 'Gen9.5', '14nm', 4, NULL, '6-10W', 'Monolithic (Atom)', '18 EU', 'intel');

-- Silver Jxxxx/Nxxxx (Gemini Lake, standalone)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode,
    igpu_name, igpu_codename, process_nm, max_p_cores, max_e_cores, tdp_range, die_layout, gpu_eu_count, vendor) VALUES
('Silver.*\d{4}', 'Gemini Lake', 'GLK', 2017, 4, 72, 1, 1, 0, 0, 0,
    'Intel UHD Graphics 605', 'Gen9.5', '14nm', 4, NULL, '6-10W', 'Monolithic (Atom)', '18 EU', 'intel');
