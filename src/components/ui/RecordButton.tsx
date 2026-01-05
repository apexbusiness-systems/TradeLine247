/**
 * RecordButton - Responsive Voice Recording Button
 * FIX 2: Uses viewport-relative units (vw) with min-width constraints
 * Touch target: minimum 48px (WCAG compliance)
 */
import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface RecordButtonProps {
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  onRecordStart,
  onRecordStop,
  disabled = false,
  className,
  size = 'md',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);

    try {
      if (isRecording) {
        await onRecordStop?.();
        setIsRecording(false);
      } else {
        await onRecordStart?.();
        setIsRecording(true);
      }
    } catch (error) {
      console.error('[RecordButton] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isRecording, isLoading, disabled, onRecordStart, onRecordStop]);

  // Size variants using vw units with min-width constraints
  const sizeClasses = {
    sm: 'w-[15vw] h-[15vw] min-w-[60px] min-h-[60px] max-w-[80px] max-h-[80px]',
    md: 'w-[20vw] h-[20vw] min-w-[80px] min-h-[80px] max-w-[120px] max-h-[120px]',
    lg: 'w-[25vw] h-[25vw] min-w-[100px] min-h-[100px] max-w-[160px] max-h-[160px]',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      aria-pressed={isRecording}
      className={cn(
        // Base styles - responsive sizing with vw units
        sizeClasses[size],
        'rounded-full flex items-center justify-center',
        'transition-all duration-300 ease-out',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
        // Touch target compliance (48px minimum)
        'touch-action-manipulation',
        // State styles
        isRecording
          ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-500 animate-pulse-recording'
          : 'bg-primary hover:bg-primary/90 focus-visible:ring-primary',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        // Shadow and elevation
        'shadow-lg hover:shadow-xl active:shadow-md active:scale-95',
        className
      )}
      style={{
        // Ensure minimum touch target size of 48px
        minWidth: 'max(48px, 15vw)',
        minHeight: 'max(48px, 15vw)',
      }}
    >
      {isLoading ? (
        <Loader2 className={cn(iconSizes[size], 'text-white animate-spin')} />
      ) : isRecording ? (
        <MicOff className={cn(iconSizes[size], 'text-white')} />
      ) : (
        <Mic className={cn(iconSizes[size], 'text-white')} />
      )}
    </button>
  );
};

export default RecordButton;
