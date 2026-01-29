import React, { useState, useEffect } from 'react';
import './BundleAuctionPopup.css';

function BundleAuctionPopup({ teams, unsoldPlayersCount, unsoldPlayers, onClose, onStart }) {
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [errors, setErrors] = useState({});
  const [tempTeam, setTempTeam] = useState({ teamId: '', minPlayers: '' });
  const [toast, setToast] = useState(null);

  // Show toast notification
  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Validate when selectedTeams change (silent validation, no toasts)
  useEffect(() => {
    const newErrors = {};

    // Validate each selected team
    selectedTeams.forEach((teamEntry, index) => {
      const team = teams.find(t => t.id === teamEntry.teamId);
      if (!team) return;

      const minPlayersNum = parseInt(teamEntry.minPlayers) || 0;

      // Validation: Check if min players exceeds available unsold players (no budget check)
      if (minPlayersNum > 0 && minPlayersNum > unsoldPlayersCount) {
        const errorMsg = `Not enough unsold players. Available: ${unsoldPlayersCount}, Requested: ${minPlayersNum}`;
        newErrors[`minPlayers_${index}`] = errorMsg;
      }
    });

    setErrors(newErrors);
  }, [selectedTeams, unsoldPlayersCount, teams, unsoldPlayers]);


  const handleTempTeamChange = (field, value) => {
    setTempTeam(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors.tempTeam) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.tempTeam;
        return newErrors;
      });
    }
  };

  const handleAddToList = () => {
    // Validate temp team
    if (!tempTeam.teamId) {
      showToast('Please select a team', 'error');
      return;
    }

    if (!tempTeam.minPlayers || parseInt(tempTeam.minPlayers) <= 0) {
      showToast('Please enter a valid minimum number of players', 'error');
      return;
    }

    const minPlayersNum = parseInt(tempTeam.minPlayers);
    const selectedTeam = teams.find(t => t.id === parseInt(tempTeam.teamId));
    
    if (!selectedTeam) {
      showToast('Selected team not found', 'error');
      return;
    }

    // Check if team is already in the list
    if (selectedTeams.some(st => st.teamId === parseInt(tempTeam.teamId))) {
      showToast('This team is already in the list', 'error');
      return;
    }

    // Validation: Check if min players exceeds available unsold players (no budget check)
    if (minPlayersNum > unsoldPlayersCount) {
      showToast(`Not enough unsold players. Available: ${unsoldPlayersCount}, Requested: ${minPlayersNum}`, 'error');
      return;
    }

    // Add to list
    setSelectedTeams([...selectedTeams, { 
      teamId: parseInt(tempTeam.teamId), 
      minPlayers: tempTeam.minPlayers 
    }]);
    
    // Reset form
    setTempTeam({ teamId: '', minPlayers: '' });
    setErrors({});
    showToast(`${selectedTeam.name} added successfully with ${minPlayersNum} minimum players`, 'success');
  };

  const handleRemoveTeam = (index) => {
    setSelectedTeams(selectedTeams.filter((_, i) => i !== index));
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (selectedTeams.length < 2) {
      showToast('Minimum 2 teams are required to start Lot auction', 'error');
      return;
    }

    // Validate each team has minPlayers
    for (let i = 0; i < selectedTeams.length; i++) {
      const teamEntry = selectedTeams[i];
      const minPlayersNum = parseInt(teamEntry.minPlayers);
      
      if (!teamEntry.minPlayers || minPlayersNum <= 0) {
        showToast('Please enter a valid minimum number of players for all teams', 'error');
        return;
      }

      const team = teams.find(t => t.id === teamEntry.teamId);
      if (!team) {
        showToast('One or more selected teams not found', 'error');
        return;
      }

      // Validation: Check if min players exceeds available unsold players (no budget check)
      if (minPlayersNum > unsoldPlayersCount) {
        showToast(`${team.name}: Not enough unsold players. Available: ${unsoldPlayersCount}, Requested: ${minPlayersNum}`, 'error');
        return;
      }
    }

    // Check total players requested doesn't exceed available
    const totalPlayersRequested = selectedTeams.reduce((sum, teamEntry) => {
      return sum + (parseInt(teamEntry.minPlayers) || 0);
    }, 0);

    if (totalPlayersRequested > unsoldPlayersCount) {
      showToast(`Total players requested (${totalPlayersRequested}) exceeds available unsold players (${unsoldPlayersCount})`, 'error');
      return;
    }

    // If all validations pass, call onStart with team data
    if (selectedTeams.length > 0) {
      onStart(selectedTeams);
    }
  };

  return (
    <div className="popup-overlay overflow-y-hidden">
      <div className="popup-content bundle-auction-popup overflow-y-hidden">
        <div className="popup-header">
          <h2>Create Lot</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="popup-body">
          <form onSubmit={handleSubmit}>
            <div className="bundle-split-layout-fixed">
              {/* Left Side - Teams Table */}
              <div className="bundle-left-panel">
                <div className="input-group">
                  <label htmlFor="teams-list">Teams</label>
                  
                  {/* Teams List - Table Format */}
                  {selectedTeams.length === 0 ? (
                    <div className="no-teams-message">No teams added yet.</div>
                  ) : (
                    <div className="teams-table-container">
                      <table className="teams-table">
                        <thead>
                          <tr>
                            <th>Team Name</th>
                            <th>Purchased Players</th>
                            <th>Min Players</th>
                            <th>Need</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTeams.map((teamEntry, index) => {
                            const team = teams.find(t => t.id === teamEntry.teamId);
                            if (!team) return null;
                            const purchasedPlayers = parseInt(team.players_count) || 0;
                            const minPlayers = parseInt(teamEntry.minPlayers) || 0;
                            // Need = Min Players - Purchased Players, but show 0 if they reached min player
                            const need = Math.max(0, minPlayers - purchasedPlayers);
                            
                            return (
                              <tr key={index} className="team-table-row">
                                <td className="team-name-cell">
                                  <span className="team-name">{team.name}</span>
                                </td>
                                <td className="team-purchased-players-cell">
                                  {purchasedPlayers}
                                </td>
                                <td className="team-min-players-cell">
                                  {teamEntry.minPlayers && parseInt(teamEntry.minPlayers) > 0 ? (
                                    <>{teamEntry.minPlayers}</>
                                  ) : (
                                    <span className="min-players-placeholder">-</span>
                                  )}
                                </td>
                                <td className="team-need-cell">
                                  {need}
                                </td>
                                <td className="team-action-cell">
                                  <button
                                    type="button"
                                    className="remove-team-btn"
                                    onClick={() => handleRemoveTeam(index)}
                                    title="Remove team"
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Select Team Form */}
              <div className="bundle-right-panel">
                <div className="input-group">
                  <label>Add Team</label>
                  
                  {/* Select Team Form - Always Visible */}
                  <div className="select-team-form">
                    <div className="form-field-inline">
                      <label htmlFor="temp-team-select">Select Team</label>
                      <select
                        id="temp-team-select"
                        value={tempTeam.teamId}
                        onChange={(e) => handleTempTeamChange('teamId', e.target.value)}
                        className={`form-select ${errors.tempTeam && !tempTeam.teamId ? 'error' : ''}`}
                      >
                        <option value="">Choose a team...</option>
                        {teams
                          .filter(team => {
                            const remainingBudget = parseInt(team.budget) - parseInt(team.spent);
                            const isAlreadySelected = selectedTeams.some(st => st.teamId === team.id);
                            return remainingBudget > 0 && !isAlreadySelected;
                          })
                          .map(team => {
                            const remainingBudget = parseInt(team.budget) - parseInt(team.spent);
                            const purchasedPlayers = parseInt(team.players_count) || 0;
                            const minPlayers = parseInt(team.min_players) || 0;
                            // Need = Min Players - Purchased Players, but show 0 if they reached min player
                            const need = Math.max(0, minPlayers - purchasedPlayers);
                            
                            return (
                              <option key={team.id} value={team.id}>
                                {team.name} (Need: {need})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <div className="form-field-inline">
                      <label htmlFor="temp-min-players">Min Players</label>
                      <input
                        id="temp-min-players"
                        type="number"
                        value={tempTeam.minPlayers}
                        onChange={(e) => handleTempTeamChange('minPlayers', e.target.value)}
                        placeholder="Enter min players"
                        min="1"
                        max={unsoldPlayersCount}
                        className={`form-input ${errors.tempTeam && !tempTeam.minPlayers ? 'error' : ''}`}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-add-to-list"
                      onClick={handleAddToList}
                      disabled={!tempTeam.teamId || !tempTeam.minPlayers || parseInt(tempTeam.minPlayers) <= 0}
                    >
                      Add
                    </button>
                  </div>

                  {/* Global Info */}
                  <div className="input-hint" style={{ marginTop: '0.75rem' }}>
                    Available unsold players: {unsoldPlayersCount}
                    <span style={{ color: '#666', fontSize: '0.9em' }}> (No points/base price considered in lot auction)</span>
                  </div>
                </div>
              </div>
            </div>


            <div className="popup-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={selectedTeams.length < 2 || selectedTeams.some(st => !st.minPlayers || parseInt(st.minPlayers) <= 0) || Object.keys(errors).length > 0}
              >
                Start Lot
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <div className="toast-content">
            <span className="toast-message">{toast.message}</span>
            <button 
              className="toast-close"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BundleAuctionPopup;
