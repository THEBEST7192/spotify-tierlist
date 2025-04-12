import React, { useState, useEffect, useRef } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs';
import './CinemaPoseDetector.css';

const CinemaPoseDetector = ({ isEnabled }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const videoRef = useRef(null);
  const lastPoseTimeRef = useRef(0);
  const COOLDOWN_PERIOD = 5000; // 5 seconds cooldown

  useEffect(() => {
    if (isEnabled) {
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
      console.log('No song element found to move');
      return;
    }

    const songId = songElement.getAttribute('data-rbd-draggable-id');
    if (!songId) {
      console.log('No song ID found on element:', songElement);
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
      // Initialize camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(resolve => {
          videoRef.current.onloadedmetadata = () => resolve();
        });
      }

      // Initialize pose detector
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet
      );

      // Start detection loop
      detectPose();
    } catch (error) {
      console.error('Error initializing camera:', error);
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
  };

  const isAbsoluteCinemaPose = (keypoints) => {
    const leftWrist = keypoints.find(p => p.name === 'left_wrist');
    const rightWrist = keypoints.find(p => p.name === 'right_wrist');
    const leftShoulder = keypoints.find(p => p.name === 'left_shoulder');
    const rightShoulder = keypoints.find(p => p.name === 'right_shoulder');

    if ([leftWrist, rightWrist, leftShoulder, rightShoulder].some(p => p.score < 0.4)) {
      return false;
    }

    const leftDist = Math.abs(leftWrist.x - leftShoulder.x);
    const rightDist = Math.abs(rightWrist.x - rightShoulder.x);

    return leftDist > 80 && rightDist > 80;
  };

  const startCinemaAnimation = (keypoints) => {
    const now = Date.now();
    if (now - lastPoseTimeRef.current < COOLDOWN_PERIOD) {
      return;
    }

    lastPoseTimeRef.current = now;
    setIsAnimating(true);

    // Find and move closest song
    const closestSong = findClosestSong(keypoints);
    console.log('Found closest song:', closestSong);
    
    if (closestSong) {
      moveToHighestTier(closestSong);  // Actually call moveToHighestTier
    }

    const cinemaImage = document.getElementById('cinema-image');
    const cinemaAudio = document.getElementById('cinema-audio');

    if (cinemaImage && cinemaAudio) {
      cinemaImage.classList.remove('fading-out');
      cinemaImage.classList.add('visible');
      cinemaAudio.currentTime = 0;
      cinemaAudio.play();

      cinemaAudio.addEventListener('timeupdate', checkAudioTime);
      cinemaAudio.onended = finishAnimation;
    }
  };

  const checkAudioTime = (e) => {
    const audio = e.target;
    const remaining = audio.duration - audio.currentTime;
    if (remaining <= 1) {
      const cinemaImage = document.getElementById('cinema-image');
      if (cinemaImage) {
        cinemaImage.classList.remove('visible');
        cinemaImage.classList.add('fading-out');
      }
    }
  };

  const finishAnimation = () => {
    const cinemaAudio = document.getElementById('cinema-audio');
    if (cinemaAudio) {
      cinemaAudio.removeEventListener('timeupdate', checkAudioTime);
    }
    
    setTimeout(() => {
      const cinemaImage = document.getElementById('cinema-image');
      if (cinemaImage) {
        cinemaImage.classList.remove('fading-out');
      }
      setIsAnimating(false);
    }, 500);
  };

  const detectPose = async () => {
    if (!isEnabled || !detectorRef.current || !videoRef.current) return;

    if (!isAnimating) {
      try {
        const poses = await detectorRef.current.estimatePoses(videoRef.current);
        if (poses.length > 0 && isAbsoluteCinemaPose(poses[0].keypoints)) {
          startCinemaAnimation(poses[0].keypoints);
        }
      } catch (error) {
        console.error('Error detecting pose:', error);
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  return (
    <>
      <video
        ref={videoRef}
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}
        playsInline
        autoPlay
        muted
      />
      <img
        id="cinema-image"
        src="/assets/absolutecinema/absolute-cinema.jpg"
        alt="Absolute Cinema"
      />
      <audio
        id="cinema-audio"
        src="/assets/absolutecinema/absolute-cinema.mp3"
      />
    </>
  );
};

export default CinemaPoseDetector;