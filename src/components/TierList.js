import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import html2canvas from "html2canvas";
import "./TierList.css";
import RecommendationGenerator from "./RecommendationGenerator";
import SpotifyPlayer from "./SpotifyPlayer";
import SingingDetector from "./SingingDetector";
import spotifyIconOfficial from '../assets/spotify/spotify-icon-official.png';

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

const TierList = ({ songs, accessToken }) => {
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

  // Play a track
  const playTrack = (trackId) => {
    setCurrentTrack(trackId);
  };

  // Handle track end
  const handleTrackEnd = () => {
    setCurrentTrack(null);
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
          // Remove from current tier
          newState[song.currentTier] = newState[song.currentTier].filter(
            s => s.id !== song.id
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
        
        <SingingDetector onSingingStateChange={setIsSinging} />
        
        {showAddTierForm && (
          <div className="add-tier-form">
            <input
              type="text"
              placeholder="Tier Name"
              value={newTierName}
              onChange={(e) => setNewTierName(e.target.value)}
              className="tier-name-input"
            />
            <input
              type="color"
              value={newTierColor}
              onChange={(e) => setNewTierColor(e.target.value)}
              className="tier-color-input"
            />
            <button 
              className="save-tier-button"
              onClick={addTier}
              disabled={!newTierName.trim()}
            >
              Add Tier
            </button>
          </div>
        )}
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
                        const song = item.content;
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
                                className="song-card"
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
                                    className="play-preview-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playTrack(song.id);
                                    }}
                                    aria-label="Play preview"
                                  >
                                    <svg viewBox="0 0 24 24" width="20" height="20">
                                      <path fill="currentColor" d="M8 5v14l11-7z" />
                                    </svg>
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
        <button className="export-button" onClick={exportImage}>
          Export as Image
        </button>
        
        <RecommendationGenerator 
          tierState={state} 
          tierOrder={tierOrder}
          tiers={tiers}
          accessToken={accessToken} 
          onPlayTrack={playTrack}
        />
      </div>

      {/* Spotify Player */}
      <SpotifyPlayer 
        trackId={currentTrack} 
        onTrackEnd={handleTrackEnd} 
      />
    </div>
  );
};

export default TierList;
