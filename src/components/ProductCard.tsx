import { imageUrl, type Product } from "../catalog";

interface Props {
  product: Product;
  variants: number;
  onOpen: (p: Product) => void;
  index: number;
}

export function ProductCard({ product: p, variants, onOpen, index }: Props) {
  const hasBack = p.photos.length > 1;
  return (
    <article className="card">
      <button className="card-media" onClick={() => onOpen(p)} aria-label={`Ver ${p.name} ${p.color}`}>
        <img
          src={imageUrl(p, 0)}
          alt={`${p.name} na cor ${p.color}, frente`}
          width={1080}
          height={1350}
          loading={index < 8 ? "eager" : "lazy"}
          decoding="async"
          className="card-img"
        />
        {hasBack && (
          <img src={imageUrl(p, 1)} alt="" aria-hidden width={1080} height={1350} loading="lazy" decoding="async" className="card-img card-img-back" />
        )}
      </button>
      <div className="card-body">
        <h3 className="card-title">
          <button onClick={() => onOpen(p)}>{p.name}</button>
        </h3>
        <p className="card-color">
          <span className="dot" style={{ background: p.hex }} />
          {p.color}
          {variants > 1 && <span className="muted"> · {variants} cores</span>}
        </p>
      </div>
    </article>
  );
}
