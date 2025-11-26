import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Share, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-3xl">Install Imposter Game</CardTitle>
          <CardDescription className="text-base mt-2">
            Install our app on your phone for the best experience!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isInstallable && (
            <Button onClick={handleInstallClick} size="lg" className="w-full">
              <Download className="w-5 h-5 mr-2" />
              Install Now
            </Button>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">How to Install:</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium">On iPhone (Safari)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tap the <Share className="w-4 h-4 inline mx-1" /> Share button at the bottom, then scroll down and tap "Add to Home Screen"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium">On Android (Chrome)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tap the menu (⋮) in the top right, then tap "Install app" or "Add to Home Screen"
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Benefits of Installing:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Works offline - play even without internet
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Faster loading and better performance
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Full screen experience with no browser UI
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Quick access from your home screen
                </li>
              </ul>
            </div>
          </div>

          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="w-full"
          >
            Back to Game
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
