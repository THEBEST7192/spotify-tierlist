import React, { useEffect, useState } from "react";
import axios from "axios";
import "./PlaylistSelector.css";

const PlaylistSelector = ({ accessToken, onSelect }) => {
  const [playlists, setPlaylists] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredPlaylists, setFilteredPlaylists] = useState([]);
  const [publicSearchQuery, setPublicSearchQuery] = useState("");
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [isSearchingPublic, setIsSearchingPublic] = useState(false);
  const [searchMode, setSearchMode] = useState("user"); // "user" or "public"
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    axios
      .get("https://api.spotify.com/v1/me/playlists", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        setPlaylists(res.data.items);
        setFilteredPlaylists(res.data.items);
      })
      .catch((err) => console.error("Error fetching playlists:", err));
  }, [accessToken]);

  useEffect(() => {
    if (searchMode === "user") {
      if (!searchQuery) {
        setFilteredPlaylists(playlists);
        return;
      }
      
      const filtered = playlists.filter(playlist => 
        playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (playlist.description && playlist.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (playlist.owner && playlist.owner.display_name && playlist.owner.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredPlaylists(filtered);
    }
  }, [searchQuery, playlists, searchMode]);

  const searchPublicPlaylists = async () => {
    if (!publicSearchQuery.trim() || !accessToken) return;
    
    setIsLoading(true);
    try {
      const response = await axios.get(`https://api.spotify.com/v1/search`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          q: publicSearchQuery,
          type: "playlist",
          limit: 50
        }
      });
      
      // Make sure we have valid playlist items before setting them
      const items = response.data.playlists?.items || [];
      const validPlaylists = items.filter(item => item != null);
      
      setPublicPlaylists(validPlaylists);
      setIsSearchingPublic(true);
    } catch (error) {
      console.error("Error searching public playlists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchModeChange = (mode) => {
    setSearchMode(mode);
    if (mode === "user") {
      setIsSearchingPublic(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && searchMode === "public") {
      searchPublicPlaylists();
    }
  };

  const displayPlaylists = searchMode === "user" ? filteredPlaylists : publicPlaylists;

  return (
    <div className="playlist-selector-container">
      <h2>Select a Playlist</h2>
      
      <div className="search-mode-toggle">
        <button 
          className={`toggle-btn ${searchMode === "user" ? "active" : ""}`}
          onClick={() => handleSearchModeChange("user")}
        >
          My Playlists
        </button>
        <button 
          className={`toggle-btn ${searchMode === "public" ? "active" : ""}`}
          onClick={() => handleSearchModeChange("public")}
        >
          Search Public Playlists
        </button>
      </div>

      {searchMode === "user" ? (
        <input
          type="text"
          className="search-input"
          placeholder="Search your playlists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      ) : (
        <div className="public-search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search for public playlists..."
            value={publicSearchQuery}
            onChange={(e) => setPublicSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="search-button" 
            onClick={searchPublicPlaylists}
            disabled={isLoading}
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>
      )}

      <div className="playlist-grid">
        {displayPlaylists && displayPlaylists.length > 0 ? displayPlaylists.map((playlist) => {
          // Skip null playlists
          if (!playlist) return null;
          
          // Get image URL safely
          const imageUrl = playlist.images && 
                          playlist.images.length > 0 && 
                          playlist.images[0] ? 
                          playlist.images[0].url : 
                          '/default-playlist-cover.png';
          
          // Get owner display name safely
          const ownerName = playlist.owner && playlist.owner.display_name ? 
                           playlist.owner.display_name : 
                           'Unknown';
          
          return (
            <button
              key={playlist.id || Math.random().toString()}
              className="playlist-button"
              onClick={() => onSelect(playlist)}
            >
              <img
                src={imageUrl}
                alt={playlist.name || 'Playlist'}
                className="playlist-cover"
              />
              <div className="playlist-info">
                <h3 className="playlist-name">{playlist.name || 'Untitled Playlist'}</h3>
                <p className="playlist-creator">Created by: {ownerName}</p>
                <p className="playlist-description">{playlist.description || 'No description available'}</p>
              </div>
            </button>
          );
        }) : (
          searchMode === "public" && isSearchingPublic ? 
          <div className="no-results">No playlists found matching your search</div> :
          null
        )}
        {displayPlaylists && displayPlaylists.length === 0 && searchMode === "public" && isSearchingPublic && (
          <div className="no-results">No playlists found matching your search</div>
        )}
      </div>
    </div>
  );
};

export default PlaylistSelector;
