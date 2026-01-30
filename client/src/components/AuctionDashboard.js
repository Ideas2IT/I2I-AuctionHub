import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SoldPopup from './SoldPopup';
import BundlePopup from './BundlePopup';
import PurchasedPlayersPopup from './PurchasedPlayersPopup';
import './AuctionDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const S3_PROFILE_PHOTOS_BASE = (process.env.REACT_APP_S3_PROFILE_PHOTOS_BASE_URL || '').replace(/\/$/, '');

function AuctionDashboard({
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
  const [teamWonRanges, setTeamWonRanges] = useState({}); // { teamId: ['A', 'B', 'C', ...] } - stores range letters directly
  const [teamRanges, setTeamRanges] = useState({}); // { teamId: [{range: 'A', bidAmount: 180}, ...] } - stores ranges with bid amounts from player sales
  const [teamBidTiers, setTeamBidTiers] = useState({}); // { teamId: { tier: 1|2|3|4, highestBid: number, top3Count: number } }
  const [imageAttempt, setImageAttempt] = useState({ protocol: 'https', extension: 'PNG' }); // Track current image URL attempt
  const [, setShowPlaceholder] = useState(true); // Start with placeholder visible
  const [loadedImageUrl, setLoadedImageUrl] = useState(null); // Track successfully loaded image URL
  const [playerProgress, setPlayerProgress] = useState({ total: 0, completed: 0 }); // total and sold count (excl. lot) for centre display

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
    setShowPlaceholder(true); // Start with placeholder visible
    setLoadedImageUrl(null); // Reset loaded image URL
  }, [currentPlayer?.id]);

  // Gray person placeholder image (SVG data URI)
  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

  // Function to get next image URL attempt
  const getNextImageAttempt = (currentAttempt) => {
    const protocols = ['https', 'http'];
    const extensions = ['PNG', 'JPG', 'jpg'];
    
    // Find current index
    const protocolIndex = protocols.indexOf(currentAttempt.protocol);
    const extensionIndex = extensions.indexOf(currentAttempt.extension);
    
    // Try next extension first
    if (extensionIndex < extensions.length - 1) {
      return {
        protocol: currentAttempt.protocol,
        extension: extensions[extensionIndex + 1]
      };
    }
    // If all extensions tried, try next protocol
    if (protocolIndex < protocols.length - 1) {
      return {
        protocol: protocols[protocolIndex + 1],
        extension: extensions[0] // Reset to first extension
      };
    }
    // All combinations tried
    return null;
  };

  const fetchPlayerProgress = async () => {
    try {
      const response = await axios.get(`${API_URL}/players`);
      const all = response.data || [];
      const nonLot = all.filter(p => !p.is_lot_details);
      const completed = nonLot.filter(p => p.status === 'sold').length;
      setPlayerProgress({ total: nonLot.length, completed });
    } catch (error) {
      console.error('Error fetching player progress:', error);
    }
  };

  useEffect(() => {
    loadFirstPlayer();
    fetchBundleRanges();
    fetchPlayerProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard navigation for player navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger if any popup is open or user is editing
      if (showSoldPopup || showBundlePopup || isEditingSold) {
        return;
      }

      // Don't trigger if user is typing in an input field, textarea, or contenteditable
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable ||
        event.target.closest('input') ||
        event.target.closest('textarea')
      ) {
        return;
      }

      // Up arrow or Right arrow for Next player
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentPlayer) {
          handleNext();
        }
      }
      // Down arrow or Left arrow for Previous player
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
  }, [currentPlayer, showSoldPopup, showBundlePopup, isEditingSold]); // Re-run when currentPlayer or popup states change

  // Fetch won ranges for all teams when bundle ranges are loaded or teams change
  // Use a ref to track teams data changes (not just length) to catch budget/spent updates
  const teamsHashRef = useRef('');
  
  useEffect(() => {
    if (teams && teams.length > 0) {
      // Fetch team ranges (from player sales)
      fetchTeamRanges();
      // Calculate team bid tiers
      calculateTeamBidTiers();
      
      if (bundleRanges.length > 0) {
        // Create a hash of teams data to detect changes in budget/spent, not just length
        const teamsHash = teams.map(t => `${t.id}:${t.budget}:${t.spent}`).join('|');
        
        // Only fetch if teams data actually changed (not just on initial load)
        if (teamsHashRef.current !== teamsHash) {
          console.log('useEffect triggered: teams data changed, bundleRanges.length =', bundleRanges.length, 'teams.length =', teams.length);
          teamsHashRef.current = teamsHash;
          fetchAllTeamWonRanges();
        } else if (teamsHashRef.current === '') {
          // Initial load
          console.log('useEffect triggered: initial load, bundleRanges.length =', bundleRanges.length, 'teams.length =', teams.length);
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
      console.log('fetchAllTeamWonRanges: No teams available');
      return;
    }
    if (bundleRanges.length === 0) {
      console.log('fetchAllTeamWonRanges: No bundle ranges available');
      return;
    }
    
    console.log('fetchAllTeamWonRanges: Starting fetch for', teams.length, 'teams');
    const wonRangesMap = {};
    for (const team of teams) {
      try {
        const response = await axios.get(`${API_URL}/bundle/participation/team/${team.id}`);
        console.log(`Team ${team.id} (${team.name}) API response:`, response.data);
        
        // Handle response - could be array or object with participations property (wrong endpoint)
        let participations = [];
        if (Array.isArray(response.data)) {
          participations = response.data;
        } else if (response.data && response.data.participations && Array.isArray(response.data.participations)) {
          // Wrong endpoint was called (returned object instead of array)
          console.warn(`Team ${team.id}: Received object response instead of array. Wrong endpoint may have been called.`);
          participations = response.data.participations;
        } else {
          participations = [];
        }
        console.log(`Team ${team.id} participations:`, participations);
        
        // Filter only won participations
        const wonParticipations = participations.filter(p => p && p.result === 'won' && p.range_id);
        console.log(`Team ${team.id} won participations:`, wonParticipations);
        
        // Get unique range letters (prefer range_letter from API, fallback to lookup)
        const wonRangeLetters = [...new Set(
          wonParticipations.map(p => {
            // Use range_letter from API response if available, otherwise lookup
            if (p.range_letter) {
              return p.range_letter.toUpperCase();
            }
            const range = bundleRanges.find(r => r.id === p.range_id);
            return range?.range_letter?.toUpperCase() || '';
          })
          .filter(letter => letter !== '')
        )].sort(); // Sort alphabetically for consistent display
        
        console.log(`Team ${team.id} won range letters:`, wonRangeLetters);
        wonRangesMap[team.id] = wonRangeLetters;
      } catch (error) {
        console.error(`Error fetching won ranges for team ${team.id} (${team.name}):`, error);
        console.error('Error details:', error.response?.data || error.message);
        wonRangesMap[team.id] = [];
      }
    }
    console.log('Team won ranges updated (final map):', wonRangesMap);
    setTeamWonRanges(wonRangesMap);
  };

  // Calculate team bid tiers based on range counts
  const calculateTeamBidTiers = async (teamsToUse = null) => {
    let teamsList = teamsToUse || teams;
    
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
    
    // Get bid counts per range for each team
    for (const team of teamsList) {
      try {
        const response = await axios.get(`${API_URL}/players?team_id=${team.id}&status=sold`);
        const soldPlayers = response.data || [];
        
        if (soldPlayers.length === 0) {
          teamBidData[team.id] = { 
            tier: 4, 
            highestBid: 0, 
            top3Count: 0,
            range150to200: 0,
            range120to150: 0,
            range100to120: 0
          };
          continue;
        }
        
        // Get all bid amounts (excluding lot sales)
        const bidAmounts = soldPlayers
          .filter(p => p.sale_method !== 'alot' && p.sold_price)
          .map(p => parseInt(p.sold_price) || 0);
        
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

  // Get color class for range based on team bid tier (for overall container)
  const getRangeColorClass = (teamId) => {
    return 'team-sale-ranges';
  };

  // Get icon color class for range based on team bid tier
  const getRangeIconColorClass = (teamId) => {
    const bidTier = teamBidTiers[teamId];
    if (!bidTier) return '';
    
    switch (bidTier.tier) {
      case 1:
        return 'tier-1-violet';
      case 2:
        return 'tier-2-ivory';
      case 3:
        return 'tier-3-blue';
      default:
        return '';
    }
  };

  // Fetch ranges for all teams (from player sales)
  const fetchTeamRanges = async (teamsToUse = null) => {
    // Use provided teams or fetch fresh teams
    let teamsList = teamsToUse || teams;
    
    // If no teams provided and state teams are empty, fetch fresh
    if (!teamsList || teamsList.length === 0) {
      try {
        const teamsResponse = await axios.get(`${API_URL}/teams`);
        teamsList = teamsResponse.data || [];
      } catch (error) {
        console.error('Error fetching teams for ranges:', error);
        return;
      }
    }
    
    if (!teamsList || teamsList.length === 0) {
      return;
    }
    
    const rangesMap = {};
    for (const team of teamsList) {
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

  const loadFirstPlayer = async () => {
    try {
      // First try to load an available player (exclude lot players)
      const availableResponse = await axios.get(`${API_URL}/players?status=available`);
      const availablePlayers = (availableResponse.data || []).filter(p => !p.is_lot_details);
      if (availablePlayers.length > 0) {
        const player = await fetchPlayerDetails(availablePlayers[0].id);
        if (player && !player.is_lot_details) {
          setCurrentPlayer(player);
          setExplicitlyUnsold(false);
          return;
        }
      }
      
      // If no available players, try unsold (exclude lot players)
      const unsoldResponse = await axios.get(`${API_URL}/players?status=unsold`);
      const unsoldPlayers = (unsoldResponse.data || []).filter(p => !p.is_lot_details);
      if (unsoldPlayers.length > 0) {
        const player = await fetchPlayerDetails(unsoldPlayers[0].id);
        if (player && !player.is_lot_details) {
          setCurrentPlayer(player);
          setExplicitlyUnsold(false);
          return;
        }
      }
      
      // If no available or unsold players, get first player (exclude lot players)
      const allResponse = await axios.get(`${API_URL}/players`);
      const allPlayers = (allResponse.data || []).filter(p => !p.is_lot_details);
      if (allPlayers.length > 0) {
        const player = await fetchPlayerDetails(allPlayers[0].id);
        if (player && !player.is_lot_details) {
          setCurrentPlayer(player);
          setExplicitlyUnsold(false);
        }
      }
    } catch (error) {
      console.error('Error loading first player:', error);
    }
  };

  const fetchPlayerDetails = async (playerId) => {
    try {
      const response = await axios.get(`${API_URL}/players/${playerId}`);
      const player = response.data;
      // Skip lot players - they should not appear in AuctionDashboard
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
      const response = await axios.get(`${API_URL}/players?search=${encodeURIComponent(query)}`);
      // Filter out lot players from search results
      const filteredResults = (response.data || []).filter(p => !p.is_lot_details);
      setSearchResults(filteredResults);
      setShowSearchResults(true);
      
      // Store cursor position before state update
      const cursorPosition = searchInputRef.current?.selectionStart || 0;
      
      // If there are results, show the first one
      if (filteredResults.length > 0) {
        const player = await fetchPlayerDetails(filteredResults[0].id);
        if (player) {
          setCurrentPlayer(player);
          setExplicitlyUnsold(false);
        }
      } else {
        // No results found, keep current player visible
        // Don't set to null to avoid showing "Loading player..."
      }
      
      // Restore cursor position and focus after state update
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
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // If search is cleared, reload first player
    if (!value || value.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      loadFirstPlayer();
    } else {
      // Debounce search to avoid too many API calls and maintain focus
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value);
      }, 300);
    }
    
    // Restore cursor position immediately after state update
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
    const player = await fetchPlayerDetails(playerId);
    if (player) {
      setCurrentPlayer(player);
      setExplicitlyUnsold(false);
      setShowSearchResults(false);
      setSelectedSearchIndex(-1);
      // Clear search query when a result is selected
      setSearchQuery('');
      setSearchResults([]);
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
      
      const updatedPlayer = await fetchPlayerDetails(currentPlayer.id);
      setCurrentPlayer(updatedPlayer);
      setExplicitlyUnsold(false);
      setShowSoldPopup(false);
      onTeamsChange();
      await fetchPlayerProgress();
      // Play sold audio
      if (playSoldAudio) {
        playSoldAudio();
      }
      // Refresh team ranges after sale - fetch fresh teams
      try {
        const teamsResponse = await axios.get(`${API_URL}/teams`);
        const freshTeams = teamsResponse.data || [];
        await fetchTeamRanges(freshTeams);
        await calculateTeamBidTiers(freshTeams);
        // Refresh won ranges after sale (in case it was a bundle sale)
        if (bundleRanges.length > 0 && freshTeams.length > 0) {
          await fetchAllTeamWonRanges();
        }
      } catch (error) {
        console.error('Error refreshing team ranges:', error);
        // Fallback to using current teams state
        await fetchTeamRanges();
        await calculateTeamBidTiers();
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
      
      const updatedPlayer = await fetchPlayerDetails(currentPlayer.id);
      setCurrentPlayer(updatedPlayer);
      setShowBundlePopup(false);
      
      // Refresh teams first
      onTeamsChange();
      
      // Note: Audio is now played in BundlePopup when winner is determined, not here
      // Refresh won ranges after bundle sale - wait for participation to be saved and teams to update
      // Use a longer delay to ensure teams are refreshed from parent component
      setTimeout(async () => {
        console.log('Refreshing won ranges after bundle sale...');
        // Force refresh teams data by calling onTeamsChange again to ensure latest data
        onTeamsChange();
        // Wait a bit more for teams to update, then refresh won ranges
        setTimeout(async () => {
          if (bundleRanges.length > 0 && teams.length > 0) {
            await fetchAllTeamWonRanges();
          }
        }, 500);
      }, 1500);
    } catch (error) {
      alert('Error selling player: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUnsold = async () => {
    if (!currentPlayer) return;
    
    try {
      setLoading(true);
      await axios.post(`${API_URL}/players/${currentPlayer.id}/unsold`);
      
      // Always fetch fresh player data to ensure we have the latest state
      const updatedPlayer = await fetchPlayerDetails(currentPlayer.id);
      setCurrentPlayer(updatedPlayer);
      setExplicitlyUnsold(true);
      onTeamsChange();
      // Play unsold audio
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

  const handleSaveEdit = async () => {
    if (!currentPlayer || !editTeamId || !editBidAmount) {
      alert('Please select a team and enter a bid amount');
      return;
    }

    const bidAmount = parseInt(editBidAmount);
    const basePrice = parseInt(currentPlayer.base_price) || 0;

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
        if (bidAmount < 10 || bidAmount >= 100) {
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

    if (bidAmount < basePrice) {
      setEditBidError(`Bid amount must be at least ${basePrice.toLocaleString('en-IN')} (base price)`);
      return;
    }

    try {
      setLoading(true);
      setEditBidError('');
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
      onTeamsChange();
      // Refresh team ranges after edit - fetch fresh teams
      try {
        const teamsResponse = await axios.get(`${API_URL}/teams`);
        const freshTeams = teamsResponse.data || [];
        await fetchTeamRanges(freshTeams);
        await calculateTeamBidTiers(freshTeams);
      } catch (error) {
        console.error('Error refreshing team ranges:', error);
        // Fallback to using current teams state
        await fetchTeamRanges();
        await calculateTeamBidTiers();
      }
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

  const handleNext = async () => {
    if (!currentPlayer) return;
    
    try {
      setLoading(true);
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite loop
      let currentId = currentPlayer.id;
      let nextPlayer = null;
      const checkedIds = new Set(); // Track checked IDs to prevent infinite loops
      
      // Keep trying until we find a non-lot player
      while (attempts < maxAttempts) {
        if (checkedIds.has(currentId)) {
          // Already checked this ID, break to avoid infinite loop
          break;
        }
        checkedIds.add(currentId);
        
        try {
          const response = await axios.get(`${API_URL}/players/navigate/next?currentId=${currentId}`);
          const player = response.data;
          
          // Skip lot players - use this player's ID as new currentId and continue
          if (player.is_lot_details) {
            currentId = player.id;
            attempts++;
            continue;
          }
          
          // Found a non-lot player
          nextPlayer = player;
          break;
        } catch (navError) {
          if (navError.response?.status === 404) {
            // No more players found
            break;
          }
          throw navError;
        }
      }
      
      if (nextPlayer) {
        setCurrentPlayer(nextPlayer);
        setExplicitlyUnsold(false);
      } else {
        alert('No next player found');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        alert('No next player found');
      } else {
        alert('Error loading next player: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = async () => {
    if (!currentPlayer) return;
    
    try {
      setLoading(true);
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite loop
      let currentId = currentPlayer.id;
      let prevPlayer = null;
      const checkedIds = new Set(); // Track checked IDs to prevent infinite loops
      
      // Keep trying until we find a non-lot player
      while (attempts < maxAttempts) {
        if (checkedIds.has(currentId)) {
          // Already checked this ID, break to avoid infinite loop
          break;
        }
        checkedIds.add(currentId);
        
        try {
          const response = await axios.get(`${API_URL}/players/navigate/prev?currentId=${currentId}`);
          const player = response.data;
          
          // Skip lot players - use this player's ID as new currentId and continue
          if (player.is_lot_details) {
            currentId = player.id;
            attempts++;
            continue;
          }
          
          // Found a non-lot player
          prevPlayer = player;
          break;
        } catch (navError) {
          if (navError.response?.status === 404) {
            // No more players found
            break;
          }
          throw navError;
        }
      }
      
      if (prevPlayer) {
        setCurrentPlayer(prevPlayer);
        setExplicitlyUnsold(false);
      } else {
        alert('No previous player found');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        alert('No previous player found');
      } else {
        alert('Error loading previous player: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // Extract name from email (remove @ideas2it.com) and format with Employee ID and Category
  const getPlayerNameAndId = (player) => {
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

  // Convert text to Title Case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getPlayerCategory = (player) => {
    if (!player) return '';
    if (player.category && player.category.trim() !== '') {
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
      // Add text before the match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }
      
      // Add the highlighted match
      parts.push(
        <span key={index} className="search-highlight">
          {text.substring(index, index + searchTerm.length)}
        </span>
      );
      
      lastIndex = index + searchTerm.length;
      index = textLower.indexOf(searchLower, lastIndex);
    }
    
    // Add remaining text after the last match
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? <>{parts}</> : text;
  };

  if (!currentPlayer) {
    return (
      <div className="card">
        <p style={{ textAlign: 'center' }}>Loading player...</p>
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
              const rangeColorClass = getRangeColorClass(team.id);
              
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
                    <span className={rangeColorClass}>
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
                          className={`sale-ranges-more-icon ${getRangeIconColorClass(team.id)}`}
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
          {/* Player progress: completed / to go (highlighted) */}
          <div className="player-progress-bar">
            <span className="player-progress-badge player-progress-completed">
              <span className="player-progress-number">{playerProgress.completed}</span>
              <span className="player-progress-label">completed</span>
            </span>
            <span className="player-progress-sep"> · </span>
            <span className="player-progress-badge player-progress-togo">
              <span className="player-progress-number">{playerProgress.total - playerProgress.completed}</span>
              <span className="player-progress-label">to go</span>
            </span>
          </div>
          {/* Search Bar */}
          {!isEditingSold && (
          <div className="player-search-container" ref={searchContainerRef}>
            <input
              ref={searchInputRef}
              type="text"
              className="player-search-input"
              placeholder="Search player by name or email..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => {
                if (searchQuery && searchResults.length > 0) {
                  setShowSearchResults(true);
                }
                // Ensure focus is maintained
                e.target.focus();
              }}
              onBlur={(e) => {
                // Only blur if clicking outside the search container
                // This prevents blur when clicking on search results
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
                  Found {searchResults.length} player{searchResults.length !== 1 ? 's' : ''}
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
                            e.preventDefault(); // Prevent input blur
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
                No players found
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
                    {/* Visible image - shows placeholder first, then actual image when loaded */}
                    <img 
                      key={`visible-${currentPlayer.employee_id}-${loadedImageUrl ? 'loaded' : 'placeholder'}`}
                      src={loadedImageUrl || placeholderImage}
                      alt={playerNameAndId}
                      className="player-image"
                    />
                    {/* Hidden preloader - tries to load actual image URLs from env-configured S3 base */}
                    {S3_PROFILE_PHOTOS_BASE && (
                    <img
                      key={`preloader-${currentPlayer.employee_id}-${imageAttempt.protocol}-${imageAttempt.extension}`}
                      src={`${S3_PROFILE_PHOTOS_BASE}/${currentPlayer.employee_id}.${imageAttempt.extension}`}
                      alt=""
                      style={{ display: 'none' }}
                      onLoad={(e) => {
                        // Image loaded successfully, use this URL
                        setLoadedImageUrl(e.target.src);
                        setShowPlaceholder(false);
                      }}
                      onError={(e) => {
                        // This URL failed, try next combination
                        const nextAttempt = getNextImageAttempt(imageAttempt);
                        if (nextAttempt) {
                          // Try next combination (different protocol or extension)
                          setImageAttempt(nextAttempt);
                        } else {
                          // All combinations tried, keep placeholder visible
                          // Don't update showPlaceholder - it's already true
                        }
                      }}
                    />
                    )}
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
                              const basePrice = parseInt(currentPlayer.base_price) || 0;
                              if (value && bidAmount < basePrice) {
                                setEditBidError(`Bid amount must be at least ${basePrice.toLocaleString('en-IN')} (base price)`);
                              } else {
                                setEditBidError('');
                              }
                            }}
                            className={`edit-input edit-input-bid ${editBidError ? 'edit-input-error' : ''}`}
                            placeholder="Amount"
                            min={currentPlayer.base_price || 0}
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
                      {currentPlayer.range && (
                        <>
                          <br />
                          <strong>Range:</strong> {currentPlayer.range}
                        </>
                      )}
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
                  disabled={loading || userRole !== 'admin'}
                >
                  ← Prev
                </button>
                <div className="action-buttons-center">
                  <button
                    className="btn btn-success action-btn"
                    onClick={() => setShowSoldPopup(true)}
                    disabled={loading || currentPlayer.status === 'sold' || userRole !== 'admin'}
                  >
                    {currentPlayer.status === 'sold' ? 'Sold' : 'Buy'}
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
                  disabled={loading || userRole !== 'admin'}
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
              const rangeColorClass = getRangeColorClass(team.id);
              
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
                    <span className={rangeColorClass}>
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
                          className={`sale-ranges-more-icon ${getRangeIconColorClass(team.id)}`}
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
            // Refresh teams to ensure latest data
            onTeamsChange();
            // Refresh won ranges after popup closes (participation should be saved by now)
            setTimeout(async () => {
              console.log('Refreshing won ranges after BundlePopup closes...');
              // Refresh teams again to ensure we have latest data
              onTeamsChange();
              // Wait a bit more for teams to update, then refresh won ranges
              setTimeout(async () => {
                if (bundleRanges.length > 0 && teams.length > 0) {
                  await fetchAllTeamWonRanges();
                }
              }, 500);
            }, 1000);
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

export default AuctionDashboard;
