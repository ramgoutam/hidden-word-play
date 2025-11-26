import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Users, Shield } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const generateRoomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setLoading(true);
    const code = generateRoomCode();
    const hostId = crypto.randomUUID();

    try {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .insert({
          room_code: code,
          host_id: hostId,
          status: "waiting",
        })
        .select()
        .single();

      if (gameError) throw gameError;

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          game_id: gameData.id,
          name: playerName.trim(),
        })
        .select()
        .single();

      if (playerError) throw playerError;

      localStorage.setItem(`player_${code}`, playerData.id);
      toast.success("Game created!");
      navigate(`/game/${code}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      toast.error("Please enter your name and room code");
      return;
    }

    setLoading(true);
    const code = roomCode.toUpperCase();

    try {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("room_code", code)
        .single();

      if (gameError || !gameData) {
        toast.error("Game not found");
        return;
      }

      if (gameData.status !== "waiting") {
        toast.error("Game already started");
        return;
      }

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          game_id: gameData.id,
          name: playerName.trim(),
        })
        .select()
        .single();

      if (playerError) throw playerError;

      localStorage.setItem(`player_${code}`, playerData.id);
      toast.success("Joined game!");
      navigate(`/game/${code}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to join game");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">Imposter</h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Find the imposter among your friends in this multiplayer word game
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Create Game</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Start a new game and invite your friends
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="create-name">Your Name</Label>
                <Input
                  id="create-name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                />
              </div>

              <Button
                onClick={handleCreateGame}
                className="w-full"
                size="lg"
                disabled={loading}
              >
                Create Game
              </Button>
            </div>
          </Card>

          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Join Game</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter a room code to join an existing game
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="join-name">Your Name</Label>
                <Input
                  id="join-name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                />
              </div>

              <div>
                <Label htmlFor="room-code">Room Code</Label>
                <Input
                  id="room-code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ABCD"
                  maxLength={4}
                  className="font-mono text-lg"
                />
              </div>

              <Button
                onClick={handleJoinGame}
                className="w-full"
                size="lg"
                variant="secondary"
                disabled={loading}
              >
                Join Game
              </Button>
            </div>
          </Card>
        </div>

        <div className="text-center">
          <Button
            onClick={() => navigate("/admin/login")}
            variant="ghost"
            className="text-muted-foreground"
          >
            <Shield className="w-4 h-4 mr-2" />
            Admin Access
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
