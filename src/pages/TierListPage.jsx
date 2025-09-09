import React, { useState, useEffect } from "react";
import axios from "axios";
import TierList from "../components/TierList";
import { getValidAccessToken } from "../utils/SpotifyAuth";

const TierListPage = ({ playlist }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validAccessToken, setValidAccessToken] = useState(null);

  // Ensure we always have a valid access token
  useEffect(() => {
    const ensureValidToken = async () => {
      if (!playlist || !playlist.accessToken) return;
      try {
        const token = await getValidAccessToken();
        setValidAccessToken(token);
      } catch (err) {
        console.error('Failed to refresh Spotify access token:', err);
        setError("Failed to refresh Spotify access token");
      }
    };
    ensureValidToken();
  }, [playlist]);

  // Fetch tracks from the playlist when component mounts
  useEffect(() => {
    const fetchTracks = async () => {
      if (!playlist || !playlist.id || !validAccessToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(
          `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
          {
            headers: {
              Authorization: `Bearer ${validAccessToken}`
            }
          }
        );

        // Extract track data from response
        const trackItems = response.data.items || [];
        const processedTracks = trackItems
          .map((item, index) => {
            if (!item.track) return null;
            return {
              ...item.track,
              dragId: `track-${index}`,
              index
            };
          })
          .filter(track => track !== null);
        setSongs(processedTracks);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching playlist tracks:', err);
        setError("Failed to load tracks from this playlist");
        setLoading(false);
      }
    };
    fetchTracks();
  }, [playlist, validAccessToken]);

  if (loading) {
    return <div className="loading">Loading playlist tracks...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="tierlist-page">
      <TierList songs={songs} accessToken={validAccessToken} />
    </div>
  );
};

export default TierListPage;