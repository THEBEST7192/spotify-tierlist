import React, { useState } from "react";
import "./SongGroupModal.css";

const getGroupSizes = (total, n) => {
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
};

const SongGroupModal = ({ totalSongs, onSelect, onClose }) => {
  const [randomGroupCount, setRandomGroupCount] = useState(1);
  const [sliderValue, setSliderValue] = useState(1);
  const maxGroups = Math.min(10, totalSongs >= 100 ? 10 : Math.floor(totalSongs / 10));

  const groupSizes = getGroupSizes(100, sliderValue);

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Playlist too large</h2>
        <p>This playlist has {totalSongs} songs. Please select which 100 songs to use:</p>
        <button onClick={() => onSelect({ type: "first" })}>First 100 songs</button>
        <button onClick={() => onSelect({ type: "middle" })}>Middle 100 songs</button>
        <button onClick={() => onSelect({ type: "last" })}>Last 100 songs</button>
        <div className="random-group-section">
          <label>
            Random groups:
            <input
              type="range"
              min="1"
              max={maxGroups}
              value={sliderValue}
              onChange={e => setSliderValue(Number(e.target.value))}
            />
          </label>
          <div className="group-count">Number of groups: {sliderValue}</div>
          <button onClick={() => onSelect({ type: "random", groups: sliderValue })}>
            Select Random Groups
          </button>
        </div>
        <button className="close-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default SongGroupModal;
