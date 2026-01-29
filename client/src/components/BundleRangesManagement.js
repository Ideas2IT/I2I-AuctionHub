import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BundleRangesManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function BundleRangesManagement({ onClose }) {
  const [ranges, setRanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRange, setEditingRange] = useState(null);
  const [formData, setFormData] = useState({ range_value: '', range_letter: '', min_value: '', max_value: '' });

  useEffect(() => {
    fetchRanges();
  }, []);

  const fetchRanges = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/bundle/ranges`);
      setRanges(response.data);
    } catch (error) {
      console.error('Error fetching ranges:', error);
      alert('Error fetching ranges: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post(`${API_URL}/bundle/ranges`, formData);
      setFormData({ range_value: '', range_letter: '', min_value: '', max_value: '' });
      setShowAddForm(false);
      fetchRanges();
    } catch (error) {
      alert('Error adding range: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (range) => {
    setEditingRange(range);
    setFormData({ 
      range_value: range.range_value.toString(),
      range_letter: (range.range_letter || '').toString(),
      min_value: (range.min_value || '').toString(),
      max_value: (range.max_value || '').toString()
    });
    setShowAddForm(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.put(`${API_URL}/bundle/ranges/${editingRange.id}`, formData);
      setFormData({ range_value: '', range_letter: '', min_value: '', max_value: '' });
      setEditingRange(null);
      setShowAddForm(false);
      fetchRanges();
    } catch (error) {
      alert('Error updating range: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this range?')) {
      return;
    }
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/bundle/ranges/${id}`);
      fetchRanges();
    } catch (error) {
      alert('Error deleting range: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ range_value: '', range_letter: '', min_value: '', max_value: '' });
    setEditingRange(null);
    setShowAddForm(false);
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content bundle-ranges-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Manage Bundle Ranges</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="popup-body">
          {showAddForm ? (
            <form onSubmit={editingRange ? handleUpdate : handleAdd} className="range-form">
              <h3>{editingRange ? 'Edit Range' : 'Add New Range'}</h3>
              <div className="input-group">
                <label>Range Letter</label>
                <input
                  type="text"
                  value={formData.range_letter}
                  onChange={(e) => setFormData({ ...formData, range_letter: e.target.value.toUpperCase() })}
                  placeholder="Enter range letter (e.g., A, B, C)"
                  required
                  maxLength="1"
                  pattern="[A-Z]"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="input-group">
                <label>Range Value</label>
                <input
                  type="number"
                  value={formData.range_value}
                  onChange={(e) => setFormData({ ...formData, range_value: e.target.value })}
                  placeholder="Enter range value (e.g., 300, 150, 75)"
                  required
                  min="1"
                />
              </div>
              <div className="input-group">
                <label>Min Bid Amount</label>
                <input
                  type="number"
                  value={formData.min_value}
                  onChange={(e) => setFormData({ ...formData, min_value: e.target.value })}
                  placeholder="Enter minimum bid amount"
                  min="0"
                />
              </div>
              <div className="input-group">
                <label>Max Bid Amount</label>
                <input
                  type="number"
                  value={formData.max_value}
                  onChange={(e) => setFormData({ ...formData, max_value: e.target.value })}
                  placeholder="Enter maximum bid amount"
                  min="0"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {editingRange ? 'Update' : 'Add'} Range
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="ranges-header">
                <h3>Bundle Ranges</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddForm(true)}
                  disabled={loading}
                >
                  + Add Range
                </button>
              </div>
              {loading && ranges.length === 0 ? (
                <div className="loading">Loading ranges...</div>
              ) : (
                <div className="ranges-list">
                  {ranges.length === 0 ? (
                    <p className="no-ranges">No ranges configured. Add a range to get started.</p>
                  ) : (
                    ranges
                      .sort((a, b) => b.range_value - a.range_value)
                      .map((range) => {
                        const letter = range.range_letter || '';
                        return (
                          <div key={range.id} className="range-item">
                            <div className="range-info">
                              <div className="range-letter">{letter}</div>
                              <div className="range-details">
                                <div className="range-value">Value: {range.range_value}</div>
                                {range.min_value && range.max_value && (
                                  <div className="range-bid-range">
                                    Bid Range: {range.min_value} - {range.max_value}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="range-actions">
                          <button
                            className="btn-icon edit-icon"
                            onClick={() => handleEdit(range)}
                            title="Edit range"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon delete-icon"
                            onClick={() => handleDelete(range.id)}
                            title="Delete range"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                        );
                      })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BundleRangesManagement;
