import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TeamManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function TeamManagement({ teams, onTeamsChange, userRole }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', budget: 100000, captain: '', wise_captain: '', min_players: 0 });
  const [editingTeam, setEditingTeam] = useState(null);
  const [loading, setLoading] = useState(false);

  // Convert text to Title Case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Get player display name (Employee ID - Player Name)
  const getPlayerDisplayName = (player) => {
    if (!player) return '';
    const name = player.name || '';
    // Remove @ideas2it.com and any email domain
    let cleanName = name.replace(/@.*$/, '').trim() || name;
    // Replace dots with spaces
    cleanName = cleanName.replace(/\./g, ' ');
    // Apply Title Case to player name
    cleanName = toTitleCase(cleanName);
    
    const parts = [];
    // Add Employee ID if it exists
    if (player.employee_id && player.employee_id.trim() !== '') {
      parts.push(player.employee_id.trim());
    }
    // Add Employee name (always show)
    parts.push(cleanName);
    
    return parts.join(' - ');
  };

  const handleDownloadCSV = async () => {
    if (teams.length === 0) {
      alert('No teams to download');
      return;
    }

    try {
      setLoading(true);

      // Define CSV headers - only the requested columns
      const headers = ['Team Name', 'Player Name', 'Player Category', 'Sold Price'];
      
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

      // Fetch players for each team and build CSV rows
      const csvRows = [headers.join(',')]; // Header row

      for (const team of teams) {
        try {
          // Fetch players for this team
          const response = await axios.get(`${API_URL}/players?team_id=${team.id}&status=sold`);
          const players = response.data || [];

          if (players.length === 0) {
            // If no players, still add a row with team info and empty player fields
            csvRows.push([
              escapeCSV(team.name),
              '', // Player Name
              '', // Player Category
              ''  // Sold Price
            ].join(','));
          } else {
            // Add a row for each player
            players.forEach((player) => {
              const playerName = getPlayerDisplayName(player);
              const playerCategory = player.category ? toTitleCase(player.category.trim()) : '';
              const soldPrice = player.sold_price || '';

              csvRows.push([
                escapeCSV(team.name),
                escapeCSV(playerName),
                escapeCSV(playerCategory),
                soldPrice
              ].join(','));
            });
          }
        } catch (error) {
          console.error(`Error fetching players for team ${team.name}:`, error);
          // Still add team row even if player fetch fails
          csvRows.push([
            escapeCSV(team.name),
            'Error loading players',
            '',
            ''
          ].join(','));
        }
      }

      // Create CSV content
      const csvContent = csvRows.join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `teams_players_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Error downloading CSV: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await axios.put(`${API_URL}/teams/${editingTeam.id}`, formData);
      } else {
        await axios.post(`${API_URL}/teams`, formData);
      }
      setFormData({ name: '', budget: 100000, captain: '', wise_captain: '', min_players: 0 });
      setShowForm(false);
      setEditingTeam(null);
      onTeamsChange();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (team) => {
    setEditingTeam(team);
    setFormData({ 
      name: team.name, 
      budget: team.budget,
      captain: team.captain || '',
      wise_captain: team.wise_captain || '',
      min_players: team.min_players || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this team? All players will be unsold.')) {
      try {
        await axios.delete(`${API_URL}/teams/${id}`);
        onTeamsChange();
      } catch (error) {
        alert('Error: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTeam(null);
    setFormData({ name: '', budget: 100000, captain: '', wise_captain: '' });
  };

  useEffect(() => {
    if (teams && teams.length > 0) {
      setLoading(false);
    }
  }, [teams]);

  const calculateStats = () => {
    const totalTeams = teams.length;
    const totalBudget = teams.reduce((sum, team) => sum + (parseInt(team.budget) || 0), 0);
    const totalSpent = teams.reduce((sum, team) => sum + (parseInt(team.spent) || 0), 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const totalPlayers = teams.reduce((sum, team) => sum + (parseInt(team.players_count) || 0), 0);
    return { totalTeams, totalBudget, totalSpent, totalRemaining, totalPlayers };
  };

  const stats = calculateStats();

  return (
    <div className="team-management">
      <div className="card">
        <div className="card-header">
          <h2>Team List</h2>
          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={handleDownloadCSV}
              disabled={loading}
            >
              Download CSV
            </button>
            {userRole === 'admin' && (
              <button
                className="btn btn-primary"
                onClick={() => setShowForm(true)}
                disabled={showForm}
              >
                Add New Team
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="team-form">
            <h3>{editingTeam ? 'Edit Team' : 'Add New Team'}</h3>
            <div className="input-group">
              <label>Team Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter team name"
              />
            </div>
            <div className="input-group">
              <label>Budget</label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) || 0 })}
                required
                min="0"
              />
            </div>
            <div className="input-group">
              <label>Captain</label>
              <input
                type="text"
                value={formData.captain}
                onChange={(e) => setFormData({ ...formData, captain: e.target.value })}
                placeholder="Enter captain name"
              />
            </div>
            <div className="input-group">
              <label>Wise Captain</label>
              <input
                type="text"
                value={formData.wise_captain}
                onChange={(e) => setFormData({ ...formData, wise_captain: e.target.value })}
                placeholder="Enter wise captain name"
              />
            </div>
            <div className="input-group">
              <label>Min Players</label>
              <input
                type="number"
                value={formData.min_players}
                onChange={(e) => setFormData({ ...formData, min_players: parseInt(e.target.value) || 0 })}
                placeholder="Enter minimum players"
                min="0"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-success">
                {editingTeam ? 'Update' : 'Create'} Team
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="loading">Loading teams...</div>
        ) : (
          <>
            <div className="team-stats">
              <div className="stat-box">
                <div className="stat-number">{stats.totalTeams}</div>
                <div className="stat-label">Total Teams</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{stats.totalBudget.toLocaleString('en-IN')}</div>
                <div className="stat-label">Total Budget</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{stats.totalSpent.toLocaleString('en-IN')}</div>
                <div className="stat-label">Total Spent</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{stats.totalRemaining.toLocaleString('en-IN')}</div>
                <div className="stat-label">Remaining Bid</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{stats.totalPlayers}</div>
                <div className="stat-label">Total Players</div>
              </div>
            </div>

            <div className="teams-table-container">
              <table className="teams-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Team Name</th>
                    <th>Total Budget</th>
                    <th>Spent</th>
                    <th>Remaining</th>
                    <th>Players</th>
                    <th>Min Players</th>
                    <th>Captain</th>
                    <th>Wise Captain</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        No teams found
                      </td>
                    </tr>
                  ) : (
                    teams.map(team => (
                      <tr key={team.id}>
                        <td>{team.id}</td>
                        <td className="team-name-cell">{team.name}</td>
                        <td className="budget-cell">{team.budget.toLocaleString('en-IN')}</td>
                        <td className="spent-cell">{team.spent.toLocaleString('en-IN')}</td>
                        <td className="remaining-cell">{Math.max(0, (parseInt(team.budget) || 0) - (parseInt(team.spent) || 0)).toLocaleString('en-IN')}</td>
                        <td>{team.players_count || 0}</td>
                        <td>{team.min_players || 0}</td>
                        <td>{team.captain || '-'}</td>
                        <td>{team.wise_captain || '-'}</td>
                        <td>
                          {userRole === 'admin' ? (
                            <div className="table-actions">
                              <button
                                className="btn-icon"
                                onClick={() => handleEdit(team)}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => handleDelete(team.id)}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TeamManagement;

