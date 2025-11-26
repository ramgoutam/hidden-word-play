import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X } from "lucide-react";

interface Player {
  id: string;
  name: string;
  is_imposter: boolean;
  is_eliminated: boolean;
  votes: number;
  has_voted: boolean;
}

interface GameDetails {
  id: string;
  room_code: string;
  status: string;
  secret_word: string | null;
  category: string | null;
  current_round: number | null;
  total_rounds: number | null;
}

interface GameDetailsDialogProps {
  gameId: string | null;
  onClose: () => void;
}

export const GameDetailsDialog = ({ gameId, onClose }: GameDetailsDialogProps) => {
  const [game, setGame] = useState<GameDetails | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const fetchGameDetails = async () => {
      const { data: gameData } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("game_id", gameId)
        .order("name");

      if (gameData) setGame(gameData);
      if (playersData) setPlayers(playersData);
      setLoading(false);
    };

    fetchGameDetails();

    const channel = supabase
      .channel(`admin-game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        () => {
          fetchGameDetails();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          fetchGameDetails();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [gameId]);

  if (!gameId) return null;

  return (
    <Dialog open={!!gameId} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Game Details - Room {game?.room_code}</span>
            <Badge
              variant={
                game?.status === "playing" ? "default" : "secondary"
              }
            >
              {game?.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading game details...
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6">
              {/* Game Info */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Game Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Round:</span>
                    <span className="ml-2 font-medium">
                      {game?.current_round || 0} / {game?.total_rounds || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="ml-2 font-medium">
                      {game?.category || "-"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Secret Word:</span>
                    <span className="ml-2 font-bold text-primary">
                      {game?.secret_word || "-"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Players List */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">
                  Players ({players.length})
                </h3>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        player.is_imposter
                          ? "bg-destructive/10 border-destructive"
                          : "bg-background"
                      } ${
                        player.is_eliminated
                          ? "opacity-50"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{player.name}</span>
                        {player.is_imposter && (
                          <Badge variant="destructive">Imposter</Badge>
                        )}
                        {player.is_eliminated && (
                          <Badge variant="outline">Eliminated</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Votes:
                          </span>
                          <span className="font-bold">{player.votes}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Voted:
                          </span>
                          {player.has_voted ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Voting Summary */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Voting Summary</h3>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-muted-foreground">
                      Players who voted:
                    </span>
                    <span className="ml-2 font-medium">
                      {players.filter((p) => p.has_voted).length} /{" "}
                      {players.filter((p) => !p.is_eliminated).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Leading player:
                    </span>
                    <span className="ml-2 font-medium">
                      {players.reduce((max, p) =>
                        p.votes > max.votes ? p : max
                      , players[0])?.name || "-"}{" "}
                      ({Math.max(...players.map((p) => p.votes))} votes)
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
