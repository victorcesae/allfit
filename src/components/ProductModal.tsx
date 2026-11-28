import { useEffect, useRef, useState } from "react";
import { views as viewsOf, typeLabel, BOTTOMS, COLORS, colorByName, type Product, type StoreColor } from "../catalog";
import { recolored } from "../recolor";
import { STORE, money, unitPrice, cashPrice, isPlus } from "../config";
import { whatsappUrl, whatsappSizeHelpUrl } from "../whatsapp";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon, WhatsAppIcon, CheckIcon } from "./Icons";
import { Turntable } from "./Turntable";

interface Props {
  product: Product;
  /** colour to open in (from a #p04/verde-militar link or a bag item); default: the photographed one */
  initialColor?: string;
  variants: Product[];
  onClose: () => void;
  onSwitch: (p: Product) => void;
  /** the chosen colour changed: App writes it into the link */
  onColor: (p: Product, color: string) => void;
  onAdd: (p: Product, size: string, qty: number, color: string) => void;
}

export function ProductModal({ product: p, initialColor, variants, onClose, onSwitch, onColor, onAdd }: Props) {
  const [view, setView] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const [added, setAdded] = useState(false);
  const [color, setColorState] = useState(initialColor ?? p.color);
  const setColor = (c: string) => { setColorState(c); onColor(p, c); };
  const [simUrls, setSimUrls] = useState<string[] | null>(null);
  const [painting, setPainting] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const views = viewsOf(p);
  // front/back pairs turn in 3D: the studio looks, and the mannequin photos
  const nLooks = p.looks ?? 0;
  const split = p.looksPartial ? p.photos.length : nLooks;      // where the second group starts
  const pairs = [[0, split], [split, views.length]]
    .map(([a, b]) => [a, Math.min(b, a + 2)])
    .filter(([a, b]) => b > a);

  useEffect(() => {
    setView(0);
    setNeedSize(false);
    setAdded(false);
    setColorState(initialColor ?? p.color);
  }, [p.id, p.color, initialColor]);

  // colour simulation: repaint the studio looks when the chosen colour isn't the photographed one;
  // the photos on the mannequin always stay the real piece in its real colour
  const simulated = color !== p.color;
  useEffect(() => {
    if (!simulated) { setSimUrls(null); setPainting(false); return; }
    const hex = colorByName(color)?.hex;
    if (!hex) return;
    let alive = true;
    setPainting(true);
    Promise.all(viewsOf(p).map((v) => (v.kind === "look" ? recolored(v, hex) : Promise.resolve(v.src))))
      .then((urls) => { if (alive) setSimUrls(urls); })
      .catch(() => { if (alive) setSimUrls(null); })
      .finally(() => { if (alive) setPainting(false); });
    return () => { alive = false; };
  }, [p, color, simulated]);

  const photo = (n: number) => (simulated && simUrls?.[n]) || views[n].src;
  const pair = pairs.find(([a, b]) => view >= a && view < b);

  const pickColor = (c: StoreColor) => {
    if (c.name === p.color) return setColor(c.name);
    const real = variants.find((v) => v.color === c.name);   // this model photographed in that colour
    if (real) return onSwitch(real);
    setColor(c.name);
    // the simulated colour shows on the studio looks only: switch to one if a mannequin photo is open
    if (views[view].kind === "photo" && nLooks) setView(views.findIndex((v) => v.kind === "look"));
  };

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setView((v) => (v + 1) % views.length);
      if (e.key === "ArrowLeft") setView((v) => (v - 1 + views.length) % views.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose, views.length]);

  const requireSize = () => {
    if (size) return true;
    setNeedSize(true);
    document.getElementById("size-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  };

  const add = () => {
    if (!requireSize()) return;
    onAdd(p, size!, qty, color);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const orderNow = (e: React.MouseEvent) => {
    if (!requireSize()) e.preventDefault();
  };

  const bottom = BOTTOMS.find((b) => b.id === p.bottom);
  const unit = unitPrice(p.price, size);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pm-title" tabIndex={-1} ref={dialog}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </button>

        <div className="gallery">
          <div className="gallery-main">
            {pair && pair[1] - pair[0] === 2 ? (
              <Turntable
                key={`${p.id}-${pair[0]}`}
                front={photo(pair[0])}
                back={photo(pair[0] + 1)}
                alt={`${p.name} ${color}`}
                side={view - pair[0]}
                onSide={(s) => setView(pair[0] + s)}
              />
            ) : (
              <div className="turntable">
                <img className="tt-face" src={photo(view)} alt={`${p.name} ${color} — ${views[view].label}`} width={1080} height={1350} />
              </div>
            )}
            {views.length > 1 && <span className="view-pill">{views[view].label}</span>}
            {simulated && views[view].kind === "look" && <span className={`sim-pill ${painting ? "is-busy" : ""}`}>{painting ? "Aplicando a cor…" : "Simulação de cor"}</span>}
            {simulated && views[view].kind === "photo" && nLooks > 0 && <span className="sim-pill">Foto real · cor {p.color}</span>}
          </div>
          {views.length > 1 && (
            <div className="thumbs" role="tablist" aria-label="Fotos do produto">
              {views.map((v, n) => (
                <button key={v.src} role="tab" aria-selected={n === view} className={`thumb ${n === view ? "is-active" : ""} ${n === split && split && nLooks ? "is-first-photo" : ""}`} onClick={() => setView(n)}>
                  <img src={photo(n)} alt="" width={86} height={108} />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="details">
          <h2 id="pm-title" className="details-title">{p.name}</h2>
          <p className="details-meta">
            {typeLabel[p.type]}
            {bottom && ` ${bottom.label.toLowerCase()}`}
          </p>
          <div className="price-block">
            <strong className="price">{money(unit)}</strong>
            <span className="price-cash">{money(cashPrice(unit))} à vista <em>({Math.round(STORE.cashDiscount * 100)}% off)</em></span>
            {size && isPlus(size) && <span className="price-note">Inclui +{money(STORE.plusFee)} do Plus Size</span>}
          </div>

          <div className="field">
            <div className="field-head">
              <span>Cor</span>
              <strong>{color}{simulated && <span className="muted"> · simulação</span>}</strong>
            </div>
            <div className="swatches" role="radiogroup" aria-label="Cor">
              {COLORS.map((c) => {
                const real = c.name === p.color || variants.some((v) => v.color === c.name);
                return (
                  <button
                    key={c.name}
                    role="radio"
                    aria-checked={color === c.name}
                    className={`swatch ${color === c.name ? "is-active" : ""} ${real ? "has-photo" : ""}`}
                    style={{ ["--sw" as string]: c.hex }}
                    onClick={() => pickColor(c)}
                    aria-label={real ? `${c.name} (foto real)` : c.name}
                    title={real ? `${c.name} · foto real` : c.name}
                  />
                );
              })}
            </div>
            <p className="hint">
              {simulated
                ? "Simulação da cor na peça: o tom real pode variar um pouco. A loja confirma pelo WhatsApp."
                : "Escolha qualquer cor da nossa cartela. As marcadas com ponto têm foto real."}
            </p>
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
              href={size ? whatsappUrl([{ product: p, size, qty, color }]) : "#"}
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
