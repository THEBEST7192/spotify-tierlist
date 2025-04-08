import React, { useEffect, useState } from "react";
import axios from "axios";
import "./PlaylistSelector.css";

const PlaylistSelector = ({ accessToken, onSelect }) => {
  const [playlists, setPlaylists] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredPlaylists, setFilteredPlaylists] = useState([]);

  useEffect(() => {
    if (!accessToken) return;

    axios
      .get("https://api.spotify.com/v1/me/playlists", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        setPlaylists(res.data.items);
        setFilteredPlaylists(res.data.items);
      })
      .catch((err) => console.error("Error fetching playlists:", err));
  }, [accessToken]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredPlaylists(playlists);
      return;
    }
    
    const filtered = playlists.filter(playlist => 
      playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (playlist.description && playlist.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (playlist.owner && playlist.owner.display_name && playlist.owner.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredPlaylists(filtered);
  }, [searchQuery, playlists]);

  return (
    <div className="playlist-selector-container">
      <h2>Select a Playlist</h2>
      <input
        type="text"
        className="search-input"
        placeholder="Search playlists..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="playlist-grid">
        {filteredPlaylists.map((playlist) => (
          <button
            key={playlist.id}
            className="playlist-button"
            onClick={() => onSelect(playlist)}
          >
            <img
              src={playlist.images[0]?.url || '/default-playlist-cover.png'}
              alt={playlist.name}
              className="playlist-cover"
            />
            <div className="playlist-info">
              <h3 className="playlist-name">{playlist.name}</h3>
              <p className="playlist-creator">Created by: {playlist.owner?.display_name || 'Unknown'}</p>
              <p className="playlist-description">{playlist.description || 'No description available'}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PlaylistSelector;
