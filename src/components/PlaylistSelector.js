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
      (playlist.description && playlist.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredPlaylists(filtered);
  }, [searchQuery, playlists]);

  return (
    <div className="playlist-selector">
      <h2>Select a Playlist</h2>
      <input
        type="text"
        placeholder="Search playlists by name or description..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="search-input"
      />
      {filteredPlaylists.length > 0 ? (
        filteredPlaylists.map((playlist) => (
          <button 
            key={playlist.id} 
            onClick={() => onSelect(playlist)} 
            className="playlist-button"
          >
            {playlist.images && playlist.images.length > 0 && (
              <img 
                src={playlist.images[0].url}
                alt={playlist.name}
                className="playlist-cover"
              />
            )}
            <div className="playlist-info">
              <div className="playlist-name">{playlist.name}</div>
              {playlist.description && (
                <div className="playlist-description">{playlist.description}</div>
              )}
            </div>
          </button>
        ))
      ) : (
        <p>No playlists found. Make sure your Spotify account has playlists.</p>
      )}
    </div>
  );
};

export default PlaylistSelector;
