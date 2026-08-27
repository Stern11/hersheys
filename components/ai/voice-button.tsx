"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isVoiceInputSupported, speechRecognitionCtor, transcriptFromEvent, type SpeechRecognitionLike } from "@/lib/ai-copilot/voice";

/**
 * Voice input — present only where it works.
 *
 * The previous build rendered a microphone on the top bar and in the copilot
 * panel on every route, and it did nothing anywhere. A permanently dead
 * control is worse than no control, because a planner cannot distinguish it
 * from a broken one. This component renders NOTHING unless the browser
 * actually exposes the Web Speech API, and where it does render, pressing it
 * starts real recognition and the transcript is submitted through the exact
 * same path as typed text.
 *
 * Support is detected in an effect rather than during render so the server
 * HTML and the first client render agree (the server has no `window`).
 */
export function VoiceButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(isVoiceInputSupported());
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  if (!supported) return null;

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function start() {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = transcriptFromEvent(event);
      if (text) onTranscript(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      aria-pressed={listening}
      title={listening ? "Listening — click to stop" : "Voice input"}
      onClick={() => (listening ? stop() : start())}
      className={listening ? "text-[var(--risk-critical)]" : undefined}
    >
      {listening ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
    </Button>
  );
}
