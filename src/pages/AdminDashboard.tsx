import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, LogOut, AlertCircle, Users, Eye, Trash2, TrendingUp, BarChart3, Award } from "lucide-react";
import { toast } from "sonner";
import { GameDetailsDialog } from "@/components/admin/GameDetailsDialog";

interface Game {
  id: string;
  room_code: string;
  status: string;
  secret_word: string | null;
  category: string | null;
  player_count: number;
  imposter_name: string | null;
}

interface GameStats {
  totalGamesToday: number;
  averagePlayersPerGame: number;
  popularCategories: { category: string; count: number }[];
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [stats, setStats] = useState<GameStats>({
    totalGamesToday: 0,
    averagePlayersPerGame: 0,
    popularCategories: [],
  });

  useEffect(() => {
    checkAuth();
    fetchGames();
    fetchStats();

    const channel = supabase
      .channel("admin-games")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
        },
        (payload) => {
          console.log("Game change detected:", payload);
          // If a game is finished, remove it immediately from the list
          if (payload.eventType === "UPDATE" && payload.new && (payload.new as any).status === "finished") {
            setGames((prevGames) => prevGames.filter((g) => g.id !== (payload.new as any).id));
            fetchStats(); // Update stats when game finishes
          } else {
            // For other changes, refetch to get updated data
            fetchGames();
            fetchStats();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
        },
        () => {
          // When players join/leave, refresh the list
          console.log("Player change detected, refreshing games");
          fetchGames();
        }
      )
      .subscribe();

    // Periodic refresh every 5 seconds to ensure data accuracy
    const interval = setInterval(() => {
      fetchGames();
      fetchStats();
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/admin/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      await supabase.auth.signOut();
      navigate("/admin/login");
      toast.error("Access denied");
    }
  };

  const fetchGames = async () => {
    try {
      const { data: gamesData, error } = await supabase
        .from("games")
        .select("*")
        .in("status", ["waiting", "playing"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching games:", error);
        setLoading(false);
        return;
      }

      if (gamesData) {
        // Only include truly active games (waiting or playing)
        const activeGames = gamesData.filter(
          (game) =>
            game.status === "waiting" || game.status === "playing"
        );

        console.log("Active games found:", activeGames.length);

        const gamesWithDetails = await Promise.all(
          activeGames.map(async (game) => {
            const { data: players } = await supabase
              .from("players")
              .select("*")
              .eq("game_id", game.id);

            const imposter = players?.find((p) => p.is_imposter);

            return {
              ...game,
              player_count: players?.length || 0,
              imposter_name: imposter?.name || null,
            };
          })
        );

        setGames(gamesWithDetails);
      }
    } catch (error) {
      console.error("Error in fetchGames:", error);
    }

    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch all games created today
      const { data: todayGames, error } = await supabase
        .from("games")
        .select("id, category, created_at")
        .gte("created_at", today.toISOString());

      if (error) {
        console.error("Error fetching stats:", error);
        return;
      }

      if (todayGames) {
        const totalGamesToday = todayGames.length;

        // Calculate average players per game
        let totalPlayers = 0;
        for (const game of todayGames) {
          const { data: players } = await supabase
            .from("players")
            .select("id")
            .eq("game_id", game.id);
          totalPlayers += players?.length || 0;
        }
        const averagePlayersPerGame = totalGamesToday > 0 
          ? Math.round((totalPlayers / totalGamesToday) * 10) / 10 
          : 0;

        // Calculate popular categories
        const categoryCounts: Record<string, number> = {};
        todayGames.forEach((game) => {
          if (game.category) {
            categoryCounts[game.category] = (categoryCounts[game.category] || 0) + 1;
          }
        });

        const popularCategories = Object.entries(categoryCounts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        setStats({
          totalGamesToday,
          averagePlayersPerGame,
          popularCategories,
        });
      }
    } catch (error) {
      console.error("Error in fetchStats:", error);
    }
  };

  const handleCloseGame = async (gameId: string, roomCode: string) => {
    if (confirm(`Are you sure you want to close game ${roomCode}?`)) {
      const { error } = await supabase
        .from("games")
        .update({ status: "finished" })
        .eq("id", gameId);

      if (error) {
        console.error("Error closing game:", error);
        toast.error("Failed to close game");
      } else {
        // Immediately remove from local state
        setGames((prevGames) => prevGames.filter((g) => g.id !== gameId));
        toast.success("Game closed successfully");
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
    toast.success("Logged out");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Games Today</p>
                <p className="text-3xl font-bold">{stats.totalGamesToday}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Players/Game</p>
                <p className="text-3xl font-bold">{stats.averagePlayersPerGame}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Popular Categories</p>
                {stats.popularCategories.length > 0 ? (
                  <div className="space-y-1">
                    {stats.popularCategories.map((cat) => (
                      <div key={cat.category} className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.category}</span>
                        <span className="text-xs text-muted-foreground">({cat.count})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Active Games</h2>
            <p className="text-muted-foreground">Monitor all game rooms in real-time</p>
          </div>

          {games.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No active games</p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Players</TableHead>
                    <TableHead>Secret Word</TableHead>
                    <TableHead>Imposter</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game) => (
                    <TableRow key={game.id}>
                      <TableCell className="font-mono font-bold">
                        {game.room_code}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            game.status === "waiting"
                              ? "bg-secondary text-secondary-foreground"
                              : game.status === "playing"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {game.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {game.player_count}
                        </div>
                      </TableCell>
                      <TableCell>
                        {game.secret_word ? (
                          <span className="font-medium">{game.secret_word}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {game.imposter_name ? (
                          <span className="font-medium text-destructive">
                            {game.imposter_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setSelectedGameId(game.id)}
                            variant="outline"
                            size="sm"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button
                            onClick={() => handleCloseGame(game.id, game.room_code)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Close
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <GameDetailsDialog
          gameId={selectedGameId}
          onClose={() => setSelectedGameId(null)}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
