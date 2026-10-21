import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext } from "@hello-pangea/dnd";
import { updateTierlist } from '../utils/backendApi';
import "./TierList/TierListMain.css";
import "./TierList/TierListSongCard.css";
import "./TierList/TierListActions.css";
import "./TierList/TierListControls.css";
import "./TierList/TierListModal.css";
import "./TierList/TierListDetection.css";
import { PLACEHOLDER_COLORS } from '../constants';
import SpotifyPlayer from "./SpotifyPlayer";
import TierListActions from "./TierList/TierListActions";
import TierListControls from "./TierList/TierListControls";
import TierListDialogs from "./TierList/TierListDialogs";
import TierRow from "./TierList/TierRow";
import { useTierlistUpload } from "./TierList/useTierlistUpload";
import { useTierlistPlayer } from "./TierList/useTierlistPlayer";
import { useTierEditor } from "./TierList/useTierEditor";
import { DEFAULT_TIERS, DEFAULT_TIER_ORDER, pickPreferredPlaylistImage, checkForUnavailableSongs } from "./TierList/tierListUtils";

const TierList = ({
  songs,
  accessToken,
  playlistName = '',
  onImport,
  debugMode = false,
  initialTierlist = null,
  storageKey = null,
  playlistImages = [],
  tuneTierUser = null,
  serverConfig = {}
}) => {
  const navigate = useNavigate();
  
  // State for custom tiers
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [tierOrder, setTierOrder] = useState(DEFAULT_TIER_ORDER);
  const [newTierName, setNewTierName] = useState("");
  const [newTierColor, setNewTierColor] = useState("#CCCCCC");
  const [showAddTierForm, setShowAddTierForm] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [editTierName, setEditTierName] = useState("");
  const [isCinemaEnabled, setIsCinemaEnabled] = useState(false);
  const [isWiiEnabled, setIsWiiEnabled] = useState(false);
  const [isWiiUiMode, setIsWiiUiMode] = useState(false);
  const [focusedSongId, setFocusedSongId] = useState(null);
  const [focusedTierId, setFocusedTierId] = useState(null);
  const [pickedUpSongId, setPickedUpSongId] = useState(null);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);
  const [inferredCoverImage, setInferredCoverImage] = useState('');
  const [state, setState] = useState(() => {
    return DEFAULT_TIER_ORDER.reduce((acc, tier) => ({
      ...acc,
      [tier]: []
    }), {});
  });
  const {
    onDragEnd,
    addTier,
    deleteTier,
    moveTierUp,
    moveTierDown,
    startEditingTier,
    saveTierName,
    cancelTierEdit
  } = useTierEditor({
    state,
    setState,
    tiers,
    setTiers,
    setTierOrder,
    newTierName,
    setNewTierName,
    newTierColor,
    setNewTierColor,
    setShowAddTierForm,
    editingTier,
    setEditingTier,
    editTierName,
    setEditTierName
  });
  const hydratedStateRef = useRef(null);
  const hydratedFromStorageRef = useRef(false);
  const manualImportRef = useRef(false);
  const lastHydratedRef = useRef(null);
  const lastFocusedCenterXRef = useRef(null);
  const wiiUiFocusedElementRef = useRef(null);
  const resolvedCoverImage = useMemo(() => {
    if (typeof state?.coverImage === 'string' && state.coverImage.trim()) {
      return state.coverImage.trim();
    }
    if (Array.isArray(playlistImages) && playlistImages.length > 0) {
      return pickPreferredPlaylistImage(playlistImages)?.url || '';
    }
    return inferredCoverImage || '';
  }, [playlistImages, state?.coverImage, inferredCoverImage]);
  const resolvedPlaylistImages = useMemo(() => {
    if (Array.isArray(playlistImages) && playlistImages.length > 0) {
      const preferred = pickPreferredPlaylistImage(playlistImages);
      if (!preferred) {
        return playlistImages;
      }
      const preferredIndex = playlistImages.findIndex((img) => img === preferred);
      if (preferredIndex <= 0) {
        return playlistImages;
      }
      const reordered = [preferred, ...playlistImages.filter((_, idx) => idx !== preferredIndex)];
      return reordered;
    }
    if (resolvedCoverImage) {
      return [{ url: resolvedCoverImage }];
    }
    return [];
  }, [playlistImages, resolvedCoverImage]);
  const getFirstAvailableCoverImage = useCallback(() => {
    if (resolvedPlaylistImages.length > 0) {
      return resolvedPlaylistImages[0]?.url || '';
    }
    for (const tier of tierOrder) {
      const songsInTier = state[tier];
      if (!Array.isArray(songsInTier)) continue;
      for (const item of songsInTier) {
        const content = item?.content;
        const images = content?.album?.images;
        if (Array.isArray(images) && images.length > 0) {
          return pickPreferredPlaylistImage(images)?.url || images[0]?.url || '';
        }
      }
    }
    return '';
  }, [resolvedPlaylistImages, state, tierOrder]);

  const {
    uploadedTierlist,
    setUploadedTierlist,
    uploadingTierlist,
    uploadMessage,
    uploadError,
    uploadShareUrl,
    setUploadShareUrl,
    showRemixDialog,
    setShowRemixDialog,
    handleUploadTierlist,
    performUploadTierlist
  } = useTierlistUpload({
    tuneTierUser,
    state,
    setState,
    tiers,
    tierOrder,
    playlistName,
    storageKey,
    getFirstAvailableCoverImage,
    navigate
  });

  const computeShareUrl = useCallback((shortId) => {
    if (!shortId || typeof window === 'undefined') return '';
    return `${window.location.origin}/tierlists/${shortId}`;
  }, []);

  const hydrateTierlist = useCallback((imported, { silent = false } = {}) => {
    if (!imported || !imported.tiers || !imported.tierOrder || !imported.state) {
      console.error('Invalid tierlist data for hydration');
      return false;
    }

    // Mark as manual import if not silent - BEFORE setState to prevent songs effect from running
    if (!silent) {
      manualImportRef.current = true;
    }

    // Ensure all songs have a placeholderColor
    const tierOrder = imported.tierOrder || DEFAULT_TIER_ORDER;
    const processedState = { ...imported.state };
    
    tierOrder.forEach(tierName => {
      if (Array.isArray(processedState[tierName])) {
        processedState[tierName] = processedState[tierName].map(entry => {
          const entryContent = entry?.content || entry;
          if (entryContent && !entryContent.placeholderColor) {
            return {
              ...entry,
              content: {
                ...entryContent,
                placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
              }
            };
          }
          return entry;
        });
      }
    });

    setTiers(imported.tiers);
    setTierOrder(tierOrder);
    const resolvedName = imported.tierListName || imported.state?.tierListName;
    const resolvedDescription = imported.description || imported.state?.description || '';
    const importedCover = imported.coverImage
      || imported.state?.coverImage
      || pickPreferredPlaylistImage(imported.images)?.url
      || pickPreferredPlaylistImage(imported.state?.images)?.url
      || '';
    const stateWithName = {
      ...processedState,
      ...(resolvedName && { tierListName: resolvedName }),
      ...(resolvedDescription && { description: resolvedDescription })
    };
    const stateWithCover = importedCover
      ? { ...stateWithName, coverImage: importedCover }
      : stateWithName;
    hydratedStateRef.current = stateWithCover;
    setState(stateWithCover);
    setIsInitialSyncComplete(true);

    if (!silent && resolvedName && typeof onImport === 'function') {
      onImport(resolvedName);
    }

    setUploadedTierlist(imported);
    const shareUrl = computeShareUrl(imported.shortId);
    if (!silent || shareUrl) {
      setUploadShareUrl(shareUrl);
    }

    setInferredCoverImage(importedCover);

    return true;
  }, [computeShareUrl, onImport]);

  useEffect(() => {
    if (!initialTierlist) return;
    const identifier = initialTierlist.shortId || JSON.stringify({
      tiers: Object.keys(initialTierlist.tiers || {}),
      order: initialTierlist.tierOrder,
      name: initialTierlist?.state?.tierListName || initialTierlist.tierListName || ''
    });

    if (lastHydratedRef.current === identifier) return;
    const hydrated = hydrateTierlist(initialTierlist, { silent: true });
    if (hydrated) {
      lastHydratedRef.current = identifier;
      
      // For online tierlists, ensure uploadedTierlist is set with online metadata
      if (initialTierlist.shortId || initialTierlist.onlineShortId) {
        setUploadedTierlist(initialTierlist);
      }
    }
  }, [initialTierlist, hydrateTierlist]);

  useEffect(() => {
    hydratedFromStorageRef.current = false;
    hydratedStateRef.current = null;
    manualImportRef.current = false;
    setIsInitialSyncComplete(false);
    setInferredCoverImage('');
    lastHydratedRef.current = null; // Clear this to allow re-hydration on navigation
  }, [storageKey]);

    useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    
    // Skip localStorage hydration if initialTierlist data exists (from import/navigation)
    if (initialTierlist) {
      return;
    }
    
    // Also skip if we're on a local route and have importedTierlistData in navigation state
    const isLocalRoute = window.location.pathname.includes('/local/');
    if (isLocalRoute && window.history?.state?.initialTierlist) {
      return;
    }
    
    try {
      const isLocalRoute = window.location.pathname.includes('/local/');
      const isOnlineTierlist = window.location.pathname.includes('/tierlists/');
      const storageKeyFormat = isLocalRoute ? `tierlist:local:${storageKey}` : `tierlist:${storageKey}`;
      const raw = localStorage.getItem(storageKeyFormat);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw);
      if (!saved || !saved.tiers || !saved.tierOrder || !saved.state) {
        return;
      }
      hydratedStateRef.current = saved.state;
      hydrateTierlist(saved, { silent: true });
      
      // For online tierlists, ensure the uploadedTierlist state preserves online metadata
      if (isOnlineTierlist && (saved.onlineShortId || saved.shortId)) {
        setUploadedTierlist(saved);
      }
      
    hydratedFromStorageRef.current = true;
  } catch (err) {
    console.error('[TierList] Error loading from localStorage:', err);
  }
}, [storageKey, hydrateTierlist, initialTierlist]);
  
  const {
    currentTrack,
    isPlayerPlaying,
    isPlayerVisible,
    playTrack,
    handleTrackEnd,
    handlePlayerStateChange,
    handlePlayerClose
  } = useTierlistPlayer();

  // State for unavailable songs handling
  const [unavailableSongs, setUnavailableSongs] = useState([]);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  
  // Handle user's choice about unavailable songs
  const handleUnavailableSongsChoice = (remove) => {
    if (remove && unavailableSongs.length > 0) {
      setState(prevState => {
        const newState = { ...prevState };
        const unavailableIds = new Set(unavailableSongs.map(song => song.id));
        
        // Process each tier
        Object.keys(newState).forEach(tierName => {
          if (Array.isArray(newState[tierName])) {
            // Filter out unavailable songs by ID
            newState[tierName] = newState[tierName].filter(song => {
              const content = song.content || song;
              const songId = content.id || content.dragId;
              return !unavailableIds.has(songId);
            });
          }
        });
        
        return newState;
      });
    }
    
    // Reset the dialog state
    setShowUnavailableDialog(false);
    setUnavailableSongs([]);
  };
  
  // Initialize with songs
  useEffect(() => {
    const songsLength = songs ? songs.length : 0;
    // console.log('[TierList] songs effect', {
    //   storageKey,
    //   songsLength,
    //   hydratedFromStorage: hydratedFromStorageRef.current
    // });

    if (!songs || songsLength === 0) {
      return;
    }

    // If we have initialTierlist data, skip this effect to preserve imported data
    if (initialTierlist) {
      return;
    }

    // If we just did a manual import, skip this effect to preserve imported data
    if (manualImportRef.current) {
      return;
    }

    // If state already contains tier data (from localStorage), preserve it
    const hasExistingTierData = Object.keys(state || {}).some(key => 
      key !== 'tierListName' && key !== 'coverImage' && Array.isArray(state[key])
    );
    if (hasExistingTierData) {
      return;
    }

    const incomingByDragId = new Map();
    const incomingByTrackId = new Map();
    songs.forEach(song => {
      const songWithColor = {
        ...song,
        placeholderColor: song.placeholderColor || PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
      };
      if (song?.dragId) {
        incomingByDragId.set(song.dragId, songWithColor);
      }
      if (song?.id) {
        incomingByTrackId.set(song.id, songWithColor);
      }
    });

    const baseState = hydratedStateRef.current || state;
    const tierNames = Object.keys(baseState || {}).filter(name => !['tierListName', 'coverImage'].includes(name));
    const existingSongIds = new Set();

    const updatedState = tierNames.reduce((acc, tierName) => {
      const tierSongs = Array.isArray(baseState[tierName]) ? baseState[tierName] : [];
      acc[tierName] = tierSongs.map(entry => {
        const entryContent = entry?.content || entry;
        const entryDragId = entry?.id || entryContent?.dragId || entryContent?.uri || null;
        const entryTrackId = entryContent?.id || null;

        const matchedSong = (entryDragId && incomingByDragId.get(entryDragId))
          || (entryTrackId && incomingByTrackId.get(entryTrackId))
          || null;

        const resolvedId = matchedSong?.dragId
          || entryDragId
          || entryTrackId
          || entry?.id
          || entryContent?.uri
          || `entry-${Math.random().toString(36).slice(2, 10)}`;

        if (entryDragId) existingSongIds.add(entryDragId);
        if (entryTrackId) existingSongIds.add(entryTrackId);
        if (resolvedId) existingSongIds.add(resolvedId);

        if (matchedSong) {
          const candidateIds = [matchedSong.dragId, matchedSong.id, matchedSong.uri].filter(Boolean);
          candidateIds.forEach(id => existingSongIds.add(id));
          return {
            id: resolvedId,
            content: matchedSong
          };
        }

        return {
          id: resolvedId,
          content: entryContent
        };
      });
      return acc;
    }, {});

    if (!Array.isArray(updatedState.Unranked)) {
      updatedState.Unranked = [];
    }

    if (typeof baseState?.tierListName === 'string') {
      updatedState.tierListName = baseState.tierListName;
    }
    if (typeof baseState?.coverImage === 'string') {
      updatedState.coverImage = baseState.coverImage;
    }

    const newEntries = [];
    songs.forEach(song => {
      const candidateIds = [song.dragId, song.id, song.uri].filter(Boolean);
      const alreadyPresent = candidateIds.some(id => existingSongIds.has(id));
      if (!alreadyPresent) {
        const entryId = song.dragId || song.id || song.uri || `track-${Math.random().toString(36).slice(2, 10)}`;
        [entryId, ...candidateIds].forEach(id => existingSongIds.add(id));
        newEntries.push({
          id: entryId,
          content: song
        });
      }
    });

    if (newEntries.length > 0) {
      updatedState.Unranked = [...updatedState.Unranked, ...newEntries];
    }

    // console.log('[TierList] songs effect merged state', {
    //   storageKey,
    //   matchedCount,
    //   addedToUnranked: newEntries.length,
    //   totalTiers: Object.keys(updatedState).length
    // });

    const usedHydratedSnapshot = !!hydratedStateRef.current;
    setState(updatedState);
    if (!isInitialSyncComplete) {
      setIsInitialSyncComplete(true);
    }
    if (usedHydratedSnapshot) {
      hydratedStateRef.current = null;
    }

    const timer = setTimeout(() => {
      const unavailable = checkForUnavailableSongs(updatedState);
      if (unavailable.length > 0) {
        setUnavailableSongs(unavailable);
        setShowUnavailableDialog(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [songs, checkForUnavailableSongs, storageKey, isInitialSyncComplete, initialTierlist, state]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined' || !isInitialSyncComplete) return;
    const isLocalRoute = window.location.pathname.includes('/local/');
    const storageEntryKey = isLocalRoute ? `tierlist:local:${storageKey}` : `tierlist:${storageKey}`;
    const now = Date.now();

    let createdAt = now;
    let onlineShortId = null;
    let onlineUsername = null;
    let onlineOwnerUserId = null;
    let isOnlineTierlist = false;

    try {
      const existingRaw = localStorage.getItem(storageEntryKey);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (typeof existing?.createdAt === 'number') {
          createdAt = existing.createdAt;
        }

        // Check if this is an online tierlist and preserve metadata
        onlineShortId = existing.onlineShortId || existing.shortId;
        onlineUsername = existing.onlineUsername || existing.username;
        onlineOwnerUserId = existing.onlineOwnerUserId || existing.ownerUserId;
        isOnlineTierlist = existing.isOnlineTierlist || !!onlineShortId;

        // If this has online reference and user is logged in, sync changes
        if (onlineShortId && tuneTierUser && tuneTierUser.username === existing.onlineUsername) {
          // Sync to online tierlist
          const syncPayload = {
            tierListName: playlistName,
            description: existing.description || '',
            state,
            coverImage: resolvedCoverImage,
            isPublic: existing.isPublic !== false
          };

          console.log('Syncing to online tierlist:', onlineShortId, syncPayload);
          updateTierlist(onlineShortId, syncPayload).catch(err => {
            console.warn('Failed to sync changes to online tierlist:', err);
          });
        }
      }
    } catch { void 0; }

    const payload = {
      tierListName: playlistName,
      description: initialTierlist?.description || uploadedTierlist?.description || uploadedTierlist?.state?.description || state?.description || '',
      tiers,
      tierOrder,
      state,
      coverImage: resolvedCoverImage,
      createdAt,
      lastModified: now,
      // Preserve online tierlist metadata
      onlineShortId,
      onlineUsername,
      onlineOwnerUserId,
      isOnlineTierlist
    };
    try {
      localStorage.setItem(storageEntryKey, JSON.stringify(payload));
    } catch { void 0; }
  }, [storageKey, tiers, tierOrder, state, uploadedTierlist, initialTierlist, playlistName, isInitialSyncComplete, resolvedCoverImage, tuneTierUser]);

  // Update state when tierOrder changes
  useEffect(() => {
    setState(prev => {
      const newState = {};

      tierOrder.forEach(tier => {
        const tierSongs = Array.isArray(prev?.[tier]) ? prev[tier] : [];
        newState[tier] = tierSongs;
      });

      if (typeof prev?.tierListName === 'string') {
        newState.tierListName = prev.tierListName;
      }
      if (typeof prev?.coverImage === 'string') {
        newState.coverImage = prev.coverImage;
      }

      return newState;
    });
  }, [tierOrder]);

  // Handler for importing tierlist JSON
  const handleImport = (imported) => {
    // Create a new local tierlist with imported content
    if (typeof window !== 'undefined') {
      const localId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      
      // Use imported state content or fallback to empty tiers
      const importedState = imported.state || {};
      const tierOrder = imported.tierOrder || ["S", "A", "B", "C", "D", "E", "F", "Unranked"];
      
      // Build state with imported tier content and ensure placeholderColor
      const importedTierState = {};
      tierOrder.forEach(tierName => {
        const tierSongs = importedState[tierName] || [];
        importedTierState[tierName] = tierSongs.map(song => {
          const songContent = song.content || song;
          if (songContent && !songContent.placeholderColor) {
            return {
              ...song,
              content: {
                ...songContent,
                placeholderColor: PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)]
              }
            };
          }
          return song;
        });
      });
      
      // Preserve non-tier properties from imported state
      Object.keys(importedState).forEach(key => {
        if (!tierOrder.includes(key)) {
          importedTierState[key] = importedState[key];
        }
      });
      
      const tierlistData = {
        tierListName: imported.state?.tierListName || imported.tierListName || 'Imported Tierlist',
        description: imported.description || imported.state?.description || '',
        tiers: imported.tiers || {
          S: { color: "#FF7F7F", label: "S" },
          A: { color: "#FFBF7F", label: "A" },
          B: { color: "#FFFF7F", label: "B" },
          C: { color: "#7FFF7F", label: "C" },
          D: { color: "#7FBFFF", label: "D" },
          E: { color: "#BF7FFF", label: "E" },
          F: { color: "#FF7FBF", label: "F" },
          Unranked: { color: "#E0E0E0", label: "Unranked" }
        },
        tierOrder: tierOrder,
        state: {
          ...importedTierState,
          tierListName: imported.state?.tierListName || imported.tierListName || 'Imported Tierlist',
          description: imported.description || imported.state?.description || '',
          tierOrder: tierOrder
        },
        coverImage: imported.coverImage || imported.state?.coverImage || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      localStorage.setItem(`tierlist:local:${localId}`, JSON.stringify(tierlistData));
      
      // Navigate to the new tierlist with imported data to prevent flashing
      navigate(`/local/${localId}`, {
        state: {
          fromPlaylistSelect: true,
          selectedPlaylist: { id: localId, name: tierlistData.tierListName },
          playlistTracks: [],
          importedPlaylistName: tierlistData.tierListName,
          // Pass the complete tierlist data to prevent flashing
          initialTierlist: tierlistData
        }
      });
    } else {
      console.error('[TierList] Window not available for JSON import');
    }
  };

  // Function to add a recommended song to the tierlist
  const addSongToTierlist = (trackData) => {
    // Create a unique ID for the new song
    const dragId = `track-rec-${trackData.id}-${Date.now()}`;
    
    // Create a song object in the format the tierlist expects
    const newSong = {
      id: dragId,
      content: {
        ...trackData,
        dragId
      }
    };
    
    // Add the song to the Unranked tier
    setState(prev => {
      const newState = {
        ...prev,
        Unranked: [...prev.Unranked, newSong]
      };
      
      // Check if the newly added song is unavailable
      const unavailable = checkForUnavailableSongs({
        Unranked: [newSong]
      });
      
      if (unavailable.length > 0) {
        setUnavailableSongs(unavailable);
        setShowUnavailableDialog(true);
      }
      
      return newState;
    });
  };

  // Function to reset all songs to Unranked tier
  const resetSongs = () => {
    if (window.confirm('Are you sure you want to reset all songs to the Unranked tier? This will clear all your current rankings.')) {
      setState(prev => {
        const allSongs = [];
        
        // Collect all songs from all tiers
        Object.keys(prev).forEach(tier => {
          if (tier !== 'tierListName' && tier !== 'coverImage' && Array.isArray(prev[tier])) {
            allSongs.push(...prev[tier]);
          }
        });
        
        // Reset all tiers to empty except Unranked
        const newState = {};
        tierOrder.forEach(tier => {
          newState[tier] = tier === 'Unranked' ? allSongs : [];
        });
        
        // Preserve non-tier properties
        if (typeof prev.tierListName === 'string') {
          newState.tierListName = prev.tierListName;
        }
        if (typeof prev.coverImage === 'string') {
          newState.coverImage = prev.coverImage;
        }
        
        return newState;
      });
    }
  };

  // Add event listener for cinema pose song movement
  useEffect(() => {
    // Listen for cinema pose move events only once
    const handleMoveSongToTier = (event) => {
      const { songId, targetTier } = event.detail;
      setState(prevState => {
        let currentTier = null;
        let songToMove = null;
        // Locate song in prevState
        Object.entries(prevState).forEach(([tier, songs]) => {
          const found = songs.find(song => song.id === songId);
          if (found) {
            currentTier = tier;
            songToMove = found;
          }
        });
        // Validate tiers and song
        if (!currentTier || !songToMove || !prevState[targetTier] || currentTier === targetTier || prevState[targetTier].some(s => s.id === songId)) {
          return prevState;
        }
        return {
          ...prevState,
          [currentTier]: prevState[currentTier].filter(s => s.id !== songId),
          [targetTier]: [...prevState[targetTier], songToMove]
        };
      });
    };
    document.addEventListener('moveSongToTier', handleMoveSongToTier);
    return () => document.removeEventListener('moveSongToTier', handleMoveSongToTier);
  }, []);

  useEffect(() => {
    if (!isWiiEnabled) {
      setFocusedSongId(null);
      setFocusedTierId(null);
      setPickedUpSongId(null);
      setIsWiiUiMode(false);
      if (wiiUiFocusedElementRef.current) {
        wiiUiFocusedElementRef.current.classList.remove('wii-control-focused');
        wiiUiFocusedElementRef.current = null;
      }
    }
  }, [isWiiEnabled, wiiUiFocusedElementRef]);

  // Scroll the focused song into view
  useEffect(() => {
    if (focusedSongId) {
      // Look for the song card by its drag ID (which is item.id in the map)
      const focusedElement = document.querySelector(`.song-card[data-song-id="${focusedSongId}"]`);
      if (focusedElement) {
        focusedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    } else if (focusedTierId) {
      // Find the tier header with the label
      const tierHeaders = document.querySelectorAll('.tier-label h3');
      for (const header of tierHeaders) {
        if (header.textContent === tiers[focusedTierId]?.label) {
          header.closest('.tier').scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
          break;
        }
      }
    }
  }, [focusedSongId, focusedTierId, tiers]);

  // Handle Wiimote button presses
  const handleWiiButtonPress = useCallback((buttons) => {
    if (!isWiiEnabled) return;

    // Use a ref to keep track of previous button state to detect presses
    if (!window._prevWiiButtons) window._prevWiiButtons = {};
    const prev = window._prevWiiButtons;
    const isPressed = (btn) => buttons[btn] && !prev[btn];

    const clearUiFocus = () => {
      if (wiiUiFocusedElementRef.current) {
        wiiUiFocusedElementRef.current.classList.remove('wii-control-focused');
        wiiUiFocusedElementRef.current = null;
      }
    };

    const getUiControls = () => {
      const root = document.querySelector('.tier-list-container');
      if (!root) return [];

      // Include specific labels that act as containers for toggles/sliders
      const candidates = Array.from(root.querySelectorAll('button, a[href], input, select, textarea, label.discover-toggle, label.exploration-depth-slider, label.toggle-switch'));
      return candidates.filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        
        // If it's an input inside one of our container labels, skip it because we focus the label instead
        if (el.tagName === 'INPUT' && el.closest('label.discover-toggle, label.exploration-depth-slider, label.toggle-switch')) {
          return false;
        }

        if (el.closest('.song-card')) return false;
        if (el.closest('.tier-songs')) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return true;
      });
    };

    const focusUiElement = (el) => {
      if (!(el instanceof HTMLElement)) return false;

      let highlightEl = el;
      let focusEl = el;

      if (el instanceof HTMLInputElement) {
        const container = el.closest('label.discover-toggle, label.exploration-depth-slider, label.toggle-switch');
        if (container instanceof HTMLElement) {
          highlightEl = container;
        }
      } else if (el.tagName === 'LABEL') {
        const nestedFocusable = el.querySelector('input, button, a[href], select, textarea');
        if (nestedFocusable instanceof HTMLElement) {
          focusEl = nestedFocusable;
        }
      }

      const prevEl = wiiUiFocusedElementRef.current;
      if (prevEl && prevEl !== highlightEl) {
        prevEl.classList.remove('wii-control-focused');
      }
      highlightEl.classList.add('wii-control-focused');
      wiiUiFocusedElementRef.current = highlightEl;

      if (highlightEl.tabIndex < 0 && highlightEl.tagName === 'LABEL') {
        highlightEl.tabIndex = -1;
      }
      if (typeof focusEl.focus === 'function') {
        try { focusEl.focus({ preventScroll: true }); } catch { focusEl.focus(); }
      }
      
      // Use scrollIntoView with smooth behavior for UI mode
      try { 
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); 
      } catch { 
        try { highlightEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { void 0; }
      }
      return true;
    };

    const focusFirstUiControl = () => {
      const controls = getUiControls();
      if (controls.length === 0) return false;
      return focusUiElement(controls[0]);
    };

    const focusAdjacentUiControl = (direction) => {
      const controls = getUiControls();
      if (controls.length === 0) return false;

      const current = wiiUiFocusedElementRef.current;
      if (!(current instanceof HTMLElement) || !controls.includes(current)) {
        return focusUiElement(controls[0]);
      }

      const currentRect = current.getBoundingClientRect();
      const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2
      };

      const getCenter = (el) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };

      const candidates = controls
        .filter((el) => el !== current)
        .map((el) => {
          const center = getCenter(el);
          return { el, dx: center.x - currentCenter.x, dy: center.y - currentCenter.y };
        })
        .filter(({ dx, dy }) => {
          if (direction === 'UP') return dy < -1;
          if (direction === 'DOWN') return dy > 1;
          if (direction === 'LEFT') return dx < -1;
          if (direction === 'RIGHT') return dx > 1;
          return false;
        })
        .map((entry) => {
          const { dx, dy } = entry;
          const primary = direction === 'UP' ? -dy
            : direction === 'DOWN' ? dy
            : direction === 'LEFT' ? -dx
            : dx;
          const secondary = direction === 'UP' || direction === 'DOWN' ? Math.abs(dx) : Math.abs(dy);
          // Prioritize vertical alignment for UP/DOWN navigation but don't be too aggressive
          // so that we can still reach elements that are slightly offset horizontally
          const secondaryWeight = (direction === 'UP' || direction === 'DOWN') ? 4 : 2;
          return { ...entry, score: primary + secondary * secondaryWeight };
        })
        .sort((a, b) => a.score - b.score);

      if (candidates.length > 0) {
        return focusUiElement(candidates[0].el);
      }

      const currentIndex = controls.indexOf(current);
      if (currentIndex === -1) return focusUiElement(controls[0]);
      if (direction === 'UP' || direction === 'LEFT') {
        return focusUiElement(controls[(currentIndex - 1 + controls.length) % controls.length]);
      }
      return focusUiElement(controls[(currentIndex + 1) % controls.length]);
    };

    const activateUiControl = () => {
      const el = wiiUiFocusedElementRef.current;
      if (!(el instanceof HTMLElement)) return false;
      el.click();
      return true;
    };

    const adjustRangeControl = (delta) => {
      const el = wiiUiFocusedElementRef.current;
      let range = null;
      if (el instanceof HTMLInputElement && el.type === 'range') {
        range = el;
      } else if (el instanceof HTMLElement) {
        const nested = el.querySelector('input[type="range"]');
        if (nested instanceof HTMLInputElement) {
          range = nested;
        }
      }

      if (!range) return false;

      const setNativeValue = (input, value) => {
        const inputPrototype = Object.getPrototypeOf(input);
        const descriptor = Object.getOwnPropertyDescriptor(inputPrototype, 'value');
        const valueSetter = descriptor?.set;
        if (typeof valueSetter === 'function') {
          valueSetter.call(input, value);
          return;
        }
        input.value = value;
      };

      const step = Number(range.step || 1);
      const min = range.min === '' ? -Infinity : Number(range.min);
      const max = range.max === '' ? Infinity : Number(range.max);
      const currentValue = Number(range.value || 0);
      const nextValue = Math.min(max, Math.max(min, currentValue + delta * step));
      if (Number.isNaN(nextValue) || nextValue === currentValue) return true;
      setNativeValue(range, String(nextValue));
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };


    if (isPressed('HOME')) {
      if (isWiiUiMode) {
        setIsWiiUiMode(false);
        clearUiFocus();
      } else {
        setIsWiiUiMode(true);
        focusFirstUiControl();
      }
      window._prevWiiButtons = { ...buttons };
      return;
    }

    if (isWiiUiMode) {
      if (isPressed('B')) {
        setIsWiiUiMode(false);
        clearUiFocus();
      } else if (isPressed('A')) {
        activateUiControl();
      } else if (isPressed('PLUS')) {
        focusAdjacentUiControl('RIGHT');
      } else if (isPressed('MINUS')) {
        focusAdjacentUiControl('LEFT');
      } else if (isPressed('DPAD_UP')) {
        focusAdjacentUiControl('UP');
      } else if (isPressed('DPAD_DOWN')) {
        focusAdjacentUiControl('DOWN');
      } else if (isPressed('DPAD_LEFT')) {
        if (!adjustRangeControl(-1)) {
          focusAdjacentUiControl('LEFT');
        }
      } else if (isPressed('DPAD_RIGHT')) {
        if (!adjustRangeControl(1)) {
          focusAdjacentUiControl('RIGHT');
        }
      }

      window._prevWiiButtons = { ...buttons };
      return;
    }

    // Helper to get all songs in order
    const getAllSongs = () => {
      const all = [];
      tierOrder.forEach(tier => {
        if (Array.isArray(state[tier])) {
          state[tier].forEach(song => {
            all.push({ ...song, tier });
          });
        }
      });
      return all;
    };

    const allSongs = getAllSongs();
    
    // Initial focus if none exists
    if (!focusedSongId && !focusedTierId && allSongs.length > 0) {
      setFocusedSongId(allSongs[0].id);
      setFocusedTierId(allSongs[0].tier);
      window._prevWiiButtons = { ...buttons };
      return;
    }

    if (allSongs.length === 0) {
      if (!focusedTierId && tierOrder.length > 0) {
        setFocusedTierId(tierOrder[0]);
      }
      window._prevWiiButtons = { ...buttons };
      return;
    }

    const currentIndex = allSongs.findIndex(s => s.id === focusedSongId);
    const currentSong = allSongs[currentIndex];

    const focusClosestSongInTier = (targetTierIndex, isDown) => {
      const targetTier = tierOrder[targetTierIndex];
      const tierSongs = state[targetTier] || [];
      const currentElement = document.querySelector('.song-card.focused');
      const currentRect = currentElement ? currentElement.getBoundingClientRect() : null;
      const elementX = currentRect ? currentRect.left + currentRect.width / 2 : null;
      if (elementX !== null) {
        lastFocusedCenterXRef.current = elementX;
      }
      const currentX = elementX ?? lastFocusedCenterXRef.current;

      if (tierSongs.length === 0) {
        setFocusedSongId(null);
        setFocusedTierId(targetTier);
        return true;
      }

      const tierListElement = document.getElementById('tier-list');
      const tierElements = tierListElement
        ? Array.from(tierListElement.children).filter(el => el.classList && el.classList.contains('tier'))
        : [];
      const targetTierElement = tierElements[targetTierIndex]
        ? tierElements[targetTierIndex].querySelector('.tier-songs')
        : null;

      if (targetTierElement && currentX !== null) {
        const targetCards = Array.from(targetTierElement.querySelectorAll('.song-card'));
        if (targetCards.length > 0) {
          const cardRects = targetCards
            .map(card => ({ card, rect: card.getBoundingClientRect() }))
            .sort((a, b) => a.rect.top - b.rect.top);

          const rows = [];
          cardRects.forEach(entry => {
            const lastRow = rows[rows.length - 1];
            if (!lastRow || Math.abs(entry.rect.top - lastRow.top) > 10) {
              rows.push({ top: entry.rect.top, entries: [entry] });
            } else {
              lastRow.entries.push(entry);
            }
          });

          const boundaryRow = isDown ? rows[0] : rows[rows.length - 1];
          let bestEntry = boundaryRow.entries[0];
          let minDiff = Infinity;

          boundaryRow.entries.forEach(entry => {
            const x = entry.rect.left + entry.rect.width / 2;
            const diff = Math.abs(x - currentX);
            if (diff < minDiff) {
              minDiff = diff;
              bestEntry = entry;
            }
          });

          const targetId = bestEntry.card.dataset.songId;
          if (targetId) {
            setFocusedSongId(targetId);
            setFocusedTierId(targetTier);
            return true;
          }
        }
      }

      setFocusedSongId(tierSongs[0].id);
      setFocusedTierId(targetTier);
      return true;
    };

    if (!currentSong) {
      const currentTierIndex = tierOrder.indexOf(focusedTierId);
      if (currentTierIndex === -1) {
        window._prevWiiButtons = { ...buttons };
        return;
      }

      if (isPressed('DPAD_DOWN') || isPressed('DPAD_UP')) {
        const isDown = buttons['DPAD_DOWN'];
        const targetTierIndex = isDown
          ? (currentTierIndex + 1) % tierOrder.length
          : (currentTierIndex - 1 + tierOrder.length) % tierOrder.length;
        focusClosestSongInTier(targetTierIndex, isDown);
      } else if (isPressed('ONE') || isPressed('TWO')) {
        const isTwo = buttons['TWO'];
        const targetTierIndex = isTwo
          ? (currentTierIndex + 1) % tierOrder.length
          : (currentTierIndex - 1 + tierOrder.length) % tierOrder.length;
        focusClosestSongInTier(targetTierIndex, isTwo);
      } else if (isPressed('B') && pickedUpSongId && focusedTierId) {
        const songToMove = allSongs.find(s => s.id === pickedUpSongId);
        const targetTier = focusedTierId;

        if (songToMove) {
          setState(prevState => {
            const newState = { ...prevState };

            newState[songToMove.tier] = newState[songToMove.tier].filter(s => s.id !== pickedUpSongId);

            const targetTierSongs = newState[targetTier] || [];
            const updatedTargetSongs = [...targetTierSongs, songToMove];
            newState[targetTier] = updatedTargetSongs;

            return newState;
          });
          setFocusedSongId(pickedUpSongId);
        }
        setPickedUpSongId(null);
      }

      window._prevWiiButtons = { ...buttons };
      return;
    }

    setFocusedTierId(currentSong.tier);

    // 1. Navigation within tier with D-Pad
    if (isPressed('DPAD_RIGHT')) {
      const currentTierSongs = allSongs.filter(s => s.tier === currentSong.tier);
      const indexInTier = currentTierSongs.findIndex(s => s.id === focusedSongId);
      const nextIndex = (indexInTier + 1) % currentTierSongs.length;
      setFocusedSongId(currentTierSongs[nextIndex].id);
    } else if (isPressed('DPAD_LEFT')) {
      const currentTierSongs = allSongs.filter(s => s.tier === currentSong.tier);
      const indexInTier = currentTierSongs.findIndex(s => s.id === focusedSongId);
      const prevIndex = (indexInTier - 1 + currentTierSongs.length) % currentTierSongs.length;
      setFocusedSongId(currentTierSongs[prevIndex].id);
    } else if (isPressed('DPAD_DOWN') || isPressed('DPAD_UP')) {
      // Line-based navigation within the same tier
      const currentElement = document.querySelector('.song-card.focused');
      let navigated = false;

      if (currentElement) {
        const currentRect = currentElement.getBoundingClientRect();
        const tierElement = currentElement.closest('.tier-songs');
        if (tierElement) {
          const cardsInTier = Array.from(tierElement.querySelectorAll('.song-card'));
          const isDown = buttons['DPAD_DOWN']; // Use raw state here as we already checked isPressed for the block entry
          
          let targetCard = null;
          if (isDown) {
            // Find cards in the next lines (top is below current bottom)
            const cardsBelow = cardsInTier.filter(card => {
              const rect = card.getBoundingClientRect();
              return rect.top >= currentRect.bottom - 5;
            });
            
            if (cardsBelow.length > 0) {
              const firstNextLineTop = Math.min(...cardsBelow.map(c => c.getBoundingClientRect().top));
              const immediateNextLine = cardsBelow.filter(c => Math.abs(c.getBoundingClientRect().top - firstNextLineTop) < 10);
              
              let minDiff = Infinity;
              immediateNextLine.forEach(card => {
                const diff = Math.abs(card.getBoundingClientRect().left - currentRect.left);
                if (diff < minDiff) {
                  minDiff = diff;
                  targetCard = card;
                }
              });
            }
          } else {
            // Find cards in previous lines (bottom is above current top)
            const cardsAbove = cardsInTier.filter(card => {
              const rect = card.getBoundingClientRect();
              return rect.bottom <= currentRect.top + 5;
            });
            
            if (cardsAbove.length > 0) {
              const lastPrevLineBottom = Math.max(...cardsAbove.map(c => c.getBoundingClientRect().bottom));
              const immediatePrevLine = cardsAbove.filter(c => Math.abs(c.getBoundingClientRect().bottom - lastPrevLineBottom) < 10);
              
              let minDiff = Infinity;
              immediatePrevLine.forEach(card => {
                const diff = Math.abs(card.getBoundingClientRect().left - currentRect.left);
                if (diff < minDiff) {
                  minDiff = diff;
                  targetCard = card;
                }
              });
            }
          }

          if (targetCard) {
            const targetId = targetCard.dataset.songId;
            if (targetId) {
              setFocusedSongId(targetId);
              navigated = true;
            } else {
              const targetIndex = cardsInTier.indexOf(targetCard);
              const tierSongs = state[currentSong.tier];
              if (tierSongs[targetIndex]) {
                setFocusedSongId(tierSongs[targetIndex].id);
                navigated = true;
              }
            }
          }
        }
      }

      // If we couldn't move to another line in the same tier, move to the next/prev tier
      if (!navigated) {
        const currentTierIndex = tierOrder.indexOf(currentSong.tier);
        const isDown = buttons['DPAD_DOWN'];
        const targetTierIndex = isDown 
          ? (currentTierIndex + 1) % tierOrder.length 
          : (currentTierIndex - 1 + tierOrder.length) % tierOrder.length;
        navigated = focusClosestSongInTier(targetTierIndex, isDown);
      }
    } else if (isPressed('ONE') || isPressed('TWO')) {
      // 2. Navigation between tiers with 1/2
      const currentTierIndex = tierOrder.indexOf(currentSong.tier);
      const isTwo = buttons['TWO'];
      const targetTierIndex = isTwo 
        ? (currentTierIndex + 1) % tierOrder.length 
        : (currentTierIndex - 1 + tierOrder.length) % tierOrder.length;
      focusClosestSongInTier(targetTierIndex, isTwo);
    }

    // 3. Pause/Play with 'A'
    if (isPressed('A')) {
      if (currentSong && currentSong.content?.id) {
        playTrack(currentSong.content.id);
      }
    }

    // 4. Pick up / Move with 'B'
    if (isPressed('B')) {
      if (pickedUpSongId) {
        const songToMove = allSongs.find(s => s.id === pickedUpSongId);
        const targetTier = focusedTierId || currentSong.tier;
        
        if (songToMove) {
          setState(prevState => {
            const newState = { ...prevState };
            
            newState[songToMove.tier] = newState[songToMove.tier].filter(s => s.id !== pickedUpSongId);

            const targetTierSongs = newState[targetTier] || [];
            const focusIndexInTargetAfterRemoval = targetTierSongs.findIndex(s => s.id === focusedSongId);

            let insertIndex = targetTierSongs.length;

            if (songToMove.tier === targetTier) {
              const sourceTierSongsBefore = prevState[targetTier] || [];
              const pickedUpIndexBefore = sourceTierSongsBefore.findIndex(s => s.id === pickedUpSongId);
              const focusIndexBefore = sourceTierSongsBefore.findIndex(s => s.id === focusedSongId);

              if (focusedSongId === pickedUpSongId) {
                insertIndex = Math.min(Math.max(pickedUpIndexBefore, 0), targetTierSongs.length);
              } else if (focusIndexInTargetAfterRemoval !== -1) {
                if (focusIndexBefore !== -1 && pickedUpIndexBefore !== -1 && focusIndexBefore < pickedUpIndexBefore) {
                  insertIndex = focusIndexInTargetAfterRemoval;
                } else {
                  insertIndex = focusIndexInTargetAfterRemoval + 1;
                }
              }
            } else if (focusIndexInTargetAfterRemoval !== -1) {
              insertIndex = focusIndexInTargetAfterRemoval + 1;
            }

            const updatedTargetSongs = [...targetTierSongs];
            updatedTargetSongs.splice(insertIndex, 0, songToMove);
            newState[targetTier] = updatedTargetSongs;
            
            return newState;
          });
          setFocusedSongId(pickedUpSongId);
        }
        setPickedUpSongId(null);
      } else {
        if (focusedSongId) {
          setPickedUpSongId(focusedSongId);
        }
      }
    }

    window._prevWiiButtons = { ...buttons };
  }, [isWiiEnabled, focusedSongId, focusedTierId, pickedUpSongId, state, tierOrder, playTrack, isWiiUiMode]);

  const handleConfirmRemix = () => {
    setShowRemixDialog(false);
    // Clear online IDs to create a new tierlist instead of updating, but preserve description
    setUploadedTierlist(prev => ({
      ...prev,
      shortId: null,
      onlineShortId: null
    }));
    // Ensure state has description before remixing
    setState(prev => ({
      ...prev,
      description: prev.description || uploadedTierlist?.description || uploadedTierlist?.state?.description || ''
    }));
    performUploadTierlist({ remix: true });
  };

  return (
    <div
      className={`tier-list-container${isWiiEnabled ? " wii-enabled" : ""}${isWiiEnabled && pickedUpSongId ? " wii-carrying" : ""}`}
    >
      <TierListDialogs
        showUnavailableDialog={showUnavailableDialog}
        unavailableSongs={unavailableSongs}
        onUnavailableSongsChoice={handleUnavailableSongsChoice}
        showRemixDialog={showRemixDialog}
        onCloseRemix={() => setShowRemixDialog(false)}
        onConfirmRemix={handleConfirmRemix}
      />
      <TierListControls
        showEditMode={showEditMode}
        showAddTierForm={showAddTierForm}
        newTierName={newTierName}
        newTierColor={newTierColor}
        isCinemaEnabled={isCinemaEnabled}
        isWiiEnabled={isWiiEnabled}
        debugMode={debugMode}
        onToggleEditMode={() => setShowEditMode(!showEditMode)}
        onToggleAddTierForm={() => setShowAddTierForm(!showAddTierForm)}
        onNewTierNameChange={setNewTierName}
        onNewTierColorChange={setNewTierColor}
        onAddTier={addTier}
        onCinemaEnabledChange={setIsCinemaEnabled}
        onWiiEnabledChange={setIsWiiEnabled}
        onWiiButtonPress={handleWiiButtonPress}
      />
      
      <DragDropContext onDragEnd={onDragEnd}>
        <div id="tier-list" className="tier-list">
          {tierOrder.map(tierId => (
            <TierRow
              key={tierId}
              tierId={tierId}
              color={tiers[tierId].color}
              label={tiers[tierId].label}
              items={state[tierId]}
              isEditing={editingTier === tierId}
              editTierName={editTierName}
              onEditTierNameChange={setEditTierName}
              onSaveTierName={saveTierName}
              onCancelTierEdit={cancelTierEdit}
              showEditMode={showEditMode}
              onStartEdit={() => startEditingTier(tierId)}
              onMoveUp={() => moveTierUp(tierId)}
              onMoveDown={() => moveTierDown(tierId)}
              onDelete={() => deleteTier(tierId)}
              currentTrack={currentTrack}
              isPlayerPlaying={isPlayerPlaying}
              focusedSongId={focusedSongId}
              focusedTierId={focusedTierId}
              pickedUpSongId={pickedUpSongId}
              isWiiUiMode={isWiiUiMode}
              onPlayTrack={playTrack}
            />
          ))}
        </div>
      </DragDropContext>
      
      <TierListActions
        tiers={tiers}
        tierOrder={tierOrder}
        state={state}
        playlistName={playlistName}
        handleImport={handleImport}
        handleUploadTierlist={handleUploadTierlist}
        uploadingTierlist={uploadingTierlist}
        uploadedTierlist={uploadedTierlist}
        resolvedCoverImage={resolvedCoverImage}
        resetSongs={resetSongs}
        tuneTierUser={tuneTierUser}
        uploadMessage={uploadMessage}
        uploadError={uploadError}
        uploadShareUrl={uploadShareUrl}
        playTrack={playTrack}
        addSongToTierlist={addSongToTierlist}
        currentTrack={currentTrack}
        isPlayerPlaying={isPlayerPlaying}
        serverConfig={serverConfig}
      />

      {/* Spotify Player */}
      <div className={!isPlayerVisible ? 'hidden' : ''}>
        <SpotifyPlayer 
          trackId={currentTrack} 
          onTrackEnd={(...args) => { console.log('[TierList] SpotifyPlayer onTrackEnd prop called at', Date.now(), 'args:', args); handleTrackEnd(...args); }}
          onPlayerStateChange={(...args) => { console.log('[TierList] SpotifyPlayer onPlayerStateChange prop called at', Date.now(), 'args:', args); handlePlayerStateChange(...args); }}
          isPlaying={isPlayerPlaying}
          onClose={handlePlayerClose}
          accessToken={accessToken}
        />
      </div>
    </div>
  );
};

export default TierList;
