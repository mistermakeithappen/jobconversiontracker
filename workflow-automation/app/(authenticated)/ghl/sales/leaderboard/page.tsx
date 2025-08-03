'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { 
  Trophy, Medal, Award, TrendingUp, Target, Star, 
  Clock, Calendar, Users, ChevronUp, ChevronDown 
} from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  teamMemberId: string;
  teamMember: any;
  score: number;
  metrics: any;
  change?: number;
}

interface Challenge {
  id: string;
  challenge_name: string;
  challenge_type: string;
  description?: string;
  target_metric: string;
  target_value: number;
  start_date: string;
  end_date: string;
  reward_type?: string;
  reward_value?: number;
  participantCount: number;
  completedCount: number;
  averageProgress: number;
  topPerformers: any[];
  userParticipation?: any;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-6 h-6 text-yellow-500" />;
    case 2:
      return <Medal className="w-6 h-6 text-gray-400" />;
    case 3:
      return <Medal className="w-6 h-6 text-orange-600" />;
    default:
      return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-600">{rank}</span>;
  }
};

const getChangeIndicator = (change: number) => {
  if (change > 0) {
    return (
      <div className="flex items-center text-green-600">
        <ChevronUp className="w-4 h-4" />
        <span className="text-xs">+{change}</span>
      </div>
    );
  } else if (change < 0) {
    return (
      <div className="flex items-center text-red-600">
        <ChevronDown className="w-4 h-4" />
        <span className="text-xs">{change}</span>
      </div>
    );
  }
  return <span className="text-gray-400 text-xs">-</span>;
};

export default function SalesLeaderboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedType, setSelectedType] = useState<string>('monthly');
  const [selectedMetric, setSelectedMetric] = useState<string>('revenue');
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [showChallenges, setShowChallenges] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedType, selectedMetric, selectedChallenge]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch leaderboard
      const params = new URLSearchParams({
        type: selectedType,
        metric: selectedMetric,
        ...(selectedChallenge && { challengeId: selectedChallenge })
      });

      const [leaderboardRes, challengesRes] = await Promise.all([
        fetch(`/api/gamification/leaderboard?${params}`, {
          credentials: 'include'
        }),
        fetch('/api/gamification/challenges?status=active', {
          credentials: 'include'
        })
      ]);

      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        setLeaderboard(data.leaderboard || []);
      }

      if (challengesRes.ok) {
        const data = await challengesRes.json();
        setChallenges(data.challenges || []);
      }
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatProgress = (current: number, target: number) => {
    const percentage = target > 0 ? (current / target) * 100 : 0;
    return {
      percentage: Math.min(percentage, 100),
      display: `${current.toLocaleString()} / ${target.toLocaleString()}`
    };
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Leaderboard</h1>
          <p className="text-gray-600">Track top performers and compete in challenges</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedChallenge(null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="daily">Today</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="quarterly">This Quarter</option>
            <option value="all_time">All Time</option>
          </select>
          {!selectedChallenge && (
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="revenue">Revenue</option>
              <option value="units">Units Sold</option>
              <option value="commissions">Commissions</option>
            </select>
          )}
        </div>
      </div>

      {/* Active Challenges */}
      {showChallenges && challenges.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Challenges</h2>
            <button
              onClick={() => setShowChallenges(!showChallenges)}
              className="text-gray-400 hover:text-gray-600"
            >
              {showChallenges ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {challenges.map((challenge) => {
              const isSelected = selectedChallenge === challenge.id;
              return (
                <div
                  key={challenge.id}
                  onClick={() => setSelectedChallenge(isSelected ? null : challenge.id)}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      <h3 className="font-medium text-gray-900">{challenge.challenge_name}</h3>
                    </div>
                    {challenge.reward_type && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        {challenge.reward_type === 'bonus_percentage' 
                          ? `${challenge.reward_value}% bonus`
                          : challenge.reward_type === 'fixed_bonus'
                          ? formatCurrency(challenge.reward_value || 0)
                          : challenge.reward_value}
                      </span>
                    )}
                  </div>
                  {challenge.description && (
                    <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">{challenge.averageProgress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${challenge.averageProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{challenge.participantCount} participants</span>
                      <span>{getTimeRemaining(challenge.end_date)}</span>
                    </div>
                  </div>
                  {challenge.userParticipation?.isParticipating && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Your Progress</span>
                        <span className="font-medium text-purple-600">
                          {challenge.userParticipation.progress?.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedChallenge 
              ? challenges.find(c => c.id === selectedChallenge)?.challenge_name + ' Leaderboard'
              : `Top Performers - ${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}`}
          </h2>
        </div>
        
        {leaderboard.length === 0 ? (
          <div className="p-12 text-center">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No leaderboard data available</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.teamMemberId}
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  index < 3 ? 'bg-gradient-to-r from-purple-50 to-transparent' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getRankIcon(entry.rank)}
                      {entry.change !== undefined && getChangeIndicator(entry.change)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {entry.teamMember?.name || 'Unknown'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {entry.teamMember?.email}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedMetric === 'revenue' || selectedMetric === 'commissions'
                        ? formatCurrency(entry.score)
                        : entry.score.toLocaleString()}
                    </div>
                    {entry.metrics && (
                      <div className="text-sm text-gray-500">
                        {selectedMetric === 'revenue' && entry.metrics.units && (
                          <span>{entry.metrics.units} units</span>
                        )}
                        {selectedMetric === 'units' && entry.metrics.revenue && (
                          <span>{formatCurrency(entry.metrics.revenue)}</span>
                        )}
                        {selectedMetric === 'commissions' && entry.metrics.commissionCount && (
                          <span>{entry.metrics.commissionCount} sales</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Additional metrics for top 3 */}
                {index < 3 && entry.metrics && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {entry.metrics.revenue !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">Total Revenue</p>
                        <p className="text-sm font-medium">{formatCurrency(entry.metrics.revenue)}</p>
                      </div>
                    )}
                    {entry.metrics.units !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">Units Sold</p>
                        <p className="text-sm font-medium">{entry.metrics.units}</p>
                      </div>
                    )}
                    {entry.metrics.averageOrderValue !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">Avg Order Value</p>
                        <p className="text-sm font-medium">{formatCurrency(entry.metrics.averageOrderValue)}</p>
                      </div>
                    )}
                    {entry.metrics.uniqueProducts !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">Products Sold</p>
                        <p className="text-sm font-medium">{entry.metrics.uniqueProducts}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Challenge-specific progress */}
                {selectedChallenge && entry.progress !== undefined && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Challenge Progress</span>
                      <span className="font-medium">{entry.progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                    {entry.completed && (
                      <div className="flex items-center gap-1 mt-2 text-green-600">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">Challenge Completed!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achievement Badges */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { icon: <Trophy className="w-8 h-8" />, name: 'Top Seller', color: 'text-yellow-500' },
            { icon: <Target className="w-8 h-8" />, name: 'Goal Crusher', color: 'text-green-500' },
            { icon: <TrendingUp className="w-8 h-8" />, name: 'Rising Star', color: 'text-blue-500' },
            { icon: <Award className="w-8 h-8" />, name: 'MVP', color: 'text-purple-500' },
            { icon: <Star className="w-8 h-8" />, name: 'All Star', color: 'text-orange-500' },
            { icon: <Medal className="w-8 h-8" />, name: 'Champion', color: 'text-red-500' }
          ].map((badge, index) => (
            <div 
              key={index}
              className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className={`mb-2 ${badge.color}`}>{badge.icon}</div>
              <span className="text-xs font-medium text-gray-700">{badge.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}