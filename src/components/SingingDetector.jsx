import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SingingDetector.css';

const SingingDetector = ({ onSingingStateChange }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSinging, setIsSinging] = useState(false);
  const [sensitivity, setSensitivity] = useState(50); // Default sensitivity
  const [debugInfo, setDebugInfo] = useState({}); // For debugging
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const previousValuesRef = useRef([]);
  const singingConfidenceRef = useRef(0);
  const lastStateChangeTimeRef = useRef(0);
  const stateChangeCountRef = useRef(0);
  const consecutiveSingingFramesRef = useRef(0);
  const consecutiveNonSingingFramesRef = useRef(0);
  const timeInCurrentStateRef = useRef(0);
  const lastVolumeRef = useRef(0);
  const MAX_TIME_IN_SINGING_STATE = 60; // 1 second at 60fps

  // Add an emergency reset interval
  useEffect(() => {
    // Safety check on a timer - reset every 3 seconds if we're in singing state with low volume
    const safetyInterval = setInterval(() => {
      if (isSinging && lastVolumeRef.current < 20) {
        console.log("EMERGENCY EXIT: Timer check found low volume while singing");
        setIsSinging(false);
        onSingingStateChange(false);
        singingConfidenceRef.current = 0.2;
      }
    }, 3000);
    
    return () => clearInterval(safetyInterval);
  }, [isSinging, onSingingStateChange]);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 4096;
      microphoneRef.current.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeDataArray = new Uint8Array(bufferLength);
      
      const analyzeAudio = () => {
        if (!isEnabled) return;
        
        // Get audio data
        analyserRef.current.getByteFrequencyData(dataArray);
        analyserRef.current.getByteTimeDomainData(timeDataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        lastVolumeRef.current = average;
        
        // DIRECT EXIT - Don't go through setSingingState or any other logic
        if (isSinging && average < 20) {
          console.log(`DIRECT EXIT: Volume too low (${average.toFixed(2)})`);
          setIsSinging(false); // Directly modify React state
          onSingingStateChange(false);
          singingConfidenceRef.current = 0.2; // Reset confidence
          lastStateChangeTimeRef.current = Date.now();
          timeInCurrentStateRef.current = 0;
          consecutiveSingingFramesRef.current = 0;
          animationFrameRef.current = requestAnimationFrame(analyzeAudio);
          return; // Skip all other processing
        }
        
        // Calculate frequency bands
        const frequencyBands = {
          bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0
        };
        
        const binSize = 22050 / bufferLength;
        for (let i = 0; i < bufferLength; i++) {
          const frequency = i * binSize;
          const value = dataArray[i];
          
          if (frequency < 150) frequencyBands.bass += value;
          else if (frequency < 600) frequencyBands.lowMid += value;
          else if (frequency < 2400) frequencyBands.mid += value;
          else if (frequency < 6000) frequencyBands.highMid += value;
          else frequencyBands.treble += value;
        }
        
        Object.keys(frequencyBands).forEach(key => {
          frequencyBands[key] = frequencyBands[key] / bufferLength;
        });
        
        // Calculate pitch stability
        let pitchStability = 0;
        if (previousValuesRef.current.length > 0) {
          const lastValue = previousValuesRef.current[previousValuesRef.current.length - 1];
          const currentValue = average;
          const difference = Math.abs(currentValue - lastValue);
          pitchStability = 1 - (difference / 128);
        }
        
        previousValuesRef.current.push(average);
        if (previousValuesRef.current.length > 10) {
          previousValuesRef.current.shift();
        }
        
        // Calculate factors
        const volumeThreshold = 25 + (sensitivity / 10);
        const volumeFactor = average > volumeThreshold ? 1 : 0;
        
        const frequencyFactor = (frequencyBands.mid * 1.5 + frequencyBands.lowMid) / 
                               (frequencyBands.bass + frequencyBands.treble + 1);
        
        const stabilityFactor = pitchStability;
        
        const harmonicFactor = (frequencyBands.mid + frequencyBands.highMid) / 
                              (frequencyBands.bass + frequencyBands.treble + 1);
        
        // Calculate new confidence with minimal smoothing
        const newConfidence = (
          volumeFactor * 0.3 + 
          frequencyFactor * 0.3 + 
          stabilityFactor * 0.2 +
          harmonicFactor * 0.2
        );
        
        // Almost no smoothing for faster response
        singingConfidenceRef.current = singingConfidenceRef.current * 0.1 + newConfidence * 0.9;
        
        // Update debug info
        setDebugInfo({
          average,
          volumeFactor,
          frequencyFactor,
          stabilityFactor,
          harmonicFactor,
          singingConfidence: singingConfidenceRef.current,
          threshold: isSinging ? 0.4 : 0.75,
          consecutiveSinging: consecutiveSingingFramesRef.current,
          consecutiveNonSinging: consecutiveNonSingingFramesRef.current,
          timeInState: timeInCurrentStateRef.current
        });
        
        // ANOTHER DIRECT EXIT for confidence - don't use any helper functions
        if (isSinging && singingConfidenceRef.current < 0.4) {
          console.log(`DIRECT EXIT: Confidence too low (${singingConfidenceRef.current.toFixed(2)})`);
          setIsSinging(false); // Directly modify React state
          onSingingStateChange(false);
          singingConfidenceRef.current = 0.2; // Reset confidence
          lastStateChangeTimeRef.current = Date.now();
          timeInCurrentStateRef.current = 0;
          consecutiveSingingFramesRef.current = 0;
          animationFrameRef.current = requestAnimationFrame(analyzeAudio);
          return; // Skip all other processing
        }
        
        // Process entry conditions only when not singing
        if (!isSinging) {
          if (singingConfidenceRef.current > 0.75 && average >= 20) {
            consecutiveSingingFramesRef.current++;
            if (consecutiveSingingFramesRef.current >= 15) {
              console.log(`ENTRY: Sustained high confidence and volume (${singingConfidenceRef.current.toFixed(2)}, ${average.toFixed(2)})`);
              setIsSinging(true);
              onSingingStateChange(true);
              lastStateChangeTimeRef.current = Date.now();
              timeInCurrentStateRef.current = 0;
              consecutiveNonSingingFramesRef.current = 0;
            }
          } else {
            consecutiveSingingFramesRef.current = 0;
          }
        }
        
        // Request next frame
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      
      analyzeAudio();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsEnabled(false);
      onSingingStateChange(null);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  useEffect(() => {
    if (isEnabled) {
      setIsSinging(false);
      onSingingStateChange(false);
      lastStateChangeTimeRef.current = Date.now();
      stateChangeCountRef.current = 0;
      consecutiveSingingFramesRef.current = 0;
      consecutiveNonSingingFramesRef.current = 0;
      timeInCurrentStateRef.current = 0;
      singingConfidenceRef.current = 0;
      lastVolumeRef.current = 0;
      startAudioAnalysis();
    } else {
      stopAudioAnalysis();
      setIsSinging(false);
      onSingingStateChange(null);
    }
    
    return () => {
      stopAudioAnalysis();
    };
  }, [isEnabled, onSingingStateChange]);

  const toggleSingingState = () => {
    setIsSinging(!isSinging);
    onSingingStateChange(!isSinging);
    console.log(`Manual toggle to: ${!isSinging}`);
  };

  const forceNotSinging = () => {
    setIsSinging(false);
    onSingingStateChange(false);
    singingConfidenceRef.current = 0.2;
    console.log("Manual force off");
  };

  return (
    <div className="singing-detector">
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
        />
        <span className="toggle-slider"></span>
      </label>
      <span className={`singing-status ${isSinging ? 'singing' : 'not-singing'}`}>
        {isEnabled ? (isSinging ? '🎵 Singing detected!' : '🎤 Not singing...') : 'Singing detection off'}
      </span>
      {isEnabled && (
        <>
          <div className="sensitivity-control">
            <label htmlFor="sensitivity">Sensitivity:</label>
            <input
              type="range"
              id="sensitivity"
              min="0"
              max="100"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseInt(e.target.value))}
            />
            <span>{sensitivity}%</span>
          </div>
          <div className="button-container">
            <button 
              className="manual-toggle-button"
              onClick={toggleSingingState}
            >
              Toggle State
            </button>
            <button 
              className="force-off-button"
              onClick={forceNotSinging}
            >
              Force Off
            </button>
          </div>
        </>
      )}
      {isEnabled && (
        <div className="debug-info">
          <div>Volume: {debugInfo.average?.toFixed(2) || 0}</div>
          <div>Conf: {(debugInfo.singingConfidence * 100).toFixed(0)}% (Need {(debugInfo.threshold * 100).toFixed(0)}%)</div>
          <div>Conseq: {isSinging ? debugInfo.consecutiveNonSinging || 0 : debugInfo.consecutiveSinging || 0}</div>
          <div>Time: {Math.floor((debugInfo.timeInState || 0) / 60)}s</div>
        </div>
      )}
    </div>
  );
};

export default SingingDetector; 