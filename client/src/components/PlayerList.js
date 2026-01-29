import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './PlayerList.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function PlayerList({ userRole, teams = [], onTeamsChange }) {
  const [players, setPlayers] = useState([]);
  const [filter, setFilter] = useState('all'); // all, sold, unsold
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // Edit team modal (for sold players)
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editPlayer, setEditPlayer] = useState(null);
  const [editTeamId, setEditTeamId] = useState('');
  const [editBidAmount, setEditBidAmount] = useState('');
  const [editRange, setEditRange] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete player
  const [deletingPlayerId, setDeletingPlayerId] = useState(null);

  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? `${API_URL}/players`
        : `${API_URL}/players?status=${filter}`;
      const response = await axios.get(url);
      setPlayers(response.data);
    } catch (error) {
      console.error('Error fetching players:', error);
      alert('Error fetching players: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Convert text to Title Case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Get player category with mapping
  const getPlayerCategory = (player) => {
    // If sale method is 'alot', show "Lot"
    if (player.sale_method === 'alot') {
      return 'Lot';
    }
    
    if (!player.category || !player.category.trim()) {
      return '-';
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

  const handleDownloadCSV = () => {
    // Filter players based on search query if active
    let playersToExport = players;
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      playersToExport = players.filter(player => {
        const name = (player.name || '').toLowerCase();
        const email = (player.email || '').toLowerCase();
        const employeeId = (player.employee_id || '').toLowerCase();
        
        return name.includes(query) || 
               email.includes(query) || 
               employeeId.includes(query);
      });
    }
    
    if (playersToExport.length === 0) {
      alert('No players to download');
      return;
    }

    // Define CSV headers
    const headers = ['ID', 'Employee ID', 'Name', 'Category', 'Base Price', 'Email', 'Status', 'Team', 'Sold Price'];
    
    // Convert players data to CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...playersToExport.map((player, index) => {
        // Remove dots and replace with spaces in name
        const displayName = (player.name?.replace(/@.*$/, '') || player.name || '').replace(/\./g, ' ');
        
        // Escape commas and quotes in values
        const escapeCSV = (value) => {
          if (value === null || value === undefined || value === '') return '';
          const stringValue = String(value);
          // If value contains comma, quote, or newline, wrap in quotes and escape quotes
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        };

        // Format status similar to UI display
        let statusDisplay = '';
        if (player.status === 'sold') {
          statusDisplay = 'Sold';
        } else if (player.status === 'unsold') {
          statusDisplay = 'Unsold';
        } else {
          statusDisplay = 'Available';
        }

        // Get category for CSV
        let categoryDisplay = '';
        if (player.sale_method === 'alot') {
          categoryDisplay = 'Lot';
        } else if (player.category && player.category.trim()) {
          const category = player.category.trim().toLowerCase();
          if (category === 'bat') {
            categoryDisplay = 'Batsman';
          } else if (category === 'bowl') {
            categoryDisplay = 'Bowler';
          } else if (category === 'all') {
            categoryDisplay = 'Allrounder';
          } else {
            categoryDisplay = toTitleCase(category);
          }
        }

        return [
          index + 1, // Sequential number starting from 1
          escapeCSV(player.employee_id),
          escapeCSV(displayName),
          escapeCSV(categoryDisplay),
          player.base_price || '',
          escapeCSV(player.email),
          escapeCSV(statusDisplay),
          escapeCSV(player.team_name),
          player.sold_price || ''
        ].join(',');
      })
    ];

    // Create CSV content
    const csvContent = csvRows.join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `players_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const getStatusBadge = (status) => {
    if (status === 'sold') {
      return <span className="badge badge-success">Sold</span>;
    }
    if (status === 'unsold') {
      return <span className="badge badge-danger">Unsold</span>;
    }
    // Default to "Available" for new players or any other status
    return <span className="badge badge-info">Available</span>;
  };

  const handleOpenEditTeam = (player) => {
    if (player.status !== 'sold') return;
    setEditPlayer(player);
    setEditTeamId(player.team_id?.toString() || '');
    setEditBidAmount(player.sold_price?.toString() || '0');
    setEditRange(player.range || '');
    setShowEditTeamModal(true);
  };

  const handleSaveEditTeam = async (e) => {
    e.preventDefault();
    if (!editPlayer || !editTeamId || !editBidAmount) {
      alert('Please select a team and enter amount.');
      return;
    }
    const amount = parseInt(editBidAmount, 10);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount.');
      return;
    }
    setEditLoading(true);
    try {
      await axios.put(`${API_URL}/players/${editPlayer.id}/update-sold`, {
        team_id: parseInt(editTeamId, 10),
        amount,
        range: editRange?.trim() || null
      });
      await fetchPlayers();
      setShowEditTeamModal(false);
      setEditPlayer(null);
      setEditTeamId('');
      setEditBidAmount('');
      setEditRange('');
    } catch (error) {
      alert('Error updating team: ' + (error.response?.data?.error || error.message));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePlayer = async (player) => {
    const playerName = toTitleCase((player.name?.replace(/@.*$/, '') || player.name || '').replace(/\./g, ' '));
    if (!window.confirm(`Are you sure you want to delete "${playerName}"? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingPlayerId(player.id);
    try {
      await axios.delete(`${API_URL}/players/${player.id}`);
      await fetchPlayers();
      // Refresh teams to update player counts
      if (onTeamsChange) {
        await onTeamsChange();
      }
    } catch (error) {
      alert('Error deleting player: ' + (error.response?.data?.error || error.message));
    } finally {
      setDeletingPlayerId(null);
    }
  };

  // Filter players based on search query
  const filteredPlayers = players.filter(player => {
    if (!searchQuery || searchQuery.trim() === '') {
      return true;
    }
    const query = searchQuery.toLowerCase().trim();
    const name = (player.name || '').toLowerCase();
    const email = (player.email || '').toLowerCase();
    const employeeId = (player.employee_id || '').toLowerCase();
    
    return name.includes(query) || 
           email.includes(query) || 
           employeeId.includes(query);
  });

  return (
    <div className="player-list">
      <div className="card">
        <div className="card-header">
          <h2>Player List</h2>
          <div className="header-actions">
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Players
              </button>
              <button
                className={`filter-btn ${filter === 'sold' ? 'active' : ''}`}
                onClick={() => setFilter('sold')}
              >
                Sold
              </button>
              <button
                className={`filter-btn ${filter === 'unsold' ? 'active' : ''}`}
                onClick={() => setFilter('unsold')}
              >
                Unsold
              </button>
              <button
                className={`filter-btn ${filter === 'available' ? 'active' : ''}`}
                onClick={() => setFilter('available')}
              >
                Available
              </button>
            </div>
            <div className="action-buttons">
              <button
                className="btn btn-secondary"
                onClick={handleDownloadCSV}
                disabled={loading}
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="player-search-container">
          <input
            ref={searchInputRef}
            type="text"
            className="player-search-input"
            placeholder="Search player by name, email, or employee ID..."
            value={searchQuery}
            onChange={handleSearchChange}
            autoComplete="off"
          />
        </div>

        {loading ? (
          <div className="loading">Loading players...</div>
        ) : (
          <>
            <div className="player-stats">
              <div className="stat-box">
                <div className="stat-number">{players.length}</div>
                <div className="stat-label">Total Players</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{players.filter(p => p.status === 'sold').length}</div>
                <div className="stat-label">Sold</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{players.filter(p => p.status === 'unsold').length}</div>
                <div className="stat-label">Unsold</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{players.filter(p => p.status === 'available' || !p.status || (p.status !== 'sold' && p.status !== 'unsold')).length}</div>
                <div className="stat-label">Available</div>
              </div>
            </div>

            <div className="players-table-container">
              <table className="players-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Base Price</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Team</th>
                    <th>Sold Price</th>
                    {userRole === 'admin' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={userRole === 'admin' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        {searchQuery ? 'No players found matching your search' : 'No players found'}
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player, index) => {
                      // Remove dots and replace with spaces in name, then apply Title Case
                      let displayName = (player.name?.replace(/@.*$/, '') || player.name || '').replace(/\./g, ' ');
                      displayName = toTitleCase(displayName);
                      const category = getPlayerCategory(player);
                      return (
                        <tr key={player.id}>
                          <td>{index + 1}</td>
                          <td>{player.employee_id || '-'}</td>
                          <td className="player-name-cell">{displayName}</td>
                          <td className="category-cell">{category}</td>
                          <td className="price-cell">
                            {player.base_price ? `${parseInt(player.base_price).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="player-email-cell">{player.email || '-'}</td>
                          <td>{getStatusBadge(player.status)}</td>
                          <td>{player.team_name || '-'}</td>
                          <td className="price-cell">
                            {player.sale_method === 'alot' 
                              ? '0' 
                              : player.sold_price 
                                ? `${parseInt(player.sold_price).toLocaleString('en-IN')}` 
                                : '-'
                            }
                          </td>
                          {userRole === 'admin' && (
                            <td>
                              <div className="player-list-actions">
                                {player.status === 'sold' && (
                                  <button
                                    type="button"
                                    className="btn-edit-team"
                                    onClick={() => handleOpenEditTeam(player)}
                                    title="Edit team and sold price"
                                  >
                                    Edit
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-delete-player"
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

      {/* Edit Team Modal (sold players only) */}
      {showEditTeamModal && editPlayer && (
        <div className="player-list-modal-overlay" onClick={() => !editLoading && setShowEditTeamModal(false)}>
          <div className="player-list-modal" onClick={e => e.stopPropagation()}>
            <div className="player-list-modal-header">
              <h3>Edit Team</h3>
              <button type="button" className="player-list-modal-close" onClick={() => !editLoading && setShowEditTeamModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEditTeam}>
              <div className="player-list-modal-body">
                <p className="player-list-modal-player-name">
                  {toTitleCase((editPlayer.name?.replace(/@.*$/, '') || editPlayer.name || '').replace(/\./g, ' '))}
                </p>
                <div className="player-list-modal-form-group">
                  <label>Team</label>
                  <select
                    value={editTeamId}
                    onChange={e => setEditTeamId(e.target.value)}
                    className="player-list-modal-select"
                    required
                  >
                    <option value="">-- Select Team --</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                <div className="player-list-modal-form-group">
                  <label>Sold Price / Amount</label>
                  <input
                    type="number"
                    min="0"
                    className="player-list-modal-input"
                    value={editBidAmount}
                    onChange={e => setEditBidAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="player-list-modal-form-group">
                  <label>Range (optional)</label>
                  <input
                    type="text"
                    className="player-list-modal-input"
                    value={editRange}
                    onChange={e => setEditRange(e.target.value)}
                    placeholder="e.g. A, B, C"
                  />
                </div>
              </div>
              <div className="player-list-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => !editLoading && setShowEditTeamModal(false)} disabled={editLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerList;

