'use client';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const q = query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        setLeaderboard(snapshot.docs.map(doc => doc.data()));
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  const getRankClass = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-yellow-400/50';
      case 2: return 'bg-gradient-to-r from-gray-300 to-gray-500 text-black shadow-gray-400/50';
      case 3: return 'bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-amber-600/50';
      default: return 'bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-purple-600/30';
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
              {/* Animated background */}
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          <div className="absolute inset-0 bg-[url('/background.gif')] bg-cover bg-center opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        </div>

      {/* Floating particles effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-yellow-400/30 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 mb-4">
            🏆 HALL OF FAME 🏆
          </h1>
          <p className="text-yellow-200 text-xl font-semibold">Top Maze Champions</p>
        </div>

        {/* Main leaderboard container */}
        <div className="w-full max-w-4xl bg-black/40 backdrop-blur-md rounded-3xl shadow-2xl border border-yellow-400/30 p-8 relative">
          {/* Glowing border effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400/20 via-transparent to-yellow-400/20"></div>
          
          <div className="relative z-10">
            {/* Header with home button */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="text-4xl">👑</div>
                <h2 className="text-3xl font-bold text-yellow-400">Leaderboard</h2>
              </div>
              <Button 
                onClick={() => router.push('/')} 
                className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold px-6 py-3 rounded-xl hover:from-yellow-300 hover:to-orange-300 transition-all duration-300 shadow-lg hover:shadow-yellow-400/25"
              >
                🏠 Back to Game
              </Button>
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
                <span className="ml-4 text-yellow-200 text-lg">Loading champions...</span>
              </div>
            )}

            {/* Leaderboard entries */}
            {!isLoading && (
              <div className="space-y-4">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎮</div>
                    <p className="text-yellow-200 text-xl font-semibold">No champions yet!</p>
                    <p className="text-gray-400 mt-2">Be the first to conquer the maze!</p>
                  </div>
                ) : (
                  leaderboard.map((user: any, i: number) => {
                    const imageUrl = user.photoURL && typeof user.photoURL === 'string' && user.photoURL.startsWith('http')
                      ? user.photoURL
                      : '/placeholder-user.jpg';
                    
                    return (
                      <div
                        key={user.email || i}
                        className={`relative group transition-all duration-300 hover:scale-105`}
                      >
                        {/* Glow effect for top 3 */}
                        {i < 3 && (
                          <div className={`absolute inset-0 rounded-2xl blur-xl opacity-50 ${getRankClass(i + 1).split(' ')[0]} ${getRankClass(i + 1).split(' ')[1]}`}></div>
                        )}
                        
                        <div className={`relative flex items-center gap-6 p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-2xl ${
                          i < 3 
                            ? `${getRankClass(i + 1)} border-yellow-400/50` 
                            : 'bg-gradient-to-r from-gray-800/80 to-gray-900/80 border-gray-600/50 hover:border-yellow-400/50'
                        }`}>
                          {/* Rank */}
                          <div className="flex flex-col items-center min-w-[60px]">
                            <span className="text-3xl mb-1">{getRankIcon(i + 1)}</span>
                            <span className={`text-2xl font-black ${i < 3 ? 'text-black' : 'text-yellow-400'}`}>
                              #{i + 1}
                            </span>
                          </div>

                          {/* Avatar */}
                          <div className="relative">
                            <img
                              src={imageUrl}
                              alt={user.displayName || user.email || 'avatar'}
                              className="w-16 h-16 rounded-full border-4 border-yellow-400/50 object-cover shadow-xl"
                              referrerPolicy="no-referrer"
                            />
                            {i < 3 && (
                              <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-black">
                                {i + 1}
                              </div>
                            )}
                          </div>

                          {/* Player info */}
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-xl font-bold truncate ${i < 3 ? 'text-black' : 'text-white'}`}>
                              {user.displayName || user.email}
                            </h3>
                            <p className={`text-sm opacity-80 ${i < 3 ? 'text-black' : 'text-gray-300'}`}>
                              Maze Master Level {Math.floor(user.points / 100) + 1}
                            </p>
                          </div>

                          {/* Score */}
                          <div className="text-right">
                            <div className={`text-3xl font-black ${i < 3 ? 'text-black' : 'text-yellow-400'}`}>
                              {user.points.toLocaleString()}
                            </div>
                            <div className={`text-sm font-semibold ${i < 3 ? 'text-black/70' : 'text-gray-400'}`}>
                              POINTS
                            </div>
                          </div>

                          {/* Achievement badges */}
                          <div className="flex gap-2">
                            {user.points >= 1000 && <span className="text-2xl" title="1000+ Points">💎</span>}
                            {user.points >= 500 && <span className="text-2xl" title="500+ Points">⭐</span>}
                            {user.points >= 100 && <span className="text-2xl" title="100+ Points">🔥</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-yellow-200/70 text-sm">
                🎯 Challenge yourself and climb the ranks! 🎯
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 