import React, { useEffect, useRef, useState } from 'react';

const WebPlaybackSDK = ({
  token,
  trackId,
  isPlaying,
  onPlayerStateChange,
  onTrackEnd,
  onReady
}) => {
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const playerRef = useRef(null);

  // Handle Web Playback SDK script loading
  useEffect(() => {
    if (!window.Spotify) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);

      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('Spotify Web Playback SDK ready');
      };
    }

    return () => {
      // Cleanup script if needed
      const existingScript = document.querySelector('script[src*="spotify-player"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  // Initialize the player when token is available
  useEffect(() => {
    if (!token) return;

    const player = new window.Spotify.Player({
      name: 'Spotify Tierlist Player',
      getOAuthToken: cb => { cb(token); },
      volume: 0.5
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => { 
      console.error('Initialization Error:', message);
    });
    player.addListener('authentication_error', ({ message }) => {
      console.error('Authentication Error:', message);
    });
    player.addListener('account_error', ({ message }) => {
      console.error('Account Error:', message);
    });
    player.addListener('playback_error', ({ message }) => {
      console.error('Playback Error:', message);
    });

    // Playback status updates
    player.addListener('player_state_changed', state => {
      if (!state) return;

      const isPlaying = !state.paused;
      onPlayerStateChange?.(isPlaying);

      // Check if track ended
      if (state.position === 0 && state.duration > 0 && !isPlaying) {
        onTrackEnd?.();
      }
    });

    // Ready
    player.addListener('ready', ({ device_id }) => {
      console.log('Ready with Device ID', device_id);
      setDeviceId(device_id);
      setIsReady(true);
      setIsLoading(false);
      onReady?.(device_id);
    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => {
      console.log('Device ID has gone offline', device_id);
      setIsReady(false);
    });

    // Connect to the player
    player.connect().then(success => {
      if (success) {
        console.log('Connected to Web Playback SDK');
      }
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [token]);

  // Handle track changes and play/pause
  useEffect(() => {
    if (!isReady || !trackId || !playerRef.current || !deviceId) return;

    const playTrack = async () => {
      try {
        // First ensure the player is active
        await playerRef.current.activateElement();
        
        // Transfer playback to this device
        await fetch(`https://api.spotify.com/v1/me/player`, {
          method: 'PUT',
          body: JSON.stringify({
            device_ids: [deviceId],
            play: false
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        // Start playback with the track
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          body: JSON.stringify({
            uris: [`spotify:track:${trackId}`],
            position_ms: 0
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        // If isPlaying is true, ensure playback starts
        if (isPlaying) {
          await playerRef.current.resume();
        }
      } catch (error) {
        console.error('Error playing track:', error);
        // Try to reconnect the player if there's an error
        if (playerRef.current) {
          playerRef.current.connect();
        }
      }
    };

    playTrack();
  }, [trackId, isReady, deviceId, token, isPlaying]);

  // Handle play/pause
  useEffect(() => {
    if (!isReady || !playerRef.current || !deviceId) return;

    const togglePlayback = async () => {
      try {
        if (isPlaying) {
          await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        } else {
          await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        }
      } catch (error) {
        console.error('Error toggling playback:', error);
        // Try to reconnect the player if there's an error
        if (playerRef.current) {
          playerRef.current.connect();
        }
      }
    };

    togglePlayback();
  }, [isPlaying, isReady, deviceId, token]);

  // This is a hidden component, it doesn't render anything
  return null;
};

export default WebPlaybackSDK;
