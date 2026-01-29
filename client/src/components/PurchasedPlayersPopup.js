import React, { useState } from 'react';
import axios from 'axios';
import './PurchasedPlayersPopup.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function PurchasedPlayersPopup({ team, players, onClose, onSyncCount }) {
  const [syncing, setSyncing] = useState(false);
  // Convert text to Title Case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Get player display name (Employee ID - Player Name)
  const getPlayerDisplayName = (player) => {
    const name = player.name || '';
    // Remove @ideas2it.com and any email domain
    let cleanName = name.replace(/@.*$/, '').trim() || name;
    // Replace dots with spaces
    cleanName = cleanName.replace(/\./g, ' ');
    // Apply Title Case to player name
    cleanName = toTitleCase(cleanName);
    
    const parts = [];
    // Add Employee ID if it exists (keep as-is since it's typically a code)
    if (player.employee_id && player.employee_id.trim() !== '') {
      parts.push(player.employee_id.trim());
    }
    // Add Employee name (always show)
    parts.push(cleanName);
    
    return parts.join(' - ');
  };

  // Get player category with mapping
  const getPlayerCategory = (player) => {
    // If sale method is 'alot', show "Lot"
    if (player.sale_method === 'alot') {
      return 'Lot';
    }
    
    if (!player.category || !player.category.trim()) {
      return 'Other';
    }
    
    const category = player.category.trim().toLowerCase();
    // Map category values
    if (category === 'bat') {
      return 'Batsman';
    } else if (category === 'bowl') {
      return 'Bowler';
    } else if (category === 'all') {
      return 'Allrounder';
    }
    // For other categories, use title case
    return toTitleCase(category);
  };

  // Group players by category
  const groupPlayersByCategory = () => {
    const grouped = {};
    
    players.forEach(player => {
      const category = getPlayerCategory(player);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(player);
    });
    
    // Sort categories: Batsman, Bowler, Allrounder, Lot, Other
    const categoryOrder = ['Batsman', 'Bowler', 'Allrounder', 'Lot', 'Other'];
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    return sortedCategories.map(category => ({
      category,
      players: grouped[category],
      total: grouped[category].reduce((sum, player) => {
        const price = player.sale_method === 'alot' ? 0 : (parseInt(player.sold_price) || 0);
        return sum + price;
      }, 0)
    }));
  };

  const categoriesWithPlayers = groupPlayersByCategory();
  const hasMismatch = team && parseInt(team.players_count) !== players.length;

  const handleSyncCount = async () => {
    if (!team) return;
    setSyncing(true);
    try {
      await axios.post(`${API_URL}/teams/sync-counts`);
      if (onSyncCount) {
        onSyncCount();
      }
      // Close popup and let parent refresh
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      alert('Error syncing counts: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content purchased-players-popup" onClick={(e) => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="popup-header" style={{ border: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2>{team?.name} (Total Player Count: {players.length})</h2>
              {hasMismatch && (
                <span className="count-mismatch-badge" title={`Database shows ${team.players_count} but actual count is ${players.length}`}>
                  ⚠️ DB shows {team.players_count}
                </span>
              )}
            </div>
            {hasMismatch && (
              <button 
                className="sync-count-btn" 
                onClick={handleSyncCount}
                disabled={syncing}
                title="Sync database count with actual player count"
              >
                {syncing ? 'Syncing...' : 'Sync Count'}
              </button>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        {/* Fixed Budget Bar */}
        {team && (
          <div className='budget-bar'>
            <div className="team-budget-info">
              <div className="budget-item">
                <span className="budget-label">Total Budget:</span>
                <span className="budget-value">{parseInt(team.budget).toLocaleString('en-IN')}</span>
              </div>
              <div className="budget-item">
                <span className="budget-label">Total Spent:</span>
                <span className="budget-value">{parseInt(team.spent).toLocaleString('en-IN')}</span>
              </div>
              <div className="budget-item remaining">
                <span className="budget-label">Remaining Budget:</span>
                <span className="budget-value">{(parseInt(team.budget) - parseInt(team.spent)).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Scrollable Player List */}
        <div className="popup-body scrollable-content">
          {players.length === 0 ? (
            <p className="no-players">No players purchased yet.</p>
          ) : (
            <div className="players-by-category">
              {categoriesWithPlayers.map(({ category, players: categoryPlayers, total }) => (
                <div key={category} className="category-group">
                  <div className="category-header-wrapper">
                    <h3 className="category-header">
                      {category} ({categoryPlayers.length})
                    </h3>
                    <span className="category-total">
                      Total: {total.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <ul className="players-list">
                    {categoryPlayers.map(player => {
                      // Get sale method indicator
                      const getSaleMethodLabel = () => {
                        if (player.sale_method === 'bundle') return 'Bundle';
                        if (player.sale_method === 'alot') return 'Lot';
                        return null;
                      };
                      const saleMethodLabel = getSaleMethodLabel();
                      
                      return (
                        <li key={player.id} className="player-item">
                          <div className="player-name">
                            {getPlayerDisplayName(player)}
                            {saleMethodLabel && (
                              <span className="sale-method-indicator"> ({saleMethodLabel})</span>
                            )}
                          </div>
                          <div className="player-price-info">
                            <span className="bid-price">
                              Bid Price: {
                                player.sale_method === 'alot' 
                                  ? '0' 
                                  : player.sold_price 
                                    ? parseInt(player.sold_price).toLocaleString('en-IN') 
                                    : 'N/A'
                              }
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PurchasedPlayersPopup;
