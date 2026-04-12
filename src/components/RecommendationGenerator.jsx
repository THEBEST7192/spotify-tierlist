import React, { useState } from 'react';
import { searchTracks } from '../utils/spotifyApi';
import { 
  getSimilarTracksFromBackend, 
  getSimilarArtistsFromBackend, 
  searchTracksFromBackend 
} from '../utils/backendApi';
import './RecommendationGenerator.css';
import AddToPlaylist from './AddToPlaylist';
import { PLACEHOLDER_COLORS } from '../constants';

// Constants for recommendation configuration
const MAX_RECOMMENDATIONS_SPOTIFY = 100; // Maximum recommendations for Spotify users
const MAX_RECOMMENDATIONS_TUNETIER = 50; // Half limit for TuneTier users

// Cache key for local storage
const LOCAL_STORAGE_CACHE_KEY = 'spotify_track_id_cache';

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

// Utility to load persistent cache
const loadPersistentCache = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      
      // Convert object back to Map and filter expired items
      Object.keys(parsed).forEach(key => {
        const item = parsed[key];
        if (now - item.timestamp < appCache.CACHE_EXPIRATION) {
          appCache.spotifyTracks.set(key, item);
        }
      });
      // console.log(`[CACHE] Loaded ${appCache.spotifyTracks.size} items from persistent storage`);
    }
  } catch (error) {
    console.warn('[CACHE] Error loading persistent cache:', error);
  }
};

// Utility to save persistent cache
const savePersistentCache = () => {
  try {
    const data = {};
    const now = Date.now();
    
    appCache.spotifyTracks.forEach((value, key) => {
      // Only persist if not expired
      if (now - value.timestamp < appCache.CACHE_EXPIRATION) {
        data[key] = value;
      }
    });
    
    localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[CACHE] Error saving persistent cache:', error);
  }
};

// Initial load
loadPersistentCache();

const RecommendationGenerator = ({ tierState, tierOrder, onPlayTrack, onAddToTierlist, currentTrackId, isPlayerPlaying, accessToken, tuneTierUser }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [resolvingTrackId, setResolvingTrackId] = useState(null); // Track which song is currently being resolved from Spotify
  const [error, setError] = useState(null);
  const [addedTracks, setAddedTracks] = useState(new Set());
  const [discoverNewArtists, setDiscoverNewArtists] = useState(false);
  const [explorationDepth, setExplorationDepth] = useState(0); // 0-20 slider affecting recommendation offset

  // Utility to safely normalize tier entries coming from state (which can include metadata like tierListName)
  const ensureSongArray = (value) => (Array.isArray(value) ? value : []);

  // Determine maximum recommendations based on user type
  const getMaxRecommendations = () => {
    // Robust check for a valid-looking access token string
    const hasValidToken = accessToken && typeof accessToken === 'string' && accessToken.length > 10;

    // If user is logged in with Spotify (has accessToken)
    if (hasValidToken) {
      return MAX_RECOMMENDATIONS_SPOTIFY;
    }
    // If user is logged in with TuneTier (has tuneTierUser but no Spotify accessToken)
    if (tuneTierUser) {
      return MAX_RECOMMENDATIONS_TUNETIER;
    }
    // Guest (no login) should have no recommendations
    return 0;
  };

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
    // console.log('[RecommendationGenerator] getPrimaryArtistName for song:', song?.content?.name, 'artists:', song?.content?.artists);
    const artists = song?.content?.artists;
    
    // Standard Spotify structure
    if (Array.isArray(artists) && artists.length > 0) {
      const name = artists[0]?.name;
      if (typeof name === 'string' && name.trim()) return name;
    }
    
    // Fallback for different structures (e.g. from imports or older versions)
    const artist = song?.content?.artist;
    if (typeof artist === 'string' && artist.trim()) return artist;
    
    if (typeof artists === 'string' && artists.trim()) return artists;
    
    return null;
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
      const searchQuery = `artist:${artistName}`;
      let artistResponse;
      
      // Robust check for a valid-looking access token string
      const hasValidToken = accessToken && typeof accessToken === 'string' && accessToken.length > 10;
      
      if (hasValidToken) {
        // User is logged into Spotify - use their token
        artistResponse = await searchTracks(searchQuery);
      } else {
        // User is only logged into TuneTier - use backend search proxy
        artistResponse = await searchTracksFromBackend(searchQuery);
      }
      
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
        savePersistentCache();
        
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
          return cachedData.data.map(t => {
            const artistName = typeof t.artist === 'string' ? t.artist : (t.artist?.name || 'Unknown Artist');
            return {
              source: { 
                artist: artist, 
                track: song.content.name,
                AMOUNT_OF_SONGS: song.AMOUNT_OF_SONGS,
                tier: song.tier
              },
              name: t.name,
              artist: artistName,
              url: t.url,
              // Score = source weight × matching value from Last.fm
              score: song.AMOUNT_OF_SONGS * parseFloat(t.match)
            };
          });
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
        return response.similartracks.track.map(t => {
          const artistName = typeof t.artist === 'string' ? t.artist : (t.artist?.name || 'Unknown Artist');
          return {
            source: { 
              artist: artist, 
              track: song.content.name,
              AMOUNT_OF_SONGS: song.AMOUNT_OF_SONGS,
              tier: song.tier
            },
            name: t.name,
            artist: artistName,
            url: t.url,
            // Score = source weight × matching value from Last.fm
            score: song.AMOUNT_OF_SONGS * parseFloat(t.match)
          };
        });
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
      const maxRecs = getMaxRecommendations();
      if (maxRecs === 0) {
        setError('Please login with Spotify or TuneTier to get recommendations');
        setIsLoading(false);
        return;
      }

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
          if (song.content) {
            if (song.content.id) {
              existingSongIds.add(song.content.id);
            }
            const artistName = getPrimaryArtistName(song)?.toLowerCase();
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

      // Proactively resolve the first 10 tracks to get Spotify metadata (like album art)
      const tracksToResolve = finalRecs.slice(0, 10);
      tracksToResolve.forEach(async (track) => {
        if (!track.spotifyData?.id) {
          const spotifyData = await resolveSpotifyTrack(track);
          if (spotifyData?.id) {
            setRecommendations(prev => prev.map(r => 
              (r.artist === track.artist && r.name === track.name) 
                ? { ...r, spotifyData } 
                : r
            ));
          }
        }
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      setError('Failed to generate recommendations. Please try again later.');
      setIsLoading(false);
    }
  };

  // Process similar tracks to remove duplicates and find on Spotify
  const processRecommendations = async (similarTracks) => {
    // Track existing content to avoid duplicates
    const existingSongNames = new Set();
    const existingArtists = new Set();

    Object.values(tierState).forEach(songs => {
      ensureSongArray(songs).forEach(song => {
        const artistName = getPrimaryArtistName(song);
        const trackName = song?.content?.name;
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

    // Group and combine similar recommendations
    const uniqueTracksMap = new Map();
    
    similarTracks.forEach(rec => {
      const artistName = rec.artist || rec.artistName;
      const trackName = rec.name;
      if (!artistName || !trackName) return;

      const key = `${artistName.toLowerCase()}###${trackName.toLowerCase()}`;
      
      // Check if track is already in the mongo db cache or local cache
      const cacheKey = `search:${artistName.toLowerCase()}:${trackName.toLowerCase()}`;
      const cached = appCache.spotifyTracks.get(cacheKey);
      const spotifyDataFromCache = (cached && (Date.now() - cached.timestamp < appCache.CACHE_EXPIRATION)) ? cached.data : null;
      
      if (uniqueTracksMap.has(key)) {
        const existing = uniqueTracksMap.get(key);
        existing.score += rec.score;
        existing.recommendationCount = (existing.recommendationCount || 1) + 1;
        
        // Update spotifyData if we found it in cache and don't have it yet
        if (!existing.spotifyData && spotifyDataFromCache) {
          existing.spotifyData = spotifyDataFromCache;
        }

        if (rec.sources && Array.isArray(rec.sources)) {
          rec.sources.forEach(src => {
            if (!existing.sources.some(s => s.artist === src.artist && s.track === src.track)) {
              existing.sources.push(src);
            }
          });
        }
        uniqueTracksMap.set(key, existing);
      } else {
        uniqueTracksMap.set(key, {
          ...rec,
          artist: artistName,
          name: trackName,
          spotifyData: spotifyDataFromCache,
          sources: rec.sources && Array.isArray(rec.sources) ? [...rec.sources] : [rec.source],
          recommendationCount: rec.recommendationCount || 1,
          placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
        });
      }
    });
    
    // Filter out already ranked songs and group by artist
    const uniqueRecommendations = Array.from(uniqueTracksMap.values());
    const finalTracks = [];
    const tracksByArtist = new Map();

    uniqueRecommendations.forEach(rec => {
      const artistKey = rec.artist.toLowerCase();
      const trackKey = rec.name.toLowerCase();
      const songKey = `${artistKey}###${trackKey}`;

      if (existingSongNames.has(songKey)) return;

      const isNewArtist = !existingArtists.has(artistKey);
      
      if (!tracksByArtist.has(artistKey)) {
        tracksByArtist.set(artistKey, []);
      }
      
      const trackWithMeta = {
        ...rec,
        isNewArtist,
        adjustedScore: discoverNewArtists && isNewArtist ? rec.score * 1.5 : rec.score
      };
      
      tracksByArtist.get(artistKey).push(trackWithMeta);
    });
    
    tracksByArtist.forEach(tracks => finalTracks.push(...tracks));

    // Sort tracks
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

    return finalTracks.sort((a, b) => {
      const countDiff = (b.recommendationCount || 1) - (a.recommendationCount || 1);
      if (countDiff !== 0) return countDiff;

      const tierDiff = getBestTierPriority(a) - getBestTierPriority(b);
      if (tierDiff !== 0) return tierDiff;

      return (b.adjustedScore || b.score) - (a.adjustedScore || a.score);
    }).slice(0, getMaxRecommendations());
  };

  // Handle playing a recommended track
  const handlePlayTrack = async (track) => {
    if (!onPlayTrack) return;
    
    // Check if we already have the spotify data
    if (track.spotifyData?.id) {
      onPlayTrack(track.spotifyData.id);
      return;
    }

    // Resolve spotify data
    setResolvingTrackId(`${track.artist}###${track.name}`);
    const spotifyData = await resolveSpotifyTrack(track);
    setResolvingTrackId(null);

    if (spotifyData?.id) {
      // Update the track in our state so we don't have to resolve it again
      const updatedRecs = recommendations.map(r => 
        (r.artist === track.artist && r.name === track.name) 
          ? { ...r, spotifyData: spotifyData || r.spotifyData, resolved: true } 
          : r
      );
      setRecommendations(updatedRecs);
      onPlayTrack(spotifyData.id);
    } else {
      setError(`Could not find "${track.name}" by ${track.artist} on Spotify.`);
    }
  };

  // Handle adding a track to the tierlist
  const handleAddToTierlist = async (track) => {
    if (!onAddToTierlist) return;

    let spotifyData = track.spotifyData;
    
    if (!spotifyData?.id) {
      setResolvingTrackId(`${track.artist}###${track.name}`);
      spotifyData = await resolveSpotifyTrack(track);
      setResolvingTrackId(null);
      
      // Update local state to mark as resolved
      const updatedRecs = recommendations.map(r => 
        (r.artist === track.artist && r.name === track.name) 
          ? { ...r, spotifyData: spotifyData || r.spotifyData, resolved: true } 
          : r
      );
      setRecommendations(updatedRecs);
    }

    if (spotifyData?.id) {
      onAddToTierlist({
        ...spotifyData,
        placeholderColor: track.placeholderColor
      });
      
      // Update added status
      const newAddedTracks = new Set(addedTracks);
      newAddedTracks.add(spotifyData.id);
      setAddedTracks(newAddedTracks);
    } else {
      setError(`Could not find "${track.name}" by ${track.artist} on Spotify.`);
    }
  };

  // Handle add all to tierlist button click (two-step process)
  const handleAddAllToTierlist = async () => {
    if (!onAddToTierlist || recommendations.length === 0 || isAddingAll) return;
    
    setIsAddingAll(true);
    try {
      const updatedRecommendations = [...recommendations];
      
      // Step 1: Resolve all tracks if not already resolved
      if (!allTracksResolved) {
        for (let i = 0; i < updatedRecommendations.length; i++) {
          const track = updatedRecommendations[i];
          if (!track.spotifyData?.id && !track.resolved) {
            setResolvingTrackId(`${track.artist}###${track.name}`);
            const spotifyData = await resolveSpotifyTrack(track);
            updatedRecommendations[i] = { 
              ...track, 
              spotifyData: spotifyData || track.spotifyData,
              resolved: true
            };
          }
        }
        setRecommendations(updatedRecommendations);
        setResolvingTrackId(null);
        // After fetching all, we stop and wait for the user to click "Add all to tierlist"
        return;
      }

      // Step 2: Add all tracks to the tierlist
      const newAddedTracks = new Set(addedTracks);
      updatedRecommendations.forEach(track => {
        if (track.spotifyData?.id && !addedTracks.has(track.spotifyData.id)) {
          onAddToTierlist({
            ...track.spotifyData,
            placeholderColor: track.placeholderColor
          });
          newAddedTracks.add(track.spotifyData.id);
        }
      });
      
      setAddedTracks(newAddedTracks);
    } catch (err) {
      console.error('Error in batch action:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsAddingAll(false);
      setResolvingTrackId(null);
    }
  };

  // Helper to resolve Spotify track data for a recommendation
  const resolveSpotifyTrack = async (track) => {
    // Already has spotify data
    if (track.spotifyData?.id) return track.spotifyData;

    const cacheKey = `search:${track.artist.toLowerCase()}:${track.name.toLowerCase()}`;
    
    // Check cache
    if (appCache.spotifyTracks.has(cacheKey)) {
      const cached = appCache.spotifyTracks.get(cacheKey);
      if (Date.now() - cached.timestamp < appCache.CACHE_EXPIRATION) {
        return cached.data;
      }
    }

    try {
      const searchQuery = `artist:${track.artist} track:${track.name}`;
      let response;
      const hasValidToken = accessToken && typeof accessToken === 'string' && accessToken.length > 10;

      if (hasValidToken) {
        response = await searchTracks(searchQuery);
      } else {
        response = await searchTracksFromBackend(searchQuery);
      }

      if (response.data.tracks.items.length > 0) {
        const spotifyTrack = response.data.tracks.items[0];
        
        // Update cache
        appCache.spotifyTracks.set(cacheKey, {
          data: spotifyTrack,
          timestamp: Date.now()
        });
        savePersistentCache();
        
        return spotifyTrack;
      }
      return null;
    } catch (err) {
      console.error('Error resolving Spotify track:', err);
      return null;
    }
  };

  // Helper to get album art URL
  const getAlbumArtUrl = (track) => {
    // 1. Check if we already resolved Spotify data (from proactive fetch, cache, or previous play)
    if (track.spotifyData?.album?.images?.[0]?.url) {
      return track.spotifyData.album.images[0].url;
    }

    // 2. Check if we have direct images from Spotify (from getTopTracksFromArtist)
    if (track.images?.[0]?.url) {
      return track.images[0].url;
    }

    // 3. Fallback to null (UI will use colored rings)
    return null;
  };

  // Handle adding a track to a playlist (lazy)
  const handleAddToPlaylistLazy = async (track) => {
    let spotifyData = track.spotifyData;
    
    if (!spotifyData?.id) {
      setResolvingTrackId(`${track.artist}###${track.name}`);
      spotifyData = await resolveSpotifyTrack(track);
      setResolvingTrackId(null);
      
      // Update local state to mark as resolved
      const updatedRecs = recommendations.map(r => 
        (r.artist === track.artist && r.name === track.name) 
          ? { ...r, spotifyData: spotifyData || r.spotifyData, resolved: true } 
          : r
      );
      setRecommendations(updatedRecs);
    }

    if (!spotifyData?.id) {
      setError(`Could not find "${track.name}" by ${track.artist} on Spotify.`);
    }
    // The AddToPlaylist component will now be rendered because spotifyData.id exists
  };

  // Check if all tracks have been added
  const areAllTracksAdded = recommendations.length > 0 && 
    recommendations.every(track => track.spotifyData?.id && addedTracks.has(track.spotifyData.id));

  // Check if all tracks have been resolved (either found on Spotify or marked as unresolvable)
  const allTracksResolved = recommendations.length > 0 && 
    recommendations.every(track => track.spotifyData?.id || track.resolved);

  const isGuest = !accessToken && !tuneTierUser;

  return (
    <div className="recommendation-container">
      <div className="recommendation-options">
        <label className={`discover-toggle${isGuest ? ' disabled' : ''}`}>
          <input
            type="checkbox"
            checked={discoverNewArtists}
            onChange={() => setDiscoverNewArtists(!discoverNewArtists)}
            disabled={isGuest}
          />
          <span className="toggle-label">Discover New Artists</span>
        </label>
        <label className={`exploration-depth-slider${isGuest ? ' disabled' : ''}`}>
          <input
            type="range"
            min="0"
            max="20"
            value={explorationDepth}
            onChange={(e) => setExplorationDepth(parseInt(e.target.value))}
            disabled={isGuest}
          />
          <span className="slider-label">Exploration Depth: {explorationDepth}</span>
        </label>
      </div>
      
      <button 
        className="recommendation-button" 
        onClick={generateRecommendations}
        disabled={isLoading || isGuest}
      >
        {isLoading ? 'Generating...' : (isGuest ? 'Login to Get Recommendations' : 'Get Recommendations Based on Your Rankings')}
      </button>

      {isGuest && (
        <div className="login-requirement-note">
          A TuneTier account or Spotify login is required to generate recommendations.
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      {recommendations.length > 0 && (
        <div className="recommendations-list">
          <div className="recommendations-header">
            <h3>Recommended Songs</h3>
            <div className="recommendations-actions">
              <button
                className={`add-all-to-tierlist-button ${areAllTracksAdded ? 'added' : ''}`}
                onClick={handleAddAllToTierlist}
                disabled={areAllTracksAdded || isAddingAll}
              >
                {isAddingAll 
                  ? (allTracksResolved ? 'Adding...' : 'Fetching...') 
                  : (areAllTracksAdded 
                      ? 'All Added to Tierlist' 
                      : (allTracksResolved ? 'Add All to Tierlist' : 'Fetch All Data')
                    )
                }
              </button>
              <AddToPlaylist 
                trackId={recommendations.filter(t => t.spotifyData?.id).map(track => track.spotifyData.id)}
                isSingleTrack={false}
              />
            </div>
          </div>
          <p className="recommendation-explanation">
            Based on songs in your ranked tiers {discoverNewArtists ? 'with emphasis on new artists' : '(higher tiers have more influence)'}
          </p>
          <div className="recommendation-tracks">
            {recommendations.map((track, index) => {
              const albumArt = getAlbumArtUrl(track);
              return (
                <div key={index} className={`recommendation-track ${track.isNewArtist ? 'new-artist' : ''}`}>
                  {albumArt ? (
                    <img 
                      src={albumArt} 
                      alt={`${track.name} album art`}
                      className="recommendation-album-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div 
                      className="recommendation-album-cover-placeholder"
                      style={{ backgroundColor: '#121212' }}
                    >
                      <svg viewBox="0 0 256 256" className="placeholder-svg">
                        <circle cx="127.5" cy="128.5" r="95.5" fill={track.placeholderColor || '#1DB954'}/>
                        <circle cx="127.5" cy="128.5" r="23.875" fill="black"/>
                        <circle cx="127.5" cy="128.5" r="7.95833" fill={track.placeholderColor || '#1DB954'}/>
                      </svg>
                    </div>
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
                      className={`play-preview-button${track.spotifyData?.id && currentTrackId === track.spotifyData.id && isPlayerPlaying ? ' playing' : ''}`}
                      onClick={() => handlePlayTrack(track)}
                      aria-label={track.spotifyData?.id && currentTrackId === track.spotifyData.id && isPlayerPlaying ? 'Pause preview' : 'Play preview'}
                      disabled={resolvingTrackId === `${track.artist}###${track.name}`}
                    >
                      {track.spotifyData?.id && currentTrackId === track.spotifyData.id && isPlayerPlaying ? (
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
                      href={track.spotifyData?.external_urls?.spotify || `https://open.spotify.com/search/${encodeURIComponent(`${track.artist} ${track.name}`)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="listen-button"
                    >
                      Listen on Spotify
                    </a>
                    <button
                      className={`add-to-tierlist-button ${track.spotifyData?.id && addedTracks.has(track.spotifyData.id) ? 'added' : ''}`}
                      onClick={() => handleAddToTierlist(track)}
                      disabled={(track.spotifyData?.id && addedTracks.has(track.spotifyData.id)) || resolvingTrackId === `${track.artist}###${track.name}`}
                    >
                      {track.spotifyData?.id && addedTracks.has(track.spotifyData.id) ? 'Added to Tierlist' : 'Add to Tierlist'}
                    </button>
                    {track.spotifyData?.id ? (
                      <AddToPlaylist 
                        trackId={track.spotifyData.id}
                        isSingleTrack={true}
                      />
                    ) : (
                      <button 
                        className="add-to-playlist-button"
                        onClick={() => handleAddToPlaylistLazy(track)}
                        disabled={resolvingTrackId === `${track.artist}###${track.name}`}
                      >
                        {resolvingTrackId === `${track.artist}###${track.name}` ? 'Resolving...' : 'Add to Playlist'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationGenerator;
