import React, { useState, useEffect } from "react";
import TierList from "../components/TierList";
import { getValidAccessToken } from "../utils/SpotifyAuth";
import { getPlaylistTracks } from "../utils/spotifyApi";

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
        const response = await getPlaylistTracks(playlist.id, 0, 100);

        // Extract track data from response
        const trackItems = response.data.items || [];
        const processedTracks = trackItems
          .map((entry, index) => {
            const track = entry?.track ?? entry?.item ?? entry?.content ?? null;
            if (!track) return null;
            return {
              ...track,
              dragId: `track-${index}`,
              index
            };
          })
          .filter(Boolean);
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
