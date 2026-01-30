import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SoldPopup from './SoldPopup';
import BundlePopup from './BundlePopup';
import PurchasedPlayersPopup from './PurchasedPlayersPopup';
import './AuctionDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function UnsoldAuctionDashboard({
  teams,
  onTeamsChange,
  userRole,
  playSoldAudio,
  playUnsoldAudio
}) {
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [showSoldPopup, setShowSoldPopup] = useState(false);
  const [showBundlePopup, setShowBundlePopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditingSold, setIsEditingSold] = useState(false);
  const [editTeamId, setEditTeamId] = useState('');
  const [editBidAmount, setEditBidAmount] = useState('');
  const [editRange, setEditRange] = useState('');
  const [editBidError, setEditBidError] = useState('');
  const [teamBidTiers, setTeamBidTiers] = useState({}); // { teamId: { tier: 1|2|3|4, highestBid: number, top3Count: number, range150to200: number, range120to150: number, range100to120: number } }
  const [explicitlyUnsold, setExplicitlyUnsold] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const [showPurchasedPlayersPopup, setShowPurchasedPlayersPopup] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [bundleRanges, setBundleRanges] = useState([]);
  const [teamWonRanges, setTeamWonRanges] = useState({});
  const [teamRanges, setTeamRanges] = useState({}); // { teamId: [{range: 'A', bidAmount: 180}, ...] } - stores ranges with bid amounts from player sales
  const [imageAttempt, setImageAttempt] = useState({ protocol: 'https', extension: 'PNG' });
  const [, setShowPlaceholder] = useState(true);
  const [loadedImageUrl, setLoadedImageUrl] = useState(null);
  const [unsoldPlayers, setUnsoldPlayers] = useState([]); // Store all unsold players for navigation
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(-1); // Track current player index in unsold list

  // Initialize edit values when entering edit mode
  useEffect(() => {
    if (isEditingSold && currentPlayer && currentPlayer.status === 'sold') {
      setEditTeamId(currentPlayer.team_id?.toString() || '');
      setEditBidAmount(currentPlayer.sold_price?.toString() || '');
      setEditRange(currentPlayer.range || '');
      setEditBidError('');
    }
  }, [isEditingSold, currentPlayer]);

  // Reset image attempt when player changes - start with placeholder
  useEffect(() => {
    setImageAttempt({ protocol: 'https', extension: 'PNG' });
    setShowPlaceholder(true);
    setLoadedImageUrl(null);
  }, [currentPlayer?.id]);

  // Gray person placeholder image (SVG data URI)
  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

  // Function to get next image URL attempt
  const getNextImageAttempt = (currentAttempt) => {
    const protocols = ['https', 'http'];
    const extensions = ['PNG', 'JPG', 'jpg'];
    
    const protocolIndex = protocols.indexOf(currentAttempt.protocol);
    const extensionIndex = extensions.indexOf(currentAttempt.extension);
    
    if (extensionIndex < extensions.length - 1) {
      return {
        protocol: currentAttempt.protocol,
        extension: extensions[extensionIndex + 1]
      };
    }
    if (protocolIndex < protocols.length - 1) {
      return {
        protocol: protocols[protocolIndex + 1],
        extension: extensions[0]
      };
    }
    return null;
  };

  // Load all unsold players on mount
  useEffect(() => {
    const initializeUnsoldPlayers = async () => {
      const players = await loadUnsoldPlayers();
      if (players.length > 0) {
        const player = await fetchPlayerDetails(players[0].id);
        setCurrentPlayer(player);
        setCurrentPlayerIndex(0);
        setExplicitlyUnsold(false);
      }
    };
    initializeUnsoldPlayers();
    fetchBundleRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard navigation for player navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger if any popup is open or user is editing
      if (showSoldPopup || isEditingSold) {
        return;
      }

      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable ||
        event.target.closest('input') ||
        event.target.closest('textarea')
      ) {
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentPlayer) {
          handleNext();
        }
      }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentPlayer) {
          handlePrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, showSoldPopup, isEditingSold]); // Re-run when currentPlayer or popup states change

  // Fetch won ranges for all teams when bundle ranges are loaded or teams change
  const teamsHashRef = useRef('');
  
  useEffect(() => {
    if (teams && teams.length > 0) {
      // Fetch team ranges (from player sales)
      fetchTeamRanges();
      // Calculate team bid tiers for validation
      calculateTeamBidTiers();
      
      if (bundleRanges.length > 0) {
        const teamsHash = teams.map(t => `${t.id}:${t.budget}:${t.spent}`).join('|');
        
        if (teamsHashRef.current !== teamsHash) {
          teamsHashRef.current = teamsHash;
          fetchAllTeamWonRanges();
        } else if (teamsHashRef.current === '') {
          teamsHashRef.current = teamsHash;
          fetchAllTeamWonRanges();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleRanges.length, teams]);

  // Handle click outside to hide search results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const fetchBundleRanges = async () => {
    try {
      const response = await axios.get(`${API_URL}/bundle/ranges`);
      setBundleRanges(response.data);
    } catch (error) {
      console.error('Error fetching bundle ranges:', error);
    }
  };

  // Fetch all won ranges for all teams
  const fetchAllTeamWonRanges = async () => {
    if (!teams || teams.length === 0) {
      return;
    }
    if (bundleRanges.length === 0) {
      return;
    }
    
    const wonRangesMap = {};
    for (const team of teams) {
      try {
        const response = await axios.get(`${API_URL}/bundle/participation/team/${team.id}`);
        
        let participations = [];
        if (Array.isArray(response.data)) {
          participations = response.data;
        } else if (response.data && response.data.participations && Array.isArray(response.data.participations)) {
          participations = response.data.participations;
        }
        
        const wonParticipations = participations.filter(p => p && p.result === 'won' && p.range_id);
        
        const wonRangeLetters = [...new Set(
          wonParticipations.map(p => {
            if (p.range_letter) {
              return p.range_letter.toUpperCase();
            }
            const range = bundleRanges.find(r => r.id === p.range_id);
            return range?.range_letter?.toUpperCase() || '';
          })
          .filter(letter => letter !== '')
        )].sort();
        
        wonRangesMap[team.id] = wonRangeLetters;
      } catch (error) {
        console.error(`Error fetching won ranges for team ${team.id}:`, error);
        wonRangesMap[team.id] = [];
      }
    }
    setTeamWonRanges(wonRangesMap);
  };

  // Get color class for a specific bid amount
  const getBidAmountColorClass = (bidAmount) => {
    if (bidAmount >= 151 && bidAmount <= 200) {
      return 'tier-1-violet'; // Green for 151-200 (Range A)
    } else if (bidAmount >= 121 && bidAmount <= 150) {
      return 'tier-2-ivory'; // Blue for 121-150 (Range B)
    } else if (bidAmount >= 101 && bidAmount <= 120) {
      return 'tier-3-blue'; // Red for 101-120 (Range C)
    }
    return '';
  };

  // Fetch ranges for all teams (from player sales)
  const fetchTeamRanges = async () => {
    if (!teams || teams.length === 0) {
      return;
    }
    
    const rangesMap = {};
    for (const team of teams) {
      try {
        const response = await axios.get(`${API_URL}/players?team_id=${team.id}&status=sold`);
        const soldPlayers = response.data || [];
        
        // Extract ranges with bid amounts (filter out null/empty ranges and lot sales)
        const rangesWithBids = soldPlayers
          .filter(p => p.range && p.range.trim() !== '' && p.sale_method !== 'alot' && p.sold_price)
          .map(p => ({
            range: p.range.trim().toUpperCase(),
            bidAmount: parseInt(p.sold_price) || 0
          }));
        
        // Remove duplicates by range (keep the one with highest bid if same range appears multiple times)
        const uniqueRangesMap = {};
        rangesWithBids.forEach(item => {
          if (!uniqueRangesMap[item.range] || uniqueRangesMap[item.range].bidAmount < item.bidAmount) {
            uniqueRangesMap[item.range] = item;
          }
        });
        
        // Convert to array and sort by range letter
        const ranges = Object.values(uniqueRangesMap).sort((a, b) => a.range.localeCompare(b.range));
        
        rangesMap[team.id] = ranges;
      } catch (error) {
        console.error(`Error fetching ranges for team ${team.id}:`, error);
        rangesMap[team.id] = [];
      }
    }
    setTeamRanges(rangesMap);
  };

  // Calculate team bid tiers for validation
  const calculateTeamBidTiers = async (teamsToUse = null) => {
    // Use provided teams or fetch fresh teams
    let teamsList = teamsToUse || teams;
    
    // If no teams provided and state teams are empty, fetch fresh
    if (!teamsList || teamsList.length === 0) {
      try {
        const teamsResponse = await axios.get(`${API_URL}/teams`);
        teamsList = teamsResponse.data || [];
      } catch (error) {
        console.error('Error fetching teams for bid tiers:', error);
        return;
      }
    }
    
    if (!teamsList || teamsList.length === 0) {
      return;
    }
    
    const teamBidData = {};
    
    for (const team of teamsList) {
      try {
        const response = await axios.get(`${API_URL}/players?team_id=${team.id}&status=sold`);
        const soldPlayers = response.data || [];
        
        // Filter out lot sales and get bid amounts
        const bidAmounts = soldPlayers
          .filter(p => p.sale_method !== 'alot' && p.sold_price)
          .map(p => parseInt(p.sold_price) || 0)
          .filter(bid => bid > 0);
        
        const highestBid = bidAmounts.length > 0 ? Math.max(...bidAmounts) : 0;
        
        // Count players in each range
        const range150to200 = bidAmounts.filter(bid => bid >= 151 && bid <= 200).length;
        const range120to150 = bidAmounts.filter(bid => bid >= 121 && bid <= 150).length;
        const range100to120 = bidAmounts.filter(bid => bid >= 101 && bid <= 120).length;
        
        // Count top 3 bids (>= 100)
        const top3Count = bidAmounts.filter(bid => bid >= 100).length;
        
        // Determine tier based on highest bid (for color coding)
        let tier = 4; // Default tier
        if (highestBid >= 151 && highestBid <= 200) {
          tier = 1; // Green (151-200)
        } else if (highestBid >= 121 && highestBid <= 150) {
          tier = 2; // Blue (121-150)
        } else if (highestBid >= 101 && highestBid <= 120) {
          tier = 3; // Red (101-120)
        }
        
        teamBidData[team.id] = { 
          tier, 
          highestBid, 
          top3Count,
          range150to200,
          range120to150,
          range100to120
        };
      } catch (error) {
        console.error(`Error calculating bid tier for team ${team.id}:`, error);
        teamBidData[team.id] = { 
          tier: 4, 
          highestBid: 0, 
          top3Count: 0,
          range150to200: 0,
          range120to150: 0,
          range100to120: 0
        };
      }
    }
    
    setTeamBidTiers(teamBidData);
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

  // Load all unsold players
  const loadUnsoldPlayers = async () => {
    try {
      // Fetch unsold players (exclude lot players)
      const response = await axios.get(`${API_URL}/players?status=unsold`);
      const updatedUnsoldPlayers = (response.data || []).filter(p => !p.is_lot_details);
      setUnsoldPlayers(updatedUnsoldPlayers);
      return updatedUnsoldPlayers;
    } catch (error) {
      console.error('Error loading unsold players:', error);
      return [];
    }
  };

  const fetchPlayerDetails = async (playerId) => {
    try {
      const response = await axios.get(`${API_URL}/players/${playerId}`);
      const player = response.data;
      // Skip lot players - they should not appear in UnsoldAuctionDashboard
      if (player && player.is_lot_details) {
        return null;
      }
      return player;
    } catch (error) {
      console.error('Error fetching player details:', error);
      return null;
    }
  };

  const handleSearch = async (query) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setLoading(true);
      // Search in unsold players (exclude lot players)
      const response = await axios.get(`${API_URL}/players?search=${encodeURIComponent(query)}&status=unsold`);
      const filteredResults = (response.data || []).filter(p => p.status === 'unsold' && !p.is_lot_details);
      
      setSearchResults(filteredResults);
      setShowSearchResults(true);
      
      const cursorPosition = searchInputRef.current?.selectionStart || 0;
      
      if (filteredResults.length > 0) {
        const player = await fetchPlayerDetails(filteredResults[0].id);
        if (player) {
          setCurrentPlayer(player);
          // Find index in unsold players list
          const index = unsoldPlayers.findIndex(p => p.id === player.id);
          setCurrentPlayerIndex(index >= 0 ? index : 0);
          setExplicitlyUnsold(false);
        }
      }
      
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    } catch (error) {
      console.error('Error searching players:', error);
      alert('Error searching players: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setSearchQuery(value);
    setSelectedSearchIndex(-1); // Reset selected index when typing
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!value || value.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      loadUnsoldPlayers();
    } else {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value);
      }, 300);
    }
    
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        const newPosition = Math.min(cursorPosition, value.length);
        searchInputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  // Handle keyboard navigation for search results
  const handleSearchKeyDown = (e) => {
    if (!showSearchResults || searchResults.length === 0) {
      return;
    }

    const maxIndex = Math.min(searchResults.length - 1, 4); // Max 5 results shown (0-4)

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => {
        if (prev < maxIndex) {
          return prev + 1;
        }
        return prev; // Stay at last item
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => {
        if (prev > 0) {
          return prev - 1;
        }
        return -1; // Go back to input
      });
    } else if (e.key === 'Enter' && selectedSearchIndex >= 0 && selectedSearchIndex <= maxIndex) {
      e.preventDefault();
      const selectedPlayer = searchResults[selectedSearchIndex];
      if (selectedPlayer) {
        handleSelectSearchResult(selectedPlayer.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSearchResults(false);
      setSelectedSearchIndex(-1);
    }
  };

  const handleSelectSearchResult = async (playerId) => {
    // Clear search query when a result is selected
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSearchIndex(-1);
    const player = await fetchPlayerDetails(playerId);
    if (player) {
      setCurrentPlayer(player);
      const index = unsoldPlayers.findIndex(p => p.id === player.id);
      setCurrentPlayerIndex(index >= 0 ? index : 0);
      setExplicitlyUnsold(false);
      setShowSearchResults(false);
      // Blur the search input after selection
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
    }
  };

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedSearchIndex(-1);
  }, [searchResults]);

  const handlePurchasedPlayersClick = async (team) => {
    const playerCount = parseInt(team.players_count) || 0;
    if (!team || playerCount === 0) {
      return;
    }

    try {
      setSelectedTeam(team);
      const response = await axios.get(`${API_URL}/players?team_id=${team.id}&status=sold`);
      setTeamPlayers(response.data);
      setShowPurchasedPlayersPopup(true);
    } catch (error) {
      console.error('Error fetching team players:', error);
      alert('Error fetching purchased players: ' + error.message);
    }
  };

  const handleSold = async (teamId, amount, range) => {
    if (!currentPlayer) return;
    
    try {
      setLoading(true);
      await axios.post(`${API_URL}/players/${currentPlayer.id}/sell`, {
        team_id: parseInt(teamId),
        amount: parseInt(amount),
        range: range || null
      });
      
      // Reload unsold players list and land on previous player (same index or index - 1)
      const updatedUnsoldPlayers = await loadUnsoldPlayers();
      if (updatedUnsoldPlayers.length > 0) {
        const targetIndex = Math.max(0, currentPlayerIndex - 1);
        const player = await fetchPlayerDetails(updatedUnsoldPlayers[targetIndex].id);
        setCurrentPlayer(player);
        setCurrentPlayerIndex(targetIndex);
      } else {
        setCurrentPlayer(null);
        setCurrentPlayerIndex(-1);
      }
      
      setExplicitlyUnsold(false);
      setShowSoldPopup(false);
      
      // Fetch fresh teams and refresh bid tiers and ranges
      let freshTeams = teams;
      try {
        const teamsResponse = await axios.get(`${API_URL}/teams`);
        freshTeams = teamsResponse.data || [];
      } catch (error) {
        console.error('Error fetching fresh teams:', error);
      }
      
      onTeamsChange();
      if (playSoldAudio) {
        playSoldAudio();
      }
      // Refresh team ranges and bid tiers after sale
      await fetchTeamRanges(freshTeams);
      await calculateTeamBidTiers(freshTeams);
      if (bundleRanges.length > 0 && freshTeams.length > 0) {
        await fetchAllTeamWonRanges();
      }
    } catch (error) {
      alert('Error selling player: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleBundle = async (teamId, amount) => {
    if (!currentPlayer) return;
    
    try {
      setLoading(true);
      await axios.post(`${API_URL}/players/${currentPlayer.id}/sell`, {
        team_id: parseInt(teamId),
        amount: parseInt(amount),
        sale_method: 'bundle'
      });
      
      setShowBundlePopup(false);
      
      // Reload unsold players list and land on previous player
      const updatedUnsoldPlayers = await loadUnsoldPlayers();
      if (updatedUnsoldPlayers.length > 0) {
        const targetIndex = Math.max(0, currentPlayerIndex - 1);
        const player = await fetchPlayerDetails(updatedUnsoldPlayers[targetIndex].id);
        setCurrentPlayer(player);
        setCurrentPlayerIndex(targetIndex);
      } else {
        setCurrentPlayer(null);
        setCurrentPlayerIndex(-1);
      }
      
      setExplicitlyUnsold(false);
      
      let freshTeams = teams;
      try {
        const teamsResponse = await axios.get(`${API_URL}/teams`);
        freshTeams = teamsResponse.data || [];
      } catch (error) {
        console.error('Error fetching fresh teams:', error);
      }
      
      onTeamsChange();
      if (playSoldAudio) {
        playSoldAudio();
      }
      await fetchTeamRanges(freshTeams);
      await calculateTeamBidTiers(freshTeams);
      if (bundleRanges.length > 0 && freshTeams.length > 0) {
        await fetchAllTeamWonRanges();
      }
    } catch (error) {
      alert('Error selling player (bundle): ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUnsold = async () => {
    if (!currentPlayer) return;
    
    try {
      setLoading(true);
      await axios.post(`${API_URL}/players/${currentPlayer.id}/unsold`);
      
      const updatedPlayer = await fetchPlayerDetails(currentPlayer.id);
      setCurrentPlayer(updatedPlayer);
      setExplicitlyUnsold(true);
      // Reload unsold players list
      await loadUnsoldPlayers();
      onTeamsChange();
      if (playUnsoldAudio) {
        playUnsoldAudio();
      }
    } catch (error) {
      console.error('Unsold error:', error);
      if (error.response?.status === 404) {
        alert('Error: The unsold endpoint was not found. Please restart the server to load the new route.');
      } else {
        alert('Error marking player as unsold: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentPlayer || !editTeamId || !editBidAmount) {
      alert('Please select a team and enter a bid amount');
      return;
    }

    const bidAmount = parseInt(editBidAmount);
    const minBid = 10;
    const maxBid = 200;

    // Get team's current bid range counts
    const bidTier = teamBidTiers[parseInt(editTeamId)];
    const oldTeamId = currentPlayer.team_id ? parseInt(currentPlayer.team_id) : null;
    const isSameTeam = oldTeamId && parseInt(editTeamId) === oldTeamId;
    
    if (bidTier) {
      const oldBidAmount = parseInt(currentPlayer.sold_price) || 0;
      
      // If editing the same team, exclude current player's old bid from counts
      // If changing teams, check new team's restrictions normally
      let range150to200 = bidTier.range150to200 || 0;
      let range120to150 = bidTier.range120to150 || 0;
      let range100to120 = bidTier.range100to120 || 0;
      let top3Count = bidTier.top3Count;
      
      if (isSameTeam && oldBidAmount > 0) {
        // Subtract old bid from counts since we're updating the same team
        if (oldBidAmount >= 151 && oldBidAmount <= 200) {
          range150to200 = Math.max(0, range150to200 - 1);
        } else if (oldBidAmount >= 121 && oldBidAmount <= 150) {
          range120to150 = Math.max(0, range120to150 - 1);
        } else if (oldBidAmount >= 101 && oldBidAmount <= 120) {
          range100to120 = Math.max(0, range100to120 - 1);
        }
        top3Count = Math.max(0, top3Count - (oldBidAmount >= 100 ? 1 : 0));
      }
      
      // Restriction only applies if team has purchased at least 1 player in EACH of A, B, and C ranges (all three slots filled)
      const hasFilledAllThreeRanges = range150to200 >= 1 && range120to150 >= 1 && range100to120 >= 1;
      if (hasFilledAllThreeRanges && top3Count >= 3) {
        if (bidAmount < 10 || bidAmount > 100) {
          setEditBidError('This team has already purchased 1 player in each of A, B, and C ranges. Bids must now be between 10 and 100 only.');
          return;
        }
      } else {
        // Check range limits: max 1 player per range
        if (bidAmount >= 151 && bidAmount <= 200) {
          if (range150to200 >= 1) {
            setEditBidError('This team has already purchased 1 player in the 151-200 range. You can only purchase 1 player in this range.');
            return;
          }
        } else if (bidAmount >= 121 && bidAmount <= 150) {
          if (range120to150 >= 1) {
            setEditBidError('This team has already purchased 1 player in the 121-150 range. You can only purchase 1 player in this range.');
            return;
          }
        } else if (bidAmount >= 101 && bidAmount <= 120) {
          if (range100to120 >= 1) {
            setEditBidError('This team has already purchased 1 player in the 101-120 range. You can only purchase 1 player in this range.');
            return;
          }
        }
      }
    }

    // Validate min/max bid
    if (bidAmount < minBid) {
      setEditBidError(`Bid amount must be at least ${minBid} (minimum bid)`);
      return;
    }
    if (bidAmount > maxBid) {
      setEditBidError(`Bid amount cannot exceed ${maxBid} (maximum bid)`);
      return;
    }

    // Get selected team to check remaining budget
    const selectedTeam = teams.find(t => t.id === parseInt(editTeamId));
    if (selectedTeam) {
      const remainingBudget = parseInt(selectedTeam.budget) - parseInt(selectedTeam.spent);
      if (bidAmount > remainingBudget) {
        setEditBidError(`Bid amount cannot exceed remaining budget of ${remainingBudget.toLocaleString('en-IN')}`);
        return;
      }
    }

    try {
      setLoading(true);
      setEditBidError('');
      
      // Fetch fresh teams before updating
      let freshTeams = teams;
      try {
        const teamsResponse = await axios.get(`${API_URL}/teams`);
        freshTeams = teamsResponse.data || [];
      } catch (error) {
        console.error('Error fetching fresh teams:', error);
      }
      
      const response = await axios.put(`${API_URL}/players/${currentPlayer.id}/update-sold`, {
        team_id: parseInt(editTeamId),
        amount: bidAmount,
        range: editRange.trim() || null
      });

      if (response.data && response.data.player) {
        setCurrentPlayer(response.data.player);
      } else {
        const updatedPlayer = await fetchPlayerDetails(currentPlayer.id);
        setCurrentPlayer(updatedPlayer);
      }
      setExplicitlyUnsold(false);
      setIsEditingSold(false);
      
      // Refresh bid tiers and ranges (using already fetched freshTeams)
      onTeamsChange();
      await fetchTeamRanges(freshTeams);
      await calculateTeamBidTiers(freshTeams);
    } catch (error) {
      alert('Error updating player: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingSold(false);
    setEditTeamId('');
    setEditBidAmount('');
    setEditRange('');
    setEditBidError('');
  };

  // Navigate through unsold players only
  const handleNext = async () => {
    if (!currentPlayer || unsoldPlayers.length === 0) return;
    
    try {
      setLoading(true);
      const nextIndex = currentPlayerIndex + 1;
      if (nextIndex < unsoldPlayers.length) {
        const player = await fetchPlayerDetails(unsoldPlayers[nextIndex].id);
        setCurrentPlayer(player);
        setCurrentPlayerIndex(nextIndex);
        setExplicitlyUnsold(false);
      } else {
        alert('No more unsold players');
      }
    } catch (error) {
      alert('Error loading next player: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = async () => {
    if (!currentPlayer || unsoldPlayers.length === 0) return;
    
    try {
      setLoading(true);
      const prevIndex = currentPlayerIndex - 1;
      if (prevIndex >= 0) {
        const player = await fetchPlayerDetails(unsoldPlayers[prevIndex].id);
        setCurrentPlayer(player);
        setCurrentPlayerIndex(prevIndex);
        setExplicitlyUnsold(false);
      } else {
        alert('No previous unsold player found');
      }
    } catch (error) {
      alert('Error loading previous player: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Extract name from email (remove @ideas2it.com) and format with Employee ID and Category
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

  // Convert text to Title Case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getPlayerCategory = (player) => {
    if (!player) return '';
    if (player.category && player.category.trim() !== '') {
      return toTitleCase(player.category.trim());
    }
    return '';
  };

  // Highlight search term in text (highlights all occurrences)
  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    
    const searchLower = searchTerm.toLowerCase();
    const textLower = text.toLowerCase();
    const parts = [];
    let lastIndex = 0;
    let index = textLower.indexOf(searchLower, lastIndex);
    
    while (index !== -1) {
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }
      
      parts.push(
        <span key={index} className="search-highlight">
          {text.substring(index, index + searchTerm.length)}
        </span>
      );
      
      lastIndex = index + searchTerm.length;
      index = textLower.indexOf(searchLower, lastIndex);
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? <>{parts}</> : text;
  };

  if (!currentPlayer) {
    return (
      <div className="card">
        <p style={{ textAlign: 'center' }}>No unsold players found</p>
      </div>
    );
  }

  const playerNameAndId = getPlayerNameAndId(currentPlayer);
  const playerCategory = getPlayerCategory(currentPlayer);

  // Split teams into left (first 4) and right (last 4)
  const leftTeams = teams.slice(0, 4);
  const rightTeams = teams.slice(4, 8);

  return (
    <div className="auction-dashboard-new">
      {/* Main Layout: Left Teams | Center Player | Right Teams */}
      <div className="dashboard-layout-three-column">
        {/* Left Side - First 4 Teams */}
        <div className="teams-sidebar-left">
          <div className="teams-list-vertical">
            {leftTeams.map((team) => {
              const wonRangeLetters = teamWonRanges[team.id] || [];
              const hasMoreThanThree = wonRangeLetters.length > 3;
              const displayRanges = hasMoreThanThree ? wonRangeLetters.slice(0, 3) : wonRangeLetters;
              
              // Get ranges from player sales (now objects with range and bidAmount)
              const saleRanges = teamRanges[team.id] || [];
              const hasMoreThanThreeSaleRanges = saleRanges.length > 3;
              const displaySaleRanges = hasMoreThanThreeSaleRanges ? saleRanges.slice(0, 3) : saleRanges;
              
              // Get all range letters for tooltip
              const allRangeLetters = saleRanges.map(r => r.range).join(', ');
              
              return (
              <div key={team.id} className="team-summary-card">
                <div className="team-summary-name">
                  {team.name}
                  {wonRangeLetters.length > 0 && (
                    <span className="team-won-ranges">
                      {' '}({displayRanges.join(', ')})
                      {hasMoreThanThree && (
                        <span 
                          className="won-ranges-more-icon" 
                          title={`Won in Ranges: ${wonRangeLetters.join(', ')}`}
                          data-tooltip={`Won in Ranges: ${wonRangeLetters.join(', ')}`}
                        >
                          {' '}...
                        </span>
                      )}
                    </span>
                  )}
                  {saleRanges.length > 0 && (
                    <span className="team-sale-ranges">
                      {' '}[
                      {displaySaleRanges.map((rangeItem, idx) => {
                        const colorClass = getBidAmountColorClass(rangeItem.bidAmount);
                        return (
                          <span key={idx}>
                            {idx > 0 && ', '}
                            <span className={colorClass}>{rangeItem.range}</span>
                          </span>
                        );
                      })}
                      ]
                      {hasMoreThanThreeSaleRanges && (
                        <span 
                          className="sale-ranges-more-icon" 
                          title={`Ranges: ${allRangeLetters}`}
                          data-tooltip={`Ranges: ${allRangeLetters}`}
                        >
                          {' '}...
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="team-summary-details">
                  <div className="team-summary-detail-item">
                    <span className="detail-label">Total Bid:</span>
                    <span className="detail-value">{parseInt(team.budget).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="team-summary-detail-item">
                    <span className="detail-label">Purchased Player:</span>
                    <span 
                      className={`detail-value ${(parseInt(team.players_count) || 0) > 0 ? 'clickable' : ''}`}
                      onClick={() => handlePurchasedPlayersClick(team)}
                      style={{ cursor: (parseInt(team.players_count) || 0) > 0 ? 'pointer' : 'default' }}
                      title={(parseInt(team.players_count) || 0) > 0 ? 'Click to view purchased players' : ''}
                    >
                      {team.players_count}
                    </span>
                  </div>
                  <div className="team-summary-detail-item">
                    <span className="detail-label">Remaining Bid:</span>
                    <span className="detail-value">{(parseInt(team.budget) - parseInt(team.spent)).toLocaleString('en-IN')}</span>
                  </div>
                  {team.wise_captain && (
                    <div className="team-summary-detail-item">
                      <span className="detail-label">Wise Captain:</span>
                      <span className="detail-value">{team.wise_captain}</span>
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        </div>

        {/* Center - Player Display */}
        <div className="center-content">
          {/* Search Bar */}
          {!isEditingSold && (
          <div className="player-search-container" ref={searchContainerRef}>
            <input
              ref={searchInputRef}
              type="text"
              className="player-search-input"
              placeholder="Search unsold player by name or email..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => {
                if (searchQuery && searchResults.length > 0) {
                  setShowSearchResults(true);
                }
                e.target.focus();
              }}
              onBlur={(e) => {
                setTimeout(() => {
                  if (!searchContainerRef.current?.contains(document.activeElement)) {
                    setShowSearchResults(false);
                    setSelectedSearchIndex(-1);
                  }
                }, 200);
              }}
              disabled={loading}
              autoComplete="off"
            />
            {showSearchResults && searchQuery && searchResults.length > 0 && (
              <div className="search-results-info">
                <div className="search-results-count">
                  Found {searchResults.length} unsold player{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.length > 0 && (
                  <div className="search-results-list">
                    {searchResults.slice(0, 5).map((player, index) => {
                      const playerName = toTitleCase((player.name?.replace(/@.*$/, '').replace(/\./g, ' ') || player.name?.replace(/\./g, ' ')) || player.name);
                      const isSelected = selectedSearchIndex === index;
                      return (
                        <button
                          key={player.id}
                          type="button"
                          className={`search-result-item ${currentPlayer?.id === player.id ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSearchResult(player.id);
                          }}
                          onMouseEnter={() => setSelectedSearchIndex(index)}
                        >
                          {highlightSearchTerm(playerName, searchQuery)}
                        </button>
                      );
                    })}
                    {searchResults.length > 5 && (
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', paddingTop: '0.25rem', fontStyle: 'italic' }}>
                        ... and {searchResults.length - 5} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {showSearchResults && searchQuery && searchResults.length === 0 && !loading && (
              <div className="search-results-count no-results">
                No unsold players found
              </div>
            )}
          </div>
          )}
          
          <div className={`card current-player-card-new ${isEditingSold ? 'editing-mode' : ''}`}>
            <div className="player-display">
              <div className="player-name-large">{playerNameAndId}</div>
              {playerCategory && (
                <div className="player-category">{playerCategory}</div>
              )}
              
              <div className="player-info-section">
                {currentPlayer.employee_id && (
                  <div className="player-image-container">
                    <img 
                      key={`visible-${currentPlayer.employee_id}-${loadedImageUrl ? 'loaded' : 'placeholder'}`}
                      src={loadedImageUrl || placeholderImage}
                      alt={playerNameAndId}
                      className="player-image"
                    />
                    <img
                      key={`preloader-${currentPlayer.employee_id}-${imageAttempt.protocol}-${imageAttempt.extension}`}
                      src={`${imageAttempt.protocol}://s3-ap-south-1.amazonaws.com/ideas2it/profile_photos/${currentPlayer.employee_id}.${imageAttempt.extension}`}
                      alt=""
                      style={{ display: 'none' }}
                      onLoad={(e) => {
                        setLoadedImageUrl(e.target.src);
                        setShowPlaceholder(false);
                      }}
                      onError={(e) => {
                        const nextAttempt = getNextImageAttempt(imageAttempt);
                        if (nextAttempt) {
                          setImageAttempt(nextAttempt);
                        }
                      }}
                    />
                  </div>
                )}
                
                <div className="player-details-right">
                  {currentPlayer.base_price && (
                    <div className="base-price-display">
                      <span className="base-price-label">Base Price:</span>
                      <span className="base-price-value">{parseInt(currentPlayer.base_price).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  
                  {currentPlayer.status === 'sold' ? (
                <div className="sold-info">
                  <div className="sold-header">
                    <span className="sold-badge">
                      SOLD{currentPlayer.sale_method === 'bundle' ? ' (Bundle)' : ''}
                    </span>
                    {!isEditingSold && userRole === 'admin' && (
                      <button
                        className="edit-sold-btn"
                        onClick={() => setIsEditingSold(true)}
                        disabled={loading}
                        title="Edit sold details"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8.75 2.625L11.375 5.25L4.375 12.25H1.75V9.625L8.75 2.625ZM9.625 1.75L11.375 0L13.125 1.75L11.375 3.5L9.625 1.75Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {isEditingSold ? (
                    <div className="sold-edit-form">
                      <div className="edit-form-group">
                        <label>Team:</label>
                        <select
                          value={editTeamId}
                          onChange={(e) => setEditTeamId(e.target.value)}
                          className="edit-select"
                        >
                          <option value="">Select Team</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="edit-form-group">
                        <label>Bid Amount:</label>
                        <div className="edit-bid-range-row">
                          <input
                            type="number"
                            value={editBidAmount}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditBidAmount(value);
                              // Auto-set range based on bid amount, or clear if empty/invalid
                              const autoRange = getRangeFromBid(value);
                              setEditRange(autoRange || '');
                              const bidAmount = parseInt(value) || 0;
                              const minBid = 10;
                              const maxBid = 200;
                              if (value) {
                                if (bidAmount < minBid) {
                                  setEditBidError(`Bid amount must be at least ${minBid} (minimum bid)`);
                                } else if (bidAmount > maxBid) {
                                  setEditBidError(`Bid amount cannot exceed ${maxBid} (maximum bid)`);
                                } else {
                                  setEditBidError('');
                                }
                              } else {
                                setEditBidError('');
                              }
                            }}
                            className={`edit-input edit-input-bid ${editBidError ? 'edit-input-error' : ''}`}
                            placeholder="Amount"
                            min={10}
                            max={200}
                          />
                          <input
                            type="text"
                            value={editRange}
                            readOnly
                            className="edit-input edit-input-range"
                            placeholder="Range (auto-set from bid)"
                            style={{ display: 'none' }}
                          />
                        </div>
                        {editBidError && (
                          <span className="edit-error-message">{editBidError}</span>
                        )}
                      </div>
                      <div className="edit-form-actions">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={handleSaveEdit}
                          disabled={loading || !editTeamId || !editBidAmount || !!editBidError}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={handleCancelEdit}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="sold-details">
                      <strong>Team:</strong> {currentPlayer.team_name || 'N/A'}
                      <br />
                      <strong>Bid:</strong> {
                        currentPlayer.sale_method === 'alot' 
                          ? '0' 
                          : currentPlayer.sold_price 
                            ? parseInt(currentPlayer.sold_price).toLocaleString('en-IN') 
                            : 'N/A'
                      }
                    </div>
                  )}
                </div>
              ) : currentPlayer.status === 'unsold' || explicitlyUnsold ? (
                <div className="unsold-info">
                  <span className="unsold-badge">UNSOLD</span>
                </div>
              ) : currentPlayer.status === 'available' || (!currentPlayer.status || (currentPlayer.status !== 'sold' && currentPlayer.status !== 'unsold')) ? (
                <div className="available-info">
                  <span className="available-badge">AVAILABLE</span>
                </div>
              ) : null}
                </div>
              </div>
            </div>

            <div className="action-buttons">
              <div className="action-buttons-row-single">
                <button
                  className="btn btn-secondary action-btn nav-btn"
                  onClick={handlePrev}
                  disabled={loading || userRole !== 'admin' || currentPlayerIndex <= 0}
                >
                  ← Prev
                </button>
                <div className="action-buttons-center">
                  <button
                    className="btn btn-success action-btn"
                    onClick={() => setShowSoldPopup(true)}
                    disabled={loading || currentPlayer.status === 'sold' || userRole !== 'admin'}
                  >
                    {currentPlayer.status === 'sold' ? 'Sold' : 'Sell'}
                  </button>
                  <button
                    className="btn btn-primary action-btn"
                    onClick={() => setShowBundlePopup(true)}
                    disabled={loading || currentPlayer.status === 'sold' || userRole !== 'admin'}
                  >
                    Bundle
                  </button>
                  <button
                    className="btn btn-danger action-btn"
                    onClick={handleUnsold}
                    disabled={loading || userRole !== 'admin' || explicitlyUnsold || currentPlayer?.status === 'unsold'}
                  >
                    Unsold
                  </button>
                </div>
                <button
                  className="btn btn-secondary action-btn nav-btn"
                  onClick={handleNext}
                  disabled={loading || userRole !== 'admin' || currentPlayerIndex >= unsoldPlayers.length - 1}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Last 4 Teams */}
        <div className="teams-sidebar-right">
          <div className="teams-list-vertical">
            {rightTeams.map((team) => {
              const wonRangeLetters = teamWonRanges[team.id] || [];
              const hasMoreThanThree = wonRangeLetters.length > 3;
              const displayRanges = hasMoreThanThree ? wonRangeLetters.slice(0, 3) : wonRangeLetters;
              
              // Get ranges from player sales (now objects with range and bidAmount)
              const saleRanges = teamRanges[team.id] || [];
              const hasMoreThanThreeSaleRanges = saleRanges.length > 3;
              const displaySaleRanges = hasMoreThanThreeSaleRanges ? saleRanges.slice(0, 3) : saleRanges;
              
              // Get all range letters for tooltip
              const allRangeLetters = saleRanges.map(r => r.range).join(', ');
              
              return (
              <div key={team.id} className="team-summary-card">
                <div className="team-summary-name">
                  {team.name}
                  {wonRangeLetters.length > 0 && (
                    <span className="team-won-ranges">
                      {' '}({displayRanges.join(', ')})
                      {hasMoreThanThree && (
                        <span 
                          className="won-ranges-more-icon" 
                          title={`Won in Ranges: ${wonRangeLetters.join(', ')}`}
                          data-tooltip={`Won in Ranges: ${wonRangeLetters.join(', ')}`}
                        >
                          {' '}...
                        </span>
                      )}
                    </span>
                  )}
                  {saleRanges.length > 0 && (
                    <span className="team-sale-ranges">
                      {' '}[
                      {displaySaleRanges.map((rangeItem, idx) => {
                        const colorClass = getBidAmountColorClass(rangeItem.bidAmount);
                        return (
                          <span key={idx}>
                            {idx > 0 && ', '}
                            <span className={colorClass}>{rangeItem.range}</span>
                          </span>
                        );
                      })}
                      ]
                      {hasMoreThanThreeSaleRanges && (
                        <span 
                          className="sale-ranges-more-icon" 
                          title={`Ranges: ${allRangeLetters}`}
                          data-tooltip={`Ranges: ${allRangeLetters}`}
                        >
                          {' '}...
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="team-summary-details">
                  <div className="team-summary-detail-item">
                    <span className="detail-label">Total Bid:</span>
                    <span className="detail-value">{parseInt(team.budget).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="team-summary-detail-item">
                    <span className="detail-label">Purchased Player:</span>
                    <span 
                      className={`detail-value ${(parseInt(team.players_count) || 0) > 0 ? 'clickable' : ''}`}
                      onClick={() => handlePurchasedPlayersClick(team)}
                      style={{ cursor: (parseInt(team.players_count) || 0) > 0 ? 'pointer' : 'default' }}
                      title={(parseInt(team.players_count) || 0) > 0 ? 'Click to view purchased players' : ''}
                    >
                      {team.players_count}
                    </span>
                  </div>
                  <div className="team-summary-detail-item">
                    <span className="detail-label">Remaining Bid:</span>
                    <span className="detail-value">{(parseInt(team.budget) - parseInt(team.spent)).toLocaleString('en-IN')}</span>
                  </div>
                  {team.wise_captain && (
                    <div className="team-summary-detail-item">
                      <span className="detail-label">Wise Captain:</span>
                      <span className="detail-value">{team.wise_captain}</span>
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </div>

      {showSoldPopup && (
        <SoldPopup
          player={currentPlayer}
          teams={teams}
          teamBidTiers={teamBidTiers}
          onClose={() => setShowSoldPopup(false)}
          onSave={handleSold}
        />
      )}

      {showBundlePopup && (
        <BundlePopup
          player={currentPlayer}
          teams={teams}
          onClose={async () => {
            setShowBundlePopup(false);
            onTeamsChange();
            setTimeout(async () => {
              onTeamsChange();
              if (bundleRanges.length > 0 && teams.length > 0) {
                await fetchAllTeamWonRanges();
              }
            }, 500);
          }}
          onSave={handleBundle}
          userRole={userRole}
          playSoldAudio={playSoldAudio}
        />
      )}

      {showPurchasedPlayersPopup && (
        <PurchasedPlayersPopup
          team={selectedTeam}
          players={teamPlayers}
          onClose={() => {
            setShowPurchasedPlayersPopup(false);
            setSelectedTeam(null);
            setTeamPlayers([]);
          }}
          onSyncCount={async () => {
            // Refresh teams after sync
            await onTeamsChange();
            // Re-fetch players for the current team
            if (selectedTeam) {
              try {
                const response = await axios.get(`${API_URL}/players?team_id=${selectedTeam.id}&status=sold`);
                setTeamPlayers(response.data);
              } catch (error) {
                console.error('Error refreshing team players:', error);
              }
            }
          }}
        />
      )}
    </div>
  );
}

export default UnsoldAuctionDashboard;
