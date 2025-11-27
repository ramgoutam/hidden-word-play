import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Crown, AlertCircle, Copy, Link as LinkIcon, LogOut } from "lucide-react";
import { toast } from "sonner";
import { sounds } from "@/lib/sounds";

interface Player {
  id: string;
  name: string;
  is_imposter: boolean;
  is_eliminated: boolean;
  votes: number;
  score: number;
  turn_order: number;
  has_voted: boolean;
}

interface Game {
  id: string;
  room_code: string;
  status: string;
  secret_word: string | null;
  category: string | null;
  host_id: string;
  total_rounds: number;
  current_round: number;
  used_words?: string[];
  results_revealed: boolean;
}

const Game = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [selectedRounds, setSelectedRounds] = useState(3);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [roundTransitioning, setRoundTransitioning] = useState(false);
  const [showEndGameDialog, setShowEndGameDialog] = useState(false);
  const [showLeaveGameDialog, setShowLeaveGameDialog] = useState(false);

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
      setShowResults(gameData.results_revealed || false);

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
          const updatedGame = payload.new as Game;
          const previousRound = game?.current_round;
          
          setGame(updatedGame);
          setShowResults(updatedGame.results_revealed || false);
          
          // Reset voting state when round changes
          if (previousRound && updatedGame.current_round !== previousRound) {
            console.log("Round changed, resetting vote state");
            setRoundTransitioning(true);
            // Clear transition state after a brief delay
            setTimeout(() => setRoundTransitioning(false), 500);
          }
          
          // Redirect all users to home when game ends
          if (updatedGame.status === "finished") {
            toast.success("Game ended!");
            setTimeout(() => navigate("/"), 2000);
          }
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
      Animals: [
        "Dog", "Cat", "Elephant", "Lion", "Tiger", "Bear", "Zebra", "Giraffe",
        "Monkey", "Penguin", "Dolphin", "Eagle", "Wolf", "Fox", "Rabbit", "Deer",
        "Kangaroo", "Panda", "Koala", "Owl", "Peacock", "Flamingo", "Crocodile", "Hippo"
      ],
      Food: [
        "Pizza", "Burger", "Sushi", "Pasta", "Taco", "Salad", "Steak", "Soup",
        "Sandwich", "Curry", "Ramen", "Burrito", "Lasagna", "Dumpling", "Pancake", "Waffle",
        "Omelette", "Kebab", "Noodles", "Rice", "Bread", "Cheese", "Chocolate", "Cookie"
      ],
      Objects: [
        "Car", "Phone", "Book", "Chair", "Table", "Lamp", "Clock", "Mirror",
        "Pen", "Laptop", "Watch", "Key", "Wallet", "Glasses", "Umbrella", "Backpack",
        "Camera", "Headphones", "Guitar", "Piano", "Bicycle", "Skateboard", "Ball", "Bottle"
      ],
    };

    // Get used words from the game
    const usedWords = game.used_words || [];
    
    // Filter available words by removing used ones
    const availableWordsByCategory = Object.entries(words).reduce((acc, [cat, wordList]) => {
      acc[cat as keyof typeof words] = wordList.filter(w => !usedWords.includes(w));
      return acc;
    }, {} as typeof words);

    // Check if we have any words left, if not reset
    const totalAvailable = Object.values(availableWordsByCategory).flat().length;
    const wordsToUse = totalAvailable > 0 ? availableWordsByCategory : words;
    const shouldResetUsedWords = totalAvailable === 0;

    // Select random category and word
    const categories = Object.keys(wordsToUse) as (keyof typeof words)[];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const categoryWords = wordsToUse[category];
    const word = categoryWords[Math.floor(Math.random() * categoryWords.length)];
    
    const imposterIndex = Math.floor(Math.random() * players.length);

    // Set turn order, reset scores, and assign imposter FIRST
    for (let i = 0; i < players.length; i++) {
      await supabase
        .from("players")
        .update({ 
          is_imposter: i === imposterIndex,
          turn_order: i,
          score: 0,
          votes: 0,
          has_voted: false
        })
        .eq("id", players[i].id);
    }

    // Small delay to ensure player updates propagate
    await new Promise(resolve => setTimeout(resolve, 300));

    // Update used words array
    const newUsedWords = shouldResetUsedWords ? [word] : [...usedWords, word];

    // Then update game state
    await supabase
      .from("games")
      .update({ 
        status: "playing", 
        secret_word: word, 
        category,
        total_rounds: selectedRounds,
        current_round: 1,
        used_words: newUsedWords
      })
      .eq("id", game.id);

    setCurrentTurn(0);
    toast.success("Game started!");
  };

  const handleStartNewRound = async () => {
    if (!game) return;

    const words = {
      Animals: [
        "Dog", "Cat", "Elephant", "Lion", "Tiger", "Bear", "Zebra", "Giraffe",
        "Monkey", "Penguin", "Dolphin", "Eagle", "Wolf", "Fox", "Rabbit", "Deer",
        "Kangaroo", "Panda", "Koala", "Owl", "Peacock", "Flamingo", "Crocodile", "Hippo"
      ],
      Food: [
        "Pizza", "Burger", "Sushi", "Pasta", "Taco", "Salad", "Steak", "Soup",
        "Sandwich", "Curry", "Ramen", "Burrito", "Lasagna", "Dumpling", "Pancake", "Waffle",
        "Omelette", "Kebab", "Noodles", "Rice", "Bread", "Cheese", "Chocolate", "Cookie"
      ],
      Objects: [
        "Car", "Phone", "Book", "Chair", "Table", "Lamp", "Clock", "Mirror",
        "Pen", "Laptop", "Watch", "Key", "Wallet", "Glasses", "Umbrella", "Backpack",
        "Camera", "Headphones", "Guitar", "Piano", "Bicycle", "Skateboard", "Ball", "Bottle"
      ],
    };

    // Get used words from the game
    const usedWords = game.used_words || [];
    
    // Filter available words by removing used ones
    const availableWordsByCategory = Object.entries(words).reduce((acc, [cat, wordList]) => {
      acc[cat as keyof typeof words] = wordList.filter(w => !usedWords.includes(w));
      return acc;
    }, {} as typeof words);

    // Check if we have any words left, if not reset
    const totalAvailable = Object.values(availableWordsByCategory).flat().length;
    const wordsToUse = totalAvailable > 0 ? availableWordsByCategory : words;
    const shouldResetUsedWords = totalAvailable === 0;

    // Select random category and word
    const categories = Object.keys(wordsToUse) as (keyof typeof words)[];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const categoryWords = wordsToUse[category];
    const word = categoryWords[Math.floor(Math.random() * categoryWords.length)];
    
    const imposterIndex = Math.floor(Math.random() * players.length);

    setRoundTransitioning(true);

    // Reset players for new round FIRST
    for (let i = 0; i < players.length; i++) {
      await supabase
        .from("players")
        .update({ 
          is_imposter: i === imposterIndex,
          votes: 0,
          is_eliminated: false,
          has_voted: false
        })
        .eq("id", players[i].id);
    }

    // Small delay to ensure player updates propagate
    await new Promise(resolve => setTimeout(resolve, 300));

    // Update used words array
    const newUsedWords = shouldResetUsedWords ? [word] : [...usedWords, word];

    // Then update game with new word and increment round
    await supabase
      .from("games")
      .update({ 
        secret_word: word, 
        category,
        current_round: game.current_round + 1,
        used_words: newUsedWords,
        results_revealed: false
      })
      .eq("id", game.id);

    // Reset local state
    setCurrentTurn(0);
    
    toast.success("New round started!");
    
    // Clear transition state
    setTimeout(() => setRoundTransitioning(false), 500);
  };

  const handleVote = async (playerId: string) => {
    if (!currentPlayer || currentPlayer.has_voted) {
      toast.error("You have already voted!");
      return;
    }

    const { data: player } = await supabase
      .from("players")
      .select("votes")
      .eq("id", playerId)
      .single();

    if (player) {
      // Update both the voted player's vote count and current player's has_voted status
      await supabase
        .from("players")
        .update({ votes: player.votes + 1 })
        .eq("id", playerId);

      await supabase
        .from("players")
        .update({ has_voted: true })
        .eq("id", currentPlayer.id);

      toast.success("Vote recorded!");
    }
  };

  const handleRevealResults = async () => {
    if (!game) return;
    
    // Calculate scores
    const imposter = players.find(p => p.is_imposter);
    const mostVoted = players
      .filter(p => !p.is_eliminated)
      .sort((a, b) => b.votes - a.votes)[0];
    
    const didPlayersWin = mostVoted?.id === imposter?.id;
    
    // Award points
    if (didPlayersWin) {
      // Players win - everyone except imposter gets 10 points
      for (const player of players) {
        if (!player.is_imposter) {
          await supabase
            .from("players")
            .update({ score: player.score + 10 })
            .eq("id", player.id);
        }
      }
    } else {
      // Imposter wins - imposter gets 20 points
      if (imposter) {
        await supabase
          .from("players")
          .update({ score: imposter.score + 20 })
          .eq("id", imposter.id);
      }
    }
    
    // Play dramatic sound effects
    sounds.drumRoll();
    setTimeout(() => sounds.reveal(), 1600);
    setTimeout(() => {
      if (didPlayersWin) {
        sounds.victory();
      } else {
        sounds.defeat();
      }
    }, 2000);
    
    // Set results_revealed in database so all players see results
    await supabase
      .from("games")
      .update({ results_revealed: true })
      .eq("id", game.id);
  };

  const handleEndGame = async () => {
    if (!game) return;
    
    await supabase
      .from("games")
      .update({ status: "finished" })
      .eq("id", game.id);
    
    setShowEndGameDialog(false);
    // No need to navigate here - the subscription will handle it for all users
  };

  const handleLeaveGame = async () => {
    if (!currentPlayer || !roomCode) return;

    await supabase
      .from("players")
      .delete()
      .eq("id", currentPlayer.id);

    localStorage.removeItem(`player_${roomCode}`);
    toast.success("Left the game");
    navigate("/");
  };

  const copyGameLink = () => {
    const gameUrl = `${window.location.origin}/game/${roomCode}`;
    navigator.clipboard.writeText(gameUrl);
    toast.success("Game link copied!");
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
  const hostPlayerId =
    players.length > 0 && game
      ? players.some((p) => p.id === game.host_id)
        ? game.host_id
        : players[0].id
      : null;

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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-bold">Lobby</h2>
              </div>
              {hostPlayerId && currentPlayer.id === hostPlayerId ? (
                <Button 
                  onClick={() => setShowEndGameDialog(true)} 
                  variant="destructive"
                  size="sm"
                >
                  End Game
                </Button>
              ) : (
                <Button 
                  onClick={() => setShowLeaveGameDialog(true)} 
                  variant="outline"
                  size="sm"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave
                </Button>
              )}
            </div>

            {/* Shareable Link */}
            <div className="mb-6 p-4 bg-secondary/50 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Share this game</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/game/${roomCode}`}
                  className="flex-1 px-3 py-2 text-sm bg-background rounded-lg border border-border"
                />
                <Button onClick={copyGameLink} size="sm" variant="outline">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 bg-secondary rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    {hostPlayerId && player.id === hostPlayerId && (
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

            {hostPlayerId && currentPlayer.id === hostPlayerId && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">Number of Rounds</label>
                  <div className="flex gap-2">
                    {[3, 5, 7, 10].map((num) => (
                      <Button
                        key={num}
                        variant={selectedRounds === num ? "default" : "outline"}
                        onClick={() => setSelectedRounds(num)}
                        className="flex-1"
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>

                {players.length >= 3 && (
                  <Button onClick={handleStartGame} className="w-full" size="lg">
                    Start Game
                  </Button>
                )}
              </>
            )}

            {players.length < 3 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Need at least 3 players to start
              </p>
            )}
          </Card>
        )}

        {game.status === "playing" && !roundTransitioning && (
          <>
            {/* Round and Score Display */}
            <Card className="p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Round</p>
                  <p className="text-2xl font-bold">{game.current_round} / {game.total_rounds}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-2">Scores</p>
                  <div className="flex gap-3 flex-wrap justify-end">
                    {players
                      .sort((a, b) => b.score - a.score)
                      .map((player) => (
                        <div key={player.id} className="text-center">
                          <p className="text-xs font-medium truncate max-w-[80px]">{player.name}</p>
                          <p className="text-lg font-bold text-primary">{player.score}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              
              {/* Turn Order */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Speaking Order</p>
                <div className="flex gap-2 overflow-x-auto">
                  {players
                    .sort((a, b) => a.turn_order - b.turn_order)
                    .map((player, index) => (
                      <div
                        key={player.id}
                        className="px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap bg-secondary"
                      >
                        {index + 1}. {player.name}
                      </div>
                    ))}
                </div>
              </div>
            </Card>

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
              {currentPlayer?.has_voted && !showResults && (
                <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
                  <p className="text-sm font-medium text-primary">✓ You have cast your vote</p>
                </div>
              )}

              {showResults && (
                <div className="mb-6 p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-2xl animate-scale-in">
                  <h4 className="text-lg font-bold mb-4 text-center animate-fade-in">Results</h4>
                  {(() => {
                    const imposter = players.find(p => p.is_imposter);
                    const mostVoted = players
                      .filter(p => !p.is_eliminated)
                      .sort((a, b) => b.votes - a.votes)[0];
                    const didWin = mostVoted?.id === imposter?.id;

                    return (
                      <div className="space-y-4">
                        <div className="text-center animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                          <p className="text-sm text-muted-foreground mb-2">The Imposter was:</p>
                          <p className="text-2xl font-bold text-destructive animate-pulse">{imposter?.name}</p>
                        </div>
                        <div className="text-center animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
                          <p className="text-sm text-muted-foreground mb-2">Most Voted:</p>
                          <p className="text-xl font-bold">{mostVoted?.name} ({mostVoted?.votes} votes)</p>
                        </div>
                        <div 
                          className={`text-center p-4 rounded-lg animate-scale-in transition-all duration-500 ${
                            didWin 
                              ? 'bg-green-500/20 border border-green-500/30' 
                              : 'bg-red-500/20 border border-red-500/30'
                          }`}
                          style={{ animationDelay: '0.6s', animationFillMode: 'both' }}
                        >
                          <p className="text-lg font-bold">
                            {didWin ? '🎉 Players Win!' : '😈 Imposter Wins!'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="space-y-3 mb-6">
                {players
                  .filter((p) => !p.is_eliminated)
                  .sort((a, b) => b.votes - a.votes)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 ${
                        showResults && player.is_imposter 
                          ? 'bg-destructive/20 border-2 border-destructive animate-pulse' 
                          : 'bg-secondary'
                      } ${showResults ? 'animate-fade-in' : ''}`}
                      style={showResults ? { animationDelay: `${0.8 + index * 0.1}s`, animationFillMode: 'both' } : {}}
                    >
                      <div className="flex items-center gap-3">
                        {showResults && index === 0 && player.votes > 0 && (
                          <span className="text-2xl">👑</span>
                        )}
                        <span className="font-medium">{player.name}</span>
                        {!showResults && player.has_voted && (
                          <span className="text-sm text-green-600 font-medium">✓ Voted</span>
                        )}
                        {showResults && player.is_imposter && (
                          <span className="text-sm font-bold text-destructive">(IMPOSTER)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {showResults && (
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-primary">{player.votes}</span>
                            <span className="text-sm text-muted-foreground">votes</span>
                          </div>
                        )}
                        {!showResults && player.id !== currentPlayer.id && (
                          <Button
                            onClick={() => handleVote(player.id)}
                            variant="outline"
                            size="sm"
                            disabled={currentPlayer?.has_voted}
                          >
                            Vote
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {hostPlayerId && currentPlayer.id === hostPlayerId && !showResults && (
                <Button 
                  onClick={handleRevealResults} 
                  className="w-full mb-3" 
                  variant="secondary"
                  size="lg"
                  disabled={!players.filter(p => !p.is_eliminated).every(p => p.has_voted)}
                >
                  Reveal Results {!players.filter(p => !p.is_eliminated).every(p => p.has_voted) && `(${players.filter(p => !p.is_eliminated && p.has_voted).length}/${players.filter(p => !p.is_eliminated).length} voted)`}
                </Button>
              )}

              {showResults && hostPlayerId && currentPlayer.id === hostPlayerId && (
                <div className="space-y-3">
                  {game.current_round < game.total_rounds ? (
                    <Button 
                      onClick={handleStartNewRound} 
                      className="w-full" 
                      size="lg"
                    >
                      Start Round {game.current_round + 1}
                    </Button>
                  ) : (
                    <div className="text-center p-4 bg-primary/10 rounded-lg mb-3">
                      <p className="text-lg font-bold">Game Complete!</p>
                      <p className="text-sm text-muted-foreground">Final Scores Above</p>
                    </div>
                  )}
                  <Button 
                    onClick={handleEndGame} 
                    className="w-full" 
                    variant="destructive"
                    size="lg"
                  >
                    End Game
                  </Button>
                </div>
              )}
            </Card>
          </>
        )}

        {game.status === "playing" && roundTransitioning && (
          <Card className="p-8 text-center">
            <p className="text-lg text-muted-foreground">Starting new round...</p>
          </Card>
        )}

        {/* End Game Confirmation Dialog */}
        <AlertDialog open={showEndGameDialog} onOpenChange={setShowEndGameDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End Game?</AlertDialogTitle>
              <AlertDialogDescription>
                This will end the game for all players. Everyone will be returned to the home page. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleEndGame} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                End Game
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Leave Game Confirmation Dialog */}
        <AlertDialog open={showLeaveGameDialog} onOpenChange={setShowLeaveGameDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave Game?</AlertDialogTitle>
              <AlertDialogDescription>
                You will be removed from this game and returned to the home page. You can rejoin using the room code if the game is still open.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLeaveGame}>
                Leave Game
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Game;
