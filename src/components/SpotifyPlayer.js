import React, { useState, useEffect } from 'react';
import './SpotifyPlayer.css';
import spotifyIconOfficial from '../assets/spotify/spotify-icon-official.png';

const SpotifyPlayer = ({ trackId, onTrackEnd }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset player state when track changes
  useEffect(() => {
    setIsPlaying(false);
  }, [trackId]);

  // Handle track end
  useEffect(() => {
    if (onTrackEnd && isPlaying) {
      const timer = setTimeout(() => {
        setIsPlaying(false);
        onTrackEnd();
      }, 30000); // 30 seconds is the typical preview length
      
      return () => clearTimeout(timer);
    }
  }, [isPlaying, onTrackEnd]);

  if (!trackId) return null;

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const closePlayer = () => {
    setIsPlaying(false);
    onTrackEnd();
  };

  return (
    <div className={`spotify-player ${isExpanded ? 'expanded' : ''}`}>
      <div className="player-controls">
        <div className="player-buttons">
          <button 
            className="expand-button" 
            onClick={toggleExpand}
            aria-label={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? (
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
              </svg>
            )}
          </button>
          
          <div className="player-buttons-spacer"></div>
          
          <button 
            className="close-button" 
            onClick={closePlayer}
            aria-label="Close player"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="player-iframe-container">
        <iframe
          src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0&autoplay=${isPlaying ? 1 : 0}`}
          width="100%"
          height={isExpanded ? "152" : "80"}
          frameBorder="0"
          allowFullScreen=""
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify Player"
        ></iframe>
      </div>
    </div>
  );
};

export default SpotifyPlayer; 