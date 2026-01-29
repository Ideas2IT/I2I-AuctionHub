import React from 'react';
import './BundleResultsPopup.css';

function BundleResultsPopup({ results, teams, onClose }) {
  const getPlayerNameAndId = (player) => {
    if (!player) return '';
    const name = player.name || '';
    let cleanName = name.replace(/@.*$/, '').trim() || name;
    cleanName = cleanName.replace(/\./g, ' ');
    cleanName = cleanName.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    
    const parts = [];
    if (player.employee_id && player.employee_id.trim() !== '') {
      parts.push(player.employee_id.trim());
    }
    parts.push(cleanName);
    return parts.join(' - ');
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content bundle-results-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Lot Auction Results</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="popup-body scrollable-content">
          {results.length === 0 ? (
            <p className="no-results">No players were assigned.</p>
          ) : (
            <div className="teams-results">
              {results.map((result, index) => {
                // Calculate balance from teams data if available, otherwise use provided balance
                let displayBalance = result.remainingBalance;
                if (teams && teams.length > 0) {
                  const team = teams.find(t => t.name === result.teamName);
                  if (team) {
                    displayBalance = parseInt(team.budget) - parseInt(team.spent);
                  }
                }
                
                return (
                <div key={index} className="team-result-group">
                  <div className="team-name-header-wrapper">
                    <h3 className="team-name-header">{result.teamName}</h3>
                    {displayBalance !== undefined && (
                      <span className="team-balance">
                        Balance: {displayBalance.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  {result.assignedPlayers && result.assignedPlayers.length > 0 ? (
                    <ul className="players-assigned-list">
                      {result.assignedPlayers.map((player, playerIndex) => {
                        const basePrice = parseInt(player.base_price) || 0;
                        return (
                          <li key={playerIndex} className="player-assigned-item">
                            <span className="player-name">{getPlayerNameAndId(player)}</span>
                            <span className="player-base-price">
                              {basePrice > 0 ? basePrice.toLocaleString('en-IN') : 'N/A'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="no-players-assigned">No players assigned</p>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BundleResultsPopup;
