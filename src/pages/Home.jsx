import React, { useState } from "react";
import AuthButton from "../components/AuthButton";
import PlaylistSelector from "../components/PlaylistSelector";
import TierListPage from "./TierListPage";

const Home = ({ accessToken, setAccessToken }) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle playlist selection
  const handlePlaylistSelect = (playlist) => {
    // Add access token to the playlist object for use in TierListPage
    setSelectedPlaylist({
      ...playlist,
      accessToken
    });
  };

  // Reset playlist selection to return to playlist selector
  const handleBackToPlaylists = () => {
    setSelectedPlaylist(null);
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
          <TierListPage playlist={selectedPlaylist} />
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