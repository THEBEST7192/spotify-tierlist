import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import html2canvas from "html2canvas";
import "./TierList.css";

// Define tiers and their colors
const TIERS = {
  S: { color: "#FF7F7F", label: "S" },
  A: { color: "#FFBF7F", label: "A" },
  B: { color: "#FFFF7F", label: "B" },
  C: { color: "#7FFF7F", label: "C" },
  D: { color: "#7FBFFF", label: "D" },
  E: { color: "#BF7FFF", label: "E" },
  F: { color: "#FF7FBF", label: "F" },
  Unranked: { color: "#E0E0E0", label: "Unranked" }
};

// Define the order of tiers
const TIER_ORDER = ["S", "A", "B", "C", "D", "E", "F", "Unranked"];

// IMPORTANT: This is the most reliable ID method
const getItemStyle = (isDragging, draggableStyle) => ({
  // some basic styles to make the items look nicer
  userSelect: "none",
  padding: 8,
  margin: "0 8px 0 0",
  
  // change background colour if dragging
  background: isDragging ? "lightgreen" : "white",
  
  // styles we need to apply on draggables
  ...draggableStyle
});

const getListStyle = isDraggingOver => ({
  background: isDraggingOver ? "lightblue" : "transparent",
  display: "flex",
  overflow: "auto",
  minHeight: "80px"
});

const TierList = ({ songs }) => {
  const [state, setState] = useState(() => {
    // Initialize state with all tiers from TIER_ORDER
    return TIER_ORDER.reduce((acc, tier) => ({
      ...acc,
      [tier]: []
    }), {});
  });
  
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

  // Export tier list as an image
  const exportImage = () => {
    html2canvas(document.getElementById("tier-list")).then(canvas => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "spotify-tierlist.png";
      link.click();
    });
  };

  return (
    <div className="tier-list-container">
      <DragDropContext onDragEnd={onDragEnd}>
        <div id="tier-list" className="tier-list">
          {TIER_ORDER.map(tierId => {
            const { color, label } = TIERS[tierId];
            
            return (
              <div 
                key={tierId}
                className="tier"
                style={{ backgroundColor: color }}
              >
                <div className="tier-label">
                  <h3>{label}</h3>
                </div>
                
                <Droppable
                  droppableId={tierId}
                  direction="horizontal"
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
                                  <img 
                                    src={song.album.images[song.album.images.length > 2 ? 2 : 0].url}
                                    alt={song.album.name || "Album Cover"}
                                    className="album-cover" 
                                  />
                                )}
                                <div className="song-info">
                                  <div className="song-name">{song.name}</div>
                                  <div className="song-artist">
                                    {song.artists && song.artists.map(artist => artist.name).join(", ")}
                                  </div>
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
      
      <button className="export-button" onClick={exportImage}>
        Export as Image
      </button>
    </div>
  );
};

export default TierList;
