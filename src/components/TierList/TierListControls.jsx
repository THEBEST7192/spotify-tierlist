import React, { useState, useEffect } from "react";
import CinemaPoseDetector from "../CinemaPoseDetector";
import WiiController from "../WiiController";

const TierListControls = ({
  showEditMode,
  showAddTierForm,
  newTierName,
  newTierColor,
  isCinemaEnabled,
  isWiiEnabled,
  debugMode,
  onToggleEditMode,
  onToggleAddTierForm,
  onNewTierNameChange,
  onNewTierColorChange,
  onAddTier,
  onCinemaEnabledChange,
  onWiiEnabledChange,
  onWiiButtonPress
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
  <div className="tier-controls">
    <div className="tier-controls-header">
      <button className="edit-mode-toggle" onClick={onToggleEditMode}>
        {showEditMode ? "Hide Editing Tools" : "Show Editing Tools"}
      </button>
      {showEditMode && (
        <button className="add-tier-button" onClick={onToggleAddTierForm}>
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
          onChange={(event) => onNewTierNameChange(event.target.value)}
          className="new-tier-name-input"
        />
        <input
          type="color"
          value={newTierColor}
          onChange={(event) => onNewTierColorChange(event.target.value)}
          className="new-tier-color-input"
        />
        <button className="confirm-add-tier-button" onClick={onAddTier}>Add Tier</button>
      </div>
    )}
    <div className="detection-controls">
      {!isMobile && (
        <div className="cinema-control">
          <label className="toggle-switch">
            <input type="checkbox" checked={isCinemaEnabled} onChange={(event) => onCinemaEnabledChange(event.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
          <span className="control-label">{isCinemaEnabled ? '🎬 Absolute cinema on' : '🎬 Absolute cinema off'}</span>
        </div>
      )}
      <div className="detection-group">
        {!isMobile && (
          <div className="cinema-control">
            <label className="toggle-switch">
              <input type="checkbox" checked={isWiiEnabled} onChange={(event) => onWiiEnabledChange(event.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="control-label">{isWiiEnabled ? '🎮 Wii Support on' : '🎮 Wii Support off'}</span>
          </div>
        )}
        <WiiController isEnabled={isWiiEnabled && !isMobile} onButtonPress={onWiiButtonPress} />
      </div>
      <CinemaPoseDetector isEnabled={isCinemaEnabled && !isMobile} debugMode={debugMode} />
    </div>
  </div>
  );
};

export default TierListControls;
