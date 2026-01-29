import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import BundleAuctionPopup from './BundleAuctionPopup';
import BundleResultsPopup from './BundleResultsPopup';
import './BundleAuction.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function BundleAuction({ teams, onTeamsChange, userRole, playSoldAudio }) {
  const [unsoldPlayers, setUnsoldPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResultsPopup, setShowResultsPopup] = useState(false);
  const [bundleResults, setBundleResults] = useState([]);
  const socketRef = useRef(null);

  // Add Player to Lot modal (manual entry)
  const [showAddToLotModal, setShowAddToLotModal] = useState(false);
  const [newPlayerEmployeeId, setNewPlayerEmployeeId] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [addToLotLoading, setAddToLotLoading] = useState(false);

  // Add Team Manually modal (for lot players)
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [addTeamPlayer, setAddTeamPlayer] = useState(null);
  const [addTeamSelectedTeamId, setAddTeamSelectedTeamId] = useState('');
  const [addTeamLoading, setAddTeamLoading] = useState(false);

  // Bulk Assign Teams modal (paste data: Employee ID, Name, Email, Team)
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignPaste, setBulkAssignPaste] = useState('');
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
  const [bulkAssignResult, setBulkAssignResult] = useState(null);

  // Delete player
  const [deletingPlayerId, setDeletingPlayerId] = useState(null);

  const fetchUnsoldPlayers = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch lot details players instead of regular unsold players
      const response = await axios.get(`${API_URL}/players/lot-details`);
      // Keep all lot details players (is_lot_details = 1) even if they're sold
      // Only filter out sold players that are NOT lot details players
      const filteredPlayers = response.data.filter(player => 
        player.is_lot_details === 1 || (player.status !== 'sold' && player.status !== 'SOLD')
      );
      setUnsoldPlayers(filteredPlayers);
    } catch (error) {
      console.error('Error fetching lot details players:', error);
      // Fallback to unsold players if lot details endpoint fails
      try {
        const fallbackResponse = await axios.get(`${API_URL}/players?status=unsold`);
        // Additional safety check: filter out any sold players
        const filteredPlayers = fallbackResponse.data.filter(player => 
          player.status !== 'sold' && player.status !== 'SOLD'
        );
        setUnsoldPlayers(filteredPlayers);
      } catch (fallbackError) {
        console.error('Error fetching unsold players (fallback):', fallbackError);
        alert('Error fetching players: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchUnsoldPlayers();

    // Set up socket connection to listen for player updates
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    
    // Join the auction room
    socket.emit('join-room', 'auction-room');

    // Listen for player sold events - refresh list (lot details players remain visible even if sold)
    socket.on('player-sold', (data) => {
      console.log('Player sold event received:', data);
      // Refresh the list when a player is sold
      // Note: Lot details players (is_lot_details = 1) remain visible even after being assigned to a team
      // Add a small delay to ensure database is updated
      setTimeout(() => {
        fetchUnsoldPlayers();
      }, 100);
    });

    // Listen for player updated events
    socket.on('player-updated', (data) => {
      console.log('Player updated event received:', data);
      // Refresh the list when a player is updated (status might have changed)
      setTimeout(() => {
        fetchUnsoldPlayers();
      }, 100);
    });

    // Listen for player unsold events
    socket.on('player-unsold', (data) => {
      console.log('Player unsold event received:', data);
      // Refresh the list when a player is marked as unsold (they might need to appear in lot auction)
      setTimeout(() => {
        fetchUnsoldPlayers();
      }, 100);
    });

    // Handle socket connection errors
    socket.on('connect', () => {
      console.log('Socket connected for BundleAuction');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected for BundleAuction');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Cleanup socket connection on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off('player-sold');
        socketRef.current.off('player-updated');
        socketRef.current.off('player-unsold');
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchUnsoldPlayers]);

  // Convert text to Title Case
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getPlayerNameAndId = (player) => {
    if (!player) return '';
    const name = player.name || '';
    let cleanName = name.replace(/@.*$/, '').trim() || name;
    cleanName = cleanName.replace(/\./g, ' ');
    cleanName = toTitleCase(cleanName);
    
    const parts = [];
    if (player.employee_id && player.employee_id.trim() !== '') {
      parts.push(player.employee_id.trim());
    }
    parts.push(cleanName);
    return parts.join(' - ');
  };

  // Helper function to shuffle array randomly
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleBundleStart = async (selectedTeamsData) => {
    try {
      setLoading(true);
      
      // Filter unsold players
      let availablePlayers = unsoldPlayers.filter(player => {
        if (searchQuery && searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase().trim();
          const name = (player.name || '').toLowerCase();
          const email = (player.email || '').toLowerCase();
          const employeeId = (player.employee_id || '').toLowerCase();
          
          if (!name.includes(query) && 
              !email.includes(query) && 
              !employeeId.includes(query)) {
            return false;
          }
        }
        return true;
      });

      // Shuffle players randomly
      availablePlayers = shuffleArray(availablePlayers);

      // Prepare team assignments
      const teamAssignments = [];
      for (const teamData of selectedTeamsData) {
        const selectedTeamId = teamData.teamId;
        const minPlayers = parseInt(teamData.minPlayers) || 0;
        
        if (minPlayers <= 0) {
          continue;
        }

        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        if (!selectedTeam) {
          continue;
        }

        teamAssignments.push({
          teamId: selectedTeamId,
          team: selectedTeam,
          minPlayers: minPlayers,
          assignedPlayers: []
        });
      }

      // Step 1: Assign minimum required players to each team (without considering base_price)
      for (const assignment of teamAssignments) {
        // Assign minimum players without budget/price checks
        for (let i = 0; i < assignment.minPlayers && availablePlayers.length > 0; i++) {
          const player = availablePlayers[0];
          assignment.assignedPlayers.push(player);
          availablePlayers.shift(); // Remove from available
        }
      }

      // Step 2: Randomly distribute remaining players to teams (without considering base_price)
      // Shuffle teams for random distribution
      const shuffledTeams = shuffleArray([...teamAssignments]);
      
      while (availablePlayers.length > 0) {
        let assigned = false;
        
        // Try to assign to each team randomly
        for (const assignment of shuffledTeams) {
          if (availablePlayers.length === 0) break;
          
          // Assign any available player without budget/price checks
          if (availablePlayers.length > 0) {
            const player = availablePlayers[0];
            assignment.assignedPlayers.push(player);
            availablePlayers.shift();
            assigned = true;
          }
        }
        
        // If no player could be assigned to any team, break
        if (!assigned) {
          break;
        }
      }

      // Step 3: Execute all assignments (without charging any amount)
      const results = [];
      for (const assignment of teamAssignments) {
        const successfullyAssignedPlayers = [];
        
        for (const player of assignment.assignedPlayers) {
          try {
            // Sell player with amount 0 (no points/base_price considered)
            await axios.post(`${API_URL}/players/${player.id}/sell`, {
              team_id: assignment.teamId,
              amount: 0,
              sale_method: 'alot'
            });
            successfullyAssignedPlayers.push(player);
          } catch (error) {
            console.error(`Error assigning player ${getPlayerNameAndId(player)}:`, error);
          }
        }
        
        // Get updated team data to calculate remaining balance (should remain unchanged)
        const updatedTeam = teams.find(t => t.id === assignment.teamId);
        const remainingBudget = updatedTeam ? (parseInt(updatedTeam.budget) - parseInt(updatedTeam.spent)) : 0;
        
        results.push({
          teamName: assignment.team.name,
          assignedPlayers: successfullyAssignedPlayers,
          remainingBalance: remainingBudget
        });
      }

      // Refresh data
      await fetchUnsoldPlayers();
      onTeamsChange();
      setShowPopup(false);
      
      // Play sold audio for each player sold in Lot auction
      if (playSoldAudio && results.some(r => r.assignedPlayers.length > 0)) {
        playSoldAudio();
      }
      
      // Show results popup
      setBundleResults(results);
      setShowResultsPopup(true);
    } catch (error) {
      console.error('Error in Lot auction:', error);
      alert('Error in Lot auction: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Open Add Player to Lot modal (manual entry form)
  const handleOpenAddToLotModal = () => {
    setNewPlayerEmployeeId('');
    setNewPlayerName('');
    setNewPlayerEmail('');
    setShowAddToLotModal(true);
  };

  const handleAddPlayerToLot = async (e) => {
    e.preventDefault();
    if (!newPlayerName || !newPlayerName.trim()) {
      alert('Please enter player name');
      return;
    }
    setAddToLotLoading(true);
    try {
      await axios.post(`${API_URL}/players`, {
        name: newPlayerName.trim(),
        email: newPlayerEmail.trim() || null,
        employee_id: newPlayerEmployeeId.trim() || null,
        is_lot_details: 1
      });
      await fetchUnsoldPlayers();
      onTeamsChange();
      setShowAddToLotModal(false);
      setNewPlayerEmployeeId('');
      setNewPlayerName('');
      setNewPlayerEmail('');
    } catch (error) {
      alert('Error adding player to lot: ' + (error.response?.data?.error || error.message));
    } finally {
      setAddToLotLoading(false);
    }
  };

  // Open Add Team modal for a lot player
  const handleOpenAddTeamModal = (player) => {
    setAddTeamPlayer(player);
    // Pre-select current team if player already has one
    setAddTeamSelectedTeamId(player.team_id?.toString() || '');
    setShowAddTeamModal(true);
  };

  const handleAddTeamToLotPlayer = async () => {
    if (!addTeamPlayer || !addTeamSelectedTeamId) {
      alert('Please select a team');
      return;
    }
    setAddTeamLoading(true);
    try {
      await axios.post(`${API_URL}/players/${addTeamPlayer.id}/sell`, {
        team_id: parseInt(addTeamSelectedTeamId),
        amount: 0,
        sale_method: 'alot'
      });
      await fetchUnsoldPlayers();
      onTeamsChange();
      setShowAddTeamModal(false);
      setAddTeamPlayer(null);
      setAddTeamSelectedTeamId('');
      if (playSoldAudio) playSoldAudio();
    } catch (error) {
      alert('Error assigning team: ' + (error.response?.data?.error || error.message));
    } finally {
      setAddTeamLoading(false);
    }
  };

  // Delete player from lot
  const handleDeletePlayer = async (player) => {
    const playerName = getPlayerNameAndId(player);
    if (!window.confirm(`Are you sure you want to delete "${playerName}"? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingPlayerId(player.id);
    try {
      await axios.delete(`${API_URL}/players/${player.id}`);
      await fetchUnsoldPlayers();
      onTeamsChange();
    } catch (error) {
      alert('Error deleting player: ' + (error.response?.data?.error || error.message));
    } finally {
      setDeletingPlayerId(null);
    }
  };

  // Bulk Assign Teams: parse pasted data (Employee ID, Name, Email, Team) and assign players to teams
  const parseBulkAssignData = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { rows: [], headerRow: false };
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    const firstCells = firstLine.split(delimiter).map(c => (c || '').trim().toLowerCase());
    const isHeader = firstCells.some(c =>
      c.includes('employee') || c.includes('team') || c.includes('email') || c.includes('name')
    );
    const dataLines = isHeader ? lines.slice(1) : lines;
    const colIdx = (label) => {
      const header = firstLine.split(delimiter).map(c => (c || '').trim().toLowerCase());
      const i = header.findIndex(h => h.includes(label) || label.includes(h));
      return i >= 0 ? i : (label === 'employee' ? 0 : label === 'name' ? 1 : label === 'email' ? 2 : 3);
    };
    const empIdx = isHeader ? colIdx('employee') : 0;
    const nameIdx = isHeader ? colIdx('name') : 1;
    const emailIdx = isHeader ? colIdx('email') : 2;
    const teamIdx = isHeader ? colIdx('team') : 3;
    const rows = dataLines.map(line => {
      const cells = line.split(delimiter).map(c => (c || '').trim());
      return {
        employeeId: (cells[empIdx] || '').trim(),
        name: (cells[nameIdx] || '').trim(),
        email: (cells[emailIdx] || '').trim(),
        teamName: (cells[teamIdx] || '').trim()
      };
    }).filter(r => r.teamName && (r.employeeId || r.email));
    return { rows, headerRow: isHeader };
  };

  const handleBulkAssignTeams = async () => {
    if (!bulkAssignPaste.trim()) {
      alert('Please paste data (Employee ID, Name, Email, Team)');
      return;
    }
    const { rows } = parseBulkAssignData(bulkAssignPaste);
    if (rows.length === 0) {
      alert('No valid rows found. Ensure each row has Team and either Employee ID or Email.');
      return;
    }
    setBulkAssignLoading(true);
    setBulkAssignResult(null);
    try {
      const allPlayersRes = await axios.get(`${API_URL}/players`);
      const allPlayers = allPlayersRes.data || [];
      const assigned = [];
      const failed = [];
      for (const row of rows) {
        const player = allPlayers.find(p => {
          const empMatch = row.employeeId && (String(p.employee_id || '').trim().toLowerCase() === row.employeeId.toLowerCase());
          const emailMatch = row.email && (String(p.email || '').trim().toLowerCase() === row.email.toLowerCase());
          return empMatch || emailMatch;
        });
        const team = teams.find(t => (t.name || '').trim().toLowerCase() === row.teamName.toLowerCase());
        if (!player) {
          failed.push({ row, reason: 'Player not found' });
          continue;
        }
        if (!team) {
          failed.push({ row, reason: `Team "${row.teamName}" not found` });
          continue;
        }
        if (player.status === 'sold') {
          failed.push({ row, reason: 'Player already sold' });
          continue;
        }
        try {
          await axios.post(`${API_URL}/players/${player.id}/sell`, {
            team_id: team.id,
            amount: 0,
            sale_method: 'alot'
          });
          assigned.push({ player, team: team.name });
        } catch (err) {
          failed.push({ row, reason: err.response?.data?.error || err.message });
        }
      }
      setBulkAssignResult({ assigned, failed, total: rows.length });
      await fetchUnsoldPlayers();
      onTeamsChange();
      if (assigned.length > 0 && playSoldAudio) playSoldAudio();
    } catch (error) {
      alert('Error during bulk assign: ' + (error.response?.data?.error || error.message));
    } finally {
      setBulkAssignLoading(false);
    }
  };

  // Filter players based on search query
  const filteredPlayers = unsoldPlayers.filter(player => {
    if (!searchQuery || searchQuery.trim() === '') {
      return true;
    }
    const query = searchQuery.toLowerCase().trim();
    const name = (player.name || '').toLowerCase();
    const email = (player.email || '').toLowerCase();
    const employeeId = (player.employee_id || '').toLowerCase();
    const category = (player.category || '').toLowerCase();
    
    return name.includes(query) || 
           email.includes(query) || 
           employeeId.includes(query) ||
           category.includes(query);
  });

  return (
    <div className="bundle-auction">
      <div className="card">
        <div className="card-header">
          <h2>Lot Auction</h2>
          <div className="header-actions">
            <button
              className="btn btn-secondary add-players-to-lot-btn"
              onClick={handleOpenAddToLotModal}
              disabled={loading || userRole !== 'admin'}
              title="Add player manually to lot"
            >
              Add Player
            </button>
            <button
              className="btn btn-secondary bulk-assign-teams-btn"
              onClick={() => { setShowBulkAssignModal(true); setBulkAssignResult(null); setBulkAssignPaste(''); }}
              disabled={loading || userRole !== 'admin'}
              title="Paste Employee ID, Name, Email, Team to assign players to teams"
            >
              Bulk Assign Teams
            </button>
            <button
              className="btn btn-primary add-bundle-btn"
              onClick={() => setShowPopup(true)}
              disabled={loading || userRole !== 'admin' || unsoldPlayers.length === 0}
              title="Create Lot auction"
            >
              <span className="plus-icon">+</span> Create Lot Auction
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="player-search-container">
          <input
            type="text"
            className="player-search-input"
            placeholder="Search unsold players by name, email, or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        {loading && unsoldPlayers.length === 0 ? (
          <div className="loading">Loading unsold players...</div>
        ) : (
          <>
            <div className="player-stats">
              <div className="stat-box">
                <div className="stat-number">{unsoldPlayers.length}</div>
                <div className="stat-label">Total Unsold</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{filteredPlayers.length}</div>
                <div className="stat-label">Filtered Results</div>
              </div>
            </div>

            <div className="players-table-container">
              <table className="players-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Team</th>
                    {userRole === 'admin' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={userRole === 'admin' ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        {searchQuery ? 'No unsold players found matching your search' : 'No unsold players found'}
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player, index) => {
                      const displayName = getPlayerNameAndId(player);
                      const hasTeam = player.team_id && player.team_name;
                      return (
                        <tr key={player.id}>
                          <td>{index + 1}</td>
                          <td>{player.employee_id || '-'}</td>
                          <td className="player-name-cell">{displayName}</td>
                          <td className="player-email-cell">{player.email || '-'}</td>
                          <td className="team-cell">{hasTeam ? player.team_name : '-'}</td>
                          {userRole === 'admin' && (
                            <td>
                              <div className="lot-player-actions">
                                <button
                                  type="button"
                                  className={hasTeam ? "btn-edit-team-lot" : "btn-add-team-lot"}
                                  onClick={() => handleOpenAddTeamModal(player)}
                                  title={hasTeam ? "Edit team assignment" : "Assign team to this lot player"}
                                >
                                  {hasTeam ? 'Edit Team' : 'Add Team'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-delete-player-lot"
                                  onClick={() => handleDeletePlayer(player)}
                                  disabled={deletingPlayerId === player.id}
                                  title="Delete this player"
                                >
                                  {deletingPlayerId === player.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showPopup && (
        <BundleAuctionPopup
          teams={teams}
          unsoldPlayersCount={filteredPlayers.length}
          unsoldPlayers={filteredPlayers}
          onClose={() => setShowPopup(false)}
          onStart={handleBundleStart}
        />
      )}

      {showResultsPopup && (
        <BundleResultsPopup
          results={bundleResults}
          teams={teams}
          onClose={() => setShowResultsPopup(false)}
        />
      )}

      {/* Add Player to Lot Modal (Manual Entry Form) */}
      {showAddToLotModal && (
        <div className="lot-modal-overlay" onClick={() => !addToLotLoading && setShowAddToLotModal(false)}>
          <div className="lot-modal" onClick={e => e.stopPropagation()}>
            <div className="lot-modal-header">
              <h3>Add Player to Lot</h3>
              <button type="button" className="lot-modal-close" onClick={() => !addToLotLoading && setShowAddToLotModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddPlayerToLot}>
              <div className="lot-modal-body">
                <p className="lot-modal-hint">Enter player details to add them to the lot.</p>
                <div className="lot-modal-form-group">
                  <label>Employee ID *</label>
                  <input
                    type="text"
                    className="lot-modal-input"
                    value={newPlayerEmployeeId}
                    onChange={e => setNewPlayerEmployeeId(e.target.value)}
                    placeholder="Enter employee ID"
                  />
                </div>
                <div className="lot-modal-form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    className="lot-modal-input"
                    value={newPlayerName}
                    onChange={e => setNewPlayerName(e.target.value)}
                    placeholder="Enter player name"
                    required
                  />
                </div>
                <div className="lot-modal-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="lot-modal-input"
                    value={newPlayerEmail}
                    onChange={e => setNewPlayerEmail(e.target.value)}
                    placeholder="Enter email (optional)"
                  />
                </div>
              </div>
              <div className="lot-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => !addToLotLoading && setShowAddToLotModal(false)} disabled={addToLotLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addToLotLoading || !newPlayerName.trim()}>
                  {addToLotLoading ? 'Adding...' : 'Add Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Team Manually Modal (for lot players) */}
      {showAddTeamModal && addTeamPlayer && (
        <div className="lot-modal-overlay" onClick={() => !addTeamLoading && setShowAddTeamModal(false)}>
          <div className="lot-modal" onClick={e => e.stopPropagation()}>
            <div className="lot-modal-header">
              <h3>{addTeamPlayer.team_id ? 'Edit Team' : 'Add Team'} to Lot Player</h3>
              <button type="button" className="lot-modal-close" onClick={() => !addTeamLoading && setShowAddTeamModal(false)}>×</button>
            </div>
            <div className="lot-modal-body">
              <p className="lot-modal-player-name">{getPlayerNameAndId(addTeamPlayer)}</p>
              {addTeamPlayer.team_name && (
                <p className="lot-modal-current-team">Current Team: <strong>{addTeamPlayer.team_name}</strong></p>
              )}
              <div className="lot-modal-form-group">
                <label>Select Team</label>
                <select
                  value={addTeamSelectedTeamId}
                  onChange={e => setAddTeamSelectedTeamId(e.target.value)}
                  className="lot-modal-select"
                >
                  <option value="">-- Select Team --</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="lot-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => !addTeamLoading && setShowAddTeamModal(false)} disabled={addTeamLoading}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleAddTeamToLotPlayer} disabled={addTeamLoading || !addTeamSelectedTeamId}>
                {addTeamLoading ? 'Assigning...' : addTeamPlayer.team_id ? 'Update Team' : 'Assign Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Teams Modal */}
      {showBulkAssignModal && (
        <div className="lot-modal-overlay" onClick={() => !bulkAssignLoading && setShowBulkAssignModal(false)}>
          <div className="lot-modal bulk-assign-modal" onClick={e => e.stopPropagation()}>
            <div className="lot-modal-header">
              <h3>Bulk Assign Teams</h3>
              <button type="button" className="lot-modal-close" onClick={() => !bulkAssignLoading && (setShowBulkAssignModal(false), setBulkAssignResult(null), setBulkAssignPaste(''))}>×</button>
            </div>
            <div className="lot-modal-body">
              <p className="lot-modal-hint">Paste data with columns: Employee ID, Player Name, Email, Team (tab or comma separated). First row can be a header.</p>
              <div className="lot-modal-form-group">
                <label>Pasted data</label>
                <textarea
                  className="lot-modal-textarea bulk-assign-textarea"
                  value={bulkAssignPaste}
                  onChange={e => setBulkAssignPaste(e.target.value)}
                  placeholder="Employee ID&#10;Name&#10;Email&#10;Team&#10;122230&#10;John Kennedy&#10;johnkennedy@ideas2it.com&#10;Blasters"
                  rows={10}
                  disabled={bulkAssignLoading}
                />
              </div>
              {bulkAssignResult && (
                <div className="bulk-assign-result">
                  <p className="bulk-assign-summary">Assigned: {bulkAssignResult.assigned.length} of {bulkAssignResult.total}</p>
                  {bulkAssignResult.failed.length > 0 && (
                    <div className="bulk-assign-failed">
                      <strong>Failed ({bulkAssignResult.failed.length}):</strong>
                      <ul>
                        {bulkAssignResult.failed.slice(0, 10).map((f, i) => (
                          <li key={i}>{f.row.name || f.row.employeeId || f.row.email} – {f.reason}</li>
                        ))}
                        {bulkAssignResult.failed.length > 10 && <li>… and {bulkAssignResult.failed.length - 10} more</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="lot-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => !bulkAssignLoading && (setShowBulkAssignModal(false), setBulkAssignResult(null), setBulkAssignPaste(''))} disabled={bulkAssignLoading}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleBulkAssignTeams} disabled={bulkAssignLoading || !bulkAssignPaste.trim()}>
                {bulkAssignLoading ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BundleAuction;
