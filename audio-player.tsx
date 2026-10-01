// Office Viewer — audio player for the media opener: a waveform you click or
// drag to seek, play/pause, stop, ±10 s, speed, loop and volume.
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  GoBackward10SecIcon,
  GoForward10SecIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  StopIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "./i18n";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const RATE_KEY = "office-viewer:audio-rate";
const BARS = 400;
/** Decoding keeps the whole PCM in memory, so long recordings get a plain progress bar. */
const MAX_WAVEFORM_SECONDS = 10 * 60;

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  return h ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

async function waveform(blob: Blob): Promise<Float32Array> {
  const audio = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
  const step = Math.max(1, Math.floor(audio.length / BARS));
  const peaks = new Float32Array(BARS);
  let top = 0;
  for (let bar = 0; bar < BARS; bar++) {
    let peak = 0;
    for (let i = bar * step; i < Math.min(audio.length, (bar + 1) * step); i += 4) {
      for (const data of channels) peak = Math.max(peak, Math.abs(data[i]));
    }
    peaks[bar] = peak;
    top = Math.max(top, peak);
  }
  return top ? peaks.map((peak) => peak / top) : peaks;
}

function ControlButton({ label, icon, onClick, active, large }: { label: string; icon: IconSvgElement; onClick(): void; active?: boolean; large?: boolean }) {
  return (
    <span title={label} className="shrink-0">
      <Button
        variant={large ? "default" : "ghost"}
        size="icon"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(large ? "size-12 rounded-full" : "size-10 text-muted-foreground hover:text-foreground", active && "bg-accent text-foreground")}
      >
        <HugeiconsIcon icon={icon} className={large ? "size-6" : "size-5"} />
      </Button>
    </span>
  );
}

export function AudioPlayer({ src, blob }: { src: string; blob: Blob | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(() => {
    const saved = Number(globalThis.localStorage?.getItem(RATE_KEY));
    return RATES.includes(saved) ? saved : 1;
  });
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPeaks(null);
    setFailed(false);
    setPlaying(false);
    setTime(0);
  }, [src]);

  useEffect(() => {
    if (!blob || !duration || duration > MAX_WAVEFORM_SECONDS) return;
    let alive = true;
    waveform(blob).then((next) => alive && setPeaks(next)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [blob, duration]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate, src]);

  // Smooth progress while playing; timeupdate alone fires only ~4 times a second.
  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function tick() {
      if (audio.current) setTime(audio.current.currentTime);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const draw = useCallback(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = globalThis.devicePixelRatio || 1;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    }
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const color = getComputedStyle(element).color;
    const progress = duration ? Math.min(1, time / duration) : 0;
    context.fillStyle = color;
    if (!peaks) {
      context.globalAlpha = 0.25;
      context.fillRect(0, height / 2 - 2, width, 4);
      context.globalAlpha = 1;
      context.fillRect(0, height / 2 - 2, width * progress, 4);
      return;
    }
    const count = Math.max(1, Math.min(peaks.length, Math.floor(width / 3)));
    const bar = width / count;
    for (let i = 0; i < count; i++) {
      let peak = 0;
      const from = Math.floor((i * peaks.length) / count);
      const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / count));
      for (let j = from; j < to; j++) peak = Math.max(peak, peaks[j]);
      const h = Math.max(2, peak * (height - 4));
      context.globalAlpha = (i + 0.5) / count <= progress ? 1 : 0.3;
      context.fillRect(i * bar + bar * 0.15, (height - h) / 2, Math.max(1, bar * 0.7), h);
    }
    context.globalAlpha = 1;
  }, [peaks, time, duration]);

  useEffect(draw, [draw]);

  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [draw]);

  const seekTo = (seconds: number) => {
    const element = audio.current;
    if (!element || !duration) return;
    element.currentTime = Math.max(0, Math.min(duration, seconds));
    setTime(element.currentTime);
  };

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setFailed(true));
    else element.pause();
  };

  const stop = () => {
    const element = audio.current;
    if (!element) return;
    element.pause();
    element.currentTime = 0;
    setTime(0);
  };

  const changeRate = (next: number) => {
    setRate(next);
    globalThis.localStorage?.setItem(RATE_KEY, String(next));
  };

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    seekTo(((event.clientX - box.left) / box.width) * duration);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.closest("button, input")) return;
    if (event.key === " " || event.key === "k") toggle();
    else if (event.key === "ArrowLeft") seekTo(time - 5);
    else if (event.key === "ArrowRight") seekTo(time + 5);
    else return;
    event.preventDefault();
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border bg-background p-4 shadow-sm outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        loop={loop}
        muted={muted}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          event.currentTarget.playbackRate = rate;
          event.currentTarget.volume = volume;
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />

      <div
        role="slider"
        aria-label={t("seek")}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${clock(time)} / ${clock(duration)}`}
        className="h-20 w-full cursor-pointer touch-none text-primary"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFromPointer(event);
        }}
      >
        <canvas ref={canvas} className="size-full" />
      </div>

      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{clock(time)}</span>
        <span>{clock(duration)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <ControlButton label={t("back10")} icon={GoBackward10SecIcon} onClick={() => seekTo(time - 10)} />
        <ControlButton label={playing ? t("pause") : t("play")} icon={playing ? PauseIcon : PlayIcon} onClick={toggle} large />
        <ControlButton label={t("forward10")} icon={GoForward10SecIcon} onClick={() => seekTo(time + 10)} />
        <ControlButton label={t("stop")} icon={StopIcon} onClick={stop} />
        <ControlButton label={t("loop")} icon={RepeatIcon} onClick={() => setLoop((value) => !value)} active={loop} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("speed")}>
          <span className="mr-1 text-xs text-muted-foreground">{t("speed")}</span>
          {RATES.map((value) => (
            <Button
              key={value}
              variant={value === rate ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={value === rate}
              className="h-8 min-w-11 px-2 text-xs tabular-nums"
              onClick={() => changeRate(value)}
            >
              {value}×
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ControlButton label={muted ? t("unmute") : t("mute")} icon={muted || volume === 0 ? VolumeMute01Icon : VolumeHighIcon} onClick={() => setMuted((value) => !value)} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label={t("volume")}
            className="w-24 accent-primary"
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              setMuted(next === 0);
              if (audio.current) audio.current.volume = next;
            }}
          />
        </div>
      </div>

      {failed ? <span role="alert" className="text-center text-xs text-muted-foreground">{t("cantPlayAudio")}</span> : null}
    </div>
  );
}
