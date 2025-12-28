import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, Square, Zap, Save, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickActionsBarProps {
  sessionState: "idle" | "active" | "paused" | "breakthrough";
  questionCount?: number;
  maxQuestions?: number;
  timeElapsed?: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkip: () => void;
  onSave: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function QuickActionsBar({
  sessionState,
  questionCount = 0,
  maxQuestions = 2,
  timeElapsed = 0,
  onPause,
  onResume,
  onStop,
  onSkip,
  onSave,
}: QuickActionsBarProps) {
  const isPaused = sessionState === "paused";
  const hasActiveSession = sessionState === "active" || sessionState === "paused";
  const isBreakthrough = sessionState === "breakthrough";

  return (
    <AnimatePresence>
      {(hasActiveSession || isBreakthrough) && (
        <motion.header
          className={cn(
            "fixed top-0 left-0 right-0 z-[98]",
            "flex items-center justify-center gap-6 px-6 py-3",
            "bg-background/60 backdrop-blur-xl",
            "border-b border-border/30"
          )}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Session Info - Left */}
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-mono">{formatTime(timeElapsed)}</span>
            </div>
            
            {/* Progress Indicator */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: maxQuestions }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      i < questionCount
                        ? "bg-accent"
                        : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {questionCount}/{maxQuestions}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border/50" />

          {/* Action Buttons - Center */}
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-2">
              {/* Pause/Resume - Primary visual hierarchy */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    className={cn(
                      "h-10 w-10 flex items-center justify-center rounded-xl",
                      "transition-all cursor-pointer",
                      isPaused
                        ? "bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30"
                        : "bg-warning/20 border border-warning/40 text-warning hover:bg-warning/30"
                    )}
                    onClick={isPaused ? onResume : onPause}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isPaused ? <Play size={18} /> : <Pause size={18} />}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{isPaused ? "Resume" : "Pause"} <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd></p>
                </TooltipContent>
              </Tooltip>

              {/* Stop - Destructive action, secondary hierarchy */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    className={cn(
                      "h-10 w-10 flex items-center justify-center rounded-xl",
                      "bg-destructive/10 border border-destructive/30",
                      "text-destructive/80 hover:text-destructive",
                      "hover:bg-destructive/20 transition-all cursor-pointer"
                    )}
                    onClick={onStop}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Square size={16} />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Stop <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd></p>
                </TooltipContent>
              </Tooltip>

              {/* Divider */}
              <div className="h-6 w-px bg-border/30 mx-1" />

              {/* Skip to Breakthrough - Accent action */}
              {!isBreakthrough && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      className={cn(
                        "h-10 px-4 flex items-center gap-2 rounded-xl",
                        "bg-secondary/20 border border-secondary/40",
                        "text-secondary hover:bg-secondary/30",
                        "transition-all cursor-pointer font-medium text-sm"
                      )}
                      onClick={onSkip}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Zap size={16} />
                      <span className="hidden sm:inline">Breakthrough</span>
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Skip to Breakthrough <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-xs">B</kbd></p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Save - Tertiary hierarchy */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    className={cn(
                      "h-10 w-10 flex items-center justify-center rounded-xl",
                      "bg-accent/10 border border-accent/30",
                      "text-accent/80 hover:text-accent",
                      "hover:bg-accent/20 transition-all cursor-pointer"
                    )}
                    onClick={onSave}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Save size={16} />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Save <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+S</kbd></p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* Status Badge - Right */}
          <div className="flex items-center gap-2">
            <div className="h-6 w-px bg-border/50" />
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide",
                sessionState === "active" && "bg-accent/20 text-accent border border-accent/30",
                sessionState === "paused" && "bg-warning/20 text-warning border border-warning/30",
                sessionState === "breakthrough" && "bg-secondary/20 text-secondary border border-secondary/30"
              )}
            >
              {sessionState === "active" && "Recording"}
              {sessionState === "paused" && "Paused"}
              {sessionState === "breakthrough" && "✨ Breakthrough"}
            </div>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
