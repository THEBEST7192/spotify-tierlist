import React, { useEffect, useState } from "react";
import axios from "axios";

const PlaylistSelector = ({ accessToken, onSelect }) => {
  const [playlists, setPlaylists] = useState([]);

  useEffect(() => {
    if (!accessToken) return;

//    console.log("Using Access Token:", accessToken); // Debugging

    axios
      .get("https://api.spotify.com/v1/me/playlists", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        console.log("API Response:", res.data);
        setPlaylists(res.data.items);
      })
      .catch((err) => console.error("Error fetching playlists:", err));
  }, [accessToken]);

  return (
    <div>
      <h2>Select a Playlist</h2>
      {playlists.length > 0 ? (
        playlists.map((playlist) => (
          <button key={playlist.id} onClick={() => onSelect(playlist)}>
            {playlist.name}
          </button>
        ))
      ) : (
        <p>No playlists found. Make sure your Spotify account has playlists.</p>
      )}
    </div>
  );
};

export default PlaylistSelector;
