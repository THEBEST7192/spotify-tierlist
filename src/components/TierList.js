import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import html2canvas from "html2canvas";

const defaultTiers = {
  S: [],
  A: [],
  B: [],
  C: [],
  D: [],
  E: [],
  F: [],
  Unranked: [] // Added Unranked tier for initial songs
};

const tierColors = {
  S: "#FF7F7F", // Light Red
  A: "#FFBF7F", // Light Orange
  B: "#FFFF7F", // Light Yellow
  C: "#7FFF7F", // Light Green
  D: "#7FBFFF", // Light Blue
  E: "#BF7FFF", // Light Purple
  F: "#FF7FBF", // Light Pink
  Unranked: "#E0E0E0" // Light Gray
};

const TierList = ({ songs }) => {
  const [tiers, setTiers] = useState(defaultTiers);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize songs into the Unranked tier when songs prop changes
  useEffect(() => {
    if (songs && songs.length > 0) {
      setTiers(prevTiers => ({
        ...prevTiers,
        Unranked: [...songs]
      }));
      setIsLoading(false);
    }
  }, [songs]);

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const sourceTier = source.droppableId;
    const destTier = destination.droppableId;
    
    // Don't do anything if dropped in the same position
    if (
      sourceTier === destTier &&
      source.index === destination.index
    ) {
      return;
    }

    // Get the song being dragged
    const song = tiers[sourceTier][source.index];

    // Create a new tiers object to update state
    const newTiers = { ...tiers };
    
    // Remove from source tier
    newTiers[sourceTier].splice(source.index, 1);
    
    // Add to destination tier
    newTiers[destTier].splice(destination.index, 0, song);

    setTiers(newTiers);
  };

  const exportImage = () => {
    html2canvas(document.getElementById("tier-list")).then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "tierlist.png";
      link.click();
    });
  };

  if (isLoading) {
    return <div>Loading songs...</div>;
  }

  return (
    <div className="tier-list-container">
      <DragDropContext onDragEnd={onDragEnd}>
        <div id="tier-list" className="tier-list">
          {Object.keys(tiers).map((tier) => (
            <Droppable key={tier} droppableId={tier} direction="horizontal">
              {(provided, snapshot) => (
                <div 
                  className={`tier ${tier.toLowerCase()}`} 
                  style={{ backgroundColor: tierColors[tier] }}
                >
                  <div className="tier-label">
                    <h3>{tier}</h3>
                  </div>
                  <div 
                    className="tier-songs"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {tiers[tier].map((song, index) => (
                      <Draggable 
                        key={song.id} 
                        draggableId={song.id} 
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            className={`song-card ${snapshot.isDragging ? 'dragging' : ''}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            {song.album && song.album.images && song.album.images.length > 0 && (
                              <img 
                                src={song.album.images[song.album.images.length > 2 ? 2 : 0].url} 
                                alt={song.album.name}
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
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
      <button className="export-button" onClick={exportImage}>Export as Image</button>
      
      <style jsx>{`
        .tier-list-container {
          font-family: 'Arial', sans-serif;
          max-width: 100%;
          margin: 0 auto;
        }
        .tier-list {
          display: flex;
          flex-direction: column;
          border: 1px solid #ddd;
          border-radius: 5px;
          overflow: hidden;
        }
        .tier {
          display: flex;
          margin-bottom: 2px;
          min-height: 80px;
        }
        .tier-label {
          width: 80px;
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: bold;
          border-right: 2px solid rgba(0,0,0,0.1);
        }
        .tier-songs {
          flex-grow: 1;
          display: flex;
          flex-wrap: wrap;
          padding: 10px;
          min-height: 80px;
        }
        .song-card {
          display: flex;
          background: white;
          padding: 5px;
          margin: 5px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          max-width: 200px;
          align-items: center;
        }
        .song-card.dragging {
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .album-cover {
          width: 50px;
          height: 50px;
          border-radius: 3px;
          margin-right: 10px;
        }
        .song-info {
          flex-grow: 1;
          overflow: hidden;
        }
        .song-name {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .song-artist {
          font-size: 12px;
          color: #777;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .export-button {
          margin-top: 20px;
          padding: 10px 15px;
          background: #1DB954;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        .export-button:hover {
          background: #1ed760;
        }
        .unranked {
          background-color: #f0f0f0;
        }
      `}</style>
    </div>
  );
};

export default TierList;
