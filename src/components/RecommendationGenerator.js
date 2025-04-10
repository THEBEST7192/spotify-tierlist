import React, { useState } from 'react';
import axios from 'axios';
import './RecommendationGenerator.css';
import AddToPlaylist from './AddToPlaylist';

// Use environment variable for Last.fm API key
const LASTFM_API_KEY = process.env.REACT_APP_LASTFM_API_KEY;
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const RecommendationGenerator = ({ tierState, tierOrder, tiers, accessToken, onPlayTrack, onAddToTierlist }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addedTracks, setAddedTracks] = useState(new Set());

  // Calculate tier weights based on position in tierOrder
  const calculateTierWeights = () => {
    const weights = {};
    const unrankedIndex = tierOrder.indexOf("Unranked");
    
    // Exclude Unranked tier and the lowest tier from recommendations
    const tiersToUse = tierOrder.slice(0, unrankedIndex - 1);
    
    // Calculate weights based on position (higher position = higher weight)
    tiersToUse.forEach((tier, index) => {
      // Reverse the index so higher tiers have higher weights
      const weight = tiersToUse.length - index;
      weights[tier] = weight;
    });
    
    // Set Unranked and lowest tier to 0 weight
    weights["Unranked"] = 0;
    if (tierOrder.length > 1) {
      weights[tierOrder[unrankedIndex - 1]] = 0; // Lowest ranked tier
    }
    
    return weights;
  };

  const getWeightedSongs = () => {
    // Get tier weights
    const tierWeights = calculateTierWeights();
    
    // Get songs from tiers with weights > 0
    const weightedSongs = [];
    
    Object.entries(tierState).forEach(([tier, songs]) => {
      if (tierWeights[tier] > 0 && songs.length > 0) {
        songs.forEach(song => {
          weightedSongs.push({
            ...song,
            weight: tierWeights[tier]
          });
        });
      }
    });
    
    // Sort songs by their weight (highest first)
    return weightedSongs.sort((a, b) => b.weight - a.weight);
  };

  const getSimilarTracks = async (song) => {
    try {
      // Get artist name and track name
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
          limit: Math.ceil(song.weight * 3) // Get more recommendations for higher weighted songs
        }
      });
      
      if (response.data && response.data.similartracks && response.data.similartracks.track) {
        return response.data.similartracks.track.map(track => ({
          source: { 
            artist: artist, 
            track: song.content.name,
            weight: song.weight
          },
          name: track.name,
          artist: track.artist.name,
          url: track.url,
          // Add a score based on the original song's weight and Last.fm match value
          score: song.weight * parseFloat(track.match)
        }));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching similar tracks for ${song.content.name}:`, error);
      return [];
    }
  };

  const findSpotifyTracks = async (recommendations) => {
    try {
      // Get unique recommendations to avoid duplicates
      const uniqueRecommendations = [];
      const trackMap = new Map();
      
      // Create a set of song IDs that are already in the tier list to exclude them
      const existingSongIds = new Set();
      Object.values(tierState).forEach(songs => {
        songs.forEach(song => {
          if (song.content && song.content.id) {
            existingSongIds.add(song.content.id);
          }
        });
      });
      
      // Process recommendations, adding scores for duplicates
      recommendations.forEach(rec => {
        const key = `${rec.artist}-${rec.name}`;
        if (trackMap.has(key)) {
          // If we've seen this track before, add to its score and track multiple sources
          const existing = trackMap.get(key);
          existing.score += rec.score;
          // Add the additional source if it's different
          if (!existing.sources.some(s => 
            s.artist === rec.source.artist && s.track === rec.source.track)) {
            existing.sources.push(rec.source);
          }
          trackMap.set(key, existing);
        } else {
          // First time seeing this track
          trackMap.set(key, {
            ...rec,
            sources: [rec.source]
          });
        }
      });
      
      Array.from(trackMap.values()).forEach(rec => {
        uniqueRecommendations.push(rec);
      });
      
      // Find these tracks on Spotify
      const spotifyTracks = [];
      for (const rec of uniqueRecommendations.slice(0, 30)) { // Increased limit to ensure we get enough after filtering
        try {
          const response = await axios.get('https://api.spotify.com/v1/search', {
            params: {
              q: `artist:${rec.artist} track:${rec.name}`,
              type: 'track',
              limit: 1
            },
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          
          if (response.data.tracks.items.length > 0) {
            const spotifyTrack = response.data.tracks.items[0];
            
            // Skip if this track is already in the user's tier list
            if (existingSongIds.has(spotifyTrack.id)) {
              continue;
            }
            
            spotifyTracks.push({
              ...rec,
              spotifyData: spotifyTrack
            });
          }
        } catch (error) {
          console.error(`Error finding track on Spotify: ${rec.name} - ${rec.artist}`, error);
        }
      }
      
      return spotifyTracks;
    } catch (error) {
      console.error('Error finding tracks on Spotify:', error);
      throw error;
    }
  };

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
      
      // Only use top 10 weighted songs to avoid too many API calls
      const topWeightedSongs = weightedSongs.slice(0, 10);
      
      // Get similar tracks for each song
      const similarTracksPromises = topWeightedSongs.map(song => getSimilarTracks(song));
      const similarTracksArrays = await Promise.all(similarTracksPromises);
      
      // Flatten the array of arrays
      const allSimilarTracks = similarTracksArrays.flat();
      
      // Find these tracks on Spotify to get album art and playback URLs
      const spotifyTracks = await findSpotifyTracks(allSimilarTracks);
      
      // Sort tracks by score (weighted match value)
      spotifyTracks.sort((a, b) => b.score - a.score);
      
      setRecommendations(spotifyTracks);
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      setError('Failed to generate recommendations. Please try again later.');
      setIsLoading(false);
    }
  };

  // Handle play button click
  const handlePlayClick = (trackId) => {
    if (onPlayTrack) {
      onPlayTrack(trackId);
    }
  };

  // Get the tier name for a weight
  const getTierNameForWeight = (weight) => {
    const tierWeights = calculateTierWeights();
    const tier = Object.entries(tierWeights).find(([_, w]) => w === weight);
    return tier ? tier[0] : 'Unknown';
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
                accessToken={accessToken} 
                isSingleTrack={false}
              />
            </div>
          </div>
          <p className="recommendation-explanation">
            Based on songs in your ranked tiers (higher tiers have more influence)
          </p>
          <div className="recommendation-tracks">
            {recommendations.map((track, index) => (
              <div key={index} className="recommendation-track">
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
                      <>
                        {track.sources[0].track} by {track.sources[0].artist} (Tier: {
                          getTierNameForWeight(track.sources[0].weight)
                        })
                      </>
                    ) : (
                      <>
                        {track.sources.length} songs including {track.sources[0].track} by {track.sources[0].artist}
                      </>
                    )}
                  </div>
                </div>
                <div className="recommendation-actions">
                  <button 
                    className="play-preview-button"
                    onClick={() => handlePlayClick(track.spotifyData.id)}
                    aria-label="Play preview"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="currentColor" d="M8 5v14l11-7z" />
                    </svg>
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
                    accessToken={accessToken} 
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
