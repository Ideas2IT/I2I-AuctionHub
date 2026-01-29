import React, { useState } from 'react';
import './BiddingPanel.css';

function BiddingPanel({
  teams,
  selectedTeam,
  onSelectTeam,
  currentBid,
  onPlaceBid,
  disabled
}) {
  const [bidAmount, setBidAmount] = useState('');
  const [quickBidAmount, setQuickBidAmount] = useState(null);

  const handleBidChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setBidAmount(value);
      setQuickBidAmount(null);
    }
  };

  const handleQuickBid = (amount) => {
    setQuickBidAmount(amount);
    setBidAmount(amount.toString());
  };

  const handlePlaceBid = () => {
    const amount = parseInt(bidAmount);
    if (isNaN(amount) || amount <= currentBid) {
      alert(`Bid must be higher than current bid of ${currentBid}`);
      return;
    }
    if (!selectedTeam) {
      alert('Please select a team');
      return;
    }
    onPlaceBid(amount);
    setBidAmount('');
    setQuickBidAmount(null);
  };

  const getQuickBidAmounts = () => {
    const amounts = [];
    const base = Math.max(currentBid + 1000, 1000);
    for (let i = 0; i < 5; i++) {
      amounts.push(base + (i * 1000));
    }
    return amounts;
  };

  const selectedTeamData = teams.find(t => t.id === selectedTeam?.id);

  return (
    <div className="card bidding-panel">
      <h2>Place Your Bid</h2>
      
      <div className="input-group">
        <label>Select Team</label>
        <select
          value={selectedTeam?.id || ''}
          onChange={(e) => {
            const team = teams.find(t => t.id === parseInt(e.target.value));
            onSelectTeam(team);
          }}
          disabled={disabled}
        >
          <option value="">-- Select Team --</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name} (Budget: {team.budget - team.spent} remaining)
            </option>
          ))}
        </select>
      </div>

      {selectedTeamData && (
        <div className="team-budget-info">
          <div className="budget-item">
            <span>Total Budget:</span>
            <span>{selectedTeamData.budget.toLocaleString()}</span>
          </div>
          <div className="budget-item">
            <span>Spent:</span>
            <span>{selectedTeamData.spent.toLocaleString()}</span>
          </div>
          <div className="budget-item highlight">
            <span>Remaining:</span>
            <span>{(selectedTeamData.budget - selectedTeamData.spent).toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="input-group">
        <label>Bid Amount (Minimum: {currentBid + 1000})</label>
        <input
          type="text"
          value={bidAmount}
          onChange={handleBidChange}
          placeholder={`Enter amount (min ${currentBid + 1000})`}
          disabled={disabled || !selectedTeam}
        />
      </div>

      <div className="quick-bid-buttons">
        <label>Quick Bid:</label>
        <div className="quick-bid-grid">
          {getQuickBidAmounts().map(amount => (
            <button
              key={amount}
              className={`btn quick-bid-btn ${quickBidAmount === amount ? 'active' : ''}`}
              onClick={() => handleQuickBid(amount)}
              disabled={disabled || !selectedTeam || amount > (selectedTeamData?.budget - selectedTeamData?.spent)}
            >
              {amount.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn btn-primary bid-button"
        onClick={handlePlaceBid}
        disabled={disabled || !selectedTeam || !bidAmount || parseInt(bidAmount) <= currentBid}
      >
        Place Bid
      </button>
    </div>
  );
}

export default BiddingPanel;

