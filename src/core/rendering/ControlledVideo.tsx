import { useEffect, useRef, useState } from "react";

type ControlledVideoProps = {
  ariaLabel?: string;
  className?: string;
  onError?: () => void;
  onLoadedData?: () => void;
  play: boolean;
  src: string;
};

/** Synchronizes media playback immediately because HTMLVideoElement ignores later autoPlay prop changes. */
export function ControlledVideo({
  ariaLabel,
  className,
  onError,
  onLoadedData,
  play,
  src
}: ControlledVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [documentVisible, setDocumentVisible] = useState(
    () => document.visibilityState !== "hidden"
  );
  const [elementVisible, setElementVisible] = useState(
    () => typeof IntersectionObserver === "undefined"
  );
  const shouldPlay = play && documentVisible && elementVisible;

  useEffect(() => {
    const handleVisibility = () => setDocumentVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setElementVisible(entry?.isIntersecting ?? false),
      { rootMargin: "100px" }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.getAttribute("src") !== src) video.setAttribute("src", src);

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (shouldPlay) {
      void video.play()?.catch(() => undefined);
      return;
    }

    video.pause();
    video.currentTime = 0;
  }, [shouldPlay, src]);

  return (
    <video
      aria-label={ariaLabel}
      autoPlay={shouldPlay}
      className={className}
      loop
      muted
      onError={onError}
      onLoadedData={onLoadedData}
      playsInline
      preload={shouldPlay ? "auto" : "metadata"}
      ref={videoRef}
      src={src}
    />
  );
}
