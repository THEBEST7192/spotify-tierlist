import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import SongCard from './SongCard';
import { getListStyle } from './tierListUtils';

const TierRow = ({
  tierId,
  color,
  label,
  items,
  isEditing,
  editTierName,
  onEditTierNameChange,
  onSaveTierName,
  onCancelTierEdit,
  showEditMode,
  onStartEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
  currentTrack,
  isPlayerPlaying,
  focusedSongId,
  focusedTierId,
  pickedUpSongId,
  isWiiUiMode,
  onPlayTrack
}) => {
  const isUnranked = tierId === "Unranked";

  return (
    <div
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
                onChange={(e) => onEditTierNameChange(e.target.value)}
                className="tier-edit-input"
                autoFocus
              />
              <div className="edit-buttons">
                <button
                  className="save-edit-button"
                  onClick={onSaveTierName}
                >
                  Save
                </button>
                <button
                  className="cancel-edit-button"
                  onClick={onCancelTierEdit}
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
              onClick={onStartEdit}
              title="Rename Tier"
            >
              ✎
            </button>
            <button
              className="tier-action-button"
              onClick={onMoveUp}
              title="Move Up"
            >
              ↑
            </button>
            <button
              className="tier-action-button"
              onClick={onMoveDown}
              title="Move Down"
            >
              ↓
            </button>
            <button
              className="tier-action-button delete"
              onClick={onDelete}
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
            const visibleItems = (items || []).filter(item => item && item.content);
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
            {(items || []).map((item, index) => {
              if (!item || !item.content) return null;
              const song = item.content;

              return (
                <SongCard
                  key={item.id}
                  item={item}
                  index={index}
                  isPlaying={currentTrack === song.id && isPlayerPlaying}
                  isFocused={!isWiiUiMode && focusedSongId === item.id}
                  isPickedUp={pickedUpSongId === item.id}
                  onPlayTrack={onPlayTrack}
                />
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
};

export default TierRow;
