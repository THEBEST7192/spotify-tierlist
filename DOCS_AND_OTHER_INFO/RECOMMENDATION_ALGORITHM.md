# [Recommendation Algorithm for Spotify Tierlist App](../README.md) 

This document explains how song recommendations are generated and processed in the `RecommendationGenerator` component.

## 1. Weighted Input Songs
- Each song in the user's tierlist is assigned an **AMOUNT_OF_SONGS** value based on its tier:
  - S: 5, A: 4, B: 3, C: 2, Others: 1, F and Unranked: 0
  - Highest: 5, Second highest: 4, Third highest: 3, Fourth highest: 2, Fifth highest and everything else: 1, Lowest and Unranked: 0
- Only songs with AMOUNT_OF_SONGS > 0 participate in recommendation. (This means that you will not be able to rank if you remove all tiers except one as that will now count as the lowest while being the highest, this is not really a issue as it not likely to be encountered and a user has to go out of their way to do it)

## 2. Fetch Similar Tracks
- For each weighted song, call Last.fm's `track.getSimilar` (via `getSimilarTracks`), **in parallel**, requesting up to N similar tracks (N = weight, capped).

## 2.5. Exploration Depth
- A slider labeled **Exploration Depth** (0–20) lets users control how far into Last.fm’s recommendations to start.
- The algorithm computes an `offset = Exploration Depth * AMOUNT_OF_SONGS` for each song to skip that many top results, promoting variety.
- If no recommendations are produced at the current depth, the depth is multiplied by 0.75 (rounded down) and retried until results are found or depth is zero.

## 3. Aggregate and Filter
1. Maintain a **map** (`recommendedTrackMap`) keyed by `artist###track`:
   - Each entry stores the track metadata, list of source recommendations, and a **recommendationCount**.
2. For each returned track:
   - Skip if already in the user's tierlist.
   - If new, add to map with `sources = [ { tier, artist, track } ]`, count = 1.
   - If existing in map, increment count and append source (if unique).

## 4. Build Candidate List
- Flatten `recommendedTrackMap` into a list of **unique** recommendations.
- Add `score` from Last.fm plus optional **adjustedScore** boost when “Discover New Artists” mode is active.
- Flag each track with `isNewArtist` if artist wasn't in tierlist.

## 5. Final Sorting and Selection
All modes share the same final sort:
1. **Recommendation Count**: Tracks recommended by multiple sources rank higher.
2. **Best Source Tier**: Prioritize tracks recommended from higher-tier songs.
3. **Score**: Last.fm similarity score (with optional boost).

After sorting, pick top `MAX_RECOMMENDATIONS` tracks.

## 6. “Discover New Artists” Mode
- Flags `isNewArtist`; can boost score by 50%.
- Allows new artists to surface when counts/tier produce ties.

## 7. Spotify Lookup
- For the top candidates, search the Spotify API (`searchTracks`) by `artist:… track:…`.
- Attach Spotify `track` data (ID, album art, preview link, etc.) to each recommendation.

## 8. UI Integration
- Recommendations display album art, artist, song name, play button (embedded player), and “Add to Tierlist”.
- Sorting ensures most popular & high-quality tracks appear first.
