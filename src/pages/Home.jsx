import React, { useState, useMemo } from "react";
import AuthButton from "../components/AuthButton";
import PlaylistSelector from "../components/PlaylistSelector";
import TierList from "../components/TierList";
import axios from "axios";

const Home = ({ accessToken, setAccessToken }) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  // Handle playlist selection
  const handlePlaylistSelect = async (playlist) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Add access token to the playlist object
      const playlistWithToken = {
        ...playlist,
        accessToken
      };
      
      setSelectedPlaylist(playlistWithToken);
      
      // Fetch the tracks for the selected playlist
      const response = await axios.get(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      
      // Extract track data and add stable IDs
      const tracks = response.data.items
        .filter(item => item.track)
        .map((item, index) => ({
          ...item.track,
          // Create a stable ID using playlist ID and index
          dragId: `track-${playlist.id}-${index}`
        }));
      
      setPlaylistTracks(tracks);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching playlist tracks:", err);
      setError("Failed to load tracks from this playlist");
      setIsLoading(false);
    }
  };

  // Reset playlist selection to return to playlist selector
  const handleBackToPlaylists = () => {
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="home-container">
      <h1>Spotify Tierlist Maker</h1>
      
      {!accessToken ? (
        <div className="auth-container">
          <p>Please log in with your Spotify account to create a tierlist.</p>
          <AuthButton />
        </div>
      ) : selectedPlaylist ? (
        <div className="tierlist-container">
          <button onClick={handleBackToPlaylists} className="back-button">
            ← Back to Playlists
          </button>
          <h2>Tierlist for: {selectedPlaylist.name}</h2>
          <TierList songs={playlistTracks} />
        </div>
      ) : (
        <div className="playlist-selector-container">
          <p>Select a playlist to create a tierlist:</p>
          <PlaylistSelector 
            accessToken={accessToken} 
            onSelect={handlePlaylistSelect} 
          />
        </div>
      )}
    </div>
  );
};

export default Home;