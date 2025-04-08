import React, { useState, useMemo } from "react";
import AuthButton from "../components/AuthButton";
import LogoutButton from "../components/LogoutButton";
import PlaylistSelector from "../components/PlaylistSelector";
import TierList from "../components/TierList";
import spotifyLogoOfficial from "../assets/spotify/spotify-logo-official.png";
import axios from "axios";
import "./Home.css";

const Home = ({ accessToken, setAccessToken }) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  // Handle logout
  const handleLogout = () => {
    setAccessToken(null);
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  };

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
      <header className="app-header">
        <h1>Tierlist Maker for Spotify</h1>
        <div className="header-controls">
          <img src={spotifyLogoOfficial} alt="Spotify" className="spotify-logo" />
          {accessToken && <LogoutButton onLogout={handleLogout} />}
        </div>
      </header>
      
      {!accessToken ? (
        <div className="auth-container">
          <div className="spotify-attribution">
            <img src={spotifyLogoOfficial} alt="Spotify" className="spotify-full-logo" />
            <p>Create a tier list from your favorite Spotify playlists.</p>
            <p>This application uses content from Spotify. By using this app, you agree to Spotify's terms of service.</p>
            <p>Please log in with your Spotify account to create a tierlist.</p>
            <AuthButton />
            <div className="made-with-spotify">
              <p>Made with Spotify</p>
            </div>
          </div>
        </div>
      ) : selectedPlaylist ? (
        <div className="tierlist-container">
          <button onClick={handleBackToPlaylists} className="back-button">
            ← Back to Playlists
          </button>
          <h2>Tierlist for: {selectedPlaylist.name}</h2>
          <TierList songs={playlistTracks} accessToken={accessToken} />
          <div className="made-with-spotify">
            <p>Made with Spotify</p>
          </div>
        </div>
      ) : (
        <div className="playlist-selector-container">
          <p>Select a playlist to create a tierlist:</p>
          <PlaylistSelector 
            accessToken={accessToken} 
            onSelect={handlePlaylistSelect} 
          />
          <div className="made-with-spotify">
            <p>Made with Spotify</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;