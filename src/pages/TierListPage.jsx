import React, { useState, useEffect } from "react";
import axios from "axios";
import TierList from "../components/TierList";

const TierListPage = ({ playlist }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch tracks from the playlist when component mounts
  useEffect(() => {
    const fetchTracks = async () => {
      if (!playlist || !playlist.id || !playlist.accessToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(
          `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
          {
            headers: {
              Authorization: `Bearer ${playlist.accessToken}`
            }
          }
        );

        // Extract track data from response
        const trackItems = response.data.items || [];
        
        // Process tracks to ensure they have proper IDs before passing to TierList
        const processedTracks = trackItems
          .map((item, index) => {
            if (!item.track) return null;
            
            // Create a processed track with a guaranteed unique ID
            return {
              ...item.track,
              // Use a simple numeric ID that's unique within the context of the playlist
              dragId: `track-${index}`,
              // Add index for stable sorting
              index
            };
          })
          .filter(track => track !== null);
        
        console.log("Processed tracks:", processedTracks.length);
        setSongs(processedTracks);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching playlist tracks:", err);
        setError("Failed to load tracks from this playlist");
        setLoading(false);
      }
    };

    fetchTracks();
  }, [playlist]);

  if (loading) {
    return <div className="loading">Loading playlist tracks...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="tierlist-page">
      <TierList songs={songs} />
    </div>
  );
};

export default TierListPage;