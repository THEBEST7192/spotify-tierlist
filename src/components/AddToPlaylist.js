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
  const [showNewPlaylistForm, setShowNewPlaylistForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [newPlaylistIsPublic, setNewPlaylistIsPublic] = useState(true);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [playlistToClone, setPlaylistToClone] = useState(null);
  const [clonedPlaylistName, setClonedPlaylistName] = useState('');

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
      
      // Check if user owns or collaborates on the playlist
      const playlist = playlists.find(p => p.id === selectedPlaylist);
      
      // Get user ID to properly check ownership
      const userResponse = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      const userId = userResponse.data.id;
      
      // Check if the user is the owner of the playlist
      const isOwner = playlist.owner.id === userId;
      
      // Get collaborative status for the playlist
      const isCollaborative = playlist.collaborative === true;
      
      // Only offer to clone if the user isn't the owner and the playlist isn't collaborative
      if (!isOwner && !isCollaborative) {
        setPlaylistToClone(playlist);
        setClonedPlaylistName(`${playlist.name} (Copy)`);
        setShowCloneDialog(true);
        setIsLoading(false);
        return;
      }
      
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
      
      // Check if user owns or collaborates on the playlist
      const playlist = playlists.find(p => p.id === selectedPlaylist);
      
      // Get user ID to properly check ownership
      const userResponse = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      const userId = userResponse.data.id;
      
      // Check if the user is the owner of the playlist
      const isOwner = playlist.owner.id === userId;
      
      // Get collaborative status for the playlist
      const isCollaborative = playlist.collaborative === true;
      
      // Only offer to clone if the user isn't the owner and the playlist isn't collaborative
      if (!isOwner && !isCollaborative) {
        setPlaylistToClone(playlist);
        setClonedPlaylistName(`${playlist.name} (Copy)`);
        setShowCloneDialog(true);
        setIsLoading(false);
        return;
      }
      
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

  const handleCreateNewPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      setError('Please enter a playlist name');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Get user ID first
      const userResponse = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      const userId = userResponse.data.id;
      
      // Create new playlist
      const createResponse = await axios.post(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          name: newPlaylistName,
          description: newPlaylistDescription,
          public: newPlaylistIsPublic
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const newPlaylistId = createResponse.data.id;
      
      // Add tracks to the new playlist
      if (isSingleTrack) {
        await axios.post(
          `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
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
      } else {
        await axios.post(
          `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
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
      }
      
      setIsSuccess(true);
      setIsLoading(false);
      setShowNewPlaylistForm(false);
      setShowPlaylistSelector(false);
      
      // Reset form fields
      setNewPlaylistName('');
      setNewPlaylistDescription('');
      setNewPlaylistIsPublic(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error creating new playlist:', err);
      setError(`Failed to create playlist: ${err.response?.data?.error?.message || err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleClonePlaylist = async () => {
    if (!playlistToClone) {
      setError('No playlist selected for cloning');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Get user ID first
      const userResponse = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      const userId = userResponse.data.id;
      
      // Create new playlist
      const createResponse = await axios.post(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          name: clonedPlaylistName,
          description: `A copy of ${playlistToClone.name}`,
          public: false // Default to private for cloned playlists
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const newPlaylistId = createResponse.data.id;
      
      // Fetch all tracks from the original playlist
      const originalTracksResponse = await axios.get(
        `https://api.spotify.com/v1/playlists/${playlistToClone.id}/tracks`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: {
            limit: 100 // Fetch up to 100 tracks
          }
        }
      );
      
      // Extract track URIs from the original playlist
      const originalTrackUris = originalTracksResponse.data.items.map(item => item.track.uri);
      
      // Add original tracks to the new playlist in batches of 100 (Spotify API limit)
      if (originalTrackUris.length > 0) {
        for (let i = 0; i < originalTrackUris.length; i += 100) {
          const batch = originalTrackUris.slice(i, i + 100);
          await axios.post(
            `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
            {
              uris: batch
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      }
      
      // Add the new recommended/selected tracks to the cloned playlist
      if (isSingleTrack) {
        await axios.post(
          `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
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
      } else {
        await axios.post(
          `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
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
      }
      
      setIsSuccess(true);
      setIsLoading(false);
      setShowCloneDialog(false);
      setShowPlaylistSelector(false);
      
      // Reset form fields
      setPlaylistToClone(null);
      setClonedPlaylistName('');
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error cloning playlist:', err);
      setError(`Failed to clone playlist: ${err.response?.data?.error?.message || err.message || 'Unknown error'}`);
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
              You don't have any playlists yet.
            </div>
          )}
          
          <div className="new-playlist-section">
            <button 
              className="new-playlist-button"
              onClick={() => setShowNewPlaylistForm(!showNewPlaylistForm)}
            >
              {showNewPlaylistForm ? 'Cancel' : 'Create New Playlist'}
            </button>
            
            {showNewPlaylistForm && (
              <div className="new-playlist-form">
                <input
                  type="text"
                  placeholder="Playlist Name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="playlist-input"
                />
                
                <textarea
                  placeholder="Description (optional)"
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  className="playlist-textarea"
                />
                
                <div className="playlist-privacy">
                  <label>
                    <input
                      type="checkbox"
                      checked={newPlaylistIsPublic}
                      onChange={(e) => setNewPlaylistIsPublic(e.target.checked)}
                    />
                    Public Playlist
                  </label>
                </div>
                
                <button 
                  className="create-playlist-button"
                  onClick={handleCreateNewPlaylist}
                  disabled={isLoading || !newPlaylistName.trim()}
                >
                  {isLoading ? 'Creating...' : 'Create & Add Tracks'}
                </button>
              </div>
            )}
          </div>
          
          {/* Clone Playlist Dialog */}
          {showCloneDialog && playlistToClone && (
            <div className="clone-playlist-dialog">
              <h4>Clone Playlist</h4>
              <p>You don't have permission to add tracks to "{playlistToClone.name}". Would you like to create a copy of this playlist and add the tracks to it?</p>
              
              <input
                type="text"
                placeholder="New Playlist Name"
                value={clonedPlaylistName}
                onChange={(e) => setClonedPlaylistName(e.target.value)}
                className="playlist-input"
              />
              
              <div className="clone-playlist-actions">
                <button 
                  className="clone-button"
                  onClick={handleClonePlaylist}
                  disabled={isLoading || !clonedPlaylistName.trim()}
                >
                  {isLoading ? 'Cloning...' : 'Clone & Add Tracks'}
                </button>
                
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setShowCloneDialog(false);
                    setPlaylistToClone(null);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddToPlaylist; 