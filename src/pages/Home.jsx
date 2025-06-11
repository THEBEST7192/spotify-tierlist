import React, { useState, useMemo } from "react";
import AuthButton from "../components/AuthButton";
import LogoutButton from "../components/LogoutButton";
import PlaylistSelector from "../components/PlaylistSelector";
import TierList from "../components/TierList";
import UserProfile from "../components/UserProfile";
import SongGroupModal from "../components/SongGroupModal";
import { getPlaylistTracks } from "../utils/spotifyApi";
import "./Home.css";

const Home = ({ accessToken, setAccessToken }) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [showSongGroupModal, setShowSongGroupModal] = useState(false);
  const [pendingPlaylist, setPendingPlaylist] = useState(null);
  const [totalSongs, setTotalSongs] = useState(0);
  const [songGroupParams, setSongGroupParams] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [publicSearchQuery, setPublicSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("user");
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [isSearchingPublic, setIsSearchingPublic] = useState(false);
  const [publicSearchCache, setPublicSearchCache] = useState({});
  const [importedPlaylistName, setImportedPlaylistName] = useState('');

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
      setPendingPlaylist(playlist);
      // Fetch only the playlist metadata to get the total tracks count
      const metaResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const meta = await metaResponse.json();
      const tracksCount = meta.tracks?.total || 0;
      setTotalSongs(tracksCount);
      if (tracksCount > 100) {
        setShowSongGroupModal(true);
        setIsLoading(false);
        return;
      }
      // Fetch all tracks if 100 or less
      const response = await getPlaylistTracks(playlist.id);
      const tracks = response.data.items
        .filter(item => item.track)
        .map((item, index) => ({
          ...item.track,
          dragId: `track-${playlist.id}-${index}`
        }));
      setSelectedPlaylist(playlist);
      setPlaylistTracks(tracks);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching playlist tracks:", err);
      setError("Failed to load tracks from this playlist");
      setIsLoading(false);
    }
  };

  const handleSongGroupSelect = async (option) => {
    if (!pendingPlaylist) return;
    setShowSongGroupModal(false);
    setIsLoading(true);
    let offset = 0;
    if (option.type === "first") {
      offset = 0;
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, offset, 100);
        const tracks = response.data.items
          .filter(item => item.track)
          .map((item, index) => ({
            ...item.track,
            dragId: `track-${pendingPlaylist.id}-${index}`
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load tracks from this playlist");
        setIsLoading(false);
      }
      return;
    } else if (option.type === "middle") {
      offset = Math.floor((totalSongs - 100) / 2);
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, offset, 100);
        const tracks = response.data.items
          .filter(item => item.track)
          .map((item, index) => ({
            ...item.track,
            dragId: `track-${pendingPlaylist.id}-${index}`
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load tracks from this playlist");
        setIsLoading(false);
      }
      return;
    } else if (option.type === "last") {
      offset = totalSongs - 100;
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, offset, 100);
        const tracks = response.data.items
          .filter(item => item.track)
          .map((item, index) => ({
            ...item.track,
            dragId: `track-${pendingPlaylist.id}-${index}`
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load tracks from this playlist");
        setIsLoading(false);
      }
      return;
    } else if (option.type === "range") {
      // Fetch a specific range of songs
      const startIndex = option.start - 1;
      const count = option.end - option.start + 1;
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, startIndex, count);
        const tracks = response.data.items
          .filter(item => item.track)
          .map((item, index) => ({
            ...item.track,
            dragId: `track-${pendingPlaylist.id}-${index}`
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load tracks from this playlist");
        setIsLoading(false);
      }
      return;
    } else if (option.type === "random") {
      // Fetch all tracks from playlist (up to totalSongs)
      try {
        // Collect all track IDs (Spotify API max limit per call is 100, so may need batching)
        let allTracks = [];
        let fetched = 0;
        while (fetched < totalSongs) {
          const batchSize = Math.min(100, totalSongs - fetched);
          const resp = await getPlaylistTracks(pendingPlaylist.id, fetched, batchSize);
          const batchTracks = resp.data.items.filter(item => item.track).map(item => item.track);
          allTracks = allTracks.concat(batchTracks);
          fetched += batchSize;
        }
        // Randomly shuffle allTracks
        for (let i = allTracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
        }
        // Split into option.groups groups
        const groupCount = option.groups;
        const base = Math.floor(100 / groupCount);
        const remainder = 100 % groupCount;
        let sizes = Array.from({ length: groupCount }, (_, i) => base + (i < remainder ? 1 : 0));
        let selectedTracks = [];
        let start = 0;
        for (let size of sizes) {
          selectedTracks = selectedTracks.concat(allTracks.slice(start, start + size));
          start += size;
        }
        // Add dragId for each track
        selectedTracks = selectedTracks.slice(0, 100).map((track, index) => ({
          ...track,
          dragId: `track-${pendingPlaylist.id}-${index}`
        }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(selectedTracks);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load tracks from this playlist");
        setIsLoading(false);
      }
      return;
    }
  };

  // Reset playlist selection to return to playlist selector
  const handleBackToPlaylists = () => {
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  };

  if (isLoading) {
    return (
      <div className="loading">
        <img src="/Spotify_Primary_Logo_RGB_Green.png" alt="Loading..." className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="home-container">
      <header className="app-header">
        <h1>Tierlist Maker for Spotify</h1>
        <div className="header-controls">
          <img src="/Spotify_Primary_Logo_RGB_Green.png" alt="Spotify" className="spotify-logo" />
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
            <img src="/Spotify_Primary_Logo_RGB_Green.png" alt="Spotify" className="spotify-full-logo" />
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
          <h2>Tierlist for: {importedPlaylistName || selectedPlaylist.name}</h2>
          <TierList 
            songs={playlistTracks} 
            accessToken={accessToken}
            playlistName={importedPlaylistName || selectedPlaylist.name}
            onImport={(name) => setImportedPlaylistName(name)}
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
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            publicSearchQuery={publicSearchQuery}
            setPublicSearchQuery={setPublicSearchQuery}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            publicPlaylists={publicPlaylists}
            setPublicPlaylists={setPublicPlaylists}
            isSearchingPublic={isSearchingPublic}
            setIsSearchingPublic={setIsSearchingPublic}
            publicSearchCache={publicSearchCache}
            setPublicSearchCache={setPublicSearchCache}
          />
          <div className="made-with-spotify">
            <p>Made with Spotify</p>
          </div>
        </div>
      )}
      {showSongGroupModal && (
        <SongGroupModal
          totalSongs={totalSongs}
          onSelect={handleSongGroupSelect}
          onClose={() => setShowSongGroupModal(false)}
        />
      )}
    </div>
  );
};

export default Home;