import React, { useState, useEffect, useRef } from 'react';
import './SpotifyPlayer.css';
import spotifyIconOfficial from '../assets/spotify/spotify-icon-official.png';

let spotifyIframeScriptLoaded = false;
let spotifyIframeApiCallbackSet = false;

const PLAYER_SIZE_KEY = 'spotifyPlayerIsExpanded';

const SpotifyPlayer = ({ trackId, onTrackEnd, isPlaying, onPlayerStateChange, onClose, accessToken }) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem(PLAYER_SIZE_KEY);
    return stored === 'true';
  });
  const [playerPlayState, setPlayerPlayState] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [, setIsFirefoxETP] = useState(false);
  const iframeContainerRef = useRef(null);
  const controllerRef = useRef(null);
  const previousTrackRef = useRef(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const isSeeking = useRef(false);
  const hasStartedPlaying = useRef(false);
  const lastPlaybackPosition = useRef(0);
  const creatingControllerRef = useRef(false);
  const pendingStartAfterLoad = useRef(false);
  const hasNotifiedEnd = useRef(false);
  
  useEffect(() => {
    localStorage.setItem(PLAYER_SIZE_KEY, isExpanded);
  }, [isExpanded]);

   
   
   

  // These callback functions are now directly used in the controller listeners
  // instead of being referenced separately

  useEffect(() => {
    console.log('[SpotifyPlayer] useEffect (loadSpotifyApi) trackId:', trackId, 'accessToken:', accessToken ? 'present' : 'missing');
    const loadSpotifyApi = () => {

      if (!spotifyIframeApiCallbackSet) {
        window.onSpotifyIframeApiReady = (IFrameAPI) => {
          console.log('[SpotifyPlayer] Spotify Iframe API ready:', IFrameAPI);
          window.SpotifyIframeApi = IFrameAPI;
          spotifyIframeApiCallbackSet = true;
          // Don't initialize controller here - let the other effects handle it
          console.log('[SpotifyPlayer] Spotify Iframe API loaded and ready for use');
        };
        spotifyIframeApiCallbackSet = true;
      }
      if (!spotifyIframeScriptLoaded) {
        const existingScript = document.getElementById('spotify-iframe-api');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'spotify-iframe-api';
          script.src = 'https://open.spotify.com/embed/iframe-api/v1';
          script.async = true;
          script.onload = () => {
            console.log('[SpotifyPlayer] Spotify Iframe API script loaded successfully');
          };
          script.onerror = (error) => {
            console.error('[SpotifyPlayer] Failed to load Spotify Iframe API:', error);

            if (error.message && error.message.includes('Failed to send message') && typeof window.InstallTrigger !== 'undefined') {
              setIsFirefoxETP(true);
            }
          };
          document.body.appendChild(script);
        }
        spotifyIframeScriptLoaded = true;
      }
    };
    
    if (!window.SpotifyIframeApi) {
      console.log('[SpotifyPlayer] Loading Spotify Iframe API');
      loadSpotifyApi();
    } else {
      console.log('[SpotifyPlayer] SpotifyIframeApi already loaded');
    }
    
    // Cleanup function
    return () => {
      console.log('[SpotifyPlayer] API load effect cleanup');
    };
  }, []);  // Only run this effect once on mount

   

  // Initialize/destroy controller on mount/unmount
  useEffect(() => {
    const cleanupController = () => {
      if (controllerRef.current) {
        console.log('[SpotifyPlayer] Cleaning up controller');
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
      if (iframeContainerRef.current) {
        iframeContainerRef.current.innerHTML = '';
      }
      setIsReady(false);
    };

    return () => {
      console.log('[SpotifyPlayer] Cleanup: destroying controller on unmount');
      cleanupController();

      setPlayerPlayState(false);
      setCurrentPosition(0);
      lastPlaybackPosition.current = 0;
      hasStartedPlaying.current = false;
      hasNotifiedEnd.current = false;
    };
  }, []);

  // Switch tracks using loadUri without recreating the controller; initialize if not present
  useEffect(() => {
    console.log('[SpotifyPlayer] useEffect (trackId change) trackId:', trackId);

    if (!trackId) {
      console.log('[SpotifyPlayer] No trackId provided - not loading any track');
      // Reset controller when trackId becomes null (track ended)
      if (previousTrackRef.current && controllerRef.current) {
        console.log('[SpotifyPlayer] Track ended, cleaning up controller for next track');
        controllerRef.current.destroy();
        controllerRef.current = null;
        setIsReady(false);
        previousTrackRef.current = null;
      }
      hasStartedPlaying.current = false;
      hasNotifiedEnd.current = false;
      return;
    }

    const initOrLoad = () => {
      if (!window.SpotifyIframeApi) {
        console.log('[SpotifyPlayer] Waiting for Spotify Iframe API to load...');
        setTimeout(initOrLoad, 500);
        return;
      }

      try {
        setCurrentPosition(0);
        lastPlaybackPosition.current = 0;
        hasStartedPlaying.current = false;
        hasNotifiedEnd.current = false;
        previousTrackRef.current = trackId;

        if (!controllerRef.current) {
          if (creatingControllerRef.current) {
            console.log('[SpotifyPlayer] Controller creation already in progress, skipping');
            return;
          }
          console.log('[SpotifyPlayer] Controller not present - initializing with current track');

          creatingControllerRef.current = true;
          // Pass resumePlaying to mimic initial auto-play behavior when desired
          const shouldResume = Boolean(isPlaying || playerPlayState);
          initializeController(window.SpotifyIframeApi, undefined, shouldResume);
        } else {
          console.log('[SpotifyPlayer] Loading new track via loadUri:', trackId);
          controllerRef.current.loadUri(`spotify:track:${trackId}`);
          // Ensure consistent behavior when switching tracks: if parent wants playing, start after load
          setPlayerPlayState(false);
          if (isPlaying) {
            pendingStartAfterLoad.current = true;
            setTimeout(() => {
              try {
                if (controllerRef.current) {
                  controllerRef.current.togglePlay();
                }
              } catch (e) {
                console.error('[SpotifyPlayer] Error auto-starting after loadUri:', e);
              } finally {
                pendingStartAfterLoad.current = false;
              }
            }, 200);
          }
        }
      } catch (err) {
        console.error('[SpotifyPlayer] Error handling track change:', err);
      }
    };

    initOrLoad();
  }, [trackId, accessToken]);

  useEffect(() => {
    console.log('[SpotifyPlayer] useEffect (isPlaying change) isPlaying:', isPlaying, 'isReady:', isReady, 'playerPlayState:', playerPlayState);
    if (!controllerRef.current || isPlaying === undefined || !isReady) return;
    if (pendingStartAfterLoad.current) return;
    if (isPlaying !== playerPlayState) {
      if (isPlaying) {
        // Resume without seeking: toggle play directly
        try {
          controllerRef.current.togglePlay();
        } catch (error) {
          console.error('[SpotifyPlayer] Error resuming playback:', error);
        }
      } else {
        if (currentPosition > 0) {
          lastPlaybackPosition.current = currentPosition;
        }
        controllerRef.current.togglePlay();
      }
    }
  }, [isPlaying, isReady, playerPlayState, currentPosition]);

  const toggleExpand = () => {
    setIsExpanded(exp => {
      const next = !exp;
      console.log('[SpotifyPlayer] toggleExpand', next);
      return next;
    });
  };

  useEffect(() => {
    // Check for mobile browsers
    const userAgent = navigator.userAgent.toLowerCase();
    setIsMobile(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent));
    
    // Check for Firefox with Enhanced Tracking Protection
    // We'll use a global error event listener to catch the specific error message
    const isFirefox = typeof window.InstallTrigger !== 'undefined';
    
    // Add a global error event listener to catch the specific Spotify error message
    const handleWindowError = (event) => {
      console.log('[SpotifyPlayer] Window error event:', event);
      if (isFirefox && event.message && event.message.includes('Failed to send message')) {
        console.log('[SpotifyPlayer] Detected Firefox ETP error');
        setIsFirefoxETP(true);
      }
    };
    
    // Add console error listener to catch the specific error
    const originalConsoleError = console.error;
    console.error = function(...args) {  
      const errorMessage = args.join(' ');
      if (isFirefox && errorMessage.includes('Failed to send message')) {
        console.log('[SpotifyPlayer] Detected Firefox ETP error in console');
        setIsFirefoxETP(true);
      }
      originalConsoleError.apply(console, args);
    };
    
    window.addEventListener('error', handleWindowError);
    
    return () => {
      window.removeEventListener('error', handleWindowError);
      console.error = originalConsoleError;
    };
  }, []);

  useEffect(() => {
    if (isMobile) {
      alert('For best experience, please enable Desktop Mode in your mobile browser settings.');
    }
  }, [isMobile]);

  useEffect(() => {
    const container = iframeContainerRef.current;
    if (!container) return;
    const iframe = container.querySelector('iframe');
    if (iframe) {
      iframe.style.height = isExpanded ? '152px' : '80px';
    }
  }, [isExpanded, isReady]);

  const initializeController = (IFrameAPI, customHeight, resumePlaying) => {
    console.log('[SpotifyPlayer] initializeController called with trackId:', trackId);
    
    if (!iframeContainerRef.current) {
      console.error('[SpotifyPlayer] Cannot initialize controller - container ref is null');
      return;
    }
    
    if (!trackId) {
      console.error('[SpotifyPlayer] Cannot initialize controller - trackId is missing');
      return;
    }
    
    // Clear any existing content
    iframeContainerRef.current.innerHTML = '';
    
    const options = {
      uri: `spotify:track:${trackId}`,
      width: '100%',
      height: customHeight || (isExpanded ? '152' : '80'),
      theme: 'black'
    };
    console.log('[SpotifyPlayer] Creating controller with options:', options);
    
    try {
      const embedController = IFrameAPI.createController(
        iframeContainerRef.current,
        options,
        (controller) => {
          console.log('[SpotifyPlayer] Controller created successfully:', controller);
          controllerRef.current = controller;
          creatingControllerRef.current = false;

          setIsReady(true);
          
          controller.addListener('playback_update', (data) => {
            console.log('[SpotifyPlayer] Playback update:', data);
            const position = Number(data?.data?.position ?? 0);
            const duration = Number(data?.data?.duration ?? 0);
            const newPlayState = !data.data.isPaused;
            
            if (!isSeeking.current && newPlayState) {
              setCurrentPosition(position);
            }
            if (data.data.isPaused && currentPosition > 0) {
              lastPlaybackPosition.current = currentPosition;
            }
            
            // Mark that playback truly started once we have duration or progressed beyond 0
            if (!hasStartedPlaying.current && newPlayState && (duration > 0 || position > 0)) {
              hasStartedPlaying.current = true;
            }
            
            setPlayerPlayState(newPlayState);
            if (onPlayerStateChange) {
              onPlayerStateChange(newPlayState);
            }
            
            // Only consider end when we had a valid duration and playback actually started
            const endThresholdMs = 1000; // 1s threshold
            if (
              onTrackEnd &&
              !hasNotifiedEnd.current &&
              hasStartedPlaying.current &&
              duration > 0 &&
              position >= duration - endThresholdMs
            ) {
              console.log('[SpotifyPlayer] Detected end-of-track. position:', position, 'duration:', duration);
              hasNotifiedEnd.current = true;
              setCurrentPosition(0);
              lastPlaybackPosition.current = 0;
              setPlayerPlayState(false);
              onTrackEnd();
            }
          });
          
          controller.addListener('ready', () => {
            console.log('[SpotifyPlayer] Controller ready');
            setIsReady(true);
            // Avoid triggering playback here to prevent double starts.
            // The isPlaying effect will handle starting/stopping based on props.
            if (resumePlaying) {
              console.log('[SpotifyPlayer] Ready: resumePlaying requested, deferring to isPlaying effect to start playback');
              // no-op: prevent double start
            }
          });

          controller.addListener('iframe_error', () => {
            console.warn('[SpotifyPlayer] Iframe error detected:');
            if (typeof window.InstallTrigger !== 'undefined') {
              setIsFirefoxETP(true);
            }
          });
        }
      );
      console.log('[SpotifyPlayer] Embed controller result:', embedController);
    } catch (err) {
        console.error('[SpotifyPlayer] Error creating controller:', err);
        creatingControllerRef.current = false;

      }
  };

  const closePlayer = () => {
    console.log('[SpotifyPlayer] closePlayer called');
    if (controllerRef.current && playerPlayState) {
      lastPlaybackPosition.current = currentPosition;
      controllerRef.current.togglePlay();
    }
    setPlayerPlayState(false);
    setCurrentPosition(0);
    lastPlaybackPosition.current = 0;
    previousTrackRef.current = null;
    setIsReady(false);
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
          <div className="spotify-player-loading" aria-hidden="true">
            <img src={spotifyIconOfficial} alt="" className="spotify-icon spinning" />
          </div>
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