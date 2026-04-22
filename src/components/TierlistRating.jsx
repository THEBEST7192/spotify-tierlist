import React, { useState, useEffect } from 'react';
import { getTierlistRatings, rateTierlist, removeTierlistRating } from '../utils/backendApi';
import './TierlistRating.css';

const TierlistRating = ({ shortId, tuneTierUser }) => {
  const [ratings, setRatings] = useState(null);
  const [userRating, setUserRating] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(null);

  useEffect(() => {
    if (!shortId) return;
    fetchRatings();
  }, [shortId]);

  const fetchRatings = async () => {
    try {
      const data = await getTierlistRatings(shortId);
      setRatings(data);
      setUserRating(data.userRating);
    } catch (err) {
      console.error('Error fetching ratings:', err);
    }
  };

  const handleRatingClick = async (rating, event) => {
    // Stop event propagation to prevent opening the tierlist
    if (event) {
      event.stopPropagation();
    }

    if (!tuneTierUser) {
      alert('Please log in to rate tierlists');
      return;
    }

    if (userRating === rating) {
      // Remove rating if clicking the same rating
      handleRemoveRating(event);
      return;
    }

    setIsLoading(true);
    try {
      await rateTierlist(shortId, rating);
      setUserRating(rating);
      await fetchRatings();
    } catch (err) {
      console.error('Error submitting rating:', err);
      alert('Failed to submit rating');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRating = async (event) => {
    // Stop event propagation to prevent opening the tierlist
    if (event) {
      event.stopPropagation();
    }

    if (!tuneTierUser) return;
    
    setIsLoading(true);
    try {
      await removeTierlistRating(shortId);
      setUserRating(null);
      await fetchRatings();
    } catch (err) {
      console.error('Error removing rating:', err);
      alert('Failed to remove rating');
    } finally {
      setIsLoading(false);
    }
  };

  if (!ratings) {
    return null;
  }

  const renderStars = () => {
    const stars = [];
    // Always show average rating in stars, but highlight user's rating when logged in
    const baseRating = ratings.averageRating || 0;
    const displayRating = tuneTierUser ? (hoveredRating || baseRating) : baseRating;
    
    for (let i = 1; i <= 5; i++) {
      let fillPercentage = 0;
      
      if (i <= Math.floor(displayRating)) {
        // Full star
        fillPercentage = 100;
      } else if (i === Math.ceil(displayRating) && displayRating % 1 !== 0) {
        // Partial star
        fillPercentage = (displayRating % 1) * 100;
      }
      
      const isFilled = i <= baseRating;
      const isActive = userRating === i;
      const hasPartialFill = fillPercentage > 0 && fillPercentage < 100;
      
      // Only apply gradient style for partial fills
      const style = hasPartialFill 
        ? { background: `linear-gradient(90deg, #FFD700 ${fillPercentage}%, #888 ${fillPercentage}%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
        : {};
      
      stars.push(
        <button
          key={i}
          type="button"
          className={`rating-star ${isFilled && !hasPartialFill ? 'filled' : ''} ${isActive ? 'active' : ''}`}
          disabled={isLoading || !tuneTierUser}
          onClick={(e) => handleRatingClick(i, e)}
          onMouseEnter={() => setHoveredRating(i)}
          onMouseLeave={() => setHoveredRating(null)}
          aria-label={`Rate ${i} stars`}
          style={style}
        >
          ★
        </button>
      );
    }
    return stars;
  };

  return (
    <div className="tierlist-rating">
      <div className="rating-stars">
        {renderStars()}
      </div>
      <div className="rating-stats">
        {ratings.averageRating > 0 ? (
          <span className="rating-average">
            {ratings.averageRating.toFixed(1)}
          </span>
        ) : null}
        <span className="rating-count">
          ({ratings.totalRatings})
        </span>
      </div>
    </div>
  );
};

export default TierlistRating;
