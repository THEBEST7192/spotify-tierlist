import React, { useEffect, useState, useCallback, useRef } from "react";
import { getUserPlaylists, searchPlaylists } from "../utils/spotifyApi";
import "./PlaylistSelector.css";

// Helper function to decode HTML entities in text
const decodeHtmlEntities = (text) => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const PlaylistSelector = ({ onSelect, searchQuery, setSearchQuery, publicSearchQuery, setPublicSearchQuery, searchMode, setSearchMode, publicPlaylists, setPublicPlaylists, isSearchingPublic, setIsSearchingPublic, publicSearchCache, setPublicSearchCache }) => {
  const [playlists, setPlaylists] = useState([]);
  const [filteredPlaylists, setFilteredPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const konamiCode = ['w', 'w', 's', 's', 'a', 'd', 'a', 'd', 'b', 'a'];
  const debugModeCode = ['d', 'e', 'b', 'u', 'g', 'm', 'o', 'd', 'e'];
  const konamiIndex = useRef(0);
  const debugModeIndex = useRef(0);
  const searchInputRef = useRef(null);
  const publicSearchInputRef = useRef(null);

  const checkKonamiCode = useCallback((key) => {
    // Check for Konami code
    if (key === konamiCode[konamiIndex.current]) {
      konamiIndex.current++;
      if (konamiIndex.current === konamiCode.length) {
        // Dispatch a custom event that the Home component can listen for
        window.dispatchEvent(new CustomEvent('konamiCodeActivated'));
        konamiIndex.current = 0;
      }
    } else {
      konamiIndex.current = 0;
    }
    
    // Check for debug mode code
    if (key === debugModeCode[debugModeIndex.current]) {
      debugModeIndex.current++;
      if (debugModeIndex.current === debugModeCode.length) {
        // Dispatch a custom event for debug mode
        window.dispatchEvent(new CustomEvent('debugModeActivated'));
        debugModeIndex.current = 0;
      }
    } else {
      debugModeIndex.current = 0;
    }
  }, []);

  useEffect(() => {
    const fetchUserPlaylists = async () => {
      try {
        const response = await getUserPlaylists();
        setPlaylists(response.data.items);
        setFilteredPlaylists(response.data.items);
      } catch (err) {
        console.error("Error fetching playlists:", err);
      }
    };

    fetchUserPlaylists();
  }, []);

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

  const handlePublicSearch = async () => {
    if (!publicSearchQuery.trim()) return;
    setIsLoading(true);
    // Check cache first
    if (publicSearchCache[publicSearchQuery]) {
      setPublicPlaylists(publicSearchCache[publicSearchQuery]);
      setIsSearchingPublic(true);
      setIsLoading(false);
      return;
    }
    try {
      const response = await searchPlaylists(publicSearchQuery);
      
      // Make sure we have valid playlist items before setting them
      const items = response.data.playlists?.items || [];
      const validPlaylists = items.filter(item => item != null);
      
      setPublicPlaylists(validPlaylists);
      setPublicSearchCache({ ...publicSearchCache, [publicSearchQuery]: validPlaylists });
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
      handlePublicSearch();
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
          ref={searchInputRef}
          onKeyDown={(e) => {
            // Only process letter keys for Konami code
            if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
              checkKonamiCode(e.key.toLowerCase());
            }
          }}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      ) : (
        <div className="public-search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search for public playlists..."
            value={publicSearchQuery}
            ref={publicSearchInputRef}
            onKeyDown={(e) => {
              // Only process letter keys for Konami code
              if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                checkKonamiCode(e.key.toLowerCase());
              }
            }}
            onChange={(e) => setPublicSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="search-button" 
            onClick={handlePublicSearch}
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
                <p className="playlist-description">
                  {playlist.description ? decodeHtmlEntities(playlist.description) : 'No description available'}
                </p>
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
