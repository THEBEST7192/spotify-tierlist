import React, { useEffect, useState, useCallback, useRef } from "react";
import { getUserPlaylists, searchPlaylists, getPlaylistById, getCurrentUser } from "../utils/spotifyApi";
import { getPublicTierlists, getUserTierlists } from "../utils/backendApi";
import "./PlaylistSelector.css";

// Helper function to decode HTML entities in text
const decodeHtmlEntities = (text) => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const PlaylistSelector = ({
  onSelect,
  searchQuery,
  setSearchQuery,
  publicSearchQuery,
  setPublicSearchQuery,
  searchMode,
  setSearchMode,
  publicPlaylists,
  setPublicPlaylists,
  isSearchingPublic,
  setIsSearchingPublic,
  publicSearchCache,
  setPublicSearchCache,
  onSelectLocalTierlist,
  onSelectOnlineTierlist
}) => {
  const [playlists, setPlaylists] = useState([]);
  const [filteredPlaylists, setFilteredPlaylists] = useState([]);
  const [localTierlists, setLocalTierlists] = useState([]);
  const [onlineTierlists, setOnlineTierlists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
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
    if (typeof window === "undefined") return;
    try {
      const lists = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith("tierlist:local:")) continue;
        const parts = key.split(":");
        if (parts.length < 3) continue;
        const localId = parts[2];
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        let saved;
        try {
          saved = JSON.parse(raw);
        } catch {
          continue;
        }
        const name =
          (saved && (saved.tierListName || (saved.state && saved.state.tierListName))) ||
          "Local Tierlist";
        const playlistLike = {
          id: localId,
          name,
          description: "Local tierlist",
          images: [],
          owner: { display_name: "You (local)" },
          _localId: localId,
          _kind: "local-tierlist"
        };
        lists.push(playlistLike);
      }
      lists.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setLocalTierlists(lists);
    } catch (e) {
      console.error("Error loading local tierlists:", e);
    }
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

  const SPOTIFY_PLAYLIST_URL_REGEX = /^(?:https?:\/\/)?(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([a-zA-Z0-9]+)(?:\?.*)?$/;

  const handlePublicSearch = async () => {
    if (!publicSearchQuery.trim()) return;
    setIsLoading(true);

    const match = publicSearchQuery.match(SPOTIFY_PLAYLIST_URL_REGEX);
    if (match) {
      const playlistId = match[1];
      try {
        const response = await getPlaylistById(playlistId);
        const playlist = response.data;
        if (playlist) {
          onSelect(playlist);
          setIsSearchingPublic(false);
          setPublicSearchQuery('');
        } else {
          setError("Playlist not found.");
        }
      } catch (error) {
        console.error("Error fetching playlist by ID:", error);
        setError("Failed to load playlist from URL.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

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
      setError(`Failed to search public playlists: ${error.response?.data?.error?.message || error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchModeChange = (mode) => {
    setSearchMode(mode);
    if (mode !== "public") {
      setIsSearchingPublic(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && searchMode === "public") {
      handlePublicSearch();
    }
  };

  const displayPlaylists =
    searchMode === "user"
      ? filteredPlaylists
      : searchMode === "public"
      ? publicPlaylists
      : searchMode === "local"
      ? localTierlists
      : searchMode === "online"
      ? onlineTierlists
      : [];

  useEffect(() => {
    if (searchMode !== "online") return;

    let cancelled = false;

    const loadOnlineTierlists = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let userId = null;
        try {
          const userResponse = await getCurrentUser();
          userId = userResponse && userResponse.data && userResponse.data.id;
        } catch {
          userId = null;
        }

        const publicListsPromise = getPublicTierlists();
        const userListsPromise = userId ? getUserTierlists(userId) : Promise.resolve([]);

        const [publicLists, userLists] = await Promise.all([publicListsPromise, userListsPromise]);

        const combined = [];
        if (Array.isArray(publicLists)) combined.push(...publicLists);
        if (Array.isArray(userLists)) combined.push(...userLists);

        const seen = new Set();
        const normalized = [];

        combined.forEach((list) => {
          if (!list || !list.shortId || seen.has(list.shortId)) return;
          seen.add(list.shortId);
          normalized.push({
            id: list.shortId,
            name: list.tierListName || "Untitled Tierlist",
            description: list.isPublic ? "Online public tierlist" : "Online private tierlist",
            images: list.coverImage ? [{ url: list.coverImage }] : [],
            owner: { display_name: list.username || "Unknown" },
            _shortId: list.shortId,
            _kind: "online-tierlist",
            isPublic: !!list.isPublic
          });
        });

        normalized.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        if (!cancelled) {
          setOnlineTierlists(normalized);
        }
      } catch (err) {
        console.error("Error loading online tierlists:", err);
        if (!cancelled) {
          setError("Failed to load online tierlists");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadOnlineTierlists();

    return () => {
      cancelled = true;
    };
  }, [searchMode]);

  const handlePlaylistClick = (playlist) => {
    if (searchMode === "local" && playlist && playlist._localId && typeof onSelectLocalTierlist === "function") {
      onSelectLocalTierlist(playlist._localId);
      return;
    }

    if (searchMode === "online" && playlist && playlist._shortId && typeof onSelectOnlineTierlist === "function") {
      onSelectOnlineTierlist(playlist._shortId);
      return;
    }

    if (typeof onSelect === "function") {
      onSelect(playlist);
    }
  };

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
        <button 
          className={`toggle-btn ${searchMode === "local" ? "active" : ""}`}
          onClick={() => handleSearchModeChange("local")}
        >
          Local Playlist
        </button>
        <button 
          className={`toggle-btn ${searchMode === "online" ? "active" : ""}`}
          onClick={() => handleSearchModeChange("online")}
        >
          Online Playlists
        </button>
      </div>

      {searchMode === "user" && (
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search your playlists..."
            value={searchQuery}
            ref={searchInputRef}
            onKeyDown={(e) => {
              if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                checkKonamiCode(e.key.toLowerCase());
              }
            }}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}
      {searchMode === "public" && (
        <div className="search-input-wrapper">
          <div className="public-search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search for public playlists..."
              value={publicSearchQuery}
              ref={publicSearchInputRef}
              onKeyDown={(e) => {
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
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

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
              onClick={() => handlePlaylistClick(playlist)}
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
