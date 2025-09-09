import React, { useState, useEffect, useRef } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import './CinemaPoseDetector.css';

// Define paths to cinema assets
const cinemaImagePath = '/assets/absolutecinema/absolute-cinema.jpg';
const cinemaAudioPath = '/assets/absolutecinema/absolute-cinema.mp3';

const CinemaPoseDetector = ({ isEnabled, debugMode = false }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const videoRef = useRef(null);
  const lastPoseTimeRef = useRef(0);
  const COOLDOWN_PERIOD = 5000; // 5 seconds cooldown

  useEffect(() => {
    if (isEnabled) {
      // Preload the cinema assets
      const preloadImage = new Image();
      preloadImage.src = cinemaImagePath;
      
      const preloadAudio = new Audio();
      preloadAudio.src = cinemaAudioPath;
      preloadAudio.preload = 'auto';
      
      initializeDetection();
    } else {
      cleanup();
    }
    return cleanup;
  }, [isEnabled]);

  const findClosestSong = (keypoints) => {
    const nose = keypoints.find(p => p.name === 'nose');
    if (!nose) return null;

    // Convert pose coordinates to viewport coordinates
    const userX = nose.x * window.innerWidth / 640;  // 640 is video width
    const userY = nose.y * window.innerHeight / 480; // 480 is video height

    const songElements = document.querySelectorAll('.song-card');
    let closestSong = null;
    let closestDistance = Infinity;

    songElements.forEach((songElement) => {
      const rect = songElement.getBoundingClientRect();
      const songCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const distance = Math.sqrt(
        Math.pow(songCenter.x - userX, 2) +
        Math.pow(songCenter.y - userY, 2)
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSong = songElement;
      }
    });

    return closestSong;
  };

  const moveToHighestTier = (songElement) => {
    if (!songElement) {
      return;
    }

    const songId = songElement.getAttribute('data-rbd-draggable-id');
    if (!songId) {
      return;
    }

    // Get highest tier label
    const firstTier = document.querySelector('.tier:not(.unranked) .tier-label h3');
    if (!firstTier) return;

    // Only emit the event with minimal data
    const moveEvent = new CustomEvent('moveSongToTier', {
      detail: {
        songId,
        targetTier: firstTier.textContent
      },
      bubbles: true
    });
    
    document.dispatchEvent(moveEvent);
  };

  const initializeDetection = async () => {
    try {
      // Initialize TensorFlow backend first
      await tf.setBackend('webgl');
      await tf.ready();
      
      // Initialize camera with more specific constraints
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = () => {
            resolve();
          };
          videoRef.current.onerror = (err) => {
            reject(err);
          };
          
          // Add a timeout in case the video never loads
          setTimeout(() => {
            if (videoRef.current.readyState < 2) {
              resolve();
            }
          }, 3000);
        });
        
        // Try to play the video
        try {
          await videoRef.current.play();
        } catch (playError) {
          // Continue anyway, we'll try again in the detection loop
        }
      }

      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: 'SinglePose.Lightning',
          enableSmoothing: true,
          minPoseScore: 0.25
        }
      );

      // Start detection loop
      detectPose();
    } catch (error) {
      console.error('Error initializing camera or pose detection:', error);
    }
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    if (detectorRef.current) {
      detectorRef.current.dispose();
    }
  };

  const isAbsoluteCinemaPose = (keypoints) => {
    // Get the keypoints that are actually important
    const leftWrist = keypoints.find(p => p.name === 'left_wrist');
    const rightWrist = keypoints.find(p => p.name === 'right_wrist');
    const leftShoulder = keypoints.find(p => p.name === 'left_shoulder');
    const rightShoulder = keypoints.find(p => p.name === 'right_shoulder');

    // Lower required score threshold for easier detection
    if ([leftWrist, rightWrist, leftShoulder, rightShoulder].some(p => !p || p.score < 0.4)) {
      return false;
    }

    // Calculate distances for arms extended outward
    const leftDist = Math.abs(leftWrist.x - leftShoulder.x);
    const rightDist = Math.abs(rightWrist.x - rightShoulder.x);
    
    // Check for 80 pixels arm extension distance
    const isDetected = leftDist > 80 && rightDist > 80;
    
    return isDetected;
  };
  
  // We've simplified the pose detection, so we no longer need the angle calculation
  
  const startCinemaAnimation = (keypoints) => {
    const now = Date.now();
    if (now - lastPoseTimeRef.current < COOLDOWN_PERIOD) {
      return;
    }
    lastPoseTimeRef.current = now;
    setIsAnimating(true);
    // Find and move closest song
    const closestSong = findClosestSong(keypoints);
    if (closestSong) {
      moveToHighestTier(closestSong);
    }
    const cinemaImage = cinemaImageRef.current;
    const cinemaAudio = cinemaAudioRef.current;
    if (cinemaImage && cinemaAudio) {
      cinemaImage.classList.remove('fading-out');
      cinemaImage.classList.add('visible');
      cinemaImage.style.opacity = '1';
      cinemaImage.style.visibility = 'visible';
      cinemaImage.style.display = 'block';
      cinemaAudio.pause();
      cinemaAudio.currentTime = 0;
      cinemaAudio.removeEventListener('ended', finishAnimation);
      cinemaAudio.addEventListener('ended', finishAnimation);
      cinemaAudio.play()
        .catch(err => console.error('Error playing audio:', err));
        
      setTimeout(() => {
        cinemaAudio.pause();
        finishAnimation();
      }, 10000);
    }
  };
  const finishAnimation = () => {
    const cinemaAudio = cinemaAudioRef.current;
    if (cinemaAudio) {
      cinemaAudio.removeEventListener('ended', finishAnimation);
    }
    const cinemaImage = cinemaImageRef.current;
    if (cinemaImage) {
      cinemaImage.classList.add('fading-out');
      cinemaImage.style.opacity = '0';
      cinemaImage.style.transition = 'opacity 0.3s ease-out';
    } else {
      console.error('Cinema image ref not found during fade-out');
    }
    setTimeout(() => {
      if (cinemaImage) {
        cinemaImage.classList.remove('visible');
        cinemaImage.classList.remove('fading-out');
        cinemaImage.style.opacity = '0';
        cinemaImage.style.visibility = 'hidden';
        cinemaImage.style.display = '';
      }
    }, 300);
    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
  };

  const detectPose = async () => {
    if (!detectorRef.current || !videoRef.current || !isEnabled) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }

    // Only proceed if not currently animating
    if (!isAnimating) {
      try {
        // Make sure video is ready and playing
        if (videoRef.current.readyState < 2) {
          animationFrameRef.current = requestAnimationFrame(detectPose);
          return;
        }
        
        // Ensure video is playing
        if (videoRef.current.paused) {
          try {
            await videoRef.current.play();
          } catch (playError) {
            console.error('Error playing video:', playError);
          }
        }
        
        const poses = await detectorRef.current.estimatePoses(videoRef.current);
        
        if (poses.length > 0) {
          // Simplified check for cinema pose
          if (isAbsoluteCinemaPose(poses[0].keypoints)) {
            // When the pose is detected, start the animation sequence
            startCinemaAnimation(poses[0].keypoints);
          }
        }
      } catch (error) {
        console.error('Error detecting pose:', error);
      }
    }
    
    // Continue the detection loop
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Create refs for cinema elements
  const cinemaImageRef = useRef(null);
  const cinemaAudioRef = useRef(null);

  // Update the startCinemaAnimation function to use refs
  useEffect(() => {
    if (cinemaImageRef.current && cinemaAudioRef.current) {
      // Set the IDs for backward compatibility with existing code
      cinemaImageRef.current.id = 'cinema-image';
      cinemaAudioRef.current.id = 'cinema-audio';
    }
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        style={{ 
          position: 'fixed', 
          opacity: debugMode ? 0.2 : 0, // Transparent in debug mode, hidden normally
          pointerEvents: 'none',
          top: 0,
          left: 0,
          width: '320px',
          height: '240px',
          zIndex: 9998 // Below the cinema image but above other content
        }}
        playsInline
        autoPlay
        muted
        width="640"
        height="480"
      />
      <img
        ref={cinemaImageRef}
        id="cinema-image"
        src={cinemaImagePath}
        alt="Absolute Cinema"
      />
      <audio
        ref={cinemaAudioRef}
        id="cinema-audio"
        src={cinemaAudioPath}
        preload="auto"
      />
    </>
  );
};

export default CinemaPoseDetector;