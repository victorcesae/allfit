import { useEffect, useRef, useState } from "react";
import { imageUrl, typeLabel, viewLabel, BOTTOMS, type Product } from "../catalog";
import { STORE } from "../config";
import { whatsappUrl, whatsappSizeHelpUrl } from "../whatsapp";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon, WhatsAppIcon, CheckIcon } from "./Icons";
import { Turntable } from "./Turntable";

interface Props {
  product: Product;
  variants: Product[];
  onClose: () => void;
  onSwitch: (p: Product) => void;
  onAdd: (p: Product, size: string, qty: number) => void;
}

export function ProductModal({ product: p, variants, onClose, onSwitch, onAdd }: Props) {
  const [view, setView] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const [added, setAdded] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setView(0);
    setNeedSize(false);
    setAdded(false);
  }, [p.id]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setView((v) => (v + 1) % p.photos.length);
      if (e.key === "ArrowLeft") setView((v) => (v - 1 + p.photos.length) % p.photos.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose, p.photos.length]);

  const requireSize = () => {
    if (size) return true;
    setNeedSize(true);
    document.getElementById("size-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  };

  const add = () => {
    if (!requireSize()) return;
    onAdd(p, size!, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const orderNow = (e: React.MouseEvent) => {
    if (!requireSize()) e.preventDefault();
  };

  const bottom = BOTTOMS.find((b) => b.id === p.bottom);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pm-title" tabIndex={-1} ref={dialog}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </button>

        <div className="gallery">
          <div className="gallery-main">
            {view < 2 ? (
              <Turntable
                key={p.id}
                front={imageUrl(p, 0)}
                back={p.photos.length > 1 ? imageUrl(p, 1) : undefined}
                alt={`${p.name} ${p.color}`}
                side={view}
                onSide={setView}
              />
            ) : (
              <div className="turntable">
                <img className="tt-face" src={imageUrl(p, view)} alt={`${p.name} ${p.color} — ${viewLabel(view)}`} width={1080} height={1350} />
              </div>
            )}
            {p.photos.length > 1 && <span className="view-pill">{viewLabel(view)}</span>}
          </div>
          {p.photos.length > 1 && (
            <div className="thumbs" role="tablist" aria-label="Fotos do produto">
              {p.photos.map((_, n) => (
                <button key={n} role="tab" aria-selected={n === view} className={`thumb ${n === view ? "is-active" : ""}`} onClick={() => setView(n)}>
                  <img src={imageUrl(p, n)} alt="" width={86} height={108} />
                  <span>{viewLabel(n)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="details">
          <h2 id="pm-title" className="details-title">{p.name}</h2>
          <p className="details-meta">
            {typeLabel[p.type]}
            {bottom && ` ${bottom.label.toLowerCase()}`} · valor sob consulta no WhatsApp
          </p>

          <div className="field">
            <div className="field-head">
              <span>Cor</span>
              <strong>{p.color}</strong>
            </div>
            <div className="swatches">
              {variants.map((v) => (
                <button
                  key={v.id}
                  className={`swatch ${v.id === p.id ? "is-active" : ""}`}
                  style={{ ["--sw" as string]: v.hex }}
                  onClick={() => onSwitch(v)}
                  aria-label={v.color}
                  title={v.color}
                  aria-pressed={v.id === p.id}
                />
              ))}
            </div>
          </div>

          <div className={`field ${needSize && !size ? "has-error" : ""}`} id="size-picker">
            <div className="field-head">
              <span>Tamanho</span>
              <strong className={size ? "" : "muted"}>{size ?? "Selecione"}</strong>
            </div>
            <div className="sizes" role="radiogroup" aria-label="Tamanho" style={{ gridTemplateColumns: `repeat(${STORE.sizes.length}, 1fr)` }}>
              {STORE.sizes.map((s) => (
                <button key={s} role="radio" aria-checked={size === s} className={`size ${size === s ? "is-active" : ""}`} onClick={() => { setSize(s); setNeedSize(false); }}>
                  {s}
                </button>
              ))}
            </div>
            {needSize && !size && <p className="field-error" role="alert">Escolha um tamanho para continuar.</p>}
            <p className="hint">
              Em dúvida no tamanho?{" "}
              <a href={whatsappSizeHelpUrl(p)} target="_blank" rel="noopener noreferrer">Pergunte no WhatsApp</a>
            </p>
          </div>

          <div className="field">
            <div className="field-head"><span>Quantidade</span></div>
            <div className="stepper">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir"><MinusIcon size={16} /></button>
              <output aria-live="polite">{qty}</output>
              <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Aumentar"><PlusIcon size={16} /></button>
            </div>
          </div>

          <div className="actions">
            <a
              className="btn btn-primary btn-lg"
              href={size ? whatsappUrl([{ product: p, size, qty }]) : "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={orderNow}
            >
              <WhatsAppIcon /> Pedir pelo WhatsApp
            </a>
            <button className={`btn btn-ghost btn-lg btn-add ${added ? "is-done" : ""}`} onClick={add} aria-label={added ? "Adicionado à sacola" : "Adicionar à sacola"}>
              {added ? <CheckIcon /> : <BagIcon />}
              <span className="btn-label">{added ? "Adicionado à sacola" : "Adicionar à sacola"}</span>
            </button>
          </div>

          <p className="fine-print">
            O pedido é finalizado no WhatsApp: a mensagem já vai com a peça, a cor e o tamanho.
          </p>
        </div>
      </div>
    </div>
  );
}
