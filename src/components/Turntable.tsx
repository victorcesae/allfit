import { useEffect, useRef, useState } from "react";

interface Props {
  front: string;
  back?: string;
  alt: string;
  /** 0 = front, 1 = back (controlled by the thumbnails) */
  side: number;
  onSide: (side: number) => void;
}

/** Drag / swipe to turn the product in 3D between its real front and back photos. */
export function Turntable({ front, back, alt, side, onSide }: Props) {
  const [angle, setAngle] = useState(side * 180);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(!!back);
  const start = useRef<{ x: number; angle: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (dragging) return;
    // turn to the nearest angle that shows the requested side (0 = front, 1 = back)
    setAngle((a) => {
      let k = Math.round(a / 180);
      if (((k % 2) + 2) % 2 !== side) k += a / 180 > k ? 1 : -1;
      return k * 180;
    });
  }, [side, dragging]);

  if (!back) {
    return (
      <div className="turntable">
        <img className="tt-face" src={front} alt={alt} width={1080} height={1350} />
      </div>
    );
  }

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, angle, moved: false };
    setDragging(true);
    setHint(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    if (Math.abs(dx) > 4) start.current.moved = true;
    setAngle(start.current.angle + dx * 0.7);
  };
  const onUp = () => {
    if (!start.current) return;
    const moved = start.current.moved;
    start.current = null;
    setDragging(false);
    const snapped = moved ? Math.round(angle / 180) * 180 : angle + 180; // tap = turn
    setAngle(snapped);
    onSide(((Math.round(snapped / 180) % 2) + 2) % 2);
  };

  return (
    <div
      className={`turntable is-3d ${dragging ? "is-dragging" : ""}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label={`${alt}. Arraste para girar entre frente e costas.`}
    >
      <div className="tt-stage" style={{ transform: `rotateY(${angle}deg)` }}>
        <img className="tt-face" src={front} alt="" draggable={false} width={1080} height={1350} />
        <img className="tt-face tt-back" src={back} alt="" draggable={false} width={1080} height={1350} />
      </div>
      <span className="tt-floor" aria-hidden />
      {hint && (
        <span className="tt-hint" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2M18 2v4h-4M6 22v-4h4" /></svg>
          Arraste para girar
        </span>
      )}
    </div>
  );
}
