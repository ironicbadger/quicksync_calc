-- Intel CPU Architecture Seed Data
-- Source: https://en.wikipedia.org/wiki/Intel_Quick_Sync_Video
--
-- Pattern: Regex to match CPU string from /proc/cpuinfo
-- Codec booleans: 1 = hardware ENCODE supported, 0 = not supported (decode may still work)

-- Clear existing data
DELETE FROM cpu_architectures WHERE vendor = 'intel';

-- Sandy Bridge (2nd gen) - H.264 decode only, no hardware encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-2\d{3}', 'Sandy Bridge', 'SNB', 2011, 1, 20, 0, 0, 0, 0, 0, 'intel');

-- Ivy Bridge (3rd gen) - H.264 encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-3\d{3}', 'Ivy Bridge', 'IVB', 2012, 2, 30, 1, 0, 0, 0, 0, 'intel');

-- Haswell (4th gen) - H.264 encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-4\d{3}', 'Haswell', 'HSW', 2013, 2, 40, 1, 0, 0, 0, 0, 'intel');

-- Broadwell (5th gen) - H.264 encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-5\d{3}', 'Broadwell', 'BDW', 2014, 4, 50, 1, 0, 0, 0, 0, 'intel');

-- Skylake (6th gen) - H.264 encode, HEVC decode only
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-6\d{3}', 'Skylake', 'SKL', 2015, 3, 60, 1, 0, 0, 0, 0, 'intel');

-- Kaby Lake (7th gen) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-7\d{3}', 'Kaby Lake', 'KBL', 2017, 1, 70, 1, 1, 0, 0, 0, 'intel');

-- Coffee Lake (8th gen) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-8\d{3}', 'Coffee Lake', 'CFL', 2018, 4, 80, 1, 1, 0, 0, 0, 'intel');

-- Coffee Lake Refresh (9th gen) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-9\d{3}', 'Coffee Lake Refresh', 'CFL-R', 2019, 2, 90, 1, 1, 0, 0, 0, 'intel');

-- Comet Lake (10th gen desktop) - H.264 + HEVC 8-bit encode
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-10\d{3}[A-Z]?$', 'Comet Lake', 'CML', 2020, 2, 100, 1, 1, 0, 0, 0, 'intel');

-- Ice Lake (10th gen mobile - ends in G) - H.264 + HEVC 8-bit encode (10-bit decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-10\d{2}G', 'Ice Lake', 'ICL', 2019, 3, 95, 1, 1, 0, 0, 0, 'intel');

-- Tiger Lake (11th gen mobile - ends in G) - Full encode: H.264, HEVC 8/10-bit, VP9 (AV1 decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-11\d{2}G', 'Tiger Lake', 'TGL', 2020, 3, 105, 1, 1, 1, 1, 0, 'intel');

-- Rocket Lake (11th gen desktop) - Full encode: H.264, HEVC 8/10-bit, VP9 (AV1 decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-11\d{3}', 'Rocket Lake', 'RKL', 2021, 1, 110, 1, 1, 1, 1, 0, 'intel');

-- Alder Lake (12th gen) - Full encode: H.264, HEVC 8/10-bit, VP9 (AV1 decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-12\d{3}', 'Alder Lake', 'ADL', 2021, 4, 120, 1, 1, 1, 1, 0, 'intel');

-- Raptor Lake (13th gen) - Full encode: H.264, HEVC 8/10-bit, VP9 (AV1 decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-13\d{3}', 'Raptor Lake', 'RPL', 2022, 4, 130, 1, 1, 1, 1, 0, 'intel');

-- Raptor Lake Refresh (14th gen) - Full encode: H.264, HEVC 8/10-bit, VP9 (AV1 decode only)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('i[3579]-14\d{3}', 'Raptor Lake Refresh', 'RPL-R', 2023, 4, 140, 1, 1, 1, 1, 0, 'intel');

-- Intel Arc (discrete GPU) - FULL encode including AV1
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Arc A\d{3}', 'Arc Alchemist', 'DG2', 2022, 4, 145, 1, 1, 1, 1, 1, 'intel');

-- Meteor Lake (Core Ultra Series 1) - FULL encode including AV1
-- Pattern matches: Core Ultra 5 125H, Core Ultra 7 155H, Core Ultra 9 185H, etc.
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Ultra [3579] 1\d{2}[HUP]?', 'Meteor Lake', 'MTL', 2023, 4, 150, 1, 1, 1, 1, 1, 'intel');

-- Arrow Lake (Core Ultra Series 2 desktop) - FULL encode including AV1
-- Pattern matches: Core Ultra 5 245K, Core Ultra 7 265K, Core Ultra 9 285K
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Ultra [3579] 2\d{2}[KFS]', 'Arrow Lake', 'ARL', 2024, 4, 200, 1, 1, 1, 1, 1, 'intel');

-- Lunar Lake (Core Ultra Series 2 mobile) - FULL encode including AV1
-- Pattern matches: Core Ultra 5 225V, Core Ultra 7 255V, Core Ultra 7 256V
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Ultra [3579] 2\d{2}[VU]', 'Lunar Lake', 'LNL', 2024, 3, 210, 1, 1, 1, 1, 1, 'intel');

-- Xeon patterns (common in servers running Jellyfin)
-- Xeon E3 (Haswell through Coffee Lake era)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Xeon.*E3-1[23]\d{2}', 'Xeon E3', 'Various', 2015, 1, 55, 1, 0, 0, 0, 0, 'intel');

-- Xeon E-2100/2200/2300 series (Coffee Lake era iGPU support)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Xeon.*E-2[123]\d{2}', 'Xeon E', 'CFL', 2018, 4, 85, 1, 1, 0, 0, 0, 'intel');

-- Pentium Gold (8th gen+ with iGPU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Pentium.*G[567]\d{3}', 'Pentium Gold', 'CFL', 2018, 4, 82, 1, 1, 0, 0, 0, 'intel');

-- Celeron (various generations with iGPU)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Celeron.*G[4567]\d{3}', 'Celeron', 'Various', 2017, 1, 65, 1, 1, 0, 0, 0, 'intel');

-- Intel N-series (Alder Lake-N) - found in mini PCs
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('N[12]\d{2}', 'Alder Lake-N', 'ADL-N', 2023, 1, 125, 1, 1, 1, 1, 0, 'intel');

-- Intel Processor N-series (newer naming)
INSERT INTO cpu_architectures (pattern, architecture, codename, release_year, release_quarter, sort_order,
    h264_encode, hevc_8bit_encode, hevc_10bit_encode, vp9_encode, av1_encode, vendor) VALUES
('Processor N\d{3}', 'Alder Lake-N', 'ADL-N', 2023, 1, 126, 1, 1, 1, 1, 0, 'intel');
