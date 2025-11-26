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
import { Shield, LogOut, AlertCircle, Users, Eye } from "lucide-react";
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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchGames();

    const channel = supabase
      .channel("admin-games")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
        },
        () => {
          fetchGames();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
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
    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false });

    if (gamesData) {
      const gamesWithDetails = await Promise.all(
        gamesData.map(async (game) => {
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

    setLoading(false);
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
                        <Button
                          onClick={() => setSelectedGameId(game.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
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
