import React, { useState, useRef } from "react";
import "./SongGroupModal.css";

const SongGroupModal = ({ totalSongs, onSelect, onClose }) => {
  const [sliderValue, setSliderValue] = useState(1);
  const [startValue, setStartValue] = useState(1);
  const [endValue, setEndValue] = useState(100);
  const maxGroups = Math.min(10, totalSongs >= 100 ? 10 : Math.floor(totalSongs / 10));
  const holdTimerRef = useRef(null);

  const startHold = (fn) => { fn(); holdTimerRef.current = setInterval(fn, 100); };
  const endHold = () => clearInterval(holdTimerRef.current);

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
            Random groups: <span className="group-count">{sliderValue}</span>
            <input
              type="range"
              min="1"
              max={maxGroups}
              value={sliderValue}
              onChange={e => setSliderValue(Number(e.target.value))}
            />
          </label>
          <button onClick={() => onSelect({ type: "random", groups: sliderValue })}>
            Select Random Groups
          </button>
        </div>
        <div className="range-section">
          <h3>Select Range</h3>
          <label>
            Start:
            <div className="number-input-wrapper">
              <input
                type="number"
                min="1"
                max={totalSongs}
                value={startValue}
                onChange={e => setStartValue(Number(e.target.value))}
                style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', appearance: 'none' }}
              />
              <div className="custom-arrows">
                <button
                  type="button"
                  className="arrow-btn arrow-up"
                  onMouseDown={() => startHold(() => setStartValue(v => Math.min(totalSongs, v + 1)))}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="arrow-btn arrow-down"
                  onMouseDown={() => startHold(() => setStartValue(v => Math.max(1, v - 1)))}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                >
                  ▼
                </button>
              </div>
            </div>
          </label>
          <label>
            End:
            <div className="number-input-wrapper">
              <input
                type="number"
                min="1"
                max={totalSongs}
                value={endValue}
                onChange={e => setEndValue(Number(e.target.value))}
                style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', appearance: 'none' }}
              />
              <div className="custom-arrows">
                <button
                  type="button"
                  className="arrow-btn arrow-up"
                  onMouseDown={() => startHold(() => setEndValue(v => Math.min(totalSongs, v + 1)))}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="arrow-btn arrow-down"
                  onMouseDown={() => startHold(() => setEndValue(v => Math.max(startValue, v - 1)))}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                >
                  ▼
                </button>
              </div>
            </div>
          </label>
          <p className={endValue < startValue || endValue - startValue + 1 > 100 ? "error-text" : ""}>
            {endValue < startValue
              ? "Invalid range"
              : endValue - startValue + 1 > 100
                ? `Too many songs selected (${endValue - startValue + 1}), max 100`
                : `Selected songs: ${startValue} to ${endValue} (total ${endValue - startValue + 1})`
            }
          </p>
          <button
            onClick={() => onSelect({ type: "range", start: startValue, end: endValue })}
            disabled={endValue < startValue || endValue - startValue + 1 > 100}
          >
            Select Range
          </button>
        </div>
        <button className="close-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default SongGroupModal;
