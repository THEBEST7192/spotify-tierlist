import React, { useState, useMemo } from "react";
import AuthButton from "../components/AuthButton";
import LogoutButton from "../components/LogoutButton";
import PlaylistSelector from "../components/PlaylistSelector";
import TierList from "../components/TierList";
import UserProfile from "../components/UserProfile";
import spotifyLogoOfficial from "../assets/spotify/spotify-logo-official.png";
import { getPlaylistTracks } from "../utils/spotifyApi";
import "./Home.css";

const Home = ({ accessToken, setAccessToken }) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  // Handle logout
  const handleLogout = () => {
    // Clear all cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Reset state
    setAccessToken(null);
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
    
    // Open Spotify logout in a new window/tab
    const spotifyLogoutWindow = window.open('https://accounts.spotify.com/logout', '_blank');
    
    // Close the window after a short delay
    setTimeout(() => {
      if (spotifyLogoutWindow) {
        spotifyLogoutWindow.close();
      }
    }, 1000);
  };

  // Handle playlist selection
  const handlePlaylistSelect = async (playlist) => {
    try {
      setIsLoading(true);
      setError(null);
      
      setSelectedPlaylist(playlist);
      
      // Fetch the tracks for the selected playlist
      const response = await getPlaylistTracks(playlist.id);
      
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
          {accessToken && (
            <>
              <UserProfile accessToken={accessToken} />
              <LogoutButton onLogout={handleLogout} />
            </>
          )}
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
          <TierList 
            songs={playlistTracks} 
            accessToken={accessToken} 
          />
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