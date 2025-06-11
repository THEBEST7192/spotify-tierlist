import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import html2canvas from "html2canvas";
import { getCurrentUser, createPlaylist, addTracksToPlaylist } from '../utils/spotifyApi';
import "./TierList.css";
import RecommendationGenerator from "./RecommendationGenerator";
import SpotifyPlayer from "./SpotifyPlayer";
import SingingDetector from "./SingingDetector";
import spotifyIconOfficial from '../assets/spotify/spotify-icon-official.png';
import CinemaPoseDetector from './CinemaPoseDetector';
import TierListJSONExportImport from "./TierListJSONExportImport";

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

const TierList = ({ songs, accessToken, playlistName = '', onImport }) => {
  // State for custom tiers
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [tierOrder, setTierOrder] = useState(DEFAULT_TIER_ORDER);
  const [newTierName, setNewTierName] = useState("");
  const [newTierColor, setNewTierColor] = useState("#CCCCCC");
  const [showAddTierForm, setShowAddTierForm] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [editTierName, setEditTierName] = useState("");
  const [isSinging, setIsSinging] = useState(false);
  const [randomChangeInterval, setRandomChangeInterval] = useState(null);
  const [isCinemaEnabled, setIsCinemaEnabled] = useState(false);
  
  // State for the tier list
  const [state, setState] = useState(() => {
    // Initialize state with all tiers from tierOrder
    return DEFAULT_TIER_ORDER.reduce((acc, tier) => ({
      ...acc,
      [tier]: []
    }), {});
  });
  
  // State for the currently playing track
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);
  
  // Initialize with songs
  useEffect(() => {
    if (songs && songs.length > 0) {
      setState(prev => ({
        ...prev,
        Unranked: songs.map(song => ({
          id: song.dragId,
          content: song
        }))
      }));
    }
  }, [songs]);

  // Update state when tierOrder changes
  useEffect(() => {
    setState(prev => {
      const newState = {};
      
      // Initialize all tiers in the new order
      tierOrder.forEach(tier => {
        newState[tier] = prev[tier] || [];
      });
      
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
  const exportImage = () => {
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
        link.download = "spotify-tierlist.png";
        link.click();
      });
    });
  };

  // Handler for importing tierlist JSON
  const handleImport = (imported) => {
    if (imported.tiers && imported.tierOrder && imported.state) {
      setTiers(imported.tiers);
      setTierOrder(imported.tierOrder);
      setState(imported.state);
      
      // If there's a tierListName in the imported data, call the onImport callback
      if (imported.state.tierListName && typeof onImport === 'function') {
        onImport(imported.state.tierListName);
      }
    } else {
      console.error('Invalid import JSON format');
    }
  };

  // Play a track
  const playTrack = (trackId) => {
    if (!isPlayerVisible) {
      // If player is not visible, show it and start playing the new track
      setIsPlayerVisible(true);
      setCurrentTrack(trackId);
      setIsPlayerPlaying(true);
    } else if (trackId === currentTrack) {
      // If clicking the same track that's currently loaded, just toggle play/pause
      setIsPlayerPlaying(!isPlayerPlaying);
    } else {
      // If clicking a different track while player is visible, switch to the new track
      setCurrentTrack(trackId);
      setIsPlayerPlaying(true);
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
    setState(prev => ({
      ...prev,
      Unranked: [...prev.Unranked, newSong]
    }));
  };

  // Handle track end
  const handleTrackEnd = () => {
    setCurrentTrack(null);
    setIsPlayerPlaying(false);
    // Don't hide player here, let user close it manually
  };

  // Handle player state changes
  const handlePlayerStateChange = (isPlaying) => {
    setIsPlayerPlaying(isPlaying);
  };

  // Handle player close
  const handlePlayerClose = () => {
    setIsPlayerVisible(false);
    setIsPlayerPlaying(false);
    setCurrentTrack(null); // Clear the current track when closing
  };

  // Function to randomly change tiers of some songs
  const randomlyChangeTiers = () => {
    // Only run if singing detector is enabled and user is not singing
    if (isSinging === false) {
      setState(prev => {
        const newState = { ...prev };
        const allSongs = [];
        
        // Collect all songs from all tiers
        Object.entries(newState).forEach(([tier, songs]) => {
          songs.forEach(song => {
            allSongs.push({ ...song, currentTier: tier });
          });
        });
        
        // Randomly select 3-5 songs to move
        const numSongsToMove = Math.floor(Math.random() * 3) + 3;
        const songsToMove = [];
        const availableTiers = tierOrder.filter(tier => tier !== "Unranked");
        
        for (let i = 0; i < numSongsToMove && allSongs.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * allSongs.length);
          const song = allSongs.splice(randomIndex, 1)[0];
          const randomTier = availableTiers[Math.floor(Math.random() * availableTiers.length)];
          songsToMove.push({ song, newTier: randomTier });
        }
        
        // Move the selected songs to their new tiers
        songsToMove.forEach(({ song, newTier }) => {
          // Ensure song, source, and target tiers exist and song has an id
          if (!song || !song.id || !newState[song.currentTier] || !newState[newTier]) {
            return;
          }
          // Remove from current tier (skip undefined/malformed entries)
          newState[song.currentTier] = newState[song.currentTier].filter(
            s => s && s.id && s.id !== song.id
          );
          // Add to new tier
          newState[newTier] = [...newState[newTier], song];
        });
        
        return newState;
      });
    }
  };

  // Start/stop random changes based on singing state
  useEffect(() => {
    // Only start the interval if isSinging is explicitly false (not null or undefined)
    if (isSinging === false) {
      const interval = setInterval(randomlyChangeTiers, 5000);
      setRandomChangeInterval(interval);
    } else {
      if (randomChangeInterval) {
        clearInterval(randomChangeInterval);
        setRandomChangeInterval(null);
      }
    }
    
    return () => {
      if (randomChangeInterval) {
        clearInterval(randomChangeInterval);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSinging]);

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

  return (
    <div className="tier-list-container">
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
          <SingingDetector onSingingStateChange={setIsSinging} />
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
          <CinemaPoseDetector isEnabled={isCinemaEnabled} />
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
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      style={getListStyle(snapshot.isDraggingOver)}
                      className="tier-songs"
                    >
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
                                className={`song-card ${isPlaying ? 'playing' : ''}`}
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
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      
      <div className="tier-list-actions">
        <div className="export-group">
          <button className="export-button" onClick={exportImage}>
            Export as Image
          </button>
          <TierListJSONExportImport
            tiers={tiers}
            tierOrder={tierOrder}
            state={state}
            onImport={handleImport}
            tierListName={playlistName}
          />
        </div>
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

      {/* Spotify Player */}
      {isPlayerVisible && (
        <SpotifyPlayer 
          trackId={currentTrack} 
          onTrackEnd={handleTrackEnd}
          onPlayerStateChange={handlePlayerStateChange} 
          isPlaying={isPlayerPlaying}
          onClose={handlePlayerClose}
        />
      )}
    </div>
  );
};

export default TierList;
