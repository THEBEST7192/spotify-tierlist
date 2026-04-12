import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import PlaylistSelector from "../components/PlaylistSelector";
import TierList from "../components/TierList";
import SongGroupModal from "../components/SongGroupModal";
import { PLACEHOLDER_COLORS } from '../constants';
import { getPlaylistTracks } from "../utils/spotifyApi";
import { getTierlist } from "../utils/backendApi";

import "./Home.css";

const getHttpStatus = (error) => error?.response?.status;

const getBackendErrorMessage = (error) => {
  if (!error) return '';
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.error ||
    error.message ||
    ''
  );
};

const describeHttpError = (error) => {
  const status = getHttpStatus(error);
  const backendMessage = getBackendErrorMessage(error);
  if (status && backendMessage) {
    return `${backendMessage} (HTTP ${status})`;
  }
  if (status) {
    return `Unexpected error (HTTP ${status})`;
  }
  return backendMessage || 'Unexpected error';
};

const buildPlaylistLoadError = (error, playlistName) => {
  const friendlyName = playlistName ? `"${playlistName}"` : 'this playlist';
  const detail = describeHttpError(error);
  return `Failed to load tracks from ${friendlyName}: ${detail}`;
};

const buildSharedTierlistError = (error) => {
  const status = getHttpStatus(error);
  if (status === 403) {
    return 'Tierlist is private. Please open it while logged into the Spotify account that created it.';
  }
  if (status === 404) {
    return 'Tierlist not found. The link may be invalid or the tierlist was deleted.';
  }
  const detail = describeHttpError(error);
  return `Failed to load tierlist: ${detail}`;
};

const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const Home = ({ accessToken, setAccessToken, setAuthToken, tuneTierUser, setTuneTierUser }) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [showSongGroupModal, setShowSongGroupModal] = useState(false);
  const [pendingPlaylist, setPendingPlaylist] = useState(null);
  const [totalSongs, setTotalSongs] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("online");
  const [hasProceededToPlaylists, setHasProceededToPlaylists] = useState(false);
  const [importedPlaylistName, setImportedPlaylistName] = useState('');
  const [importedTierlistData, setImportedTierlistData] = useState(null);
  const [konamiActive, setKonamiActive] = useState(false);
  const [debugModeActive, setDebugModeActive] = useState(false);
  const [showKonamiMessage, setShowKonamiMessage] = useState(false);
  const [showDebugMessage, setShowDebugMessage] = useState(false);
  const [sharedTierlist, setSharedTierlist] = useState(null);
  const [loadingColor, setLoadingColor] = useState('#1DB954'); // Initial color
  const [dotCount, setDotCount] = useState(0); // Initial dot count
  const { shortId, songId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const canUseOnlineTierlists = !!tuneTierUser;

  useEffect(() => {
    // Allow online tierlists to be viewed even without login
  }, [canUseOnlineTierlists, searchMode]);

  const genLocalId = useCallback(() => {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }, []);

  const getLocalIdForPlaylist = useCallback((pid) => {
    try {
      const key = `localIdFor:${pid}`;
      let id = localStorage.getItem(key);
      if (!id) {
        id = genLocalId();
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return pid;
    }
  }, [genLocalId]);

  const getStoredLocalTierlistName = useCallback((localId) => {
    try {
      const raw = localStorage.getItem(`tierlist:local:${localId}`);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      return saved?.tierListName || saved?.state?.tierListName || null;
    } catch {
      return null;
    }
  }, []);


  const konamiIndexRef = useRef(0);

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
    if (accessToken) {
      // Only clear Spotify-related state if logged into Spotify
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
      }, 2000);
    }
    
    // Always clear TuneTier auth state
    setAuthToken(null);
    setTuneTierUser(null);
  };

  // Function to toggle Konami code
  const toggleKonamiCode = useCallback(() => {
    const newState = !konamiActive;
    setKonamiActive(newState);
    setShowKonamiMessage(true);
    
    // Play different sound based on new state
    const soundFile = newState ? '/assets/sounds/konami.wav' : '/assets/sounds/konami-off.wav';
    const audio = new Audio(soundFile);
    audio.volume = 0.5; // Slightly reduce volume for better UX
    audio.play().catch(e => console.log('Audio play failed:', e));
    
    // Hide message after 5 seconds
    setTimeout(() => setShowKonamiMessage(false), 5000);
  }, [konamiActive]);

  // Konami code detection - arrow keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === konamiCode[konamiIndexRef.current]) {
        konamiIndexRef.current++;
        if (konamiIndexRef.current === konamiCode.length) {
          toggleKonamiCode();
          konamiIndexRef.current = 0;
        }
      } else {
        konamiIndexRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleKonamiCode]);

  // Function to toggle Debug mode
  const toggleDebugMode = useCallback(() => {
    const newState = !debugModeActive;
    setDebugModeActive(newState);
    setShowDebugMessage(true);
    
    // Play sound similar to Konami code
    const soundFile = newState ? '/assets/sounds/konami.wav' : '/assets/sounds/konami-off.wav';
    const audio = new Audio(soundFile);
    audio.volume = 0.5; // Slightly reduce volume for better UX
    audio.play().catch(e => console.log('Audio play failed:', e));
    
    // Hide message after 5 seconds
    setTimeout(() => setShowDebugMessage(false), 5000);
  }, [debugModeActive]);

  // Listen for Konami code activation from search bar
  useEffect(() => {
    const handleKonamiActivation = () => {
      toggleKonamiCode();
    };

    const handleDebugModeActivation = () => {
      toggleDebugMode();
    };

    window.addEventListener('konamiCodeActivated', handleKonamiActivation);
    window.addEventListener('debugModeActivated', handleDebugModeActivation);
    
    return () => {
      window.removeEventListener('konamiCodeActivated', handleKonamiActivation);
      window.removeEventListener('debugModeActivated', handleDebugModeActivation);
    };
  }, [toggleKonamiCode, toggleDebugMode]);

  useEffect(() => {
    let i = 0;

    const interval = setInterval(() => {
      setLoadingColor(PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length]);
      setDotCount(i % 4);
      i = i + 1;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handlePlaylistSelect = useCallback(async (playlist) => {
    try {
      // console.log('[Home] handlePlaylistSelect', {
      //   playlistId: playlist?.id,
      //   name: playlist?.name,
      //   konamiActive,
      //   accessTokenPresent: !!accessToken
      // });

      setSharedTierlist(null);
      setIsLoading(true);
      setError(null);

      setPendingPlaylist(playlist);
      // Get total tracks count from items paging
      const metaResp = await getPlaylistTracks(playlist.id, 0, 1);
      const tracksCount = metaResp?.data?.total || 0;
      setTotalSongs(tracksCount);
      // console.log('[Home] playlist meta', {
      //   playlistId: playlist.id,
      //   tracksCount
      // });

      // Only show song group modal if not in konami mode and tracks > 100
      if (tracksCount > 100 && !konamiActive) {
        setShowSongGroupModal(true);
        setIsLoading(false);
        return;
      }
      
      // In konami mode or tracks <= 100, fetch all tracks at once
      const allTracks = [];
      let offset = 0;
      const limit = konamiActive ? 50 : 100; // Smaller batches in konami mode to avoid rate limiting
      
      while (offset < tracksCount) {
        const response = await getPlaylistTracks(playlist.id, offset, limit);
        const tracks = (response.data.items || [])
          .map((item) => item?.track ?? item?.item ?? item?.content ?? null)
          .filter(Boolean)
          .map((track, index) => ({
            ...track,
            dragId: `track-${playlist.id}-${offset + index}`,
            placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
          }));
        allTracks.push(...tracks);
        offset += limit;
      }
      // console.log('[Home] fetched all tracks', {
      //   playlistId: playlist.id,
      //   totalFetched: allTracks.length
      // });
      
      setSelectedPlaylist(playlist);
      setPlaylistTracks(allTracks);
      const localId = getLocalIdForPlaylist(playlist.id);
      const storedName = getStoredLocalTierlistName(localId);
      const effectiveName = storedName || importedPlaylistName || playlist.name || '';
      // console.log('[Home] navigating to local route from handlePlaylistSelect', {
      //   playlistId: playlist.id,
      //   localId,
      //   songsCount: allTracks.length
      // });
      navigate(`/local/${localId}`, {
        state: {
          fromPlaylistSelect: true,
          selectedPlaylist: { ...playlist, name: effectiveName },
          playlistTracks: allTracks,
          importedPlaylistName: effectiveName
        }
      });
      setImportedPlaylistName(effectiveName);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching playlist tracks:", err);
      setError(buildPlaylistLoadError(err, playlist?.name));
      setIsLoading(false);
    }
  }, [navigate, konamiActive, importedPlaylistName, getLocalIdForPlaylist, getStoredLocalTierlistName, setImportedPlaylistName]);

  const handleLocalTierlistSelect = (localId) => {
    navigate(`/local/${localId}`);
  };

  const handleOnlineTierlistSelect = (shortId) => {
    navigate(`/tierlists/${shortId}`);
  };

  const handleSelectImported = ({ name, description, tracks }) => {
    const localId = genLocalId();
    const tierlistData = {
      tierListName: name,
      description,
      tiers: {
        S: { color: "#FF7F7F", label: "S" },
        A: { color: "#FFBF7F", label: "A" },
        B: { color: "#FFFF7F", label: "B" },
        C: { color: "#7FFF7F", label: "C" },
        D: { color: "#7FBFFF", label: "D" },
        E: { color: "#BF7FFF", label: "E" },
        F: { color: "#FF7FBF", label: "F" },
        Unranked: { color: "#E0E0E0", label: "Unranked" }
      },
      tierOrder: ["S", "A", "B", "C", "D", "E", "F", "Unranked"],
      state: {
        tierListName: name,
        description,
        tierOrder: ["S", "A", "B", "C", "D", "E", "F", "Unranked"],
        S: [],
        A: [],
        B: [],
        C: [],
        D: [],
        E: [],
        F: [],
        Unranked: tracks.map(track => ({ 
          content: {
            ...track,
            placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
          }, 
          id: `track-${track.id}-${Math.random().toString(36).slice(2, 10)}` 
        }))
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    localStorage.setItem(`tierlist:local:${localId}`, JSON.stringify(tierlistData));
    navigate(`/local/${localId}`, {
      state: {
        fromPlaylistSelect: true,
        selectedPlaylist: { id: localId, name: tierlistData.tierListName },
        playlistTracks: tracks
      }
    });
  };

  const handleSongGroupSelect = async (option) => {
    if (!pendingPlaylist) return;

    // console.log('[Home] handleSongGroupSelect', {
    //   option,
    //   pendingPlaylistId: pendingPlaylist.id,
    //   totalSongs
    // });

    setShowSongGroupModal(false);
    setIsLoading(true);
    
    let offset = 0;
    if (option.type === "first") {
      offset = 0;
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, offset, 100);
        const tracks = (response.data.items || [])
          .map((item) => item?.track ?? item?.item ?? item?.content ?? null)
          .filter(Boolean)
          .map((track, index) => ({
            ...track,
            dragId: `track-${pendingPlaylist.id}-${index}`,
            placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        const localId = getLocalIdForPlaylist(pendingPlaylist.id);
        const storedName = getStoredLocalTierlistName(localId);
        const effectiveName = storedName || importedPlaylistName || pendingPlaylist.name || '';
        // console.log('[Home] songGroupSelect result', {
        //   type: option.type,
        //   playlistId: pendingPlaylist.id,
        //   localId,
        //   songsCount: tracks.length
        // });
        navigate(`/local/${localId}`, {
          state: {
            fromPlaylistSelect: true,
            selectedPlaylist: { ...pendingPlaylist, name: effectiveName },
            playlistTracks: tracks,
            importedPlaylistName: effectiveName
          }
        });
        setImportedPlaylistName(effectiveName);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load tracks from this playlist:", error);
        setError(buildPlaylistLoadError(error, pendingPlaylist?.name));
        setIsLoading(false);
      }
      return;
    } else if (option.type === "middle") {
      offset = Math.floor((totalSongs - 100) / 2);
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, offset, 100);
        const tracks = (response.data.items || [])
          .map((item) => item?.track ?? item?.item ?? item?.content ?? null)
          .filter(Boolean)
          .map((track, index) => ({
            ...track,
            dragId: `track-${pendingPlaylist.id}-${index}`,
            placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        const localId = getLocalIdForPlaylist(pendingPlaylist.id);
        const storedName = getStoredLocalTierlistName(localId);
        const effectiveName = storedName || importedPlaylistName || pendingPlaylist.name || '';
        // console.log('[Home] songGroupSelect result', {
        //   type: option.type,
        //   playlistId: pendingPlaylist.id,
        //   localId,
        //   songsCount: tracks.length
        // });
        navigate(`/local/${localId}`, {
          state: {
            fromPlaylistSelect: true,
            selectedPlaylist: { ...pendingPlaylist, name: effectiveName },
            playlistTracks: tracks,
            importedPlaylistName: effectiveName
          }
        });
        setImportedPlaylistName(effectiveName);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load tracks from this playlist:", error);
        setError(buildPlaylistLoadError(error, pendingPlaylist?.name));
        setIsLoading(false);
      }
      return;
    } else if (option.type === "last") {
      offset = totalSongs - 100;
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, offset, 100);
        const tracks = (response.data.items || [])
          .map((item) => item?.track ?? item?.item ?? item?.content ?? null)
          .filter(Boolean)
          .map((track, index) => ({
            ...track,
            dragId: `track-${pendingPlaylist.id}-${index}`,
            placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        const localId = getLocalIdForPlaylist(pendingPlaylist.id);
        const storedName = getStoredLocalTierlistName(localId);
        const effectiveName = storedName || importedPlaylistName || pendingPlaylist.name || '';
        // console.log('[Home] songGroupSelect result', {
        //   type: option.type,
        //   playlistId: pendingPlaylist.id,
        //   localId,
        //   songsCount: tracks.length
        // });
        navigate(`/local/${localId}`, {
          state: {
            fromPlaylistSelect: true,
            selectedPlaylist: { ...pendingPlaylist, name: effectiveName },
            playlistTracks: tracks,
            importedPlaylistName: effectiveName
          }
        });
        setImportedPlaylistName(effectiveName);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load tracks from this playlist:", error);
        setError(buildPlaylistLoadError(error, pendingPlaylist?.name));
        setIsLoading(false);
      }
      return;
    } else if (option.type === "range") {
      // Fetch a specific range of songs
      const startIndex = option.start - 1;
      const count = option.end - option.start + 1;
      try {
        const response = await getPlaylistTracks(pendingPlaylist.id, startIndex, count);
        const tracks = (response.data.items || [])
          .map((item) => item?.track ?? item?.item ?? item?.content ?? null)
          .filter(Boolean)
          .map((track, index) => ({
            ...track,
            dragId: `track-${pendingPlaylist.id}-${index}`,
            placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
          }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(tracks);
        const localId = getLocalIdForPlaylist(pendingPlaylist.id);
        const storedName = getStoredLocalTierlistName(localId);
        const effectiveName = storedName || importedPlaylistName || pendingPlaylist.name || '';
        // console.log('[Home] songGroupSelect result', {
        //   type: option.type,
        //   playlistId: pendingPlaylist.id,
        //   localId,
        //   songsCount: tracks.length
        // });
        navigate(`/local/${localId}`, {
          state: {
            fromPlaylistSelect: true,
            selectedPlaylist: { ...pendingPlaylist, name: effectiveName },
            playlistTracks: tracks,
            importedPlaylistName: effectiveName
          }
        });
        setImportedPlaylistName(effectiveName);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load tracks from this playlist:", error);
        setError(buildPlaylistLoadError(error, pendingPlaylist?.name));
        setIsLoading(false);
      }
      return;
    } else if (option.type === "random") {
      // Fetch all tracks from playlist (up to totalSongs)
      try {
        let allTracks = [];
        let fetched = 0;
        while (fetched < totalSongs) {
          const batchSize = Math.min(100, totalSongs - fetched);
          const resp = await getPlaylistTracks(pendingPlaylist.id, fetched, batchSize);
          const batchTracks = (resp.data.items || [])
            .map((item) => item?.track ?? item?.item ?? item?.content ?? null)
            .filter(Boolean);
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
          dragId: `track-${pendingPlaylist.id}-${index}`,
          placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
        }));
        setSelectedPlaylist(pendingPlaylist);
        setPlaylistTracks(selectedTracks);
        const localId = getLocalIdForPlaylist(pendingPlaylist.id);
        const storedName = getStoredLocalTierlistName(localId);
        const effectiveName = storedName || importedPlaylistName || pendingPlaylist.name || '';
        // console.log('[Home] songGroupSelect result', {
        //   type: option.type,
        //   playlistId: pendingPlaylist.id,
        //   localId,
        //   songsCount: selectedTracks.length
        // });
        navigate(`/local/${localId}`, {
          state: {
            fromPlaylistSelect: true,
            selectedPlaylist: { ...pendingPlaylist, name: effectiveName },
            playlistTracks: selectedTracks,
            importedPlaylistName: effectiveName
          }
        });
        setImportedPlaylistName(effectiveName);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load tracks from this playlist:", error);
        setError(buildPlaylistLoadError(error, pendingPlaylist?.name));
        setIsLoading(false);
      }
      return;
    }
  };

  // Reset playlist selection to return to playlist selector
  const handleBackToPlaylists = () => {
    // console.log('[Home] handleBackToPlaylists', { prevSelectedPlaylistId: selectedPlaylist?.id });
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
    setImportedPlaylistName('');
    setSharedTierlist(null);
    navigate('/');
  };

  useEffect(() => {
    if (!shortId) {
      setSharedTierlist(null);
      return;
    }

    let isMounted = true;

    const applyTierlistData = async (data) => {
      setSharedTierlist(data);
      const name = data?.state?.tierListName || data?.tierListName || 'Shared Spotify Tierlist';
      setImportedPlaylistName(name);
      setSelectedPlaylist({
        id: `shared-${shortId}`,
        name,
        owner: data?.username || undefined
      });
      setPlaylistTracks([]);
      setPendingPlaylist(null);
      setShowSongGroupModal(false);

      // Create local editable copy for online tierlists
      if (shortId && !window.location.pathname.includes('/local/')) {
        try {
          // Extract all songs from the tierlist state
          const tierState = data?.state || {};
          const tierOrder = data?.tierOrder || Object.keys(tierState).filter(key => Array.isArray(tierState[key]));
          const allSongs = [];

          // Collect all songs from all tiers
          tierOrder.forEach(tierName => {
            const tierSongs = tierState[tierName] || [];
            tierSongs.forEach(songEntry => {
              const song = songEntry?.content || songEntry;
              if (song && song.id) {
                allSongs.push({
                  ...song,
                  dragId: `track-${song.id}-${Math.random().toString(36).slice(2, 10)}`,
                  placeholderColor: song.placeholderColor || PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
                });
              }
            });
          });

          // Store the online tierlist data for editing at /tierlists/ID
          const onlineTierlistData = {
            ...data,
            onlineShortId: shortId,
            onlineUsername: data?.username,
            onlineOwnerUserId: data?.ownerUserId,
            isOnlineTierlist: true,
            isPublic: data?.isPublic
          };
          
          // Save to localStorage using the shortId key
          localStorage.setItem(`tierlist:${shortId}`, JSON.stringify(onlineTierlistData));

          // Stay at /tierlists/shortId - don't navigate to local copy
          setSharedTierlist(data);
        } catch (err) {
          console.error('Failed to create local copy for online tierlist:', err);
        }
      }
    };

    const loadSharedTierlist = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getTierlist(shortId);
        if (!isMounted) return;
        applyTierlistData(data);
      } catch (err) {
        if (!isMounted) return;
        setError(buildSharedTierlistError(err));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSharedTierlist();

    return () => {
      isMounted = false;
    };
  }, [shortId]);

  useEffect(() => {
    if (location.pathname === '/') {
      setSharedTierlist(null);
      setSelectedPlaylist(null);
      setPlaylistTracks([]);
      setImportedPlaylistName('');
      setImportedTierlistData(null);
      setPendingPlaylist(null);
      setShowSongGroupModal(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!songId) {
      return;
    }

    // Handle navigation state from imports
    if (location.state?.fromPlaylistSelect) {
      setSharedTierlist(null); // Clear shared tierlist when importing/selecting a new one
      const isImport = location.state.fromPlaylistSelect && location.state.selectedPlaylist?.name;
      const fallbackName = location.state.selectedPlaylist?.name || 'Local Spotify Tierlist';
      const nameFromState = isImport ? fallbackName : null;
      
      if (nameFromState) {
        setImportedPlaylistName(nameFromState);
        setSelectedPlaylist({ ...location.state.selectedPlaylist, name: nameFromState });
      }
      
      if (Array.isArray(location.state.playlistTracks)) {
        setPlaylistTracks(location.state.playlistTracks);
      }
      
      // Extract initialTierlist from navigation state for JSON imports
      if (location.state?.initialTierlist) {
        setImportedTierlistData(location.state.initialTierlist);
      } else {
        setImportedTierlistData(null); // Clear previous imported data if not present
      }
      
      setPendingPlaylist(null);
      setShowSongGroupModal(false);
      return;
    }

    // Don't override if we're coming from an import (but we handled it above)
    if (location.state?.fromPlaylistSelect) {
      return;
    }

    // console.log('[Home] songId effect triggered', {
    //   songId,
    //   locationState: location.state
    // });

    setSharedTierlist(null);

    let saved = null;
    let storedName = null;
    try {
      const raw = localStorage.getItem(`tierlist:local:${songId}`);
      saved = raw ? JSON.parse(raw) : null;
      storedName = saved?.tierListName || saved?.state?.tierListName || null;
      // console.log('[Home] hydrated from localStorage', {
      //   songId,
      //   hasSaved: !!saved,
      //   importedPlaylistName: storedName,
      //   savedKeys: saved ? Object.keys(saved) : []
      // });
    } catch (e) {
      console.error('[Home] failed to hydrate from localStorage', e);
    }

    const navState = location.state;
    if (navState?.fromPlaylistSelect) {
      // For imports, prioritize the navigation state name over stored name
      const isImport = navState.fromPlaylistSelect && navState.selectedPlaylist?.name;
      const fallbackName = navState.selectedPlaylist?.name || 'Local Spotify Tierlist';
      const nameFromState = isImport ? fallbackName : (storedName || fallbackName);
      setImportedPlaylistName(nameFromState);
      if (navState.selectedPlaylist) {
        setSelectedPlaylist(prev => prev || { ...navState.selectedPlaylist, name: nameFromState });
      } else {
        setSelectedPlaylist(prev => prev || { id: `local-${songId}`, name: nameFromState });
      }
      if (Array.isArray(navState.playlistTracks)) {
        setPlaylistTracks(navState.playlistTracks);
      }
      setPendingPlaylist(null);
      setShowSongGroupModal(false);
      // console.log('[Home] hydrated from navigation state', {
      //   songId,
      //   importedPlaylistName: nameFromState,
      //   selectedPlaylistId: navState.selectedPlaylist?.id,
      //   tracksCount: Array.isArray(navState.playlistTracks) ? navState.playlistTracks.length : null
      // });
      return;
    }

    const name = storedName || 'Local Spotify Tierlist';
    setImportedPlaylistName(name);
    setSelectedPlaylist(prev => prev || { id: `local-${songId}`, name });
    setPendingPlaylist(null);
    setShowSongGroupModal(false);
  }, [songId, location.state]);

  if (isLoading) {
    return (
      <div className="loading-screen">
          <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="127.5" cy="128.5" r="95.5" fill={loadingColor}/>
            <circle cx="127.5" cy="128.5" r="23.875" fill="black"/>
            <circle cx="127.5" cy="128.5" r="7.95833" fill={loadingColor}/>
          </svg>
          <p className="loading-text">
            <span>Loading</span>
            <span className="loading-dots">
              <span className={dotCount >= 1 ? 'dot on' : 'dot'}>.</span>
              <span className={dotCount >= 2 ? 'dot on' : 'dot'}>.</span>
              <span className={dotCount >= 3 ? 'dot on' : 'dot'}>.</span>
            </span>
          </p>
        </div>
    );
  }

  if (error) {
    return (
      <div className="home-error-page">
        <div className="error-message home-error-banner">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">

      <Header 
        tuneTierUser={tuneTierUser} 
        onLogout={handleLogout} 
        onBack={() => navigate('/login')} 
      />
      
      {showKonamiMessage && (
        <div className={`konami-message ${konamiActive ? 'active' : 'inactive'}`}>
          Konami code {konamiActive ? 'activated' : 'deactivated'}! Song limits {konamiActive ? 'removed' : 'restored'}.
        </div>
      )}
      {showDebugMessage && (
        <div className={`konami-message ${debugModeActive ? 'active' : 'inactive'}`}>
          Debug mode {debugModeActive ? 'activated' : 'deactivated'}! Camera preview {debugModeActive ? 'enabled' : 'disabled'}.
        </div>
      )}
      {(!accessToken && !sharedTierlist && !hasProceededToPlaylists) ? (
        <div className="auth-container">
          <div className="spotify-attribution">
            <img src="/logo.png" alt="Logo" className="app-full-logo" />
            <p>Create a tier list from your favorite Spotify playlists.</p>
            <p>This application uses content from Spotify. By using this app, you agree to Spotify&apos;s terms of service.</p>
            <p>This application is not affiliated with, endorsed by, or in any way officially connected with Spotify AB.</p>
            <p>Start by browsing online tierlists.</p>
            <button
              type="button"
              className="auth-button auth-button-primary"
              onClick={() => setHasProceededToPlaylists(true)}
            >
              View playlists
            </button>
            <div className="app-attribution">
              <p>A third party-tool for Spotify</p>
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
            debugMode={debugModeActive}
            initialTierlist={sharedTierlist || importedTierlistData}
            storageKey={shortId || songId || selectedPlaylist?.id || null}
            playlistImages={selectedPlaylist?.images || []}
            tuneTierUser={tuneTierUser}
          />

          <div className="app-attribution">
            <p>A third-party tool for Spotify</p>
          </div>
        </div>
      ) : (
        <div className="playlist-selector-container">

          <PlaylistSelector 
            accessToken={accessToken}
            onSelect={handlePlaylistSelect} 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            onSelectLocalTierlist={handleLocalTierlistSelect}
            onSelectOnlineTierlist={handleOnlineTierlistSelect}
            onSelectImported={handleSelectImported}
            tuneTierUser={tuneTierUser}
          />
          <div className="app-attribution">
            <p>A third-party tool for Spotify</p>
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
