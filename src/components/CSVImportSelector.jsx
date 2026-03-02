import React, { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import SongGroupModal from "./SongGroupModal";
import { getOEmbed } from '../utils/backendApi';
import "./CSVImportSelector.css";

const CSVImportSelector = ({ onSelectImported }) => {
  const [file, setFile] = useState(null);
  const [parsedTracks, setParsedTracks] = useState([]);
  const [tracksParsed, setTracksParsed] = useState([]);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSongGroupModal, setShowSongGroupModal] = useState(false);
  const [totalSongs, setTotalSongs] = useState(0);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);

  const fetchAlbumCover = useCallback(async (trackId) => {
    try {
      const data = await getOEmbed(trackId);
      return data.thumbnail_url || null;
    } catch (err) {
      console.error("Failed to fetch cover for track", trackId, err);
      return null;
    }
  }, []);

  const parseCSVBasic = useCallback(async (csvText) => {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const tracks = [];
          for (const row of results.data) {
            const trackId = row["Spotify Track Id"];
            const song = row["Song"];
            const artist = row["Artist"];
            if (trackId && song && artist) {
              tracks.push({
                id: trackId,
                name: song,
                artists: [{ name: artist }],
                album: {
                  name: row["Album"] || "Unknown Album",
                  images: [] // No covers yet
                },
                duration_ms: parseInt(row["Duration"].replace(/:/g, "")) * 1000 || 0,
                external_urls: { spotify: `https://open.spotify.com/track/${trackId}` }
              });
            }
          }
          resolve(tracks);
        },
        error: (error) => reject(error)
      });
    });
  }, []);

  const fetchCoversForTracks = useCallback(async (tracks) => {
    setProgress({ current: 0, total: tracks.length });
    const updatedTracks = [];
    for (const track of tracks) {
      const cover = await fetchAlbumCover(track.id);
      updatedTracks.push({
        ...track,
        album: {
          ...track.album,
          images: cover ? [{ url: cover, width: 300, height: 300 }] : []
        }
      });
      setProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }
    setProgress({ current: 0, total: 0 });
    return updatedTracks;
  }, [fetchAlbumCover]);

  const handleFileChange = useCallback(async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.csv')) {
      setError("Please select a CSV file.");
      return;
    }
    setFile(selectedFile);
    const baseName = selectedFile.name.replace(/\.csv$/i, '');
    const cleanName = baseName.replace(/[-_\.\s]+/g, ' ').trim();
    setPlaylistName(cleanName);
    setError("");
    setIsLoading(true);
    try {
      const text = await selectedFile.text();
      const tracks = await parseCSVBasic(text);
      if (tracks.length === 0) {
        setError("No valid tracks found in CSV.");
        setIsLoading(false);
        return;
      }
      setTracksParsed(tracks);
      if (tracks.length > 100) {
        setParsedTracks(tracks);
        setTotalSongs(tracks.length);
        setShowSongGroupModal(true);
        setIsLoading(false);
      } else {
        setSelectedTracks(tracks);
        // Fetch covers asynchronously
        fetchCoversForTracks(tracks).then(updatedTracks => {
          setSelectedTracks(updatedTracks);
          setIsLoading(false);
        }).catch(err => {
          console.error("Error fetching covers:", err);
          setIsLoading(false);
        });
      }
    } catch (err) {
      setError("Failed to parse CSV file.");
      console.error(err);
      setIsLoading(false);
    }
  }, [parseCSVBasic, fetchCoversForTracks]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      const fakeEvent = { target: { files: [droppedFile] } };
      handleFileChange(fakeEvent);
    } else {
      setError("Please drop a CSV file.");
    }
  }, [handleFileChange]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handleSongGroupSelect = useCallback(async (option) => {
    setShowSongGroupModal(false);
    setIsLoading(true);
    
    let selected = [];
    
    if (option.type === "first") {
      selected = parsedTracks.slice(0, 100);
    } else if (option.type === "middle") {
      const offset = Math.floor((totalSongs - 100) / 2);
      selected = parsedTracks.slice(offset, offset + 100);
    } else if (option.type === "last") {
      const offset = totalSongs - 100;
      selected = parsedTracks.slice(offset, offset + 100);
    } else if (option.type === "range") {
      const startIndex = option.start - 1;
      const count = option.end - option.start + 1;
      selected = parsedTracks.slice(startIndex, startIndex + count);
    } else if (option.type === "random") {
      // Shuffle and take first 100
      const shuffled = [...parsedTracks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      selected = shuffled.slice(0, 100);
    }
    
    setTracksParsed(selected);
    // Fetch covers asynchronously
    fetchCoversForTracks(selected).then(updatedTracks => {
      setSelectedTracks(updatedTracks);
      setIsLoading(false);
    }).catch(err => {
      console.error("Error fetching covers:", err);
      setIsLoading(false);
    });
  }, [parsedTracks, totalSongs, fetchCoversForTracks]);

  const handleImport = useCallback(() => {
    if (!playlistName.trim() && selectedTracks.length === 0) {
      setError("Please enter a playlist name and ensure tracks are loaded.");
      return;
    } else if (!playlistName.trim()) {
      setError("Please enter a playlist name.");
      return;
    } else if (selectedTracks.length === 0) {
      setError("No tracks are loaded. Please select a CSV file first.");
      return;
    }
    onSelectImported({
      name: playlistName,
      description: playlistDescription,
      tracks: selectedTracks
    });
  }, [playlistName, playlistDescription, selectedTracks, onSelectImported]);

  return (
    <>
    <div className="csv-import-container">
      <h3>Import Playlist from CSV</h3>
      <div 
        className="drop-zone" 
        onDrop={handleDrop} 
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        {file ? (
          <p>Selected: {file.name}</p>
        ) : (
          <p>Drop your CSV file here or click to choose</p>
        )}
      </div>
      {!isLoading && tracksParsed.length === 0 && <p>You can get CSV files from <a href="https://www.chosic.com/spotify-playlist-analyzer/" target="_blank" rel="noopener noreferrer">Chosic Spotify Playlist Analyzer</a>.</p>}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        style={{ display: 'none' }}
      />
      {(progress.total > 0 && isLoading) ? (
        <div className="progress-bar">
          <p>Loading album covers... {progress.current}/{progress.total}</p>
          <div className="progress-container">
            <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
          </div>
        </div>
      ) : selectedTracks.length > 0 && !isLoading ? (
        <div className="progress-bar">
          <p>Loaded {selectedTracks.length} tracks</p>
        </div>
      ) : null}
      {error && <p className="error">{error}</p>}
      {tracksParsed.length > 0 && (
        <div className="import-form">
          <label>
            Playlist Name:
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Enter playlist name"
            />
          </label>
          <label>
            Description:
            <textarea
              value={playlistDescription}
              onChange={(e) => setPlaylistDescription(e.target.value)}
              placeholder="Enter description (optional)"
            />
          </label>
          <button onClick={handleImport} disabled={!playlistName.trim() || isLoading}>
            Import Playlist
          </button>
        </div>
      )}
    </div>
    {showSongGroupModal && (
      <SongGroupModal
        totalSongs={totalSongs}
        onSelect={handleSongGroupSelect}
        onClose={() => setShowSongGroupModal(false)}
      />
    )}
    </>
  );
};

export default CSVImportSelector;
