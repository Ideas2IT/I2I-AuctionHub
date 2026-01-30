import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import Login from './components/Login';
import SignUp from './components/SignUp';
import AuctionDashboard from './components/AuctionDashboard';
import UnsoldAuctionDashboard from './components/UnsoldAuctionDashboard';
import TeamManagement from './components/TeamManagement';
import PlayerList from './components/PlayerList';
import BundleAuction from './components/BundleAuction';
import BundleRangesManagement from './components/BundleRangesManagement';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [socket, setSocket] = useState(null);
  const [auctionState, setAuctionState] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [teams, setTeams] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [activeTab, setActiveTab] = useState('auction');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRangesManagement, setShowRangesManagement] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [audioMuted, setAudioMuted] = useState(() => {
    const saved = localStorage.getItem('audioMuted');
    return saved ? JSON.parse(saved) : false;
  });

  // Audio playback functions - preload audio elements for better performance
  const soldAudioRef = useRef(null);
  const unsoldAudioRef = useRef(null);

  // Helper function to load audio with format fallback (WAV, MPEG, MP3)
  const loadAudioWithFallback = (baseName, formats = ['.wav', '.mpeg', '.mp3']) => {
    const tryFormat = (formatIndex) => {
      if (formatIndex >= formats.length) {
        console.error(`❌ Failed to load ${baseName} in any format (tried: ${formats.join(', ')})`);
        return Promise.resolve(null);
      }

      const format = formats[formatIndex];
      const audioPath = `/${baseName}${format}`;
      const audio = new Audio(audioPath);
      audio.preload = 'auto';
      audio.volume = 1.0;

      return new Promise((resolve) => {
        const onError = () => {
          console.warn(`⚠️ Failed to load ${audioPath}, trying next format...`);
          // Try next format
          tryFormat(formatIndex + 1).then(resolve);
        };

        const onSuccess = () => {
          console.log(`✅ ${baseName} loaded successfully in ${format} format`);
          audio.removeEventListener('error', onError);
          resolve(audio);
        };

        audio.addEventListener('error', onError, { once: true });
        audio.addEventListener('loadeddata', onSuccess, { once: true });
        audio.addEventListener('canplay', () => {
          console.log(`✅ ${baseName} ready to play (${format})`);
        }, { once: true });

        // Start loading
        audio.load();
      });
    };

    return tryFormat(0);
  };

  useEffect(() => {
    // Preload audio files with format fallback
    loadAudioWithFallback('Sold_Auction_Voice', ['.mpeg', '.mp3', '.wav'])
      .then((audio) => {
        if (audio) {
          soldAudioRef.current = audio;
        } else {
          console.error('❌ Could not load sold audio in any format');
        }
      })
      .catch((error) => {
        console.error('❌ Failed to create sold audio element:', error);
      });

    loadAudioWithFallback('Unsold_Auction_Voice', ['.wav', '.mpeg', '.mp3'])
      .then((audio) => {
        if (audio) {
          unsoldAudioRef.current = audio;
        } else {
          console.error('❌ Could not load unsold audio in any format');
        }
      })
      .catch((error) => {
        console.error('❌ Failed to create unsold audio element:', error);
      });

    return () => {
      // Cleanup
      if (soldAudioRef.current) {
        soldAudioRef.current.pause();
        soldAudioRef.current = null;
      }
      if (unsoldAudioRef.current) {
        unsoldAudioRef.current.pause();
        unsoldAudioRef.current = null;
      }
    };
  }, []);

  const playSoldAudio = () => {
    console.log('playSoldAudio called, audioMuted:', audioMuted);
    if (audioMuted) {
      console.log('Audio is muted - unmute to hear sound');
      return;
    }
    if (soldAudioRef.current) {
      // Check if audio is ready
      console.log('Audio readyState:', soldAudioRef.current.readyState);
      if (soldAudioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        soldAudioRef.current.currentTime = 0; // Reset to start
        soldAudioRef.current.volume = 1.0; // Ensure volume is max
        const playPromise = soldAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('✅ Sold audio playing successfully');
            })
            .catch(err => {
              console.error('❌ Error playing sold audio:', err);
              console.error('Browser may be blocking autoplay. User interaction required.');
              // Try creating a new audio instance as fallback with format fallback
              try {
                loadAudioWithFallback('Sold_Auction_Voice', ['.mpeg', '.mp3', '.wav'])
                  .then((fallbackAudio) => {
                    if (fallbackAudio) {
                      fallbackAudio.volume = 1.0;
                      fallbackAudio.play()
                        .then(() => console.log('✅ Fallback audio playing'))
                        .catch(e => {
                          console.error('❌ Fallback audio also failed:', e);
                          console.error('Make sure Sold_Auction_Voice exists in client/public/ folder (supports .mpeg, .mp3, .wav)');
                        });
                    }
                  });
              } catch (e) {
                console.error('❌ Could not create fallback audio:', e);
              }
            });
        }
      } else {
        console.warn('⚠️ Sold audio not ready yet, readyState:', soldAudioRef.current.readyState);
        // Wait for audio to load
        soldAudioRef.current.addEventListener('canplay', () => {
          console.log('Audio can now play, attempting playback...');
          soldAudioRef.current.currentTime = 0;
          soldAudioRef.current.volume = 1.0;
          soldAudioRef.current.play()
            .then(() => console.log('✅ Audio playing after load'))
            .catch(err => console.error('❌ Error playing after load:', err));
        }, { once: true });
      }
    } else {
      console.error('❌ Sold audio not initialized. Check if Sold_Auction_Voice exists in client/public/ folder (supports .mpeg, .mp3, .wav formats).');
    }
  };

  const playUnsoldAudio = () => {
    if (audioMuted) {
      console.log('Audio is muted - unmute to hear sound');
      return;
    }
    if (unsoldAudioRef.current) {
      // Check if audio is ready
      if (unsoldAudioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        unsoldAudioRef.current.currentTime = 0; // Reset to start
        const playPromise = unsoldAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Unsold audio playing successfully');
            })
            .catch(err => {
              console.error('Error playing unsold audio:', err);
              console.error('Browser may be blocking autoplay. User interaction required.');
              // Try creating a new audio instance as fallback with format fallback
              try {
                loadAudioWithFallback('Unsold_Auction_Voice', ['.wav', '.mpeg', '.mp3'])
                  .then((fallbackAudio) => {
                    if (fallbackAudio) {
                      fallbackAudio.volume = 1.0;
                      fallbackAudio.play().catch(e => {
                        console.error('Fallback audio also failed:', e);
                        console.error('Make sure Unsold_Auction_Voice exists in client/public/ folder (supports .wav, .mpeg, .mp3)');
                      });
                    }
                  });
              } catch (e) {
                console.error('Could not create fallback audio:', e);
              }
            });
        }
      } else {
        console.warn('Unsold audio not ready yet, readyState:', unsoldAudioRef.current.readyState);
        // Wait for audio to load
        unsoldAudioRef.current.addEventListener('canplay', () => {
          unsoldAudioRef.current.currentTime = 0;
          unsoldAudioRef.current.play().catch(err => console.error('Error playing after load:', err));
        }, { once: true });
      }
    } else {
      console.error('❌ Unsold audio not initialized. Check if Unsold_Auction_Voice exists in client/public/ folder (supports .wav, .mpeg, .mp3 formats).');
    }
  };

  const toggleAudioMute = () => {
    const newMutedState = !audioMuted;
    setAudioMuted(newMutedState);
    localStorage.setItem('audioMuted', JSON.stringify(newMutedState));
  };

  // Check for existing session on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    const expiresAt = localStorage.getItem('expiresAt');

    if (sessionId && username && role && expiresAt) {
      // Verify session is still valid
      const expires = new Date(expiresAt);
      if (expires > new Date()) {
        // Verify with server
        axios.get(`${API_URL}/auth/verify`, {
          headers: { Authorization: `Bearer ${sessionId}` }
        })
        .then(response => {
          if (response.data.valid) {
            setUser({ sessionId, username, role });
          } else {
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            localStorage.removeItem('role');
            localStorage.removeItem('expiresAt');
          }
        })
        .catch(() => {
          localStorage.removeItem('sessionId');
          localStorage.removeItem('username');
          localStorage.removeItem('role');
          localStorage.removeItem('expiresAt');
        });
      } else {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        localStorage.removeItem('expiresAt');
      }
    }
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserMenu]);

  useEffect(() => {
    if (!user) return; // Don't connect socket if not logged in

    // Initialize socket connection
    const newSocket = io(SOCKET_URL);
    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join-auction');
    });

    // Listen for auction events
    newSocket.on('auction-started', (data) => {
      setCurrentPlayer(data.player);
      fetchAuctionState();
    });

    newSocket.on('auction-stopped', () => {
      setCurrentPlayer(null);
      fetchAuctionState();
    });

    newSocket.on('bid-update', (data) => {
      fetchAuctionState();
      fetchCurrentPlayer();
    });

    newSocket.on('player-sold', (data) => {
      setCurrentPlayer(data.nextPlayer);
      fetchAuctionState();
    });

    newSocket.on('timer-update', (data) => {
      setAuctionState(prev => prev ? { ...prev, timer_seconds: data.seconds } : null);
    });

    newSocket.on('auction-completed', () => {
      alert('Auction completed! All players have been sold.');
    });

    newSocket.on('data-cleared', () => {
      alert('All data has been cleared by admin. Refreshing...');
      window.location.reload();
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchAuctionState();
    fetchTeams();
    fetchCurrentPlayer();

    return () => {
      newSocket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        await axios.post(`${API_URL}/auth/logout`, { sessionId });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('expiresAt');
      setUser(null);
      setSocket(null);
    }
  };

  // Show login or sign up if not authenticated
  if (!user) {
    if (showSignUp) {
      return (
        <SignUp
          onSwitchToLogin={() => setShowSignUp(false)}
          onLoginAfterSignup={handleLogin}
        />
      );
    }
    return (
      <Login
        onLogin={handleLogin}
        onSwitchToSignUp={() => setShowSignUp(true)}
      />
    );
  }

  const fetchAuctionState = async () => {
    try {
      const response = await axios.get(`${API_URL}/auction/state`);
      setAuctionState(response.data);
      
      if (response.data.current_player_id) {
        fetchCurrentPlayer();
      }
    } catch (error) {
      console.error('Error fetching auction state:', error);
    }
  };

  const fetchCurrentPlayer = async () => {
    if (auctionState?.current_player_id) {
      try {
        const response = await axios.get(`${API_URL}/players/${auctionState.current_player_id}`);
        setCurrentPlayer(response.data);
      } catch (error) {
        console.error('Error fetching current player:', error);
      }
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${API_URL}/teams`);
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  // Legacy handler functions - kept for potential future use
  // eslint-disable-next-line no-unused-vars
  const handleStartAuction = async () => {
    try {
      await axios.post(`${API_URL}/auction/start`);
      fetchAuctionState();
    } catch (error) {
      alert('Error starting auction: ' + error.response?.data?.error);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleStopAuction = async () => {
    try {
      await axios.post(`${API_URL}/auction/stop`);
      fetchAuctionState();
    } catch (error) {
      alert('Error stopping auction: ' + error.response?.data?.error);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handlePlaceBid = async (amount) => {
    if (!selectedTeam) {
      alert('Please select a team first');
      return;
    }
    try {
      await axios.post(`${API_URL}/auction/bid`, {
        team_id: selectedTeam.id,
        amount: amount
      });
    } catch (error) {
      alert('Error placing bid: ' + (error.response?.data?.error || error.message));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleSellPlayer = async () => {
    try {
      await axios.post(`${API_URL}/auction/sell`);
      fetchAuctionState();
      fetchTeams();
    } catch (error) {
      alert('Error selling player: ' + error.response?.data?.error);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-main">
          <nav className="nav-tabs">
            <button 
              className={activeTab === 'auction' ? 'active' : ''}
              onClick={() => setActiveTab('auction')}
            >
              Auction
            </button>
            <button 
              className={activeTab === 'unsold-auction' ? 'active' : ''}
              onClick={() => setActiveTab('unsold-auction')}
            >
              Unsold Auction
            </button>
            <button 
              className={activeTab === 'bundle-auction' ? 'active' : ''}
              onClick={() => setActiveTab('bundle-auction')}
            >
              Lot Auction
            </button>
          </nav>
          
          <div className="header-right">
            <h1>ICL Tournament {new Date().getFullYear()} - Auction</h1>
            <button 
              className={`header-nav-btn ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => setActiveTab('teams')}
            >
              Teams
            </button>
            <button 
              className={`header-nav-btn ${activeTab === 'players' ? 'active' : ''}`}
              onClick={() => setActiveTab('players')}
            >
              Players
            </button>
            {user.role === 'admin' && (
              <button
                className="header-nav-btn range-set-icon-btn"
                onClick={() => setShowRangesManagement(true)}
                title="Manage Bundle Ranges"
              >
                ⚙️
              </button>
            )}
            <button
              className="audio-toggle-btn"
              onClick={(e) => {
                // User interaction helps unlock audio
                if (audioMuted) {
                  // Test audio when unmuting
                  toggleAudioMute();
                  // Small delay then test
                  setTimeout(() => {
                    if (soldAudioRef.current) {
                      soldAudioRef.current.play().catch(err => {
                        console.log('Audio test - browser may require more interaction');
                      });
                    }
                  }, 100);
                } else {
                  toggleAudioMute();
                }
              }}
              title={audioMuted ? 'Unmute Audio (Click to test)' : 'Mute Audio'}
            >
              {audioMuted ? '🔇' : '🔊'}
            </button>
            <div className="user-menu-container">
              <button 
                className="menu-dots-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="User menu"
              >
                <span className="menu-dots">⋯</span>
              </button>
              {showUserMenu && (
                <div className="user-menu-dropdown">
                  <div className="user-menu-item">
                    <span className="username">Logged in as: <strong>{user.username}</strong> ({user.role})</span>
                  </div>
                  <div className="user-menu-item">
                    <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`app-main ${(activeTab === 'players' || activeTab === 'bundle-auction') ? 'scrollable' : 'no-scroll'}`}>
        {activeTab === 'auction' && (
          <AuctionDashboard
            teams={teams}
            onTeamsChange={fetchTeams}
            userRole={user.role}
            playSoldAudio={playSoldAudio}
            playUnsoldAudio={playUnsoldAudio}
          />
        )}

        {activeTab === 'unsold-auction' && (
          <UnsoldAuctionDashboard
            teams={teams}
            onTeamsChange={fetchTeams}
            userRole={user.role}
            playSoldAudio={playSoldAudio}
            playUnsoldAudio={playUnsoldAudio}
          />
        )}

        {activeTab === 'teams' && (
          <TeamManagement
            teams={teams}
            onTeamsChange={fetchTeams}
            userRole={user.role}
          />
        )}

        {activeTab === 'players' && (
          <PlayerList userRole={user.role} teams={teams} onTeamsChange={fetchTeams} />
        )}

        {activeTab === 'bundle-auction' && (
          <BundleAuction
            teams={teams}
            onTeamsChange={fetchTeams}
            userRole={user.role}
            playSoldAudio={playSoldAudio}
          />
        )}
      </main>

      {/* Bundle Ranges Management Popup */}
      {showRangesManagement && (
        <BundleRangesManagement
          onClose={() => setShowRangesManagement(false)}
        />
      )}
    </div>
  );
}

export default App;

