import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BundleRangesManagement from './BundleRangesManagement';
import './BundlePopup.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function BundlePopup({ player, teams, onClose, onSave, userRole, playSoldAudio }) {
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState(null);
  const [bundleRanges, setBundleRanges] = useState([]);
  const [selectedRange, setSelectedRange] = useState(null);
  const [teamParticipationStatus, setTeamParticipationStatus] = useState({});
  const [bidAmount, setBidAmount] = useState('');
  const [showRangesManagement, setShowRangesManagement] = useState(false);
  const [bidAmountError, setBidAmountError] = useState('');
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);

  // Play audio when winner is determined (after spin completes)
  useEffect(() => {
    if (winnerTeam && !hasPlayedAudio && playSoldAudio) {
      // Small delay to ensure UI has updated
      const timer = setTimeout(() => {
        console.log('Playing sold audio - winner determined in bundle auction');
        playSoldAudio();
        setHasPlayedAudio(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [winnerTeam, hasPlayedAudio, playSoldAudio]);

  // Convert text to Title Case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getPlayerDisplayName = (player) => {
    if (!player) return '';
    const name = player.name || '';
    // Remove @ideas2it.com and any email domain
    let cleanName = name.replace(/@.*$/, '').trim() || name;
    // Replace dots with spaces
    cleanName = cleanName.replace(/\./g, ' ');
    // Apply Title Case to player name
    cleanName = toTitleCase(cleanName);
    
    // Build display string: Employee ID - Employee Name
    const parts = [];
    
    // Add Employee ID if it exists (keep as-is since it's typically a code)
    if (player.employee_id && player.employee_id.trim() !== '') {
      parts.push(player.employee_id.trim());
    }
    
    // Add Employee name (always show)
    parts.push(cleanName);
    
    // Join with " - " separator
    return parts.join(' - ');
  };

  // Fetch bundle ranges on mount
  useEffect(() => {
    fetchBundleRanges();
  }, []);

  // Update selectedRange when bundleRanges changes (e.g., after edit/delete)
  useEffect(() => {
    if (bundleRanges.length > 0 && selectedRange) {
      const updatedRange = bundleRanges.find(r => r.id === selectedRange.id);
      if (updatedRange) {
        // Update if range_letter, range_value, min_value, or max_value changed
        if (
          updatedRange.range_letter !== selectedRange.range_letter ||
          updatedRange.range_value !== selectedRange.range_value ||
          updatedRange.min_value !== selectedRange.min_value ||
          updatedRange.max_value !== selectedRange.max_value
        ) {
          setSelectedRange(updatedRange);
        }
      } else if (bundleRanges.length > 0) {
        // Selected range was deleted, select first available
        setSelectedRange(bundleRanges[0]);
      }
    }
  }, [bundleRanges, selectedRange]);

  // Fetch team participation status when range changes
  useEffect(() => {
    if (selectedRange && teams.length > 0) {
      fetchTeamParticipationStatus();
    }
  }, [selectedRange, teams]);

  const fetchBundleRanges = async () => {
    try {
      const response = await axios.get(`${API_URL}/bundle/ranges`);
      setBundleRanges(response.data);
      if (response.data.length > 0) {
        if (!selectedRange) {
          // If no range is selected, select the first one
          setSelectedRange(response.data[0]);
        } else {
          // If a range is already selected, update it with fresh data
          const updatedRange = response.data.find(r => r.id === selectedRange.id);
          if (updatedRange) {
            setSelectedRange(updatedRange);
          } else {
            // If the selected range was deleted, select the first available
            setSelectedRange(response.data[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching bundle ranges:', error);
    }
  };

  const fetchTeamParticipationStatus = async () => {
    const statusMap = {};
    for (const team of teams) {
      try {
        const response = await axios.get(`${API_URL}/bundle/participation/${team.id}/${selectedRange.id}`);
        statusMap[team.id] = response.data;
      } catch (error) {
        console.error(`Error fetching participation for team ${team.id}:`, error);
        statusMap[team.id] = { canParticipate: true, hasWonInRange: false, totalWins: 0 };
      }
    }
    setTeamParticipationStatus(statusMap);
  };

  // Get range letter (A, B, C) from range ID
  const getRangeLetter = (rangeId) => {
    if (!rangeId || bundleRanges.length === 0) return '';
    const range = bundleRanges.find(r => r.id === rangeId);
    return range?.range_letter || '';
  };

  // Get range display name with letter prefix (A - 300, B - 150, C - 75)
  const getRangeDisplayName = (range) => {
    if (!range) return '';
    const letter = range.range_letter || '';
    return `${letter} - ${range.range_value}`;
  };

  const handleTeamToggle = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const participationStatus = teamParticipationStatus[teamId];
    if (participationStatus && !participationStatus.canParticipate) {
      if (participationStatus.hasWonInRange) {
        alert(`${team.name} has already won in this range (${selectedRange ? getRangeLetter(selectedRange.id) : ''})`);
      } else if (participationStatus.totalWins >= 3) {
        alert(`${team.name} has already won 3 spins and cannot participate`);
      }
      return;
    }

    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const handleSpin = async () => {
    if (!selectedRange) {
      alert('Please select a bundle range');
      return;
    }

    if (selectedTeams.length < 2) {
      alert('Please select at least 2 teams for bundle');
      return;
    }

    // Validate common bid amount
    if (!bidAmount || parseInt(bidAmount) <= 0) {
      setBidAmountError('Please enter a valid bid amount');
      return;
    }

    const bidAmountNum = parseInt(bidAmount);

    // Validate bid amount is within range min/max
    if (selectedRange.min_value && bidAmountNum < selectedRange.min_value) {
      setBidAmountError(`Bid amount must be at least ${selectedRange.min_value.toLocaleString('en-IN')} for this range`);
      return;
    }

    if (selectedRange.max_value && bidAmountNum > selectedRange.max_value) {
      setBidAmountError(`Bid amount cannot exceed ${selectedRange.max_value.toLocaleString('en-IN')} for this range`);
      return;
    }

    // Validate bid amount doesn't exceed any team's remaining budget
    for (const teamId of selectedTeams) {
      const team = teams.find(t => t.id === teamId);
      const remainingBudget = parseInt(team.budget) - parseInt(team.spent);
      if (bidAmountNum > remainingBudget) {
        setBidAmountError(`${team.name}: Bid amount exceeds remaining budget (${remainingBudget.toLocaleString('en-IN')})`);
        return;
      }
    }

    // Clear any errors if validation passes
    setBidAmountError('');

    setSpinning(true);
    setHasPlayedAudio(false); // Reset audio flag for new spin
    // Simulate spinning animation
    setTimeout(async () => {
      const randomIndex = Math.floor(Math.random() * selectedTeams.length);
      const winner = teams.find(t => t.id === selectedTeams[randomIndex]);
      setWinnerTeam(winner);
      setSpinning(false);
      // Audio will be played by useEffect when winnerTeam is set

      // Record participation for all teams
      try {
        console.log('Recording participations for teams:', selectedTeams, 'Winner:', winner.id);
        for (const teamId of selectedTeams) {
          const team = teams.find(t => t.id === teamId);
          const result = team.id === winner.id ? 'won' : 'lost';
          
          console.log(`Recording participation: Team ${team.id} (${team.name}), Range ${selectedRange.id} (${selectedRange.range_letter}), Result: ${result}`);
          
          const response = await axios.post(`${API_URL}/bundle/participation`, {
            team_id: team.id,
            range_id: selectedRange.id,
            bid_amount: bidAmountNum,
            result: result
          });
          
          console.log(`Participation recorded successfully for team ${team.id}:`, response.data);
        }
        console.log('All participations recorded successfully');
      } catch (error) {
        console.error('Error recording participation:', error);
        console.error('Error details:', error.response?.data || error.message);
        alert('Error recording participation: ' + (error.response?.data?.error || error.message));
      }
    }, 2000);
  };

  // Get base price and max amount for winner team
  const basePrice = parseInt(player?.base_price) || 0;
  const winnerBidAmount = winnerTeam ? parseInt(bidAmount) || 0 : 0;

  const handleSubmit = () => {
    if (!winnerTeam || !winnerBidAmount) {
      alert('Please complete the spin');
      return;
    }

    // Validate amount is not below base price
    if (winnerBidAmount < basePrice) {
      alert(`Bid amount cannot be below the base price of ${basePrice.toLocaleString('en-IN')}`);
      return;
    }

    onSave(winnerTeam.id, winnerBidAmount);
    onClose(); // Close the popup after saving
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content bundle-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Bundle Auction</h2>
          <div className="popup-header-actions">
            {userRole === 'admin' && !winnerTeam && (
              <button
                className="manage-ranges-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRangesManagement(true);
                }}
                title="Manage Bundle Ranges"
              >
                ⚙️
              </button>
            )}
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="popup-body">
          <div className="player-info-popup">
            <h3>{getPlayerDisplayName(player)}</h3>
          </div>

          {/* Range Selection */}
          <div className="bundle-range-selection">
            <label htmlFor="bundle-range-select">Select Bundle Range</label>
            <select
              id="bundle-range-select"
              value={selectedRange?.id || ''}
              onChange={(e) => {
                const range = bundleRanges.find(r => r.id === parseInt(e.target.value));
                setSelectedRange(range);
                setSelectedTeams([]);
                setBidAmount('');
                setBidAmountError('');
                setWinnerTeam(null);
              }}
              className="form-select"
              disabled={spinning || !!winnerTeam}
            >
              <option value="">Select a range...</option>
              {bundleRanges
                .sort((a, b) => b.range_value - a.range_value)
                .map((range) => {
                  const letter = range.range_letter || '';
                  return (
                    <option key={range.id} value={range.id}>
                      {letter}
                    </option>
                  );
                })}
            </select>
          </div>

          {!winnerTeam ? (
            <>
              <div className="bundle-section">
                <label>Select Multiple Teams (Minimum 2)</label>
                <div className="teams-grid">
                  {teams
                    .filter(team => {
                      const remainingBudget = parseInt(team.budget) - parseInt(team.spent);
                      return remainingBudget > 0;
                    })
                    .map(team => {
                      const participationStatus = teamParticipationStatus[team.id];
                      const canParticipate = !participationStatus || participationStatus.canParticipate;
                      const isSelected = selectedTeams.includes(team.id);
                      const remainingBudget = parseInt(team.budget) - parseInt(team.spent);
                      
                      return (
                        <div
                          key={team.id}
                          className={`team-checkbox ${isSelected ? 'selected' : ''} ${!canParticipate ? 'disabled' : ''}`}
                          onClick={() => canParticipate && handleTeamToggle(team.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => canParticipate && handleTeamToggle(team.id)}
                            disabled={!canParticipate || spinning}
                          />
                          <span>{team.name}</span>
                          <small>{(remainingBudget).toLocaleString('en-IN')} remaining</small>
                          {!canParticipate && participationStatus && (
                            <small className="participation-status">
                              {participationStatus.hasWonInRange 
                                ? `Won in ${selectedRange?.range_value || ''}`
                                : participationStatus.totalWins >= 3 
                                  ? 'Won 3 spins'
                                  : ''}
                            </small>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {selectedTeams.length >= 2 && selectedRange && (
                <>
                  <div className="common-bid-section">
                    <label htmlFor="common-bid-amount">Enter Bid Amount</label>
                    <input
                      id="common-bid-amount"
                      type="number"
                      className={`common-bid-input ${bidAmountError ? 'error' : ''}`}
                      placeholder="Enter bid amount"
                      value={bidAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBidAmount(value);
                        
                        // Real-time validation
                        if (!value || value.trim() === '') {
                          setBidAmountError('');
                          return;
                        }
                        
                        const bidAmountNum = parseInt(value);
                        if (isNaN(bidAmountNum) || bidAmountNum <= 0) {
                          setBidAmountError('Please enter a valid bid amount');
                          return;
                        }
                        
                        // Validate against range min/max
                        if (selectedRange.min_value && bidAmountNum < selectedRange.min_value) {
                          setBidAmountError(`Bid amount must be at least ${selectedRange.min_value.toLocaleString('en-IN')}`);
                          return;
                        }
                        
                        if (selectedRange.max_value && bidAmountNum > selectedRange.max_value) {
                          setBidAmountError(`Bid amount cannot exceed ${selectedRange.max_value.toLocaleString('en-IN')}`);
                          return;
                        }
                        
                        // Validate against team budgets
                        let budgetError = '';
                        for (const teamId of selectedTeams) {
                          const team = teams.find(t => t.id === teamId);
                          if (team) {
                            const remainingBudget = parseInt(team.budget) - parseInt(team.spent);
                            if (bidAmountNum > remainingBudget) {
                              budgetError = `${team.name} has insufficient budget (${remainingBudget.toLocaleString('en-IN')} remaining)`;
                              break;
                            }
                          }
                        }
                        
                        if (budgetError) {
                          setBidAmountError(budgetError);
                        } else {
                          setBidAmountError('');
                        }
                      }}
                      min={selectedRange.min_value || 1}
                      max={selectedRange.max_value || undefined}
                      disabled={spinning}
                    />
                    {bidAmountError && (
                      <div className="bid-error-message">
                        {bidAmountError}
                      </div>
                    )}
                    {selectedRange.min_value && selectedRange.max_value && (
                      <div className="bid-range-display">
                        <span className="bid-range-label">Bid Range:</span>
                        <span className="bid-range-values">
                          Min: {selectedRange.min_value.toLocaleString('en-IN')} | Max: {selectedRange.max_value.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    <small className="bid-hint">
                      This amount will apply to all selected teams
                    </small>
                  </div>
                  <div className="spin-section">
                    <button
                      type="button"
                      className={`btn btn-primary spin-button ${spinning ? 'spinning' : ''}`}
                      onClick={handleSpin}
                      disabled={spinning || !bidAmount || parseInt(bidAmount) <= 0 || !!bidAmountError}
                    >
                      {spinning ? 'Spinning...' : '🎰 Spin'}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="winner-section">
              <div className="winner-display">
                <h3>Winner Team:</h3>
                <div className="winner-team">{winnerTeam.name}</div>
                <p>Bid Amount: {winnerBidAmount.toLocaleString('en-IN')}</p>
                <p>Budget Remaining: {(parseInt(winnerTeam.budget) - parseInt(winnerTeam.spent)).toLocaleString('en-IN')}</p>
              </div>
              <div className="popup-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setWinnerTeam(null);
                  setSelectedTeams([]);
                  setBidAmount('');
                  setBidAmountError('');
                  setHasPlayedAudio(false); // Reset audio flag when resetting
                }}>
                  Reset
                </button>
                <button type="button" className="btn btn-success" onClick={handleSubmit} disabled={winnerBidAmount < basePrice}>
                  Sold
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showRangesManagement && (
        <BundleRangesManagement
          onClose={() => {
            setShowRangesManagement(false);
            fetchBundleRanges(); // Refresh ranges after management
          }}
        />
      )}
    </div>
  );
}

export default BundlePopup;

