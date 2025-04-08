import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserProfile.css';

const UserProfile = ({ accessToken }) => {
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        setUserData(response.data);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user profile');
      }
    };

    if (accessToken) {
      fetchUserData();
    }
  }, [accessToken]);

  if (error) return null;
  if (!userData) return null;

  const firstLetter = userData.display_name ? userData.display_name.charAt(0).toUpperCase() : '?';

  return (
    <div className="user-profile">
      {userData.images?.[0]?.url ? (
        <img 
          src={userData.images[0].url} 
          alt={userData.display_name} 
          className="user-avatar"
        />
      ) : (
        <div className="user-avatar-placeholder">
          {firstLetter}
        </div>
      )}
      <span className="user-name">{userData.display_name}</span>
    </div>
  );
};

export default UserProfile; 