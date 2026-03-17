import React, { useState, useEffect } from 'react';
import { updateUser, getMe } from '../utils/backendApi';
import './UserSettings.css';

const UserSettings = ({ tuneTierUser, onUserUpdate, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (tuneTierUser) {
      setUsername(tuneTierUser.username || '');
    }
  }, [tuneTierUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const updateData = {};
      
      // Validate and add username if changed
      if (username !== tuneTierUser.username) {
        if (!username.trim()) {
          setError('Username is required');
          setIsLoading(false);
          return;
        }
        updateData.username = username.trim();
      }

      // Validate and add password if provided
      if (password) {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        updateData.password = password;
      }

      // Require current password for any changes
      if (!currentPassword && Object.keys(updateData).length > 0) {
        setError('Current password is required for any changes');
        setIsLoading(false);
        return;
      }

      if (Object.keys(updateData).length === 0) {
        setError('No changes to save');
        setIsLoading(false);
        return;
      }

      const response = await updateUser(updateData);
      setSuccess('Profile updated successfully!');
      
      // Update the user in parent component
      if (onUserUpdate) {
        onUserUpdate(response.user);
      }
      
      // Clear password fields
      setPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = username !== tuneTierUser.username || password || confirmPassword || currentPassword;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <button
          type="button"
          className="modal-close-button"
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
        <div className="modal-content">
          <h2>Account Settings</h2>
          <form onSubmit={handleSubmit} className="user-settings-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter new username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">New Password (optional)</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required={hasChanges}
              />
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-button" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="save-button"
                disabled={isLoading || !hasChanges}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
