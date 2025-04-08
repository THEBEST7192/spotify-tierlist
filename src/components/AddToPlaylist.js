import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AddToPlaylist.css';

const AddToPlaylist = ({ trackId, accessToken, isSingleTrack = false }) => {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);

  // Fetch user's playlists when component mounts
  useEffect(() => {
    if (accessToken && showPlaylistSelector) {
      fetchPlaylists();
    }
  }, [accessToken, showPlaylistSelector]);

  const fetchPlaylists = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          limit: 50 // Fetch up to 50 playlists
        }
      });
      
      setPlaylists(response.data.items);
      
      // Set the first playlist as default if available
      if (response.data.items.length > 0) {
        setSelectedPlaylist(response.data.items[0].id);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching playlists:', err);
      setError('Failed to load your playlists. Please try again.');
      setIsLoading(false);
    }
  };

  const handleAddToPlaylist = async () => {
    if (!selectedPlaylist) {
      setError('Please select a playlist');
      return;
    }

    if (!trackId) {
      setError('No track selected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Add track to the selected playlist
      await axios.post(
        `https://api.spotify.com/v1/playlists/${selectedPlaylist}/tracks`,
        {
          uris: [`spotify:track:${trackId}`]
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setIsSuccess(true);
      setIsLoading(false);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
        setShowPlaylistSelector(false);
      }, 3000);
    } catch (err) {
      console.error('Error adding track to playlist:', err);
      setError(`Failed to add track to playlist: ${err.response?.data?.error?.message || err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleAddAllToPlaylist = async () => {
    if (!selectedPlaylist) {
      setError('Please select a playlist');
      return;
    }

    if (!trackId || !Array.isArray(trackId) || trackId.length === 0) {
      setError('No tracks selected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Add all tracks to the selected playlist
      await axios.post(
        `https://api.spotify.com/v1/playlists/${selectedPlaylist}/tracks`,
        {
          uris: trackId.map(id => `spotify:track:${id}`)
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setIsSuccess(true);
      setIsLoading(false);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
        setShowPlaylistSelector(false);
      }, 3000);
    } catch (err) {
      console.error('Error adding tracks to playlist:', err);
      setError(`Failed to add tracks to playlist: ${err.response?.data?.error?.message || err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="add-to-playlist-container">
      {!showPlaylistSelector ? (
        <button 
          className="add-to-playlist-button"
          onClick={() => setShowPlaylistSelector(true)}
        >
          {isSingleTrack ? 'Add to Playlist' : 'Add All to Playlist'}
        </button>
      ) : (
        <div className="playlist-selector">
          <h4>Select a Playlist</h4>
          {isLoading && <div className="loading">Loading playlists...</div>}
          
          {error && <div className="error-message">{error}</div>}
          
          {isSuccess && (
            <div className="success-message">
              {isSingleTrack ? 'Track added to playlist!' : 'Tracks added to playlist!'}
            </div>
          )}
          
          {!isLoading && playlists.length > 0 && (
            <>
              <select 
                value={selectedPlaylist} 
                onChange={(e) => setSelectedPlaylist(e.target.value)}
                className="playlist-select"
              >
                {playlists.map(playlist => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              
              <div className="playlist-actions">
                <button 
                  className="add-button"
                  onClick={isSingleTrack ? handleAddToPlaylist : handleAddAllToPlaylist}
                  disabled={isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add'}
                </button>
                
                <button 
                  className="cancel-button"
                  onClick={() => setShowPlaylistSelector(false)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
          
          {!isLoading && playlists.length === 0 && (
            <div className="no-playlists">
              <p>You don't have any playlists. Create one on Spotify first.</p>
              <button 
                className="cancel-button"
                onClick={() => setShowPlaylistSelector(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddToPlaylist; 