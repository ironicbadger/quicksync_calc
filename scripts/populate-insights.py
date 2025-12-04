#!/usr/bin/env python3
"""
Populate generation_insights table with analysis for each CPU generation.
Based on benchmark data analysis.
"""

import os
import requests

TURSO_URL = os.environ.get('TURSO_URL')
TURSO_AUTH_TOKEN = os.environ.get('TURSO_AUTH_TOKEN')

# Insights generated based on benchmark data analysis
INSIGHTS = [
    {
        "generation": 6,
        "headline": "The Foundation of Modern Quick Sync",
        "summary": "6th Gen Skylake introduced the refined Quick Sync 6.0 with improved HEVC decode support. With 64 benchmark results averaging 55 FPS, it represents the baseline for modern hardware encoding. Power efficiency data is limited but suggests reasonable consumption for its era.",
        "pros": "Widely available in used market; Solid H.264 encoding; Good Linux support; Low power consumption",
        "cons": "No HEVC encoding support; Lower FPS than newer generations; Limited to older codec profiles",
        "best_for": "Budget builds focused on H.264 only; Legacy system upgrades; Low-power home servers",
        "vs_previous": "First generation recommended for modern Quick Sync usage. Earlier generations lack essential codec support."
    },
    {
        "generation": 7,
        "headline": "HEVC Encoding Arrives",
        "summary": "7th Gen Kaby Lake was a game-changer, adding HEVC/H.265 8-bit hardware encoding. With 84 results averaging 65 FPS at ~9W, it offers an 18% performance boost over Skylake while maintaining excellent efficiency. This is the minimum recommended generation for HEVC workflows.",
        "pros": "First gen with HEVC 8-bit encoding; Good power efficiency (~9W avg); Strong community benchmark data; Excellent value in used market",
        "cons": "No HEVC 10-bit encoding; No VP9 encoding support; Showing age for 4K workflows",
        "best_for": "Entry-level Plex/Jellyfin servers; Users needing HEVC on a budget; 1080p-focused transcoding",
        "vs_previous": "18% faster than 6th Gen with the critical addition of HEVC encoding. Worth the upgrade if HEVC is needed."
    },
    {
        "generation": 8,
        "headline": "The Sweet Spot for Value",
        "summary": "8th Gen Coffee Lake remains extremely popular with 179 benchmark submissions - the most of any generation. Averaging 70 FPS at ~9W, it delivers consistent performance. The i5-8500 is particularly well-represented, suggesting strong community adoption for media servers.",
        "pros": "Largest benchmark dataset (highest confidence); Excellent used market availability; Proven reliability; Great performance per dollar",
        "cons": "Still limited to HEVC 8-bit; No 10-bit HDR encoding; Similar codec support to 7th Gen",
        "best_for": "Dedicated Plex/Jellyfin servers; Multi-stream 1080p transcoding; Best value for most users",
        "vs_previous": "8% faster than 7th Gen with identical codec support. Worth it for the price/availability, but not a must-upgrade."
    },
    {
        "generation": 9,
        "headline": "Coffee Lake Refined",
        "summary": "9th Gen Coffee Lake Refresh shows a notable jump to 89 FPS average - a 27% improvement over 8th Gen. With 30 results at ~10W, it maintains efficiency while boosting throughput. However, codec support remains unchanged from 7th/8th Gen.",
        "pros": "Significant performance bump; Same great Coffee Lake reliability; Good for higher stream counts",
        "cons": "Smaller benchmark dataset; Premium over 8th Gen may not justify; Same codec limitations",
        "best_for": "Users needing more concurrent streams; Upgrading from 6th/7th Gen; High-traffic media servers",
        "vs_previous": "27% faster than 8th Gen but with identical codec support. Good upgrade path if streams are maxing out."
    },
    {
        "generation": 10,
        "headline": "Comet Lake Consistency",
        "summary": "10th Gen Comet Lake delivers 83 FPS average across 99 submissions at ~8W. While slightly slower than 9th Gen in raw FPS, it offers excellent efficiency and represents the last generation before the major architectural shift to hybrid cores.",
        "pros": "Strong efficiency (~8W average); Large dataset for confidence; Mature platform; Wide motherboard selection",
        "cons": "No major codec improvements; Slightly lower peak FPS than 9th Gen; End of the pure P-core era",
        "best_for": "Balanced performance and efficiency; Users wanting mature, stable platform; Pre-hybrid architecture preference",
        "vs_previous": "Similar to 9th Gen in performance. Choose based on platform availability and price rather than encoding capability."
    },
    {
        "generation": 11,
        "headline": "The Codec Revolution Begins",
        "summary": "11th Gen Rocket Lake is transformative for codec support, adding HEVC 10-bit and VP9 encoding. With limited data (10 results, 80 FPS, ~5W), the efficiency gains are notable. This generation enables HDR content encoding for the first time.",
        "pros": "HEVC 10-bit encoding (HDR support); VP9 encoding capability; Improved power efficiency; AV1 decode support",
        "cons": "Limited benchmark data; Rocket Lake had mixed desktop reception; Higher idle power than predecessors",
        "best_for": "HDR content creators; VP9/YouTube workflows; Users needing 10-bit HEVC encoding",
        "vs_previous": "Major codec upgrade over 10th Gen. Essential if you need HEVC 10-bit or VP9 encoding."
    },
    {
        "generation": 12,
        "headline": "Hybrid Architecture Excellence",
        "summary": "12th Gen Alder Lake introduces the hybrid P-core/E-core architecture with impressive results: 90 FPS at just ~3W average across 30 submissions. The efficiency gains are remarkable while maintaining full codec support from 11th Gen.",
        "pros": "Exceptional power efficiency (~3W avg); Strong performance (90 FPS); Modern platform with DDR5 option; Full codec support",
        "cons": "Hybrid scheduling can be complex; Premium pricing; Overkill for basic transcoding",
        "best_for": "New builds prioritizing efficiency; Users wanting latest platform features; Low-power server builds",
        "vs_previous": "13% faster than 11th Gen with dramatically better efficiency. Strong upgrade for power-conscious users."
    },
    {
        "generation": 13,
        "headline": "Raw Performance Leader",
        "summary": "13th Gen Raptor Lake leads in raw performance at 124 FPS average, though with higher power draw (~39W). With only 5 results, data is limited but suggests this generation prioritizes throughput over efficiency. Best for maximum concurrent streams.",
        "pros": "Highest FPS average; Maximum concurrent stream capacity; Full codec support; Strong single-thread performance",
        "cons": "Higher power consumption; Limited benchmark data; May be overkill for most users; Premium cost",
        "best_for": "High-demand media servers; Maximum concurrent transcodes; Users prioritizing raw speed over efficiency",
        "vs_previous": "38% faster than 12th Gen but at significantly higher power. Choose based on whether you need maximum throughput."
    },
    {
        "generation": 14,
        "headline": "Efficiency Optimized",
        "summary": "14th Gen Raptor Lake Refresh shows 117 FPS at ~4W average across 5 results. While slightly slower than 13th Gen in peak FPS, the dramatic efficiency improvement suggests Intel optimized for power consumption. Same codec support as 12th/13th Gen.",
        "pros": "Excellent efficiency (~4W avg); Near-flagship performance; Latest platform support; Strong value proposition",
        "cons": "Very limited benchmark data; Minimal improvement over 13th Gen; No new codec features",
        "best_for": "New builds wanting latest hardware; Balance of performance and efficiency; Future-proofing",
        "vs_previous": "6% slower than 13th Gen but dramatically more efficient. Better choice for most users unless maximum FPS is critical."
    }
]

def execute_sql(sql, args=None):
    """Execute SQL via Turso HTTP API"""
    headers = {
        "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
        "Content-Type": "application/json"
    }

    stmt = {"q": sql}
    if args:
        stmt["params"] = args

    response = requests.post(
        f"{TURSO_URL}",
        headers=headers,
        json={"statements": [stmt]}
    )

    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

    return response.json()

def main():
    if not TURSO_URL or not TURSO_AUTH_TOKEN:
        print("Error: TURSO_URL and TURSO_AUTH_TOKEN must be set")
        return

    print("Populating generation insights...")

    for insight in INSIGHTS:
        sql = """
            INSERT OR REPLACE INTO generation_insights
            (generation, headline, summary, pros, cons, best_for, vs_previous, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """

        result = execute_sql(sql, [
            insight["generation"],
            insight["headline"],
            insight["summary"],
            insight["pros"],
            insight["cons"],
            insight["best_for"],
            insight["vs_previous"]
        ])

        if result:
            print(f"  Gen {insight['generation']}: {insight['headline']}")
        else:
            print(f"  Gen {insight['generation']}: FAILED")

    print("\nDone! Verifying...")

    result = execute_sql("SELECT generation, headline FROM generation_insights ORDER BY generation")
    if result and result[0].get("rows"):
        print("\nInserted insights:")
        for row in result[0]["rows"]:
            print(f"  Gen {row[0]}: {row[1]}")

if __name__ == "__main__":
    main()
