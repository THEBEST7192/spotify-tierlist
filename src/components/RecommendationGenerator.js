import React, { useState } from 'react';
import axios from 'axios';
import { searchTracks } from '../utils/spotifyApi';
import './RecommendationGenerator.css';
import AddToPlaylist from './AddToPlaylist';

// Use environment variable for Last.fm API key
const LASTFM_API_KEY = process.env.REACT_APP_LASTFM_API_KEY;
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// Constants for recommendation configuration
const MAX_SONGS_TO_USE = 20;  // Maximum songs used for generating recommendations
const MAX_RECOMMENDATIONS = 25; // Maximum recommendations to display

const RecommendationGenerator = ({ tierState, tierOrder, tiers, onPlayTrack, onAddToTierlist, currentTrackId, isPlayerPlaying }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addedTracks, setAddedTracks] = useState(new Set());
  const [discoverNewArtists, setDiscoverNewArtists] = useState(false);

  // ===== TIER WEIGHT SYSTEM ===== 
  // Calculate the weight of each tier based on position in tierOrder
  // Higher tiers get higher weights
  const calculateTierWeights = () => {
    // Initialize weights object
    const weights = {};
    
    // Find Unranked tier position 
    const unrankedIndex = tierOrder.indexOf("Unranked");
    
    // Calculate usable tiers (all except Unranked and lowest tier)
    const tiersToUse = tierOrder.slice(0, unrankedIndex - 1);
    
    // Assign weights in reverse order (higher position = higher weight)
    // Example: If there are 5 usable tiers, S=5, A=4, B=3, C=2, D=1
    tiersToUse.forEach((tier, index) => {
      weights[tier] = tiersToUse.length - index; // Higher tiers get higher weights
    });
    
    // Unranked and lowest tier get 0 weight (not used for recommendations)
    weights["Unranked"] = 0;
    if (tierOrder.length > 1) {
      weights[tierOrder[unrankedIndex - 1]] = 0; // Lowest tier gets 0 weight
    }
    
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
      // Only include songs from tiers with weight > 0
      if (tierWeights[tier] > 0 && songs.length > 0) {
        // Add each song with its tier weight
        songs.forEach(song => {
          weightedSongs.push({
            ...song,
            weight: tierWeights[tier],
            tier: tier // Store tier name for reference
          });
        });
      }
    });
    
    // Sort by weight (highest tier songs first)
    return weightedSongs.sort((a, b) => b.weight - a.weight);
  };

  // Get similar tracks from Last.fm API based on a song
  const getSimilarTracks = async (song) => {
    try {
      // Extract artist and track info
      const artist = song.content.artists[0].name;
      const track = song.content.name;
      
      // Query Last.fm API for similar tracks
      const response = await axios.get(LASTFM_BASE_URL, {
        params: {
          method: 'track.getSimilar',
          artist: artist,
          track: track,
          api_key: LASTFM_API_KEY,
          format: 'json',
          limit: Math.ceil(song.weight * 3) // Higher tier songs get more recommendations
        }
      });
      
      // Process and return similar tracks with source info
      if (response.data?.similartracks?.track) {
        return response.data.similartracks.track.map(track => ({
          source: { 
            artist: artist, 
            track: song.content.name,
            weight: song.weight,
            tier: song.tier
          },
          name: track.name,
          artist: track.artist.name,
          url: track.url,
          // Score = source weight × matching value from Last.fm
          score: song.weight * parseFloat(track.match)
        }));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching similar tracks for ${song.content.name}:`, error);
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
      
      // ----- Song selection for recommendations -----
      // 1. Get all songs from the highest tier
      const topTierSongs = weightedSongs.filter(
        song => song.weight === weightedSongs[0].weight
      );
      
      // 2. Select songs to use for recommendations
      let songsToUse = [...topTierSongs];
      
      // 3. If not enough top tier songs, add from other tiers
      if (songsToUse.length < 5) {
        const otherTierSongs = weightedSongs.filter(
          song => song.weight !== weightedSongs[0].weight
        );
        
        songsToUse = [...songsToUse, ...otherTierSongs];
      }
      
      // 4. Limit to maximum number of songs
      if (songsToUse.length > MAX_SONGS_TO_USE) {
        songsToUse = songsToUse.slice(0, MAX_SONGS_TO_USE);
      }
      
      console.log(`Using ${songsToUse.length} songs for recommendations (${songsToUse.map(s => s.tier).join(', ')})`);
      
      // ----- Generate recommendations -----
      // 1. Get similar tracks for each song
      const similarTrackPromises = songsToUse.map(song => getSimilarTracks(song));
      const similarTrackResults = await Promise.all(similarTrackPromises);
      
      // 2. Flatten results into a single array
      const allSimilarTracks = similarTrackResults.flat();
      
      // 3. Process recommendations and filter out duplicates
      const recommendations = await processRecommendations(allSimilarTracks);
      
      setRecommendations(recommendations);
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
    
    // Build sets of existing content from the tierlist
    Object.values(tierState).forEach(songs => {
      songs.forEach(song => {
        if (song.content && song.content.id) {
          // Track Spotify IDs
          existingSongIds.add(song.content.id);
          
          // Track artist+track combinations
          if (song.content.artists?.[0]?.name && song.content.name) {
            const artistName = song.content.artists[0].name.toLowerCase();
            const trackName = song.content.name.toLowerCase();
            
            existingSongNames.add(`${artistName}###${trackName}`);
            existingArtists.add(artistName);
          }
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
        
        // Add source if it's new
        if (!existing.sources.some(s => 
          s.artist === rec.source.artist && s.track === rec.source.track)) {
          existing.sources.push(rec.source);
        }
        
        uniqueTracksMap.set(key, existing);
      } else {
        // First time seeing this track
        uniqueTracksMap.set(key, {
          ...rec,
          sources: [rec.source],
          recommendationCount: 1
        });
      }
    });
    
    // Convert to array
    const uniqueRecommendations = Array.from(uniqueTracksMap.values());
    
    // ----- Find tracks on Spotify -----
    const spotifyTracks = [];
    const tracksByArtist = new Map();
    
    // Process more recommendations in discovery mode
    const maxRecsToProcess = discoverNewArtists ? 100 : 50;
    
    // Sort recommendations by count and score before processing
    uniqueRecommendations.sort((a, b) => {
      // First by number of sources
      if (b.recommendationCount !== a.recommendationCount) {
        return b.recommendationCount - a.recommendationCount;
      }
      // Then by score
      return b.score - a.score;
    });
    
    // Process recommendations up to the limit
    for (const rec of uniqueRecommendations.slice(0, maxRecsToProcess)) {
      try {
        // Search Spotify for this track
        const response = await searchTracks(`artist:${rec.artist} track:${rec.name}`);
        
        if (response.data.tracks.items.length > 0) {
          const spotifyTrack = response.data.tracks.items[0];
          
          // Skip if already in tierlist (by ID)
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
    
    // ----- Apply diversity filtering based on mode -----
    if (discoverNewArtists) {
      // Discovery mode: prioritize new artists
      
      // 1. First add tracks from new artists (max 2 per artist)
      tracksByArtist.forEach((tracks, artistName) => {
        if (!existingArtists.has(artistName)) {
          // Sort new artist tracks by score
          tracks.sort((a, b) => b.adjustedScore - a.adjustedScore);
          // Take top 2 from each new artist
          spotifyTracks.push(...tracks.slice(0, 2));
        }
      });
      
      // 2. If we need more tracks, add from existing artists (max 1 per artist)
      if (spotifyTracks.length < MAX_RECOMMENDATIONS) {
        tracksByArtist.forEach((tracks, artistName) => {
          if (existingArtists.has(artistName)) {
            // Only take top track from each existing artist
            if (tracks.length > 0) {
              tracks.sort((a, b) => b.adjustedScore - a.adjustedScore);
              spotifyTracks.push(tracks[0]);
            }
          }
        });
      }
      
      // 3. Sort by new artist first, then by number of recommendations, then score
      spotifyTracks.sort((a, b) => {
        // First by new artist status
        if (a.isNewArtist !== b.isNewArtist) {
          return a.isNewArtist ? -1 : 1;
        }
        // Then by number of sources
        if (b.sources.length !== a.sources.length) {
          return b.sources.length - a.sources.length;
        }
        // Finally by score
        return b.adjustedScore - a.adjustedScore;
      });
    } else {
      // Normal mode: maximize quality regardless of artist
      
      // Add all tracks
      tracksByArtist.forEach(tracks => {
        spotifyTracks.push(...tracks);
      });
      
      // Sort by number of recommendations first, then by score
      spotifyTracks.sort((a, b) => {
        // First by number of sources
        if (b.sources.length !== a.sources.length) {
          return b.sources.length - a.sources.length;
        }
        // Then by score
        return b.score - a.score;
      });
    }
    
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
                disabled={areAllTracksAdded || isLoading}
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
