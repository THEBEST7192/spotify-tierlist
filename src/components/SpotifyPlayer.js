import React, { useState, useEffect, useRef } from 'react';
import './SpotifyPlayer.css';
import spotifyIconOfficial from '../assets/spotify/spotify-icon-official.png';

// Using Spotify's iframe API as documented at:
// https://developer.spotify.com/documentation/embeds/tutorials/using-the-iframe-api
const SpotifyPlayer = ({ trackId, onTrackEnd, isPlaying, onPlayerStateChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playerPlayState, setPlayerPlayState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const iframeContainerRef = useRef(null);
  const controllerRef = useRef(null);
  const previousTrackRef = useRef(null);
  
  // Load the Spotify Iframe API script
  useEffect(() => {
    // Only load the script once
    if (!window.SpotifyIframeApi && !document.getElementById('spotify-iframe-api')) {
      setIsLoading(true);
      
      // Define the callback for when the API is ready
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        window.SpotifyIframeApi = IFrameAPI;
        if (trackId && iframeContainerRef.current) {
          initializeController(IFrameAPI);
        }
      };
      
      // Create and add the script element
      const script = document.createElement('script');
      script.id = 'spotify-iframe-api';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      
      document.body.appendChild(script);
      
      return () => {
        // Optional: Clean up global handlers when component unmounts
        window.onSpotifyIframeApiReady = null;
      };
    } else if (window.SpotifyIframeApi && trackId && iframeContainerRef.current) {
      // If API already loaded, initialize controller
      initializeController(window.SpotifyIframeApi);
    }
  }, []);
  
  // Initialize or update controller when trackId changes
  useEffect(() => {
    if (!trackId) return;
    
    if (window.SpotifyIframeApi && iframeContainerRef.current) {
      if (previousTrackRef.current !== trackId) {
        previousTrackRef.current = trackId;
        
        if (controllerRef.current) {
          // If we already have a controller, load the new URI
          controllerRef.current.loadUri(`spotify:track:${trackId}`);
          
          // Start playing the new track if player should be in playing state
          if (isPlaying || playerPlayState) {
            setTimeout(() => {
              controllerRef.current.play();
            }, 300);
          }
        } else {
          // Initialize a new controller if needed
          initializeController(window.SpotifyIframeApi);
        }
      }
    }
  }, [trackId, isPlaying, playerPlayState]);
  
  // Sync with external play state changes
  useEffect(() => {
    if (!controllerRef.current || isPlaying === undefined) return;
    
    // Only update if the states are different
    if (isPlaying !== playerPlayState) {
      if (isPlaying) {
        controllerRef.current.play();
      } else {
        controllerRef.current.pause();
      }
    }
  }, [isPlaying]);
  
  // Initialize the controller with the Spotify Iframe API
  const initializeController = (IFrameAPI) => {
    // Clear any existing content
    if (iframeContainerRef.current) {
      iframeContainerRef.current.innerHTML = '';
    }
    
    // Create options for the controller
    const options = {
      uri: `spotify:track:${trackId}`,
      width: '100%',
      height: isExpanded ? '152' : '80',
      theme: 'black'
    };
    
    // Create the controller
    IFrameAPI.createController(
      iframeContainerRef.current,
      options,
      (controller) => {
        // Store controller reference
        controllerRef.current = controller;
        setIsLoading(false);
        setIsReady(true);
        
        // Add event listeners
        controller.addListener('playback_update', (data) => {
          const newPlayState = !data.data.isPaused;
          
          // Update our local state and notify parent
          setPlayerPlayState(newPlayState);
          if (onPlayerStateChange) {
            onPlayerStateChange(newPlayState);
          }
          
          // Check for track end
          if (data.data.position >= data.data.duration - 1 && onTrackEnd) {
            onTrackEnd();
          }
        });
        
        // Handle ready state
        controller.addListener('ready', () => {
          setIsReady(true);
          // Auto-play the track if needed
          if (isPlaying) {
            setTimeout(() => controller.play(), 300);
          }
        });
      }
    );
  };
  
  const toggleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // Update iframe height if controller exists
    if (controllerRef.current) {
      controllerRef.current.setHeight(newExpandedState ? '152' : '80');
    }
  };
  
  const closePlayer = () => {
    // Pause playback
    if (controllerRef.current) {
      controllerRef.current.pause();
    }
    
    setPlayerPlayState(false);
    if (onPlayerStateChange) onPlayerStateChange(false);
    if (onTrackEnd) {
      onTrackEnd();
    }
  };
  
  if (!trackId) return null;
  
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
        {isLoading && (
          <div className="spotify-player-loading">
            <img src={spotifyIconOfficial} alt="Spotify" className="spotify-icon spinning" />
          </div>
        )}
        <div 
          ref={iframeContainerRef}
          className="spotify-iframe-element"
        />
      </div>
    </div>
  );
};

export default SpotifyPlayer; 