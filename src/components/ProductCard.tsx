import { money } from "../config";
import { coverUrl, imageUrl, type Product } from "../catalog";

interface Props {
  product: Product;
  colors: number;
  onOpen: (p: Product) => void;
  index: number;
}

export function ProductCard({ product: p, colors, onOpen, index }: Props) {
  // hover: the studio look turns into the real photo on the mannequin (or the back, without a look)
  const hover = p.looks && !p.looksPartial ? imageUrl(p, 0) : p.photos.length > 1 ? imageUrl(p, 1) : null;
  return (
    <article className="card">
      <button className="card-media" onClick={() => onOpen(p)} aria-label={`Ver ${p.name} ${p.color}`}>
        <img
          src={coverUrl(p)}
          alt={`${p.name} na cor ${p.color}, frente`}
          width={1080}
          height={1350}
          loading={index < 8 ? "eager" : "lazy"}
          decoding="async"
          className="card-img"
        />
        {hover && (
          <img src={hover} alt="" aria-hidden width={1080} height={1350} loading="lazy" decoding="async" className="card-img card-img-back" />
        )}
        {p.looks && !p.looksPartial ? <span className="card-tag" aria-hidden>No manequim</span> : null}
      </button>
      <div className="card-body">
        <h3 className="card-title">
          <button onClick={() => onOpen(p)}>{p.name}</button>
        </h3>
        <p className="card-price">{money(p.price)}</p>
        <p className="card-color">
          <span className="dot" style={{ background: p.hex }} />
          {p.color}
          <span className="muted"> · {colors} cores</span>
        </p>
      </div>
    </article>
  );
}
