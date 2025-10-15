import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Zap, ShoppingCart, Clock, Timer } from 'lucide-react';
import { retrieveLaunchParams } from '@telegram-apps/sdk';

export default function NeonClickerGame() {
  // ==== BACKEND INTEGRATION BLOCK ====
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // get user id from Telegram WebApp or fallback to 'guest'
  const tgRef = useRef<any>();
  const [userId, setUserId] = useState<string>('guest');
  const [isTelegramContext, setIsTelegramContext] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initData, setInitData] = useState<string | null>(null);

  // On mount: determine user ID from environment or Telegram WebApp
  useEffect(() => {
    let tid: string | undefined;
    let tg: any = undefined;
    let isTelegram = false;
    let initDataRaw: string | null = null;
    
    // Check for FORCE_USER_ID environment variable (for local testing)
    const forceUserId = (import.meta as any).env?.VITE_FORCE_USER_ID;
    if (forceUserId) {
      tid = forceUserId;
      
      // For local development, simulate Telegram init data
      if (forceUserId === '1234567') {
        const mockUser = {
          id: 1234567,
          first_name: "Test",
          last_name: "User",
          username: "testuser",
          language_code: "en",
          is_premium: false
        };
        
        const mockInitData = new URLSearchParams({
          user: JSON.stringify(mockUser),
          auth_date: Math.floor(Date.now() / 1000).toString(),
          query_id: "test_query_123",
          hash: "mock_hash_for_local_dev"
        }).toString();
        
        initDataRaw = mockInitData;
        console.log('🔧 Local dev mode: Using mock Telegram init data');
      }
    } else {
      try {
        // Use official Telegram SDK to retrieve launch parameters
        const { initDataRaw: rawInitData, initData: parsedInitData } = retrieveLaunchParams();
        
        if (rawInitData && parsedInitData?.user) {
          // Telegram WebApp mode
          isTelegram = true;
          tid = parsedInitData.user.id.toString();
          initDataRaw = rawInitData;
            
          // Initialize Telegram WebApp
          if (window && (window as any).Telegram && (window as any).Telegram.WebApp) {
            tg = (window as any).Telegram.WebApp;
            
            // Enable fullscreen mode for Telegram mini app
            tg.ready();
            tg.expand();
            
            // Disable scrolling and enable fullscreen
            tg.enableClosingConfirmation();
            
            // Set theme to dark to match our game
            tg.setHeaderColor('#000000');
            tg.setBackgroundColor('#000000');
            
            tgRef.current = tg;
          }
          
          console.log('✅ Telegram WebApp detected:', { userId: tid, hasInitData: !!initDataRaw });
        } else {
          // Fallback to guest
          tid = 'guest';
          console.log('⚠️ No Telegram WebApp detected, using guest mode');
        }
      } catch (error) {
        // Fallback to guest if SDK fails
        tid = 'guest';
        console.log('⚠️ Telegram SDK error, using guest mode:', error);
      }
    }
    
    setIsTelegramContext(isTelegram);
    setUserId(tid);
    setInitData(initDataRaw);
    setIsInitialized(true);
  }, []);


  // Ensure fullscreen on resize
  useEffect(() => {
    const handleResize = () => {
      if (tgRef.current) {
        tgRef.current.expand();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Store previous score to prevent UI jumping during loading
  const [prevScore, setPrevScore] = useState(0);

  // Helper function to make authenticated API calls
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authentication header
    if (sessionId) {
      headers['Authorization'] = `Bearer ${sessionId}`;
    } else if (initData) {
      headers['Authorization'] = `tma ${initData}`;
    } else if (userId === '1234567') {
      // Local development mode - use mock init data
      // This should have been set in the initialization
      throw new Error('No authentication available - check VITE_FORCE_USER_ID');
    } else {
      throw new Error('No authentication available');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Authentication failed, clear session and try to re-authenticate
      setSessionId(null);
      if (initData) {
        // Retry with init data
        const retryHeaders = {
          ...headers,
          'Authorization': `tma ${initData}`,
        };
        return fetch(url, {
          ...options,
          headers: retryHeaders,
        });
      }
    }

    return response;
  };

  // Fetch score from backend on userId set
  useEffect(() => {
    if (!isInitialized || !userId) return;
    
    setLoading(true);
    setError(null); // Clear any previous errors
    
    makeAuthenticatedRequest('/api/state')
      .then(res => {
        // Check if we got a session ID from the response headers
        const newSessionId = res.headers.get('X-Session-ID');
        if (newSessionId) {
          setSessionId(newSessionId);
        }
        return res.json();
      })
      .then(data => { 
        const newScore = data.score ?? 0;
        setPrevScore(newScore); // Set previous score to new score for smooth transition
        setScore(newScore); 
        setLoading(false); 
      })
      .catch(e => { 
        setError('Failed to load score'); 
        setLoading(false); 
      });
  }, [isInitialized, userId, isTelegramContext, initData]);

  const [powerInfo, setPowerInfo] = useState({ 
    power: 1, 
    price: 10, 
    score: 0, 
    build_time: 2, 
    is_building: false, 
    build_time_left: 0 
  });
  const [powerLoading, setPowerLoading] = useState(true);
  // Store previous values to prevent UI jumping during loading
  const [prevPowerInfo, setPrevPowerInfo] = useState({ 
    power: 1, 
    price: 10, 
    score: 0, 
    build_time: 2, 
    is_building: false, 
    build_time_left: 0 
  });
  const powerInfoRef = useRef({ 
    power: 1, 
    price: 10, 
    score: 0, 
    build_time: 2, 
    is_building: false, 
    build_time_left: 0 
  });

  // Keep ref in sync with state
  useEffect(() => {
    powerInfoRef.current = powerInfo;
  }, [powerInfo]);

  // Fetch upgrade info from backend
  const fetchPowerInfo = React.useCallback((silent = false) => {
    if (!isInitialized || !userId) return;
    if (!silent) {
      setPowerLoading(true);
      setPrevPowerInfo(powerInfoRef.current);
    }
    makeAuthenticatedRequest('/api/user_upgrades')
      .then(res => res.json())
      .then(r => {
        setPowerInfo(r);
        powerInfoRef.current = r;
        if (!silent) {
        setPrevPowerInfo(r); // Update previous values with new ones
        }
      })
      .finally(() => {
        if (!silent) {
          setPowerLoading(false);
        }
      });
  }, [userId, sessionId, initData]);

  useEffect(() => {
    if (!isInitialized || !userId) return;
    // In Telegram context, only make calls for real users (not guest)
    fetchPowerInfo();
  }, [isInitialized, userId, isTelegramContext, fetchPowerInfo]);

  // Fetch producers from backend
  const fetchProducers = React.useCallback((silent = false) => {
    if (!isInitialized || !userId) return;
    if (!silent) {
      setProducersLoading(true);
    }
    makeAuthenticatedRequest('/api/producers')
      .then(res => res.json())
      .then(data => {
        setProducers(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        setProducers([]);
      })
      .finally(() => {
        if (!silent) {
          setProducersLoading(false);
        }
      });
  }, [userId, sessionId, initData]);

  useEffect(() => {
    if (!isInitialized || !userId) return;
    // In Telegram context, only make calls for real users (not guest)
    fetchProducers();
  }, [isInitialized, userId, isTelegramContext, fetchProducers]);

  // Timer effect to update build time left and refresh when complete
  useEffect(() => {
    if (!powerInfo.is_building || powerInfo.build_time_left <= 0) return;
    
    const timer = setInterval(() => {
      setPowerInfo(prev => {
        const newTimeLeft = Math.max(0, prev.build_time_left - 1);
        if (newTimeLeft === 0) {
          // Build complete, optimistically update power
          return { 
            ...prev, 
            build_time_left: 0, 
            is_building: false,
            power: prev.power + 1,
            price: prev.price + 10
          };
        }
        return { ...prev, build_time_left: newTimeLeft };
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [powerInfo.is_building, powerInfo.build_time_left]);

  // Timer effect for producers
  useEffect(() => {
    const timer = setInterval(() => {
      setProducers(prev => {
        let hasCompletedBuilds = false;
        const newProducers = prev.map(producer => {
          if (producer.is_building && producer.build_time_left > 0) {
            const newTimeLeft = Math.max(0, producer.build_time_left - 1);
            if (newTimeLeft === 0) {
              hasCompletedBuilds = true;
              // Optimistically update the producer as completed
              // Calculate new build time for next purchase (should be 0 for most cases now)
              const newBuildTime = producer.cost < 1000000 ? 0 : 
                Math.max(1, Math.floor((producer.cost - 1000000) / (1000000000000 - 1000000) * 172800));
              
              return { 
                ...producer, 
                build_time_left: 0, 
                is_building: false,
                owned: producer.owned + 1,
                build_time: newBuildTime
              };
            }
            return { ...producer, build_time_left: newTimeLeft };
          }
          return producer;
        });
        
        // If any builds completed, refresh producers from backend to get updated build times
        if (hasCompletedBuilds) {
          fetchProducers(true); // Silent refresh
        }
        
        return newProducers;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Background sync to ensure data consistency (runs every 30 seconds)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (isInitialized && userId) {
        // In Telegram context, only make calls for real users (not guest)
        // Silent sync - don't show loading states
        fetchPowerInfo(true);
        fetchProducers(true);
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(syncInterval);
  }, [isInitialized, userId, isTelegramContext, fetchPowerInfo, fetchProducers]);

  // Backend click handler (now no local optimistic, just fetch)
  const backendClick = async () => {
    if (!isInitialized || !userId) return;
    // In Telegram context, only make calls for real users (not guest)
    if (tgRef.current?.HapticFeedback) {
      tgRef.current.HapticFeedback.impactOccurred('medium');
    }
    try {
      const res = await makeAuthenticatedRequest('/api/click', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const result = await res.json();
      setScore(result.score);
      // Don't fetch power info on click - power doesn't change
    } catch (e) {
      setError('Failed to register click');
    }
  };

  // Override upgradePower to use backend
  const upgradePower = async () => {
    if (!isInitialized || !userId) return;
    // In Telegram context, only make calls for real users (not guest)
    
    // Check if we have enough balance locally first
    const currentPrice = powerInfo.price ?? 0;
    if (score < currentPrice) {
      setError('Insufficient balance');
      return;
    }
    
    // Check if already building
    if (powerInfo.is_building) {
      setError('Upgrade in progress');
      return;
    }
    
    // Store previous values for rollback
    const previousPowerInfo = powerInfo;
    const previousScore = score;
    
    try {
      const res = await makeAuthenticatedRequest('/api/upgrade_power', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const result = await res.json();
      
      if (result.success) {
      // Update with actual backend response
      setPowerInfo(result);
      powerInfoRef.current = result;
        setScore(result.score ?? score);
      setPrevPowerInfo(result);
      } else {
        // Show error message from backend
        setError(result.message || 'Upgrade failed');
      }
    } catch (e) {
      // Rollback on error
      setPowerInfo(previousPowerInfo);
      powerInfoRef.current = previousPowerInfo;
      setScore(previousScore);
      setPrevPowerInfo(previousPowerInfo);
      setError('Upgrade failed - please try again');
    }
  };

  const [displayScore, setDisplayScore] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [activeTab, setActiveTab] = useState('game');
  const [gas, setGas] = useState(500);
  const [autoTapActive, setAutoTapActive] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState(0);
  const boostMultiplier = boostActive ? 2 : 1;
  const [clicks, setClicks] = useState([]);
  const [producers, setProducers] = useState([]);
  const [producersLoading, setProducersLoading] = useState(true);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [prevTotalProduction, setPrevTotalProduction] = useState(0);
  // Replace and extend hardcoded leaderboard
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'richest' | 'per_second' | 'clicks'>('richest');
  const [perSecondLeaderboard, setPerSecondLeaderboard] = useState<any[]>([]);
  const [clicksLeaderboard, setClicksLeaderboard] = useState<any[]>([]);
  const [hasInitiallyLoadedRichest, setHasInitiallyLoadedRichest] = useState(false);
  const [hasInitiallyLoadedPerSecond, setHasInitiallyLoadedPerSecond] = useState(false);
  const [hasInitiallyLoadedClicks, setHasInitiallyLoadedClicks] = useState(false);
  
  
  // Fetch leaderboard from backend
  const fetchLeaderboard = React.useCallback((silent = false) => {
    if (!isInitialized || !userId) return;
    if (!silent) {
      setLeaderboardLoading(true);
    }
    makeAuthenticatedRequest('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        const leaderboardData = Array.isArray(data) ? data : [];
        leaderboardData.sort((a, b) => (b.score || 0) - (a.score || 0));
        setLeaderboard(leaderboardData);
        setHasInitiallyLoadedRichest(true);
      })
      .catch(() => setLeaderboard([]))
      .finally(() => {
        if (!silent) {
          setLeaderboardLoading(false);
        }
      });
  }, [userId, sessionId, initData]);

  // Fetch per-second leaderboard from backend
  const fetchPerSecondLeaderboard = React.useCallback((silent = false) => {
    if (!isInitialized || !userId) return;
    if (!silent) {
      setLeaderboardLoading(true);
    }
    makeAuthenticatedRequest('/api/per_second_leaderboard')
      .then(res => res.json())
      .then(data => {
        const leaderboardData = Array.isArray(data) ? data : [];
        leaderboardData.sort((a, b) => (b.production_rate || 0) - (a.production_rate || 0));
        setPerSecondLeaderboard(leaderboardData);
        setHasInitiallyLoadedPerSecond(true);
      })
      .catch(() => setPerSecondLeaderboard([]))
      .finally(() => {
        if (!silent) {
          setLeaderboardLoading(false);
        }
      });
  }, [isInitialized, userId, isTelegramContext, sessionId, initData]);

  // Fetch clicks leaderboard from backend
  const fetchClicksLeaderboard = React.useCallback((silent = false) => {
    if (!isInitialized || !userId) return;
    if (!silent) {
      setLeaderboardLoading(true);
    }
    makeAuthenticatedRequest('/api/clicks_leaderboard')
      .then(res => res.json())
      .then(data => {
        const leaderboardData = Array.isArray(data) ? data : [];
        setClicksLeaderboard(leaderboardData);
        setHasInitiallyLoadedClicks(true);
      })
      .catch(() => setClicksLeaderboard([]))
      .finally(() => {
        if (!silent) {
          setLeaderboardLoading(false);
        }
      });
  }, [isInitialized, userId, isTelegramContext, sessionId, initData]);

  // Reset initial load state when switching away from leaderboard
  useEffect(() => {
    if (activeTab !== 'leaderboard') {
      setHasInitiallyLoadedRichest(false);
      setHasInitiallyLoadedPerSecond(false);
      setHasInitiallyLoadedClicks(false);
    }
  }, [activeTab]);

  // Initial leaderboard fetch when tab is opened
  useEffect(() => {
    if (activeTab !== 'leaderboard') return;
    if (!isInitialized || !userId) return;
    if (leaderboardMode === 'richest') {
      fetchLeaderboard();
    } else if (leaderboardMode === 'per_second') {
      fetchPerSecondLeaderboard();
    } else if (leaderboardMode === 'clicks') {
      fetchClicksLeaderboard();
    }
  }, [activeTab, leaderboardMode, isInitialized, userId, fetchLeaderboard, fetchPerSecondLeaderboard, fetchClicksLeaderboard]);

  // Auto-update leaderboard every 2 seconds when on leaderboard tab
  useEffect(() => {
    if (activeTab !== 'leaderboard') return;
    if (!isInitialized || !userId) return;
    
    const interval = setInterval(() => {
      if (leaderboardMode === 'richest') {
        fetchLeaderboard(true); // Silent update
      } else if (leaderboardMode === 'per_second') {
        fetchPerSecondLeaderboard(true); // Silent update
      } else if (leaderboardMode === 'clicks') {
        fetchClicksLeaderboard(true); // Silent update
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [activeTab, leaderboardMode, isInitialized, userId, fetchLeaderboard, fetchPerSecondLeaderboard, fetchClicksLeaderboard]);

  // Update display score immediately when score changes
  useEffect(() => {
    setDisplayScore(score);
  }, [score]);

  // Background production - sync with backend every 5 seconds
  useEffect(() => {
    const totalProduction = producers.reduce((sum, p) => sum + (p.rate * p.owned), 0);
    
    if (totalProduction > 0) {
      // Local smooth increment for immediate feedback
      const localInterval = setInterval(() => {
        setScore(prev => prev + (totalProduction / 60));
      }, 16);

      // Sync with backend every 5 seconds to prevent drift
      const syncInterval = setInterval(async () => {
        if (!isInitialized || !userId) return;
        // In Telegram context, only make calls for real users (not guest)
        try {
          const res = await makeAuthenticatedRequest('/api/state');
          const data = await res.json();
          setScore(data.score ?? score);
        } catch (e) {
          // Silent fail for score sync
        }
      }, 5000);

      return () => {
        clearInterval(localInterval);
        clearInterval(syncInterval);
      };
    }
  }, [producers, userId]);

  // Override the original handleClick to use backendClick for main click area
  const handleClick = (e) => {
    // Original UI feedback code
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newClick = { id: Date.now() + Math.random(), x, y, value: powerInfo.power }; // value=actual power from backend
    setClicks(prev => [...prev, newClick]);
    backendClick();
    setTimeout(() => {
      setClicks(prev => prev.filter(click => click.id !== newClick.id));
    }, 800);
  };

  const buyProducer = async (producer) => {
    if (!isInitialized || !userId) return;
    // In Telegram context, only make calls for real users (not guest)
    
    // Check if we have enough balance locally first
    if (score < producer.cost) {
      setError('Insufficient balance');
      return;
    }
    
    // Check if already building
    if (producer.is_building) {
      setError('Producer building in progress');
      return;
    }
    
    try {
      const res = await makeAuthenticatedRequest('/api/buy_producer', {
        method: 'POST',
        body: JSON.stringify({ 
          producer_id: producer.id 
        })
      });
      const result = await res.json();
      
      if (result.success) {
        setProducers(result.producers);
        setScore(result.score);
      } else {
        setError(result.message || 'Failed to buy producer');
      }
    } catch (e) {
      setError('Failed to buy producer - please try again');
    }
  };

  const totalProduction = producers.reduce((sum, p) => sum + (p.rate * p.owned), 0);

  // Helper function to format time
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      // Less than 1 hour: show MM:SS
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      // 1 hour or more: show H:MM or HH:MM
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours < 10) {
        return `${hours}:${minutes.toString().padStart(2, '0')}h`;
      } else {
        return `${hours}h ${minutes}m`;
      }
    }
  };

  // Detect when total production changes and trigger highlight
  useEffect(() => {
    if (totalProduction > prevTotalProduction && prevTotalProduction > 0) {
      setIsHighlighted(true);
      setTimeout(() => setIsHighlighted(false), 800);
    }
    setPrevTotalProduction(totalProduction);
  }, [totalProduction, prevTotalProduction]);

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" style={{
          animation: 'pulse-slow 8s ease-in-out infinite'
        }}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" style={{
          animation: 'pulse-slow 8s ease-in-out infinite',
          animationDelay: '2s'
        }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" style={{
          animation: 'pulse-slow 8s ease-in-out infinite',
          animationDelay: '4s'
        }}></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-cyan-500/20 bg-black/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-light tracking-widest text-cyan-400 mb-1">NEON CLICKER</div>
              <div className="flex items-center gap-3">
                {totalProduction > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        className="text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,0.8)] animate-pulse"
                        style={{
                          filter: 'drop-shadow(0 0 2px #06b6d4) drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 6px #06b6d4)',
                          animation: 'neon-flicker 2s ease-in-out infinite alternate',
                        }}
                      >
                        <path 
                          d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" 
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="0.5"
                        />
                      </svg>
                </div>
                    <div className={`text-xs font-light tracking-widest transition-all duration-300 ${isHighlighted ? 'text-cyan-400 scale-125 font-semibold' : 'text-cyan-400'}`} style={{
                      textShadow: '0 0 2px #06b6d4, 0 0 4px #06b6d4'
                    }}>
                      +{totalProduction.toLocaleString()}/sec
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="relative">
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"
                    style={{
                      filter: 'drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 8px #06b6d4) drop-shadow(0 0 12px #06b6d4)',
                      animation: 'neon-flicker 2s ease-in-out infinite alternate',
                    }}
                  >
                    <path 
                      d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" 
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="0.5"
                    />
                  </svg>
                </div>
                <div className="text-xs text-cyan-400 font-light tracking-widest drop-shadow-[0_0_4px_rgba(6,182,212,0.6)]" style={{
                  textShadow: '0 0 4px #06b6d4, 0 0 8px #06b6d4'
                }}>NEON POWER</div>
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-mono font-bold text-cyan-400 break-all">
                {loading ? Math.floor(prevScore).toLocaleString() : Math.floor(displayScore).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-8 mt-8">
          <div className="flex gap-8 border-b border-white/10">
            {[
              { id: 'game', label: 'PLAY', icon: Zap },
              { id: 'shop', label: 'PRODUCERS', icon: ShoppingCart },
              { id: 'leaderboard', label: 'RANKS', icon: Trophy }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-light tracking-wide transition-all relative flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" strokeWidth={1.5} />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-8 py-12 pb-20">
          {activeTab === 'game' && (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Click Area */}
              <div className="space-y-6">
                <div className="relative">
                  <button
                    onClick={handleClick}
                    className="w-full aspect-square bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-3xl border border-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 relative overflow-hidden group backdrop-blur-sm shadow-2xl shadow-cyan-500/10"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-purple-500/10 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <div className="relative z-10 h-full flex items-center justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-purple-400 rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity"></div>
                        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-400/30 border-2 border-cyan-400/50 flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform duration-300 shadow-2xl">
                          <Zap className="w-16 h-16 text-cyan-400" strokeWidth={1.5} />
                        </div>
                      </div>
                    </div>
                    
                    {clicks.map(click => (
                      <div
                        key={click.id}
                        className="absolute text-2xl font-light text-cyan-400 pointer-events-none drop-shadow-lg"
                        style={{
                          left: click.x,
                          top: click.y,
                          animation: 'float 0.8s ease-out forwards'
                        }}
                      >
                        +{click.value}
                      </div>
                    ))}
                  </button>
                </div>

                {/* Click Power Upgrade */}
                <div className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-light tracking-widest text-gray-500 mb-1">CLICK POWER</div>
                      <div className="text-3xl font-extralight text-cyan-400 flex items-center gap-3">
                        {powerInfo.power}
                        {powerInfo.build_time > 0 && (
                          <span className="text-sm text-gray-400 flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            {formatTime(powerInfo.build_time)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-light tracking-widest text-gray-500 mb-1">COST</div>
                      <div className="text-xl font-extralight text-purple-400">{(powerInfo.price ?? 0).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  
                  <button
                    onClick={upgradePower}
                    disabled={score < (powerInfo.price ?? 0) || powerInfo.is_building}
                    className={`w-full py-3 rounded-xl font-light text-sm tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
                      score >= (powerInfo.price ?? 0) && !powerInfo.is_building
                        ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 hover:border-cyan-400/50 text-cyan-400 hover:scale-105 active:scale-95'
                        : powerInfo.is_building
                        ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-400 cursor-not-allowed'
                        : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {powerInfo.is_building ? (
                      <>
                        <Clock className="w-4 h-4 animate-pulse" />
                        BUILDING... {formatTime(powerInfo.build_time_left)}
                      </>
                    ) : score >= (powerInfo.price ?? 0) ? (
                      'UPGRADE'
                    ) : (
                      'INSUFFICIENT'
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Producers Preview */}
              <div className="space-y-4">
                <div className="text-xs font-light tracking-widest text-gray-500 mb-4">QUICK ACCESS</div>
                 {producers.slice(0, 3).map(producer => {
                   const cost = producer.cost; // Backend already calculates the scaled cost
                  return (
                    <div
                      key={producer.id}
                      className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-cyan-500/30 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`text-3xl ${producer.owned > 0 ? '' : 'grayscale opacity-60'}`} style={producer.owned === 0 ? {
                            filter: 'grayscale(100%) brightness(0.8) drop-shadow(0 0 8px rgba(6,182,212,0.4)) drop-shadow(0 0 16px rgba(6,182,212,0.2))',
                            color: '#06b6d4'
                          } : {}}>{producer.emoji}</div>
                          <div>
                            <div className="text-sm font-light text-white">{producer.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              +{producer.rate}/sec
                              {producer.build_time > 0 && (
                                <span className="flex items-center gap-1 text-gray-400">
                                  <Timer className="w-3 h-3" />
                                  {formatTime(producer.build_time)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-light text-cyan-400">{producer.owned}</div>
                          <div className="text-xs text-gray-500">owned</div>
                        </div>
                      </div>
                      
                      
                      <button
                        onClick={() => buyProducer(producer)}
                        disabled={score < cost || producer.is_building}
                        className={`w-full py-2 rounded-xl text-xs font-light tracking-widest transition-all flex items-center justify-center gap-2 ${
                          score >= cost && !producer.is_building
                            ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-500/30'
                            : producer.is_building
                            ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-400 cursor-not-allowed'
                            : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {producer.is_building ? (
                          <>
                            <Clock className="w-3 h-3 animate-pulse" />
                            BUILDING... {formatTime(producer.build_time_left)}
                          </>
                        ) : (
                          `BUY - ${cost.toLocaleString()}`
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            {activeTab === 'shop' && (
             <div className="space-y-8">
               {producersLoading && (
                 <div className="text-center text-gray-500">Loading neon production chain...</div>
               )}
               {!producersLoading && (
                 <>
                   {producers.length === 0 ? (
                     <div className="text-center text-gray-500">No producers available. Please try refreshing.</div>
                   ) : (
                     <div className="grid md:grid-cols-2 gap-6">
                       {producers.map(producer => {
                     const cost = producer.cost; // Backend already calculates the scaled cost
                return (
                  <div
                    key={producer.id}
                    className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`text-5xl ${producer.owned > 0 ? '' : 'grayscale opacity-60'}`} style={producer.owned === 0 ? {
                        filter: 'grayscale(100%) brightness(0.8) drop-shadow(0 0 12px rgba(6,182,212,0.5)) drop-shadow(0 0 24px rgba(6,182,212,0.3))',
                        color: '#06b6d4'
                      } : {}}>{producer.emoji}</div>
                      <div className="flex-1">
                        <div className="text-lg font-light text-white mb-1">{producer.name}</div>
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          +{producer.rate} per second
                          {producer.build_time > 0 && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Timer className="w-3 h-3" />
                              {formatTime(producer.build_time)}
                            </span>
                          )}
                      </div>
                    </div>
                    </div>
                    {producer.owned > 0 && (
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs text-gray-500">Owned</div>
                        <div className="text-2xl font-mono font-extralight text-cyan-400">{producer.owned}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Total Production</div>
                        <div className="text-2xl font-mono font-extralight text-purple-400">{(producer.rate * producer.owned).toLocaleString()}/s</div>
                      </div>
                    </div>
                    )}
                    
                    
                    <button
                      onClick={() => buyProducer(producer)}
                      disabled={score < cost || producer.is_building}
                      className={`w-full py-3 rounded-xl font-light text-sm tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
                        score >= cost && !producer.is_building
                          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 hover:border-cyan-400/50 text-cyan-400'
                          : producer.is_building
                          ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-400 cursor-not-allowed'
                          : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {producer.is_building ? (
                        <>
                          <Clock className="w-4 h-4 animate-pulse" />
                          BUILDING... {formatTime(producer.build_time_left)}
                        </>
                      ) : (
                        `BUY - ${cost.toLocaleString()}`
                      )}
                    </button>
                  </div>
                  );
                })}
                     
                     {/* Mystery Upgrade */}
                     <div className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all duration-300 opacity-75">
                       <div className="flex items-start gap-4 mb-4">
                         <div className="text-5xl grayscale opacity-60" style={{
                           filter: 'grayscale(100%) brightness(0.8) drop-shadow(0 0 12px rgba(6,182,212,0.5)) drop-shadow(0 0 24px rgba(6,182,212,0.3))',
                           color: '#06b6d4'
                         }}>❓</div>
                         <div className="flex-1">
                           <div className="text-lg font-light text-white mb-1">Unknown</div>
                           <div className="text-sm text-gray-400 flex items-center gap-2">
                             Open all above to continue
                           </div>
                         </div>
                       </div>
                       
                       <button
                         disabled={true}
                         className="w-full py-3 rounded-xl font-light text-sm tracking-widest transition-all duration-300 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed"
                       >
                         UNLOCK ABOVE TO SEE
                       </button>
                     </div>
                     </div>
                   )}
                 </>
               )}
            </div>
            )}

          {activeTab === 'leaderboard' && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Live indicator and toggle */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-400 font-light tracking-widest">LIVE</span>
                </div>
                
                {/* Toggle switch */}
                <div className="flex items-center gap-2">
                  <button 
                    className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
                      leaderboardMode === 'richest' 
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30' 
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                    onClick={() => {
                      if (leaderboardMode !== 'richest') {
                        setLeaderboardMode('richest');
                      }
                    }}
                  >
                    RICHEST
                  </button>
                  <button 
                    className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
                      leaderboardMode === 'per_second' 
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30' 
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                    onClick={() => {
                      if (leaderboardMode !== 'per_second') {
                        setLeaderboardMode('per_second');
                      }
                    }}
                  >
                    PER SECOND
                  </button>
                  <button 
                    className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
                      leaderboardMode === 'clicks' 
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30' 
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                    onClick={() => {
                      if (leaderboardMode !== 'clicks') {
                        setLeaderboardMode('clicks');
                      }
                    }}
                  >
                    CLICKS
                  </button>
                </div>
              </div>
              
              {!leaderboardLoading && leaderboardMode === 'richest' && hasInitiallyLoadedRichest && leaderboard.length === 0 && (
                <div className="text-center text-gray-500">No leaders yet.</div>
              )}
              {!leaderboardLoading && leaderboardMode === 'per_second' && hasInitiallyLoadedPerSecond && perSecondLeaderboard.length === 0 && (
                <div className="text-center text-gray-500">No producers yet.</div>
              )}
              {!leaderboardLoading && leaderboardMode === 'clicks' && hasInitiallyLoadedClicks && clicksLeaderboard.length === 0 && (
                <div className="text-center text-gray-500">No clickers yet.</div>
              )}
              
              

              {/* Richest leaderboard */}
              {!leaderboardLoading && leaderboardMode === 'richest' && leaderboard.map((entry, index) => {
                const isSelf = entry.is_self;
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-cyan-500/30 transition-all duration-300 ${isSelf ? 'border-yellow-400/40 bg-yellow-400/5' : ''}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-light ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400/30 to-yellow-400/10 text-yellow-400 border border-yellow-400/30' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300/30 to-gray-300/10 text-gray-300 border border-gray-300/30' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400/30 to-orange-400/10 text-orange-400 border border-orange-400/30' :
                        'bg-white/5 text-gray-500 border border-white/10'
                      }`}>
                        {index + 1}
                      </div>
                      <div className={`font-light ${isSelf ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {isSelf ? 'You' : entry.user_id}
                      </div>
                    </div>
                    <div className="text-2xl font-extralight text-cyan-400">
                      {entry.score.toLocaleString()}
                    </div>
                  </div>
                );
              })}
              
              {/* Per-second leaderboard */}
              {!leaderboardLoading && leaderboardMode === 'per_second' && perSecondLeaderboard.map((entry, index) => {
                const isSelf = entry.is_self;
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-cyan-500/30 transition-all duration-300 ${isSelf ? 'border-yellow-400/40 bg-yellow-400/5' : ''}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-light ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400/30 to-yellow-400/10 text-yellow-400 border border-yellow-400/30' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300/30 to-gray-300/10 text-gray-300 border border-gray-300/30' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400/30 to-orange-400/10 text-orange-400 border border-orange-400/30' :
                        'bg-white/5 text-gray-500 border border-white/10'
                      }`}>
                        {index + 1}
                      </div>
                      <div className={`font-light ${isSelf ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {isSelf ? 'You' : entry.user_id}
                      </div>
                    </div>
                    <div className="text-2xl font-extralight text-green-400">
                      +{entry.production_rate.toLocaleString()}/s
                    </div>
                  </div>
                );
              })}
              
              {/* Clicks leaderboard */}
              {!leaderboardLoading && leaderboardMode === 'clicks' && clicksLeaderboard.map((entry, index) => {
                const isSelf = entry.is_self;
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-cyan-500/30 transition-all duration-300 ${isSelf ? 'border-yellow-400/40 bg-yellow-400/5' : ''}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-light ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400/30 to-yellow-400/10 text-yellow-400 border border-yellow-400/30' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300/30 to-gray-300/10 text-gray-300 border border-gray-300/30' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400/30 to-orange-400/10 text-orange-400 border border-orange-400/30' :
                        'bg-white/5 text-gray-500 border border-white/10'
                      }`}>
                        {index + 1}
                      </div>
                      <div className={`font-light ${isSelf ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {isSelf ? 'You' : entry.user_id}
                      </div>
                    </div>
                    <div className="text-2xl font-extralight text-purple-400">
                      {entry.clicks.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-60px);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }
        
        @keyframes neon-flicker {
          0%, 100% {
            opacity: 1;
            filter: drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 8px #06b6d4) drop-shadow(0 0 12px #06b6d4);
          }
          50% {
            opacity: 0.8;
            filter: drop-shadow(0 0 2px #06b6d4) drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 6px #06b6d4);
          }
        }
        
      `}</style>
    </div>
  );
}