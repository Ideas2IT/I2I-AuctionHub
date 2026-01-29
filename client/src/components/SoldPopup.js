import React, { useState, useEffect } from 'react';
import './SoldPopup.css';

function SoldPopup({ player, teams, teamBidTiers = {}, onClose, onSave }) {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [amount, setAmount] = useState('');
  const [range, setRange] = useState('');

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

  // Filter out teams with zero remaining budget
  const availableTeams = teams.filter(team => {
    const remainingBudget = parseInt(team.budget) - parseInt(team.spent);
    return remainingBudget > 0;
  });

  // Get selected team and calculate min/max values
  const selectedTeamData = teams.find(t => t.id === parseInt(selectedTeam));
  const basePrice = parseInt(player?.base_price) || 0;
  const remainingBudget = selectedTeamData ? (parseInt(selectedTeamData.budget) - parseInt(selectedTeamData.spent)) : 0;
  // Set min bid to 10 and max bid to 200 (but respect remaining budget and top3 restriction)
  const minBid = 10;
  const maxBid = 200;
  const effectiveMaxBid = selectedTeamData ? Math.min(maxBid, remainingBudget) : maxBid;
  
  // Check team's current bid range counts
  const bidTier = selectedTeamData ? teamBidTiers[selectedTeamData.id] : null;
  const range150to200 = bidTier ? bidTier.range150to200 : 0;
  const range120to150 = bidTier ? bidTier.range120to150 : 0;
  const range100to120 = bidTier ? bidTier.range100to120 : 0;
  const top3Count = bidTier ? bidTier.top3Count : 0;
  
  // Restriction only applies if team has purchased at least 1 player in EACH of A, B, and C ranges (all three slots filled)
  const hasFilledAllThreeRanges = range150to200 >= 1 && range120to150 >= 1 && range100to120 >= 1;
  const hasTop3Restriction = hasFilledAllThreeRanges && top3Count >= 3;
  
  // Determine available ranges
  const canBuy150to200 = range150to200 < 1;
  const canBuy120to150 = range120to150 < 1;
  const canBuy100to120 = range100to120 < 1;
  
  // Build restriction message
  const getRestrictionMessage = () => {
    if (hasTop3Restriction) {
      return '⚠️ This team has already purchased 1 player in each of A, B, and C ranges. Bids must be between 10-100 only.';
    }
    
    const restrictions = [];
    if (!canBuy150to200) restrictions.push('151-200 range (already purchased 1)');
    if (!canBuy120to150) restrictions.push('121-150 range (already purchased 1)');
    if (!canBuy100to120) restrictions.push('101-120 range (already purchased 1)');
    
    if (restrictions.length > 0) {
      return `⚠️ Restrictions: ${restrictions.join(', ')}. Max 1 player per range allowed.`;
    }
    
    return `Base Price: ${basePrice.toLocaleString('en-IN')} | Remaining Budget: ${remainingBudget.toLocaleString('en-IN')} | Min Bid: ${minBid} | Max Bid: ${maxBid}`;
  };

  // Auto-set range based on bid amount
  const getRangeFromBid = (bidAmount) => {
    const amountNum = parseInt(bidAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return '';
    }
    if (amountNum >= 151 && amountNum <= 200) {
      return 'A';
    } else if (amountNum >= 121 && amountNum <= 150) {
      return 'B';
    } else if (amountNum >= 101 && amountNum <= 120) {
      return 'C';
    }
    return '';
  };

  // Handle amount change - auto-set range
  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);
    // Auto-set range based on bid amount, or clear if empty/invalid
    const autoRange = getRangeFromBid(value);
    setRange(autoRange || '');
  };

  // Clear selected team if it becomes unavailable
  useEffect(() => {
    if (selectedTeam && !availableTeams.find(t => t.id === parseInt(selectedTeam))) {
      setSelectedTeam('');
      setAmount('');
      setRange('');
    }
  }, [teams, selectedTeam, availableTeams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedTeam || !amount) {
      alert('Please select a team and enter amount');
      return;
    }
    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // Get selected team
    const team = teams.find(t => t.id === parseInt(selectedTeam));
    if (!team) {
      alert('Please select a valid team');
      return;
    }

    const remainingBudget = parseInt(team.budget) - parseInt(team.spent);

    // Check team's current bid range counts
    const bidTier = teamBidTiers[team.id];
    const range150to200 = bidTier ? bidTier.range150to200 : 0;
    const range120to150 = bidTier ? bidTier.range120to150 : 0;
    const range100to120 = bidTier ? bidTier.range100to120 : 0;
    const top3Count = bidTier ? bidTier.top3Count : 0;
    
    // Restriction only applies if team has purchased at least 1 player in EACH of A, B, and C ranges (all three slots filled)
    const hasFilledAllThreeRanges = range150to200 >= 1 && range120to150 >= 1 && range100to120 >= 1;
    if (hasFilledAllThreeRanges && top3Count >= 3) {
      if (amountNum < 10 || amountNum > 100) {
        alert('This team has already purchased 1 player in each of A, B, and C ranges. Bids must now be between 10 and 100 only.');
        return;
      }
    } else {
      // Check range limits: max 1 player per range
      if (amountNum >= 151 && amountNum <= 200) {
        if (range150to200 >= 1) {
          alert('This team has already purchased 1 player in the 151-200 range. You can only purchase 1 player in this range.');
          return;
        }
      } else if (amountNum >= 121 && amountNum <= 150) {
        if (range120to150 >= 1) {
          alert('This team has already purchased 1 player in the 121-150 range. You can only purchase 1 player in this range.');
          return;
        }
      } else if (amountNum >= 101 && amountNum <= 120) {
        if (range100to120 >= 1) {
          alert('This team has already purchased 1 player in the 101-120 range. You can only purchase 1 player in this range.');
          return;
        }
      }
      
      // Normal validation: amount must be at least min bid (10) and not exceed max bid (200)
      if (amountNum < minBid) {
        alert(`Amount cannot be below the minimum bid of ${minBid}`);
        return;
      }
      if (amountNum > maxBid) {
        alert(`Amount cannot exceed the maximum bid of ${maxBid}`);
        return;
      }
    }

    // Validate amount is not more than remaining budget
    if (amountNum > remainingBudget) {
      alert(`Amount cannot exceed the remaining budget of ${remainingBudget.toLocaleString('en-IN')}`);
      return;
    }

    onSave(selectedTeam, amountNum, range.trim() || null);
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Buy Player</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="popup-body">
          <div className="player-info-popup">
            <h3>{getPlayerDisplayName(player)}</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Select Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                required
              >
                <option value="">-- Select Team --</option>
                {availableTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} (Budget: {(parseInt(team.budget) - parseInt(team.spent)).toLocaleString('en-IN')} remaining)
                    </option>
                  ))}
              </select>
            </div>
            <div className="input-group">
              <label>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={handleAmountChange}
                placeholder="Enter amount"
                min={hasTop3Restriction ? 10 : minBid}
                max={hasTop3Restriction ? 100 : effectiveMaxBid}
                required
              />
              {selectedTeamData && (
                <div style={{ marginTop: '0.5rem' }}>
                  <small style={{ color: '#666', display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    <strong>Restrictions:</strong> Min Bid: {hasTop3Restriction ? 10 : minBid} | Max Bid: {hasTop3Restriction ? 100 : effectiveMaxBid}
                  </small>
                  <small style={{ color: (hasTop3Restriction || !canBuy150to200 || !canBuy120to150 || !canBuy100to120) ? '#ef4444' : '#666', display: 'block', fontWeight: (hasTop3Restriction || !canBuy150to200 || !canBuy120to150 || !canBuy100to120) ? 600 : 400 }}>
                    {getRestrictionMessage()}
                  </small>
                </div>
              )}
            </div>
            <div className="input-group" style={{ display: 'none' }}>
              <label>Range (Auto-set from Bid)</label>
              <input
                type="text"
                value={range}
                readOnly
                placeholder="Range will be set automatically based on bid amount"
                style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
              />
            </div>
            <div className="popup-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success">
                Buy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SoldPopup;

