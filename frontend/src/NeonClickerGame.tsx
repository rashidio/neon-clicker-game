import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Zap, ShoppingCart, Clock, Timer, Check } from 'lucide-react';
import { retrieveLaunchParams } from '@telegram-apps/sdk';
import ProducerItem from './components/ProducerItem';
import LeaderboardItem from './components/LeaderboardItem';
import DonationItem from './components/DonationItem';
import PowerUpgradeCard from './components/PowerUpgradeCard';
import { formatTime, formatCompact, formatPercent } from './utils/format';

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
  const [donationGoals, setDonationGoals] = useState<any[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(false);
  const [selectedDonationGoalId, setSelectedDonationGoalId] = useState<number | null>(null);
  const [donationDetails, setDonationDetails] = useState<Record<number, any>>({});
  const [detailLoading, setDetailLoading] = useState<Record<number, boolean>>({});
  const [showTopDonors, setShowTopDonors] = useState<Record<number, boolean>>({});
  const [confirmDonation, setConfirmDonation] = useState<{ goalId: number; percent: 10 | 25 | 50 | 100 } | null>(null);
  const [donationSubmitting, setDonationSubmitting] = useState<{ goalId: number; percent: 10 | 25 | 50 | 100 } | null>(null);
  const [donationSuccess, setDonationSuccess] = useState<{ goalId: number; percent: 10 | 25 | 50 | 100 } | null>(null);
  
  
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

  const fetchDonationGoals = React.useCallback((silent = false) => {
    if (!isInitialized || !userId) return;
    if (!silent) setDonationsLoading(true);
    makeAuthenticatedRequest('/api/donations/goals')
      .then(res => res.json())
      .then(data => {
        setDonationGoals(Array.isArray(data) ? data : []);
      })
      .catch(() => setDonationGoals([]))
      .finally(() => {
        if (!silent) setDonationsLoading(false);
      });
  }, [isInitialized, userId, sessionId, initData]);

  const fetchDonationGoalDetail = React.useCallback((goalId: number) => {
    if (!isInitialized || !userId) return;
    setDetailLoading(prev => ({ ...prev, [goalId]: true }));
    makeAuthenticatedRequest(`/api/donations/goal?id=${goalId}`)
      .then(res => res.json())
      .then(data => {
        setSelectedDonationGoalId(goalId);
        setDonationDetails(prev => ({ ...prev, [goalId]: data }));
      })
      .finally(() => setDetailLoading(prev => ({ ...prev, [goalId]: false })));
  }, [isInitialized, userId, sessionId, initData]);

  const donate = async (goalId: number, percent: 10 | 25 | 50 | 100) => {
    if (!isInitialized || !userId) return;
    try {
      // keep the confirm button on screen; mark as submitting
      setDonationSubmitting({ goalId, percent });
      const res = await makeAuthenticatedRequest('/api/donations/donate', {
        method: 'POST',
        body: JSON.stringify({ goal_id: goalId, percent })
      });
      const result = await res.json();
      if (result.success) {
        setScore(result.score ?? score);
        fetchDonationGoals(true);
        if (selectedDonationGoalId === goalId) {
          setDonationDetails(prev => ({ ...prev, [goalId]: result.goal }));
        }
        // silently refresh richest leaderboard after donation
        fetchLeaderboard(true);
        // show success on the same confirmation button, then revert
        setDonationSubmitting(null);
        setDonationSuccess({ goalId, percent });
        setTimeout(() => {
          setDonationSuccess(prev => (prev && prev.goalId === goalId ? null : prev));
          setConfirmDonation(prev => (prev && prev.goalId === goalId ? null : prev));
        }, 500);
      } else {
        setDonationSubmitting(null);
        setError(result.message || 'Donation failed');
      }
    } catch {
      setDonationSubmitting(null);
      setError('Donation failed');
    }
  };

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

  // Auto-load donation goals when opening the Donations tab
  useEffect(() => {
    if (activeTab !== 'donations') return;
    if (!isInitialized || !userId) return;
    fetchDonationGoals();
  }, [activeTab, isInitialized, userId, fetchDonationGoals]);

  // Auto-fetch donors for all goals once goals are loaded (cache per goal)
  useEffect(() => {
    if (activeTab !== 'donations') return;
    if (!donationGoals || donationGoals.length === 0) return;
    donationGoals.forEach(g => {
      if (!donationDetails[g.id] && !detailLoading[g.id]) {
        fetchDonationGoalDetail(g.id);
      }
    });
  }, [activeTab, donationGoals, donationDetails, detailLoading, fetchDonationGoalDetail]);

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

  // formatTime, formatCompact, formatPercent imported from utils/format

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
        <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6 sm:mt-8 mb-4 sm:mb-6">
          <div className="flex justify-center sm:justify-start gap-5 sm:gap-8 border-b border-white/10">
            {[
              { id: 'game', label: 'TAP', icon: Zap },
              { id: 'shop', label: 'PRODUCE', icon: ShoppingCart },
              { id: 'donations', label: 'DONATE', icon: Trophy },
              { id: 'leaderboard', label: 'RANKS' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 sm:pb-3 text-xs sm:text-sm font-light tracking-normal sm:tracking-wide transition-all relative flex items-center gap-2 sm:gap-2 ${
                  activeTab === tab.id
                    ? 'text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.id === 'leaderboard' ? (
                  <span className="relative inline-flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                    {tab.label}
                  </span>
                ) : (
                  <>
                    {tab.icon && <tab.icon className="w-4 h-4" strokeWidth={1.5} />}
                    {tab.label}
                  </>
                )}
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
                <PowerUpgradeCard
                  powerInfo={powerInfo}
                  score={score}
                  onUpgrade={upgradePower}
                  formatTime={formatTime}
                />
              </div>

              {/* Quick Producers Preview */}
              <div className="space-y-4">
                <div className="text-xs font-light tracking-widest text-gray-500 mb-4">QUICK ACCESS</div>
                 {producers.slice(0, 3).map(producer => (
                   <ProducerItem
                     key={producer.id}
                     producer={producer}
                     score={score}
                     onBuy={buyProducer}
                     formatTime={formatTime}
                     compact
                   />
                 ))}
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
                       {producers.map(producer => (
                         <ProducerItem
                           key={producer.id}
                           producer={producer}
                           score={score}
                           onBuy={buyProducer}
                           formatTime={formatTime}
                         />
                       ))}
                     
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

          {activeTab === 'donations' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {donationsLoading && (
                <div className="text-center text-gray-500">Loading...</div>
              )}
              {!donationsLoading && donationGoals.length === 0 && (
                <div className="text-center text-gray-500">No goals.</div>
              )}
              {!donationsLoading && donationGoals.map(g => {
                const selected = !!showTopDonors[g.id];
                return (
                  <DonationItem
                    key={g.id}
                    goal={g}
                    selected={selected}
                    detailLoading={!!detailLoading[g.id]}
                    detail={donationDetails[g.id]}
                    onToggleTopDonors={(goalId, next) => setShowTopDonors(prev => ({ ...prev, [goalId]: next }))}
                    onRequestDetail={fetchDonationGoalDetail}
                    confirm={confirmDonation}
                    submitting={donationSubmitting}
                    success={donationSuccess}
                    setConfirm={setConfirmDonation}
                    onDonate={donate}
                    score={score}
                    formatCompact={formatCompact}
                    formatPercent={formatPercent}
                  />
                );
              })}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Toggle switch */}
              <div className="flex items-center justify-center gap-2 mb-6">
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
              {!leaderboardLoading && leaderboardMode === 'richest' && leaderboard.map((entry, index) => (
                <LeaderboardItem key={entry.user_id} index={index} entry={entry} mode="richest" />
              ))}
              
              {/* Per-second leaderboard */}
              {!leaderboardLoading && leaderboardMode === 'per_second' && perSecondLeaderboard.map((entry, index) => (
                <LeaderboardItem key={entry.user_id} index={index} entry={entry} mode="per_second" />
              ))}
              
              {/* Clicks leaderboard */}
              {!leaderboardLoading && leaderboardMode === 'clicks' && clicksLeaderboard.map((entry, index) => (
                <LeaderboardItem key={entry.user_id} index={index} entry={entry} mode="clicks" />
              ))}
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
        
        @keyframes neon-scan {
          0% { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }

        .neon-scan {
          background: linear-gradient(90deg, rgba(6, 182, 212, 0) 0%, rgba(6, 182, 212, 0.25) 50%, rgba(6, 182, 212, 0) 100%);
          background-size: 200% 100%;
          animation: neon-scan 2s linear infinite;
          opacity: 0.6;
          mix-blend-mode: screen;
        }
        
      `}</style>
    </div>
  );
}