import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SpotifyPlayer.css';
import spotifyIconOfficial from '../assets/spotify/spotify-icon-official.png';
import WebPlaybackSDK from './WebPlaybackSDK';

// Using Spotify's iframe API as documented at:
// https://developer.spotify.com/documentation/embeds/tutorials/using-the-iframe-api

// --- Module-level flags to prevent double initialization ---
let spotifyIframeScriptLoaded = false;
let spotifyIframeApiCallbackSet = false;

const SpotifyPlayer = ({ trackId, onTrackEnd, isPlaying, onPlayerStateChange, onClose, accessToken }) => {
  const [useFallback, setUseFallback] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [playerPlayState, setPlayerPlayState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const iframeContainerRef = useRef(null);
  const controllerRef = useRef(null);
  const previousTrackRef = useRef(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const isSeeking = useRef(false);
  const hasStartedPlaying = useRef(false);
  const lastPlaybackPosition = useRef(0);

  // Handle track end for Web Playback SDK
  const handleTrackEnd = useCallback(() => {
    setCurrentPosition(0);
    lastPlaybackPosition.current = 0;
    onTrackEnd?.();
  }, [onTrackEnd]);

  // Handle player state change for Web Playback SDK
  const handlePlayerStateChange = useCallback((isPlaying) => {
    setPlayerPlayState(isPlaying);
    onPlayerStateChange?.(isPlaying);
  }, [onPlayerStateChange]);

  // Load the Spotify Iframe API script with fallback to Web Playback SDK
  useEffect(() => {
    // Check if we should use the fallback (mobile or Firefox with enhanced protection)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isFirefoxWithProtection = navigator.userAgent.includes('Firefox') && 
      (window.netscape || window.netscape.security || {}).privilegeManager?.enabled;

    if (isMobile || isFirefoxWithProtection) {
      console.log('Using Web Playback SDK fallback due to browser/device restrictions');
      setUseFallback(true);
      return;
    }

    const loadSpotifyApi = () => {
      setIsLoading(true);
      
      // Only set the callback once
      if (!spotifyIframeApiCallbackSet) {
        window.onSpotifyIframeApiReady = (IFrameAPI) => {
          window.SpotifyIframeApi = IFrameAPI;
          spotifyIframeApiCallbackSet = true;
          if (trackId && iframeContainerRef.current) {
            initializeController(IFrameAPI);
          }
        };
        spotifyIframeApiCallbackSet = true;
      }

      // Only add the script once
      if (!spotifyIframeScriptLoaded) {
        const existingScript = document.getElementById('spotify-iframe-api');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'spotify-iframe-api';
          script.src = 'https://open.spotify.com/embed/iframe-api/v1';
          script.async = true;
          script.onerror = () => {
            console.log('Failed to load Spotify Iframe API, falling back to Web Playback SDK');
            setUseFallback(true);
          };
          document.body.appendChild(script);
        }
        spotifyIframeScriptLoaded = true;
      }
    };

    if (!window.SpotifyIframeApi) {
      loadSpotifyApi();
    } else if (trackId && iframeContainerRef.current) {
      initializeController(window.SpotifyIframeApi);
    }

    // Cleanup: only destroy controller, not script or API
    return () => {
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
      setIsReady(false);
      setIsLoading(true);
      setIsExpanded(false);
      setPlayerPlayState(false);
      setCurrentPosition(0);
      if (iframeContainerRef.current) {
        iframeContainerRef.current.innerHTML = '';
      }
      lastPlaybackPosition.current = 0;
      hasStartedPlaying.current = false;
    };
  }, [trackId]);

  // Initialize or update controller when trackId changes
  useEffect(() => {
    if (!trackId || !window.SpotifyIframeApi || !iframeContainerRef.current) return;
    if (controllerRef.current) {
      // If controller exists, just load new URI
      controllerRef.current.loadUri(`spotify:track:${trackId}`);
      // Optionally auto-play if needed
      if (isPlaying) {
        setTimeout(() => controllerRef.current.togglePlay(), 300);
      }
      previousTrackRef.current = trackId;
      setCurrentPosition(0);
      lastPlaybackPosition.current = 0;
    } else {
      // If no controller, create one
      initializeController(window.SpotifyIframeApi);
      previousTrackRef.current = trackId;
      setCurrentPosition(0);
      lastPlaybackPosition.current = 0;
    }
  }, [trackId]);
  
  // Sync with external play state changes
  useEffect(() => {
    if (!controllerRef.current || isPlaying === undefined || !isReady) return;
    
    // Only update if the states are different
    if (isPlaying !== playerPlayState) {
      if (isPlaying) {
        // If resuming playback and we have a saved position, seek first
        if (lastPlaybackPosition.current > 0) {
          try {
            // First seek to the position
            isSeeking.current = true;
            controllerRef.current.seekTo(lastPlaybackPosition.current);
            
            // Small delay after seeking before playing
            setTimeout(() => {
              controllerRef.current.togglePlay();
              isSeeking.current = false;
            }, 100);
          } catch (error) {
            console.error("Error resuming playback:", error);
            controllerRef.current.togglePlay(); // Fallback
            isSeeking.current = false;
          }
        } else {
          // Just toggle play for first time
          controllerRef.current.togglePlay();
        }
      } else {
        // Save current position before pausing
        if (currentPosition > 0) {
          lastPlaybackPosition.current = currentPosition;
        }
        controllerRef.current.togglePlay();
      }
    }
  }, [isPlaying, isReady]);
  
  // Expand/collapse handler
  const toggleExpand = () => setIsExpanded(exp => !exp);

  // Set iframe height instantly (not animated) to only supported heights
  useEffect(() => {
    const container = iframeContainerRef.current;
    if (!container) return;
    const iframe = container.querySelector('iframe');
    if (iframe) {
      iframe.style.height = isExpanded ? '152px' : '80px';
    }
  }, [isExpanded, isReady]);

  // Initialize the controller with the Spotify Iframe API
  const initializeController = (IFrameAPI, customHeight, resumePlaying, resumePosition) => {
    if (iframeContainerRef.current) {
      iframeContainerRef.current.innerHTML = '';
    }
    const options = {
      uri: `spotify:track:${trackId}`,
      token: accessToken,
      width: '100%',
      height: customHeight || (isExpanded ? '152' : '80'),
      theme: 'black'
    };
    IFrameAPI.createController(
      iframeContainerRef.current,
      options,
      (controller) => {
        controllerRef.current = controller;
        setIsLoading(false);
        setIsReady(true);
        controller.addListener('playback_update', (data) => {
          const newPlayState = !data.data.isPaused;
          if (!isSeeking.current && newPlayState) {
            setCurrentPosition(data.data.position);
          }
          if (data.data.isPaused && currentPosition > 0) {
            lastPlaybackPosition.current = currentPosition;
          }
          setPlayerPlayState(newPlayState);
          if (onPlayerStateChange) {
            onPlayerStateChange(newPlayState);
          }
          if (data.data.position >= data.data.duration - 1 && onTrackEnd) {
            setCurrentPosition(0);
            lastPlaybackPosition.current = 0;
            onTrackEnd();
          }
        });
        controller.addListener('ready', () => {
          setIsReady(true);
          // Restore position and play state
          if (resumePosition && resumePosition > 0) {
            controller.seekTo(resumePosition);
          }
          if (resumePlaying) {
            setTimeout(() => controller.togglePlay(), 300);
          }
        });
      }
    );
  };
  
  // Close the player and clean up
  const closePlayer = () => {
    // Save position before closing
    if (controllerRef.current && playerPlayState) {
      lastPlaybackPosition.current = currentPosition;
      controllerRef.current.togglePlay();
    }
    
    // Reset all state
    setPlayerPlayState(false);
    setCurrentPosition(0);
    lastPlaybackPosition.current = 0;
    previousTrackRef.current = null;
    setIsReady(false);
    
    // Clean up the controller
    if (controllerRef.current) {
      controllerRef.current.destroy();
      controllerRef.current = null;
    }
    
    if (iframeContainerRef.current) {
      iframeContainerRef.current.innerHTML = '';
    }
    
    if (onPlayerStateChange) onPlayerStateChange(false);
    if (onClose) onClose();
  };
  
  if (!trackId) return null;

  // Render Web Playback SDK fallback if needed
  if (useFallback && accessToken) {
    return (
      <div className={`spotify-player${isExpanded ? ' expanded' : ''}`}>
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
              onClick={onClose}
              aria-label="Close player"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="spotify-iframe-crop">
          <div className="player-iframe-container">
            {isLoading && (
              <div className="spotify-player-loading">
                <img src={spotifyIconOfficial} alt="Spotify" className="spotify-icon spinning" />
                <div>Loading player...</div>
              </div>
            )}
            {isReady && (
              <div className="web-playback-sdk-container">
                <div className="now-playing">
                  <img src={spotifyIconOfficial} alt="Spotify" className="spotify-icon" />
                  <div className="track-info">
                    <div className="track-name">Playing from Web Player</div>
                    <div className="track-artist">Spotify</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <WebPlaybackSDK
          token={accessToken}
          trackId={trackId}
          isPlaying={isPlaying}
          onPlayerStateChange={handlePlayerStateChange}
          onTrackEnd={handleTrackEnd}
          onReady={() => {
            console.log('Web Playback SDK is ready');
            setIsLoading(false);
            setIsReady(true);
          }}
        />
      </div>
    );
  }
  
  return (
    <div className={`spotify-player${isExpanded ? ' expanded' : ''}`}>
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
      
      <div className="spotify-iframe-crop">
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
    </div>
  );
};

export default SpotifyPlayer;