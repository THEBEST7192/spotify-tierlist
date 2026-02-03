import React, { useState } from 'react';
import { searchTracks } from '../utils/spotifyApi';
import { getSimilarTracksFromBackend, getSimilarArtistsFromBackend } from '../utils/backendApi';
import './RecommendationGenerator.css';
import AddToPlaylist from './AddToPlaylist';

// Constants for recommendation configuration
const MAX_RECOMMENDATIONS = 200; // Maximum recommendations to display

// Cache for API responses and assets
const appCache = {
  // LastFM API caches
  similarTracks: new Map(),
  similarArtists: new Map(),
  // Spotify API caches
  spotifyTracks: new Map(),
  // Image caches
  imageCache: new Map(),
  // Cache expiration time (7 days in milliseconds)
  CACHE_EXPIRATION: 7 * 24 * 60 * 60 * 1000
};

const RecommendationGenerator = ({ tierState, tierOrder, onPlayTrack, onAddToTierlist, currentTrackId, isPlayerPlaying }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addedTracks, setAddedTracks] = useState(new Set());
  const [discoverNewArtists, setDiscoverNewArtists] = useState(false);
  const [explorationDepth, setExplorationDepth] = useState(0); // 0-20 slider affecting recommendation offset

  // Utility to safely normalize tier entries coming from state (which can include metadata like tierListName)
  const ensureSongArray = (value) => (Array.isArray(value) ? value : []);

  // ===== TIER WEIGHT SYSTEM ===== 
  // Calculate the weight of each tier based on position in tierOrder
  // Higher tiers get higher weights
  const calculateTierWeights = () => {
    const weights = {};
    // Exclude "Unranked" then drop the final tier
    const tiersWithoutUnranked = tierOrder.filter(tier => tier !== 'Unranked');
    const filteredTiers = tiersWithoutUnranked.slice(0, -1);
    // Assign weights: highest = 5, next = 4, ...
    const maxWeight = 5;
    filteredTiers.forEach((tier, idx) => {
      weights[tier] = Math.max(maxWeight - idx, 1);
    });
    // All others get 0
    tierOrder.forEach(tier => {
      if (!weights[tier]) weights[tier] = 0;
    });
    return weights;
  };

  // Get all songs with their assigned tier weights
  const getWeightedSongs = () => {
    // Get tier weights map (tier name -> weight value)
    const tierWeights = calculateTierWeights();
    
    // Array to hold all songs with their weights
    const weightedSongs = [];
    
    // Process each tier and its songs
    Object.entries(tierState).forEach(([tier, songs]) => {
      const tierSongs = ensureSongArray(songs);
      // Only include songs from tiers with weight > 0
      if (tierWeights[tier] > 0 && tierSongs.length > 0) {
        // Add each song with its tier weight
        tierSongs.forEach(song => {
          weightedSongs.push({
            ...song,
            AMOUNT_OF_SONGS: tierWeights[tier],
            tier: tier // Store tier name for reference
          });
        });
      }
    });
    
    // Sort by weight (highest tier songs first)
    return weightedSongs.sort((a, b) => b.AMOUNT_OF_SONGS - a.AMOUNT_OF_SONGS);
  };

  // Get primary artist name from a tier song object
  const getPrimaryArtistName = (song) => {
    const artists = song?.content?.artists;
    if (!Array.isArray(artists) || artists.length === 0) return null;
    const name = artists[0]?.name;
    return typeof name === 'string' && name.trim() ? name : null;
  };

  // Get similar artists from Last.fm API based on an artist
  const getSimilarArtists = async (song) => {
    try {
      // Extract artist info
      const artist = getPrimaryArtistName(song);
      if (!artist) {
        console.warn('[RecommendationGenerator] Missing primary artist, skipping similar artists fetch for song:', song?.content?.name || 'Unknown');
        return [];
      }
      
      // Create a cache key using artist name
      const cacheKey = artist.toLowerCase();
      
      // Check if we have a valid cached response
      if (appCache.similarArtists.has(cacheKey)) {
        const cachedData = appCache.similarArtists.get(cacheKey);
        const now = Date.now();
        
        // If cache is still valid, use it
        if (now - cachedData.timestamp < appCache.CACHE_EXPIRATION) {
          console.log(`[CACHE: LastFM Similar Artists] Using cached data for ${artist}`);
          
          // Map the cached artists with the current song's weight
          return cachedData.data.map(similarArtist => ({
            source: { 
              artist: artist, 
              track: song.content.name,
              AMOUNT_OF_SONGS: song.AMOUNT_OF_SONGS,
              tier: song.tier
            },
            artistName: similarArtist.name,
            // Score = source weight × matching value from Last.fm
            score: song.AMOUNT_OF_SONGS * parseFloat(similarArtist.match)
          }));
        }
      }
      
      // Query backend API for similar artists
      const response = await getSimilarArtistsFromBackend(artist, 10);
      
      // Process and store in cache
      if (response?.similarartists?.artist) {
        // Store the raw artist data in cache with timestamp
        appCache.similarArtists.set(cacheKey, {
          data: response.similarartists.artist,
          timestamp: Date.now()
        });
        
        // Return processed artists
        return response.similarartists.artist.map(similarArtist => ({
          source: { 
            artist: artist, 
            track: song.content.name,
            AMOUNT_OF_SONGS: song.AMOUNT_OF_SONGS,
            tier: song.tier
          },
          artistName: similarArtist.name,
          // Score = source weight × matching value from Last.fm
          score: song.AMOUNT_OF_SONGS * parseFloat(similarArtist.match)
        }));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching similar artists for ${getPrimaryArtistName(song) || 'Unknown Artist'}:`, error);
      return [];
    }
  };

  // Get top tracks from a similar artist using Spotify API
  const getTopTracksFromArtist = async (artistName, sourceInfo, artistMatch) => {
    try {
      // Create a cache key for this artist
      const cacheKey = `artist:${artistName.toLowerCase()}`;
      
      // Check if we have a valid cached response
      if (appCache.spotifyTracks.has(cacheKey)) {
        const cachedData = appCache.spotifyTracks.get(cacheKey);
        const now = Date.now();
        
        // If cache is still valid, use it
        if (now - cachedData.timestamp < appCache.CACHE_EXPIRATION) {
          console.log(`[CACHE: Spotify Artist Tracks] Using cached data for artist: ${artistName}`);
          
          // Map the cached tracks with the current source info
          return cachedData.data.map(track => ({
            source: sourceInfo,
            name: track.name,
            artist: track.artists[0].name,
            url: track.external_urls.spotify,
            // Use same weight system as similar tracks: source weight × artist match value
            score: sourceInfo.AMOUNT_OF_SONGS * parseFloat(artistMatch),
            // Include image URLs if available
            images: track.album?.images || []
          }));
        }
      }
      
      // Search for the artist on Spotify
      const artistResponse = await searchTracks(`artist:${artistName}`);
      
      if (artistResponse.data.tracks.items.length > 0) {
        // Get the first few tracks from this artist (they're usually popular ones)
        const artistTracks = artistResponse.data.tracks.items
          .filter(track => track.artists?.[0]?.name && track.artists[0].name.toLowerCase() === artistName.toLowerCase())
          .slice(0, 3); // Get top 3 tracks from this artist
        
        // Cache the artist tracks
        appCache.spotifyTracks.set(cacheKey, {
          data: artistTracks,
          timestamp: Date.now()
        });
        
        // Cache images if available
        artistTracks.forEach(track => {
          if (track.album?.images?.length > 0) {
            track.album.images.forEach(image => {
              if (image.url) {
                appCache.imageCache.set(image.url, {
                  data: image.url,
                  timestamp: Date.now()
                });
              }
            });
          }
        });
        
        return artistTracks.map(track => ({
          source: sourceInfo,
          name: track.name,
          artist: track.artists[0].name,
          url: track.external_urls.spotify,
          // Use same weight system as similar tracks: source weight × artist match value
          score: sourceInfo.AMOUNT_OF_SONGS * parseFloat(artistMatch),
          // Include image URLs if available
          images: track.album?.images || []
        }));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching top tracks for artist ${artistName}:`, error);
      return [];
    }
  };

  // Get similar tracks from Last.fm API based on a song
  const getSimilarTracks = async (song) => {
    try {
      // Extract artist and track info
      const artist = getPrimaryArtistName(song);
      const track = song?.content?.name;
      if (!artist || !track) {
        console.warn('[RecommendationGenerator] Missing artist or track name, skipping similar tracks fetch for song:', song?.content?.name || 'Unknown');
        return [];
      }
      
      // Create a cache key using artist and track
      const cacheKey = `${artist.toLowerCase()}###${track.toLowerCase()}`;
      
      // Check if we have a valid cached response
      if (appCache.similarTracks.has(cacheKey)) {
        const cachedData = appCache.similarTracks.get(cacheKey);
        const now = Date.now();
        
        // If cache is still valid, use it
        if (now - cachedData.timestamp < appCache.CACHE_EXPIRATION) {
          console.log(`[CACHE: LastFM Similar Tracks] Using cached data for ${artist} - ${track}`);
          
          // Map the cached tracks with the current song's weight
          return cachedData.data.map(track => ({
            source: { 
              artist: artist, 
              track: song.content.name,
              AMOUNT_OF_SONGS: song.AMOUNT_OF_SONGS,
              tier: song.tier
            },
            name: track.name,
            artist: track.artist.name,
            url: track.url,
            // Score = source weight × matching value from Last.fm
            score: song.AMOUNT_OF_SONGS * parseFloat(track.match)
          }));
        }
      }
      
      // If no valid cache, query backend API
      const response = await getSimilarTracksFromBackend(artist, track);
      
      // Process the response
      if (response?.similartracks?.track) {
        // Store the raw track data in cache with timestamp
        appCache.similarTracks.set(cacheKey, {
          data: response.similartracks.track,
          timestamp: Date.now()
        });
        
        // Return processed tracks
        return response.similartracks.track.map(track => ({
          source: { 
            artist: artist, 
            track: song.content.name,
            AMOUNT_OF_SONGS: song.AMOUNT_OF_SONGS,
            tier: song.tier
          },
          name: track.name,
          artist: track.artist.name,
          url: track.url,
          // Score = source weight × matching value from Last.fm
          score: song.AMOUNT_OF_SONGS * parseFloat(track.match)
        }));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching similar tracks for ${song?.content?.name || 'Unknown Track'}:`, error);
      return [];
    }
  };

  // Generate recommendations based on weighted songs
  const generateRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get weighted songs from tiers
      const weightedSongs = getWeightedSongs();
      if (weightedSongs.length === 0) {
        setError('Please rank some songs in your tiers to get recommendations');
        setIsLoading(false);
        return;
      }
      // Only use songs with weight > 0
      const songsToUse = weightedSongs.filter(song => song.AMOUNT_OF_SONGS > 0);
      if (songsToUse.length === 0) {
        setError('No ranked songs available for recommendations.');
        setIsLoading(false);
        return;
      }
      // Collect existing song IDs and artist-track keys from tierlist
      const existingSongIds = new Set();
      const existingSongKeys = new Set();
      Object.values(tierState).forEach(songs => {
        ensureSongArray(songs).forEach(song => {
          if (song.content && song.content.id) {
            existingSongIds.add(song.content.id);
            const artistName = song.content?.artists?.[0]?.name?.toLowerCase();
            const trackName = song.content?.name?.toLowerCase();
            if (artistName && trackName) {
              existingSongKeys.add(`${artistName}###${trackName}`);
            }
          }
        });
      });
      // ----- Generate recommendations with temperature fallback -----
      let tempExplorationDepth = explorationDepth;
      let finalRecs = [];
      while (true) {
        // Get similar tracks for each song, with fallback to similar artists
        const similarTracksResults = await Promise.all(
          songsToUse.map(async (song) => {
            const similarTracks = await getSimilarTracks(song);
            
            // If no similar tracks found, try getting tracks from similar artists
            if (similarTracks.length === 0) {
              console.log(`No similar tracks found for ${song.content.name}, trying similar artists...`);
              const similarArtists = await getSimilarArtists(song);
              
              if (similarArtists.length > 0) {
                 // Get top tracks from each similar artist
                 const artistTracksPromises = similarArtists.slice(0, 3).map(artistInfo => 
                   getTopTracksFromArtist(artistInfo.artistName, artistInfo.source, artistInfo.score / artistInfo.source.AMOUNT_OF_SONGS)
                 );
                
                const artistTracksResults = await Promise.all(artistTracksPromises);
                return artistTracksResults.flat();
              }
            }
            
            return similarTracks;
          })
        );
      // Build a map to track recommended artist-track keys for diversity and sources
      const recommendedTrackMap = new Map(); // key: songKey, value: track object with sources and count
        let allSimilarTracks = [];
        songsToUse.forEach((song, idx) => {
          let added = 0;
          const tracks = similarTracksResults[idx] || [];
          const offset = tempExplorationDepth * song.AMOUNT_OF_SONGS;
          for (let i = offset; i < tracks.length && added < song.AMOUNT_OF_SONGS; i++) {
            const t = tracks[i];
            if (!t || !t.artist || !t.name) { continue; }
            const artistKey = t.artist.toLowerCase();
            const trackKey = t.name.toLowerCase();
            const songKey = `${artistKey}###${trackKey}`;
          // If already in tierlist or already recommended, increment count and add source, then try next
            if (existingSongKeys.has(songKey) || recommendedTrackMap.has(songKey)) {
            // If already recommended, update sources and count
              if (recommendedTrackMap.has(songKey)) {
                const existing = recommendedTrackMap.get(songKey);
                // Only add if this source is new
                if (!existing.sources.some(s => s.artist === t.source.artist && s.track === t.source.track)) {
                  existing.sources.push(t.source);
                }
                existing.recommendationCount = (existing.recommendationCount || 1) + 1;
                recommendedTrackMap.set(songKey, existing);
              }
            // If in tierlist, just skip
              continue;
            }
          // New recommendation
          // Attach sources array and recommendationCount
            const trackWithSources = { ...t, sources: [t.source], recommendationCount: 1 };
            recommendedTrackMap.set(songKey, trackWithSources);
            allSimilarTracks.push(trackWithSources);
            added++;
          }
        });
        // Remove undefined/null
        allSimilarTracks = allSimilarTracks.filter(Boolean);
        // Use aggregated recommendations from recommendedTrackMap
        const aggregatedTracks = Array.from(recommendedTrackMap.values());
        finalRecs = await processRecommendations(aggregatedTracks);
        if (finalRecs.length === 0 && tempExplorationDepth > 0) {
          tempExplorationDepth = Math.floor(tempExplorationDepth * 0.75);
          continue;
        }
        break;
      }
      if (finalRecs.length === 0) {
        setRecommendations([]);
        setError('Could not find any recommendations, please adjust the exploration depth or rank more songs.');
        setIsLoading(false);
        return;
      }

      setRecommendations(finalRecs);
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      setError('Failed to generate recommendations. Please try again later.');
      setIsLoading(false);
    }
  };

  // Process similar tracks to remove duplicates and find on Spotify
  const processRecommendations = async (similarTracks) => {
    // Track existing content to avoid duplicates
    const existingSongIds = new Set();
    const existingSongNames = new Set();
    const existingArtists = new Set();

    Object.values(tierState).forEach(songs => {
      ensureSongArray(songs).forEach(song => {
        const content = song?.content;
        const spotifyId = content?.id;
        if (spotifyId) {
          existingSongIds.add(spotifyId);
        }

        const artistName = content?.artists?.[0]?.name;
        const trackName = content?.name;
        if (artistName && trackName) {
          const artistKey = artistName.toLowerCase();
          const trackKey = trackName.toLowerCase();
          existingSongNames.add(`${artistKey}###${trackKey}`);
          existingArtists.add(artistKey);
        } else if (artistName) {
          existingArtists.add(artistName.toLowerCase());
        }
      });
    });

    // ----- Group and combine similar recommendations -----
    const uniqueTracksMap = new Map(); // Using artist-track as key
    
    // Process each recommendation, combining duplicates
    similarTracks.forEach(rec => {
      const key = `${rec.artist.toLowerCase()}-${rec.name.toLowerCase()}`;
      
      if (uniqueTracksMap.has(key)) {
        // If we've seen this track before, update its entry
        const existing = uniqueTracksMap.get(key);
        
        // Increase score
        existing.score += rec.score;
        existing.recommendationCount = (existing.recommendationCount || 1) + 1;
        
        // Merge sources arrays (not just rec.source)
        if (rec.sources && Array.isArray(rec.sources)) {
          rec.sources.forEach(src => {
            if (!existing.sources.some(s => s.artist === src.artist && s.track === src.track)) {
              existing.sources.push(src);
            }
          });
        } else if (rec.source) {
          if (!existing.sources.some(s => s.artist === rec.source.artist && s.track === rec.source.track)) {
            existing.sources.push(rec.source);
          }
        }
        
        uniqueTracksMap.set(key, existing);
      } else {
        // First time seeing this track
        // Ensure sources is always an array
        uniqueTracksMap.set(key, {
          ...rec,
          sources: rec.sources && Array.isArray(rec.sources) ? [...rec.sources] : [rec.source],
          recommendationCount: rec.recommendationCount || 1
        });
      }
    });
    
    // Convert to array
    const uniqueRecommendations = Array.from(uniqueTracksMap.values());
    
    // ----- Find tracks on Spotify -----
    const spotifyTracks = [];
    const tracksByArtist = new Map();
    
    // Initial sorting of unique recommendations removed; final spotifyTracks sort handles full ordering
    
    // Process recommendations up to the limit
    for (const rec of uniqueRecommendations.slice(0, MAX_RECOMMENDATIONS)) {
      try {
        // Create a cache key for this track search
        const searchCacheKey = `search:${rec.artist.toLowerCase()}:${rec.name.toLowerCase()}`;
        let spotifyTrack;
        
        // Check if we have a valid cached response
        if (appCache.spotifyTracks.has(searchCacheKey)) {
          const cachedData = appCache.spotifyTracks.get(searchCacheKey);
          const now = Date.now();
          
          // If cache is still valid, use it
          if (now - cachedData.timestamp < appCache.CACHE_EXPIRATION) {
            console.log(`[CACHE: Spotify Search] Using cached data for: ${rec.artist} - ${rec.name}`);
            spotifyTrack = cachedData.data;
          }
        }
        
        // If no valid cache, search Spotify
        if (!spotifyTrack) {
          const response = await searchTracks(`artist:${rec.artist} track:${rec.name}`);
          
          if (response.data.tracks.items.length > 0) {
            spotifyTrack = response.data.tracks.items[0];
            
            // Cache the search result
            appCache.spotifyTracks.set(searchCacheKey, {
              data: spotifyTrack,
              timestamp: Date.now()
            });
            
            // Cache album images if available
            if (spotifyTrack.album?.images?.length > 0) {
              spotifyTrack.album.images.forEach(image => {
                if (image.url) {
                  appCache.imageCache.set(image.url, {
                    data: image.url,
                    timestamp: Date.now()
                  });
                }
              });
            }
          }
        }
        
        if (spotifyTrack) {
          
          // Skip if already in tierlist (by ID or by artist-track combination)
          if (existingSongIds.has(spotifyTrack.id)) {
            continue;
          }
          
          // Skip different versions of the same song
          if (spotifyTrack.artists?.[0]) {
            const artistName = spotifyTrack.artists[0].name.toLowerCase();
            const trackName = spotifyTrack.name.toLowerCase();
            const trackKey = `${artistName}###${trackName}`;
            
            if (existingSongNames.has(trackKey)) {
              continue;
            }
            
            // Check if this is a new artist
            const isNewArtist = !existingArtists.has(artistName);
            
            // Store by artist for diversity filtering
            if (!tracksByArtist.has(artistName)) {
              tracksByArtist.set(artistName, []);
            }
            
            // Create track object with artist newness information
            const trackWithMeta = {
              ...rec,
              spotifyData: spotifyTrack,
              isNewArtist: isNewArtist,
              // Boost score for new artists in discovery mode
              adjustedScore: discoverNewArtists && isNewArtist 
                ? rec.score * 1.5 // 50% boost for new artists
                : rec.score
            };
            
            tracksByArtist.get(artistName).push(trackWithMeta);
          }
        }
      } catch (error) {
        console.error(`Error finding track on Spotify: ${rec.name} - ${rec.artist}`, error);
      }
    }
    
    // Collect all tracks into spotifyTracks
    tracksByArtist.forEach(tracks => spotifyTracks.push(...tracks));
    // ----- Final sorting of recommendations -----
    // Use recommendationCount, then best source tier, then adjustedScore
    const tierPriority = tierOrder.reduce((acc, tierName, idx) => {
      acc[tierName] = idx;
      return acc;
    }, {});
    const getBestTierPriority = (rec) => rec.sources.reduce(
      (min, s) => {
        const pr = tierPriority[s.tier];
        return Math.min(min, pr !== undefined ? pr : Infinity);
      },
      Infinity
    );
    spotifyTracks.sort((a, b) => {
      // 0. Bring currently held track to the top
      if (a.spotifyData.id === currentTrackId && b.spotifyData.id !== currentTrackId) return -1;
      if (b.spotifyData.id === currentTrackId && a.spotifyData.id !== currentTrackId) return 1;
      // 1. By recommendation count (desc)
      if (b.recommendationCount !== a.recommendationCount) {
        return b.recommendationCount - a.recommendationCount;
      }
      // 2. By best source tier
      const aTier = getBestTierPriority(a);
      const bTier = getBestTierPriority(b);
      if (aTier !== bTier) {
        return aTier - bTier;
      }
      // 3. By adjustedScore (desc)
      return b.adjustedScore - a.adjustedScore;
    });
    // Return limited number of recommendations
    return spotifyTracks.slice(0, MAX_RECOMMENDATIONS);
  };

  // Handle play button click
  const handlePlayClick = (trackId) => {
    if (onPlayTrack) {
      onPlayTrack(trackId);
    }
  };

  // Handle add to tierlist button click
  const handleAddToTierlist = (track) => {
    if (onAddToTierlist) {
      onAddToTierlist(track.spotifyData);
      // Track which songs have been added
      setAddedTracks(prev => new Set([...prev, track.spotifyData.id]));
    }
  };

  // Handle add all to tierlist button click
  const handleAddAllToTierlist = () => {
    if (!onAddToTierlist || recommendations.length === 0) return;
    
    // Get tracks that haven't been added yet
    const tracksToAdd = recommendations.filter(track => 
      !addedTracks.has(track.spotifyData.id)
    );
    
    // Add each track to the tierlist
    tracksToAdd.forEach(track => {
      onAddToTierlist(track.spotifyData);
    });
    
    // Update the addedTracks state to include all tracks
    const newAddedTracks = new Set(addedTracks);
    tracksToAdd.forEach(track => {
      newAddedTracks.add(track.spotifyData.id);
    });
    
    setAddedTracks(newAddedTracks);
  };

  // Check if all tracks have been added
  const areAllTracksAdded = recommendations.length > 0 && 
    recommendations.every(track => addedTracks.has(track.spotifyData.id));

  return (
    <div className="recommendation-container">
      <div className="recommendation-options">
        <label className="discover-toggle">
          <input
            type="checkbox"
            checked={discoverNewArtists}
            onChange={() => setDiscoverNewArtists(!discoverNewArtists)}
          />
          <span className="toggle-label">Discover New Artists</span>
        </label>
        <label className="exploration-depth-slider">
          <input
            type="range"
            min="0"
            max="20"
            value={explorationDepth}
            onChange={(e) => setExplorationDepth(parseInt(e.target.value))}
          />
          <span className="slider-label">Exploration Depth: {explorationDepth}</span>
        </label>
      </div>
      
      <button 
        className="recommendation-button" 
        onClick={generateRecommendations}
        disabled={isLoading}
      >
        {isLoading ? 'Generating...' : 'Get Recommendations Based on Your Rankings'}
      </button>
      
      {error && <div className="error-message">{error}</div>}
      
      {recommendations.length > 0 && (
        <div className="recommendations-list">
          <div className="recommendations-header">
            <h3>Recommended Songs</h3>
            <div className="recommendations-actions">
              <button
                className={`add-all-to-tierlist-button ${areAllTracksAdded ? 'added' : ''}`}
                onClick={handleAddAllToTierlist}
                disabled={areAllTracksAdded}
              >
                {areAllTracksAdded ? 'All Added to Tierlist' : 'Add All to Tierlist'}
              </button>
              <AddToPlaylist 
                trackId={recommendations.map(track => track.spotifyData.id)}
                isSingleTrack={false}
              />
            </div>
          </div>
          <p className="recommendation-explanation">
            Based on songs in your ranked tiers {discoverNewArtists ? 'with emphasis on new artists' : '(higher tiers have more influence)'}
          </p>
          <div className="recommendation-tracks">
            {recommendations.map((track, index) => (
              <div key={index} className={`recommendation-track ${track.isNewArtist ? 'new-artist' : ''}`}>
                {track.spotifyData?.album?.images?.[0]?.url && (
                  <img 
                    src={track.spotifyData.album.images[0].url} 
                    alt={`${track.name} album art`}
                    className="recommendation-album-cover"
                  />
                )}
                <div className="recommendation-info">
                  <div className="recommendation-track-name">{track.name}</div>
                  <div className="recommendation-artist-name">{track.artist}</div>
                  <div className="recommendation-source">
                    <span className="recommendation-source-label">Based on:</span> 
                    {track.sources.length === 1 ? (
                      <span className="source-details">
                        {track.sources[0].track} by {track.sources[0].artist} (Tier: {track.sources[0].tier})
                      </span>
                    ) : (
                      <span className="source-details">
                        {track.sources.length} songs including {track.sources[0].track} by {track.sources[0].artist}
                      </span>
                    )}
                  </div>
                </div>
                <div className="recommendation-actions">
                  <button 
                    className={`play-preview-button${currentTrackId === track.spotifyData.id && isPlayerPlaying ? ' playing' : ''}`}
                    onClick={() => handlePlayClick(track.spotifyData.id)}
                    aria-label={currentTrackId === track.spotifyData.id && isPlayerPlaying ? 'Pause preview' : 'Play preview'}
                  >
                    {currentTrackId === track.spotifyData.id && isPlayerPlaying ? (
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <a 
                    href={track.spotifyData?.external_urls?.spotify} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="listen-button"
                  >
                    Listen on Spotify
                  </a>
                  <button
                    className={`add-to-tierlist-button ${addedTracks.has(track.spotifyData.id) ? 'added' : ''}`}
                    onClick={() => handleAddToTierlist(track)}
                    disabled={addedTracks.has(track.spotifyData.id)}
                  >
                    {addedTracks.has(track.spotifyData.id) ? 'Added to Tierlist' : 'Add to Tierlist'}
                  </button>
                  <AddToPlaylist 
                    trackId={track.spotifyData.id}
                    isSingleTrack={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationGenerator;
