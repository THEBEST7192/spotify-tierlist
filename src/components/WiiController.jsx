import React, { useState, useEffect, useCallback, useRef } from 'react';
import WIIMote from '../utils/wiimote/wiimote';
import './WiiController.css';

const WiiController = ({ onButtonPress, isEnabled }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState(null);
  const [error, setError] = useState(null);
  const onButtonPressRef = useRef(onButtonPress);

  // Keep ref up to date to avoid stale closures in the callback
  useEffect(() => {
    onButtonPressRef.current = onButtonPress;
  }, [onButtonPress]);

  const isWebHIDSupported = 'hid' in navigator;

  const connectWiimote = async () => {
    setError(null);
    try {
      const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: 0x057e, productId: 0x0306 }, { vendorId: 0x057e, productId: 0x0330 }]
      });

      if (devices.length > 0) {
        const selectedDevice = devices[0];
        
        const wm = new WIIMote(selectedDevice);
        setDevice(selectedDevice);
        setIsConnected(true);

        wm.BtnListener = (buttons) => {
          if (onButtonPressRef.current) {
            onButtonPressRef.current(buttons);
          }
        };
      } else {
        setError('No Wiimote selected');
      }
    } catch (error) {
      console.error('Failed to connect Wiimote:', error);
      setError(error.message || 'Failed to connect Wiimote');
    }
  };

  const disconnectWiimote = useCallback(async () => {
    if (device) {
      await device.close();
      setDevice(null);
      setIsConnected(false);
    }
  }, [device]);

  useEffect(() => {
    if (!isEnabled && isConnected) {
      disconnectWiimote();
    }
  }, [isEnabled, isConnected, disconnectWiimote]);

  if (!isEnabled) return null;

  return (
    <div className="wii-controller-container">
      {!isWebHIDSupported ? (
        <div className="wii-status wii-status-unsupported">
          <span className="status-dot unsupported"></span>
          WebHID is not supported in your browser. Use Chrome or Edge.
        </div>
      ) : !isConnected ? (
        <>
          <button className="wii-connect-button" onClick={connectWiimote}>
            Connect Wiimote
          </button>
          {error && <div className="wii-error-message">{error}</div>}
        </>
      ) : (
        <div className="wii-status">
          <span className="status-dot connected"></span>
          Wiimote Connected
          <button className="wii-disconnect-button" onClick={disconnectWiimote}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WiiController;
