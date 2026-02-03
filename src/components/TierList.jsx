import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import html2canvas from "html2canvas";
import { getCurrentUser, createPlaylist, addTracksToPlaylist } from '../utils/spotifyApi';
import { createTierlist, updateTierlist } from '../utils/backendApi';
import "./TierList.css";
import RecommendationGenerator from "./RecommendationGenerator";
import SpotifyPlayer from "./SpotifyPlayer";
import spotifyIconOfficial from '../assets/spotify/spotify-icon-official.png';
import CinemaPoseDetector from './CinemaPoseDetector';
import TierListJSONExportImport from "./TierListJSONExportImport";
import ConfirmationDialog from "./ConfirmationDialog";
import WiiController from "./WiiController";

// Define default tiers and their colors
const DEFAULT_TIERS = {
  S: { color: "#FF7F7F", label: "S" },
  A: { color: "#FFBF7F", label: "A" },
  B: { color: "#FFFF7F", label: "B" },
  C: { color: "#7FFF7F", label: "C" },
  D: { color: "#7FBFFF", label: "D" },
  E: { color: "#BF7FFF", label: "E" },
  F: { color: "#FF7FBF", label: "F" },
  Unranked: { color: "#E0E0E0", label: "Unranked" }
};

// Define the default order of tiers
const DEFAULT_TIER_ORDER = ["S", "A", "B", "C", "D", "E", "F", "Unranked"];

const pickPreferredPlaylistImage = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const exact300 = images.find((img) => Number(img?.width) === 300 || Number(img?.height) === 300);
  if (exact300) {
    return exact300;
  }

  if (images[1]) {
    return images[1];
  }

  return images[0];
};

// IMPORTANT: This is the most reliable ID method
const getItemStyle = (isDragging, draggableStyle) => ({
  // some basic styles to make the items look nicer
  userSelect: "none",
  padding: 8,
  margin: "0 8px 0 0",
  
  // change background colour if dragging
  background: isDragging ? "#333" : "#191414", // Spotify black
  color: "white", // Text color for readability on black background
  
  // styles we need to apply on draggables
  ...draggableStyle
});

const getListStyle = isDraggingOver => ({
  background: isDraggingOver ? "rgba(255, 255, 255, 0.1)" : "transparent",
  display: "flex",
  flexWrap: "wrap",
  overflow: "auto",
  minHeight: "80px",
  alignContent: "flex-start"
});

// Create Playlist From Ranked Songs component
const CreatePlaylistFromRanked = ({ tierState, tierOrder }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [includeTiers, setIncludeTiers] = useState({});

  // Initialize tier selection - all tiers except "Unranked" are selected by default
  useEffect(() => {
    const initialTierSelection = {};
    tierOrder.forEach(tier => {
      initialTierSelection[tier] = tier !== "Unranked";
    });
    setIncludeTiers(initialTierSelection);
  }, [tierOrder]);

  const toggleTierSelection = (tier) => {
    setIncludeTiers(prev => ({
      ...prev,
      [tier]: !prev[tier]
    }));
  };

  const openModal = () => {
    setIsModalOpen(true);
    setPlaylistName(`My Tierlist ${new Date().toLocaleDateString()}`);
    setPlaylistDescription("Created with Spotify Tierlist Maker");
    setIsSuccess(false);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const createPlaylistFromTiers = async () => {
    if (!playlistName.trim()) {
      setError("Please enter a playlist name");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get all songs from selected tiers
      const songsToAdd = [];
      Object.entries(tierState).forEach(([tier, songs]) => {
        if (includeTiers[tier] && tier !== "Unranked") {
          songs.forEach(song => {
            if (song.content && song.content.id) {
              songsToAdd.push(song.content.id);
            }
          });
        }
      });

      if (songsToAdd.length === 0) {
        setError("No songs found in selected tiers");
        setIsLoading(false);
        return;
      }

      // Get user ID
      const userResponse = await getCurrentUser();
      const userId = userResponse.data.id;
      
      // Create new playlist
      const createResponse = await createPlaylist(userId, {
        name: playlistName,
        description: playlistDescription,
        isPublic
      });
      
      const newPlaylistId = createResponse.data.id;

      // Add tracks to the new playlist (in batches of 100 to avoid API limits)
      for (let i = 0; i < songsToAdd.length; i += 100) {
        const batch = songsToAdd.slice(i, i + 100);
        await addTracksToPlaylist(newPlaylistId, batch.map(id => `spotify:track:${id}`));
      }
      
      setIsSuccess(true);
      setIsLoading(false);
      
      // Close modal after success
      setTimeout(() => {
        closeModal();
      }, 3000);
    } catch (err) {
      console.error('Error creating playlist:', err);
      setError(`Failed to create playlist: ${err.response?.data?.error?.message || err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="create-playlist-container">
      <button className="create-playlist-button" onClick={openModal}>
        Create Playlist From Ranked Songs
      </button>

      {isModalOpen && (
        <div className="playlist-modal-overlay">
          <div className="playlist-modal">
            <h3>Create New Playlist</h3>
            
            {isSuccess ? (
              <div className="success-message">
                <p>Playlist created successfully!</p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="playlist-input"
                  placeholder="Playlist name"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                />
                
                <textarea
                  className="playlist-input playlist-description"
                  placeholder="Playlist description (optional)"
                  value={playlistDescription}
                  onChange={(e) => setPlaylistDescription(e.target.value)}
                />
                
                <div className="playlist-privacy">
                  <label>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={() => setIsPublic(!isPublic)}
                    />
                    Make playlist public
                  </label>
                </div>
                
                <div className="tier-selection">
                  <h4>Include songs from tiers:</h4>
                  <div className="tier-checkboxes">
                    {tierOrder.filter(tier => tier !== "Unranked").map(tier => (
                      <div key={tier} className="tier-checkbox">
                        <label>
                          <input
                            type="checkbox"
                            checked={includeTiers[tier] || false}
                            onChange={() => toggleTierSelection(tier)}
                          />
                          {tier}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {error && <div className="error-message">{error}</div>}
                
                <div className="playlist-modal-actions">
                  <button
                    className="cancel-button"
                    onClick={closeModal}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className="create-button"
                    onClick={createPlaylistFromTiers}
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating..." : "Create Playlist"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TierList = ({
  songs,
  accessToken,
  playlistName = '',
  onImport,
  debugMode = false,
  initialTierlist = null,
  storageKey = null,
  playlistImages = []
}) => {
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
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);
  const [uploadedTierlist, setUploadedTierlist] = useState(null);
  const [uploadingTierlist, setUploadingTierlist] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadShareUrl, setUploadShareUrl] = useState('');
  const [inferredCoverImage, setInferredCoverImage] = useState('');
  const [state, setState] = useState(() => {
    return DEFAULT_TIER_ORDER.reduce((acc, tier) => ({
      ...acc,
      [tier]: []
    }), {});
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

    setTiers(imported.tiers);
    setTierOrder(imported.tierOrder);
    const resolvedName = imported.tierListName || imported.state?.tierListName;
    const importedCover = imported.coverImage
      || imported.state?.coverImage
      || pickPreferredPlaylistImage(imported.images)?.url
      || pickPreferredPlaylistImage(imported.state?.images)?.url
      || '';
    const stateWithName = {
      ...imported.state,
      ...(resolvedName && { tierListName: resolvedName })
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
    }
  }, [initialTierlist, hydrateTierlist]);

  useEffect(() => {
    hydratedFromStorageRef.current = false;
    hydratedStateRef.current = null;
    manualImportRef.current = false;
    setIsInitialSyncComplete(false);
    setInferredCoverImage('');
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`tierlist:${storageKey}`);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !saved.tiers || !saved.tierOrder || !saved.state) return;
      hydratedStateRef.current = saved.state;
      // console.log('[TierList] hydrated from storage', {
      //   storageKey,
      //   tiers: Object.keys(saved.state || {}).length
      // });
      hydrateTierlist(saved, { silent: true });
    hydratedFromStorageRef.current = true;
  } catch { void 0; }
}, [storageKey, hydrateTierlist]);
  
  // State for the tier list
  // State for the currently playing track
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);
  
  // State for unavailable songs handling
  const [unavailableSongs, setUnavailableSongs] = useState([]);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  
  // Check for unavailable songs
  const checkForUnavailableSongs = useCallback((tracks) => {
    const unavailable = [];
    
    // Helper function to recursively check tracks in the state
    const checkTracks = (tierName, tierSongs) => {
      tierSongs.forEach((song) => {
        // Check if the track is unavailable (no preview_url and no external_urls.spotify)
        const content = song.content || song; // Handle both formats
        if (content && content.type === 'track' && !content.preview_url && !content.external_urls?.spotify) {
          unavailable.push({
            id: content.id || content.dragId, // Use track ID or dragId as fallback
            name: content.name,
            artist: content.artists?.[0]?.name || 'Unknown Artist',
            tier: tierName
          });
        }
      });
    };
    
    // Check all tiers
    Object.entries(tracks).forEach(([tierName, tierSongs]) => {
      checkTracks(tierName, tierSongs);
    });
    
    return unavailable;
  }, []);
  
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

    // If we just did a manual import, skip this effect to preserve imported data
    if (manualImportRef.current) {
      return;
    }

    const incomingByDragId = new Map();
    const incomingByTrackId = new Map();
    songs.forEach(song => {
      if (song?.dragId) {
        incomingByDragId.set(song.dragId, song);
      }
      if (song?.id) {
        incomingByTrackId.set(song.id, song);
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
  }, [songs, checkForUnavailableSongs, storageKey, isInitialSyncComplete, state]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined' || !isInitialSyncComplete) return;
    const storageEntryKey = `tierlist:${storageKey}`;
    const now = Date.now();

    let createdAt = now;
    try {
      const existingRaw = localStorage.getItem(storageEntryKey);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (typeof existing?.createdAt === 'number') {
          createdAt = existing.createdAt;
        }
      }
    } catch { /* ignore */ }

    const payload = {
      shortId: uploadedTierlist?.shortId || initialTierlist?.shortId || null,
      tiers,
      tierOrder,
      state,
      tierListName: (typeof state?.tierListName === 'string' && state.tierListName.trim())
        ? state.tierListName
        : playlistName,
      coverImage: resolvedCoverImage,
      createdAt,
      updatedAt: now,
      lastModified: now
    };
    try {
      localStorage.setItem(storageEntryKey, JSON.stringify(payload));
    } catch { void 0; }
  }, [storageKey, tiers, tierOrder, state, uploadedTierlist, initialTierlist, playlistName, isInitialSyncComplete, resolvedCoverImage]);

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

  const onDragEnd = result => {
    const { source, destination } = result;

    // dropped outside the list
    if (!destination) {
      return;
    }

    // If dropped in the same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Moving within the same list
    if (source.droppableId === destination.droppableId) {
      const items = Array.from(state[source.droppableId]);
      const [removed] = items.splice(source.index, 1);
      items.splice(destination.index, 0, removed);

      setState(prev => ({
        ...prev,
        [source.droppableId]: items
      }));
    } 
    // Moving from one list to another
    else {
      const sourceItems = Array.from(state[source.droppableId]);
      const destItems = Array.from(state[destination.droppableId]);
      const [removed] = sourceItems.splice(source.index, 1);

      destItems.splice(destination.index, 0, removed);

      setState(prev => ({
        ...prev,
        [source.droppableId]: sourceItems,
        [destination.droppableId]: destItems
      }));
    }
  };

  // Add a new tier
  const addTier = () => {
    if (!newTierName.trim()) return;
    
    // Check if tier name already exists
    if (tiers[newTierName]) {
      alert("A tier with this name already exists!");
      return;
    }
    
    // Add the new tier
    setTiers(prev => ({
      ...prev,
      [newTierName]: { color: newTierColor, label: newTierName }
    }));
    
    // Add the new tier to the order (before Unranked)
    setTierOrder(prev => {
      const unrankedIndex = prev.indexOf("Unranked");
      const newOrder = [...prev];
      newOrder.splice(unrankedIndex, 0, newTierName);
      return newOrder;
    });
    
    // Initialize the new tier in the state
    setState(prev => ({
      ...prev,
      [newTierName]: []
    }));
    
    // Reset form
    setNewTierName("");
    setNewTierColor("#CCCCCC");
    setShowAddTierForm(false);
  };

  // Delete a tier
  const deleteTier = (tierId) => {
    // Don't allow deleting the Unranked tier
    if (tierId === "Unranked") {
      alert("Cannot delete the Unranked tier!");
      return;
    }
    
    // Check if the tier has songs
    if (state[tierId] && state[tierId].length > 0) {
      if (window.confirm(`The tier "${tierId}" contains ${state[tierId].length} songs. Do you want to move them to the Unranked tier?`)) {
        // Move songs to Unranked tier
        setState(prev => ({
          ...prev,
          Unranked: [...prev.Unranked, ...prev[tierId]],
          [tierId]: []
        }));
      } else {
        return; // Cancel deletion
      }
    }
    
    // Remove the tier from the order
    setTierOrder(prev => prev.filter(tier => tier !== tierId));
    
    // Remove the tier from the tiers object
    setTiers(prev => {
      const newTiers = { ...prev };
      delete newTiers[tierId];
      return newTiers;
    });
  };

  // Move a tier up in the order
  const moveTierUp = (tierId) => {
    // Don't allow moving the Unranked tier
    if (tierId === "Unranked") return;
    
    setTierOrder(prev => {
      const index = prev.indexOf(tierId);
      if (index <= 0) return prev;
      
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  };

  // Move a tier down in the order
  const moveTierDown = (tierId) => {
    // Don't allow moving the Unranked tier
    if (tierId === "Unranked") return;
    
    setTierOrder(prev => {
      const index = prev.indexOf(tierId);
      if (index === -1 || index === prev.length - 1) return prev;
      
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  };

  // Start editing a tier
  const startEditingTier = (tierId) => {
    // Don't allow editing the Unranked tier
    if (tierId === "Unranked") {
      alert("Cannot rename the Unranked tier!");
      return;
    }
    
    setEditingTier(tierId);
    setEditTierName(tierId);
  };

  // Save tier name changes
  const saveTierName = () => {
    if (!editTierName.trim() || editTierName === editingTier) {
      setEditingTier(null);
      return;
    }
    
    // Check if the new name already exists
    if (tiers[editTierName]) {
      alert("A tier with this name already exists!");
      return;
    }
    
    // Update the tier name in the tiers object
    setTiers(prev => {
      const newTiers = { ...prev };
      const tierData = newTiers[editingTier];
      delete newTiers[editingTier];
      newTiers[editTierName] = { ...tierData, label: editTierName };
      return newTiers;
    });
    
    // Update the tier name in the order
    setTierOrder(prev => prev.map(tier => tier === editingTier ? editTierName : tier));
    
    // Update the state with the new tier name
    setState(prev => {
      const newState = { ...prev };
      newState[editTierName] = prev[editingTier];
      delete newState[editingTier];
      return newState;
    });
    
    // Reset editing state
    setEditingTier(null);
  };

  // Cancel tier name editing
  const cancelTierEdit = () => {
    setEditingTier(null);
  };

  // Export tier list as an image
  const exportImage = (name) => {
    // Wait for images to load
    const images = document.querySelectorAll('.album-cover');
    const promises = Array.from(images).map(img => {
      return new Promise((resolve) => {
        if (img.complete) {
          resolve();
        } else {
          img.onload = resolve;
          img.onerror = resolve; // Resolve even if image fails to load
        }
      });
    });

    Promise.all(promises).then(() => {
      // Create a temporary container for the tier list
      const tempContainer = document.createElement('div');
      const tierList = document.getElementById("tier-list").cloneNode(true);
      
      // Ensure all images have CORS support
      const clonedImages = tierList.querySelectorAll('.album-cover');
      clonedImages.forEach(img => {
        img.crossOrigin = "Anonymous";
        img.loading = "eager";
        img.style.opacity = '1'; // Ensure images are visible
      });

      tempContainer.appendChild(tierList);
      document.body.appendChild(tempContainer);

      // Generate the image
      html2canvas(tempContainer, {
        useCORS: true,
        logging: true,
        scale: 2, // Higher quality image
        onclone: (doc) => {
          // Ensure images are loaded in the cloned document
          const docImages = doc.querySelectorAll('.album-cover');
          docImages.forEach(img => {
            img.crossOrigin = "Anonymous";
            img.loading = "eager";
          });
        }
      }).then(canvas => {
        // Clean up
        tempContainer.remove();
        
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        const filename = name ? 
          `${name.replace(/[^a-z0-9-]/gi, '_').toLowerCase()}.png` : 
          'spotify-tierlist.png';
        link.download = filename;
        link.click();
      });
    });
  };

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

  // Handler for importing tierlist JSON
  const handleImport = (imported) => {
    const hydrated = hydrateTierlist(imported, { silent: false });
    if (!hydrated) {
      console.error('Invalid import JSON format');
    }
  };

  const handleUploadTierlist = async () => {
    setUploadError('');
    setUploadMessage('');
    setUploadShareUrl('');
    setUploadingTierlist(true);

    try {
      let user = currentUser;
      if (!user) {
        const userResponse = await getCurrentUser();
        user = userResponse.data;
        setCurrentUser(user);
      }

      if (!user || !user.id) {
        throw new Error('Unable to determine Spotify user ID');
      }

      const isUpdate = Boolean(uploadedTierlist?.shortId);
      const resolvedTierListName = state.tierListName || playlistName || 'My Spotify Tierlist';
      const existingCoverImage = typeof state?.coverImage === 'string' && state.coverImage.trim()
        ? state.coverImage.trim()
        : '';
      const coverImage = existingCoverImage || getFirstAvailableCoverImage();
      const tierlistState = {
        ...state,
        tierListName: resolvedTierListName,
        ...(coverImage ? { coverImage } : {})
      };

      const payload = {
        spotifyUserId: user.id,
        username: user.display_name || user.id,
        tierListName: resolvedTierListName,
        coverImage,
        tiers,
        tierOrder,
        state: tierlistState,
        isPublic: true
      };

      const response = isUpdate
        ? await updateTierlist(uploadedTierlist.shortId, payload)
        : await createTierlist(payload);

      const resolvedResponse = response || uploadedTierlist;
      if (!resolvedResponse) {
        throw new Error('No response received from tierlist service');
      }

      setUploadedTierlist(resolvedResponse);
      
      // Ensure state includes the resolved name and cover image after upload
      setState(prev => ({
        ...prev,
        tierListName: resolvedTierListName,
        ...(coverImage ? { coverImage } : {})
      }));

      const shareUrl = resolvedResponse?.shortId && typeof window !== 'undefined'
        ? `${window.location.origin}/tierlists/${resolvedResponse.shortId}`
        : '';

      setUploadShareUrl(shareUrl);
      setUploadMessage(
        `Tierlist ${isUpdate ? 'updated' : 'uploaded'} successfully!${shareUrl ? '' : ` ID: ${resolvedResponse?.shortId || ''}`}`
      );
    } catch (error) {
      console.error('Failed to upload tierlist:', error);
      const backendMessage = error.response?.data?.error;
      setUploadError(backendMessage || error.message || 'Failed to upload tierlist');
    } finally {
      setUploadingTierlist(false);
    }
  };

  // Play a track
  const playTrack = useCallback((trackId) => {
    console.log('[TierList] playTrack called with', trackId, 'isPlayerVisible:', isPlayerVisible, 'currentTrack:', currentTrack, 'isPlayerPlaying:', isPlayerPlaying, 'at', Date.now());
    if (!isPlayerVisible) {
      setIsPlayerVisible(true);
      setCurrentTrack(trackId);
      setIsPlayerPlaying(true);
    } else if (trackId === currentTrack) {
      setIsPlayerPlaying(!isPlayerPlaying);
    } else {
      setCurrentTrack(trackId);
      setIsPlayerPlaying(true);
    }
    try {
      const ev = new CustomEvent('spotifyPlayerRequestPlay', { detail: { trackId } });
      document.dispatchEvent(ev);
    } catch { /* ignore */ }
  }, [isPlayerVisible, currentTrack, isPlayerPlaying]);

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

  // Handle track end
  const handleTrackEnd = () => {
    console.log('[TierList] handleTrackEnd called, clearing currentTrack at', Date.now(), 'currentTrack:', currentTrack, 'isPlayerPlaying:', isPlayerPlaying);
    setCurrentTrack(null);
    setIsPlayerPlaying(false);
  };

  // Handle player state changes
  const handlePlayerStateChange = (isPlaying) => {
    setIsPlayerPlaying(isPlaying);
  };

  // Handle player close
  const handlePlayerClose = () => {
    console.log('[TierList] handlePlayerClose called, hiding player');
    setIsPlayerVisible(false);
    setIsPlayerPlaying(false);
    setCurrentTrack(null);
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

  // Render the confirmation dialog for unavailable songs
  const renderUnavailableSongsDialog = () => (
    <ConfirmationDialog
      isOpen={showUnavailableDialog}
      onClose={() => handleUnavailableSongsChoice(false)}
      onConfirm={() => handleUnavailableSongsChoice(true)}
      title="Unavailable Songs Detected"
      confirmText="Remove Unavailable Songs"
      cancelText="Keep Songs"
      message={
        <>
          <p>We found {unavailableSongs.length} song{unavailableSongs.length > 1 ? 's' : ''} that may not be playable:</p>
          <ul className="unavailable-songs-list">
            {unavailableSongs.slice(0, 5).map((song, index) => (
              <li key={index}>
                {song.name} by {song.artist}
                {song.tier !== 'Unranked' ? ` (in ${song.tier} tier)` : ''}
              </li>
            ))}
            {unavailableSongs.length > 5 && (
              <li>...and {unavailableSongs.length - 5} more</li>
            )}
          </ul>
          <p>These songs may have been removed from Spotify or may not be available in your region.</p>
          <p>Would you like to remove them from your tier list?</p>
        </>
      }
    />
  );

  return (
    <div
      className={`tier-list-container${isWiiEnabled ? " wii-enabled" : ""}${isWiiEnabled && pickedUpSongId ? " wii-carrying" : ""}`}
    >
      {renderUnavailableSongsDialog()}
      <div className="tier-controls">
        <div className="tier-controls-header">
          <button 
            className="edit-mode-toggle"
            onClick={() => setShowEditMode(!showEditMode)}
          >
            {showEditMode ? "Hide Editing Tools" : "Show Editing Tools"}
          </button>
          
          {showEditMode && (
            <button 
              className="add-tier-button"
              onClick={() => setShowAddTierForm(!showAddTierForm)}
            >
              {showAddTierForm ? "Cancel" : "Add New Tier"}
            </button>
          )}
        </div>
        {showAddTierForm && (
          <div className="add-tier-form">
            <input
              type="text"
              placeholder="Tier Name"
              value={newTierName}
              onChange={(e) => setNewTierName(e.target.value)}
              className="new-tier-name-input"
            />
            <input
              type="color"
              value={newTierColor}
              onChange={(e) => setNewTierColor(e.target.value)}
              className="new-tier-color-input"
            />
            <button
              className="confirm-add-tier-button"
              onClick={addTier}
            >
              Add Tier
            </button>
          </div>
        )}
        <div className="detection-controls">
          <div className="cinema-control">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isCinemaEnabled}
                onChange={(e) => setIsCinemaEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="control-label">
              {isCinemaEnabled ? '🎬 Absolute cinema on' : '🎬 Absolute cinema off'}
            </span>
          </div>

          <div className="detection-group">
            <div className="cinema-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isWiiEnabled}
                  onChange={(e) => setIsWiiEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="control-label">
                {isWiiEnabled ? '🎮 Wii Support on' : '🎮 Wii Support off'}
              </span>
            </div>
            <WiiController isEnabled={isWiiEnabled} onButtonPress={handleWiiButtonPress} />
          </div>
          <CinemaPoseDetector isEnabled={isCinemaEnabled} debugMode={debugMode} />
        </div>
      </div>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <div id="tier-list" className="tier-list">
          {tierOrder.map(tierId => {
            const { color, label } = tiers[tierId];
            const isUnranked = tierId === "Unranked";
            const isEditing = editingTier === tierId;
            
            return (
              <div 
                key={tierId}
                className="tier"
                style={{ backgroundColor: color }}
              >
                <div className="tier-header">
                  <div className="tier-label">
                    {isEditing ? (
                      <div className="tier-edit-form">
                        <input
                          type="text"
                          value={editTierName}
                          onChange={(e) => setEditTierName(e.target.value)}
                          className="tier-edit-input"
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button 
                            className="save-edit-button"
                            onClick={saveTierName}
                          >
                            Save
                          </button>
                          <button 
                            className="cancel-edit-button"
                            onClick={cancelTierEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <h3>{label}</h3>
                    )}
                  </div>
                  
                  {showEditMode && !isUnranked && !isEditing && (
                    <div className="tier-actions">
                      <button 
                        className="tier-action-button rename"
                        onClick={() => startEditingTier(tierId)}
                        title="Rename Tier"
                      >
                        ✎
                      </button>
                      <button 
                        className="tier-action-button"
                        onClick={() => moveTierUp(tierId)}
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button 
                        className="tier-action-button"
                        onClick={() => moveTierDown(tierId)}
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <button 
                        className="tier-action-button delete"
                        onClick={() => deleteTier(tierId)}
                        title="Delete Tier"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                
                <Droppable
                  droppableId={tierId}
                  direction="vertical"
                >
                  {(provided, snapshot) => (
                    (() => {
                      const visibleItems = (state[tierId] || []).filter(item => item && item.content);
                      const isEmpty = visibleItems.length === 0;
                      const isEmptyFocused = isEmpty && focusedTierId === tierId;
                      const isEmptyDraggingOver = isEmpty && snapshot.isDraggingOver;
                      const isCarrying = Boolean(pickedUpSongId);
                      const showEmptySlot = isEmpty && (isEmptyFocused || isEmptyDraggingOver);
                      const emptySlotVariant = isEmptyDraggingOver || (isEmptyFocused && isCarrying) ? "carrying" : "focused";

                      return (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      style={getListStyle(snapshot.isDraggingOver)}
                      className={[
                        "tier-songs",
                        snapshot.isDraggingOver ? "dragging-over" : ""
                      ].filter(Boolean).join(" ")}
                    >
                      {showEmptySlot && (
                        <div className={`empty-tier-slot ${emptySlotVariant}`} />
                      )}
                      {state[tierId].map((item, index) => {
                        if (!item || !item.content) return null;
                        const song = item.content;
                        const isPlaying = currentTrack === song.id && isPlayerPlaying;
                        
                        return (
                          <Draggable
                            key={item.id}
                            draggableId={item.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={getItemStyle(
                                  snapshot.isDragging,
                                  provided.draggableProps.style
                                )}
                                data-song-id={item.id}
                                className={`song-card ${isPlaying ? 'playing' : ''} ${!isWiiUiMode && focusedSongId === item.id ? 'focused' : ''} ${pickedUpSongId === item.id ? 'picked-up' : ''}`}
                              >
                                {song.album && song.album.images && song.album.images.length > 0 && (
                                  <a 
                                    href={`https://open.spotify.com/track/${song.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="album-cover-link"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <img 
                                      src={song.album.images[song.album.images.length > 2 ? 2 : 0].url}
                                      alt={song.album.name || "Album Cover"}
                                      className="album-cover" 
                                    />
                                  </a>
                                )}
                                <div className="song-info">
                                  <div className="song-name">{song.name}</div>
                                  <div className="song-artist">
                                    {song.artists && song.artists.map(artist => artist.name).join(", ")}
                                  </div>
                                </div>
                                <div className="song-actions">
                                  <button 
                                    className={`play-preview-button ${isPlaying ? 'playing' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playTrack(song.id);
                                    }}
                                    aria-label={isPlaying ? "Pause preview" : "Play preview"}
                                  >
                                    {isPlaying ? (
                                      <svg viewBox="0 0 24 24" width="20" height="20">
                                        <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                      </svg>
                                    ) : (
                                      <svg viewBox="0 0 24 24" width="20" height="20">
                                        <path fill="currentColor" d="M8 5v14l11-7z" />
                                      </svg>
                                    )}
                                  </button>
                                  <a 
                                    href={`https://open.spotify.com/track/${song.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="spotify-icon-link"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <img 
                                      src={spotifyIconOfficial} 
                                      alt="Spotify" 
                                      className="spotify-icon-small" 
                                    />
                                  </a>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                      );
                    })()
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      
      <div className="tier-list-actions">
        <div className="tier-list-primary-actions">
          <div className="export-group">
            <button className="export-button" onClick={() => exportImage(playlistName)}>
              Export as Image
            </button>
            <TierListJSONExportImport
              tiers={tiers}
              tierOrder={tierOrder}
              state={state}
              onImport={handleImport}
              tierListName={playlistName}
              onUpload={handleUploadTierlist}
              uploading={uploadingTierlist}
              uploadedTierlist={uploadedTierlist}
              uploadMessage=""
              uploadError=""
              uploadShareUrl=""
              coverImage={resolvedCoverImage}
            />
          </div>

          {/* Upload status messages - grouped with export/import/upload buttons */}
          {(uploadMessage || uploadError) && (
            <div className="upload-status-container">
              {uploadMessage && (
                <div className="success-message upload-status">
                  {uploadMessage}
                  {uploadShareUrl && (
                    <>
                      {' '}
                      <a href={uploadShareUrl} target="_blank" rel="noopener noreferrer">
                        {uploadShareUrl}
                      </a>
                    </>
                  )}
                </div>
              )}
              {uploadError && (
                <div className="error-message upload-status">
                  {uploadError}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tier-secondary-actions">
          <CreatePlaylistFromRanked
            tierState={state}
            tierOrder={tierOrder}
          />
          
          <RecommendationGenerator 
            tierState={state} 
            tierOrder={tierOrder}
            tiers={tiers}
            accessToken={accessToken} 
            onPlayTrack={playTrack}
            onAddToTierlist={addSongToTierlist}
            currentTrackId={currentTrack}
            isPlayerPlaying={isPlayerPlaying}
          />
        </div>
      </div>

      {/* Spotify Player */}
      {isPlayerVisible && (
        <SpotifyPlayer 
          trackId={currentTrack} 
          onTrackEnd={(...args) => { console.log('[TierList] SpotifyPlayer onTrackEnd prop called at', Date.now(), 'args:', args); handleTrackEnd(...args); }}
          onPlayerStateChange={(...args) => { console.log('[TierList] SpotifyPlayer onPlayerStateChange prop called at', Date.now(), 'args:', args); handlePlayerStateChange(...args); }}
          isPlaying={isPlayerPlaying}
          onClose={handlePlayerClose}
          accessToken={accessToken}
        />
      )}
    </div>
  );
};

export default TierList;
