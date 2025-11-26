import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Crown, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Player {
  id: string;
  name: string;
  is_imposter: boolean;
  is_eliminated: boolean;
  votes: number;
}

interface Game {
  id: string;
  room_code: string;
  status: string;
  secret_word: string | null;
  category: string | null;
  host_id: string;
}

const Game = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomCode) return;

    const fetchGameData = async () => {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("room_code", roomCode.toUpperCase())
        .single();

      if (gameError || !gameData) {
        toast.error("Game not found");
        navigate("/");
        return;
      }

      setGame(gameData);

      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("game_id", gameData.id)
        .order("created_at", { ascending: true });

      if (playersData) {
        setPlayers(playersData);
        const playerId = localStorage.getItem(`player_${roomCode}`);
        const player = playersData.find((p) => p.id === playerId);
        setCurrentPlayer(player || null);
      }

      setLoading(false);
    };

    fetchGameData();

    // Subscribe to game changes
    const gameChannel = supabase
      .channel(`game-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `room_code=eq.${roomCode.toUpperCase()}`,
        },
        (payload) => {
          console.log("Game updated:", payload.new);
          setGame(payload.new as Game);
        }
      )
      .subscribe();

    // Subscribe to players changes
    const playersChannel = supabase
      .channel(`players-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
        },
        async (payload) => {
          console.log("Players changed:", payload);
          // Fetch fresh player data when any change occurs
          const { data: gameData } = await supabase
            .from("games")
            .select("*")
            .eq("room_code", roomCode.toUpperCase())
            .single();

          if (gameData) {
            const { data: freshPlayers } = await supabase
              .from("players")
              .select("*")
              .eq("game_id", gameData.id)
              .order("created_at", { ascending: true });

            if (freshPlayers) {
              console.log("Updated players list:", freshPlayers);
              setPlayers(freshPlayers);
              
              // Update current player if needed
              const playerId = localStorage.getItem(`player_${roomCode}`);
              const player = freshPlayers.find((p) => p.id === playerId);
              if (player) {
                setCurrentPlayer(player);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      gameChannel.unsubscribe();
      playersChannel.unsubscribe();
    };
  }, [roomCode, navigate]);

  const handleStartGame = async () => {
    if (!game || !currentPlayer) return;

    const words = {
      Animals: ["Dog", "Cat", "Elephant", "Lion", "Tiger", "Bear", "Zebra", "Giraffe"],
      Food: ["Pizza", "Burger", "Sushi", "Pasta", "Taco", "Salad", "Steak", "Soup"],
      Objects: ["Car", "Phone", "Book", "Chair", "Table", "Lamp", "Clock", "Mirror"],
    };

    const category = Object.keys(words)[Math.floor(Math.random() * 3)] as keyof typeof words;
    const word = words[category][Math.floor(Math.random() * words[category].length)];
    const imposterIndex = Math.floor(Math.random() * players.length);

    await supabase
      .from("games")
      .update({ status: "playing", secret_word: word, category })
      .eq("id", game.id);

    for (let i = 0; i < players.length; i++) {
      await supabase
        .from("players")
        .update({ is_imposter: i === imposterIndex })
        .eq("id", players[i].id);
    }

    toast.success("Game started!");
  };

  const handleVote = async (playerId: string) => {
    const { data: player } = await supabase
      .from("players")
      .select("votes")
      .eq("id", playerId)
      .single();

    if (player) {
      await supabase
        .from("players")
        .update({ votes: player.votes + 1 })
        .eq("id", playerId);

      toast.success("Vote recorded!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (!game || !currentPlayer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-center mb-2">Game Not Found</h2>
          <p className="text-muted-foreground text-center mb-4">
            This game doesn't exist or you haven't joined it yet.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Return Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Room: {game.room_code}</h1>
          <p className="text-muted-foreground">
            {game.status === "waiting" ? "Waiting for players..." : "Game in progress"}
          </p>
        </div>

        {game.status === "waiting" && (
          <Card className="p-8 mb-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Users className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-bold">Lobby</h2>
            </div>

            <div className="space-y-3 mb-6">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 bg-secondary rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    {player.id === game.host_id && (
                      <Crown className="w-5 h-5 text-primary" />
                    )}
                    <span className="font-medium">{player.name}</span>
                  </div>
                  {player.id === currentPlayer.id && (
                    <span className="text-sm text-primary font-medium">You</span>
                  )}
                </div>
              ))}
            </div>

            {currentPlayer.id === game.host_id && players.length >= 3 && (
              <Button onClick={handleStartGame} className="w-full" size="lg">
                Start Game
              </Button>
            )}

            {players.length < 3 && (
              <p className="text-center text-sm text-muted-foreground">
                Need at least 3 players to start
              </p>
            )}
          </Card>
        )}

        {game.status === "playing" && (
          <>
            <Card className="p-8 mb-8">
              {currentPlayer.is_imposter ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-destructive-foreground" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">You are the IMPOSTER</h2>
                  <p className="text-lg text-muted-foreground">
                    Try to blend in and guess the secret word!
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Category: {game.category}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">The Secret Word is:</h2>
                  <p className="text-4xl font-bold text-primary">{game.secret_word}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Find the imposter among you!
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-8">
              <h3 className="text-xl font-bold mb-4">Vote to Eliminate</h3>
              <div className="space-y-3">
                {players
                  .filter((p) => !p.is_eliminated)
                  .map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-secondary rounded-2xl"
                    >
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {player.votes} votes
                        </span>
                        {player.id !== currentPlayer.id && (
                          <Button
                            onClick={() => handleVote(player.id)}
                            variant="outline"
                            size="sm"
                          >
                            Vote
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Game;
