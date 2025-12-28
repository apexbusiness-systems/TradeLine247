import { Mic, MicOff, Square, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface MicButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  isPaused?: boolean;
  onClick: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

export function MicButton({
  isRecording,
  isProcessing,
  isSupported,
  isPaused = false,
  onClick,
  onPause,
  onStop,
}: MicButtonProps) {
  if (!isSupported) {
    return (
      <Button
        variant="outline"
        size="lg"
        disabled
        className="h-16 w-16 rounded-full glass-card"
      >
        <MicOff className="h-6 w-6 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <div className="relative flex items-center gap-3">
      {/* Stop Button - visible when recording */}
      <AnimatePresence>
        {isRecording && onStop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              onClick={onStop}
              size="lg"
              variant="ghost"
              className={cn(
                "h-12 w-12 rounded-full",
                "bg-destructive/20 border border-destructive/40",
                "hover:bg-destructive/30 transition-all"
              )}
            >
              <Square className="h-4 w-4 text-destructive fill-destructive" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Mic Button */}
      <div className="relative">
        {/* Outer glow ring when not recording */}
        {!isRecording && !isProcessing && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-secondary to-accent opacity-20 blur-xl animate-pulse" />
        )}
        
        <Button
          onClick={onClick}
          disabled={isProcessing}
          size="lg"
          className={cn(
            "relative h-20 w-20 rounded-full transition-all duration-500",
            "border-2 backdrop-blur-sm",
            isRecording
              ? "bg-destructive border-destructive/50 hover:bg-destructive/90 mic-pulse"
              : "bg-gradient-to-br from-primary to-secondary border-primary/30 hover:scale-105 shadow-glow"
          )}
        >
          {isRecording ? (
            <Square className="h-6 w-6 fill-current text-destructive-foreground" />
          ) : (
            <Mic className="h-8 w-8 text-primary-foreground drop-shadow-lg" />
          )}
        </Button>
        
        {/* Recording indicator ring */}
        {isRecording && (
          <div className="absolute -inset-2 rounded-full border-2 border-destructive/50 animate-ping" />
        )}
      </div>

      {/* Pause Button - visible when recording */}
      <AnimatePresence>
        {isRecording && onPause && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              onClick={onPause}
              size="lg"
              variant="ghost"
              className={cn(
                "h-12 w-12 rounded-full",
                isPaused 
                  ? "bg-accent/20 border border-accent/40 hover:bg-accent/30"
                  : "bg-warning/20 border border-warning/40 hover:bg-warning/30",
                "transition-all"
              )}
            >
              {isPaused ? (
                <Play className="h-4 w-4 text-accent" />
              ) : (
                <Pause className="h-4 w-4 text-warning" />
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
