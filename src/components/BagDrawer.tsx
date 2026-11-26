import { useEffect } from "react";
import { imageUrl } from "../catalog";
import { whatsappUrl, type BagItem } from "../whatsapp";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon, TrashIcon, WhatsAppIcon } from "./Icons";

interface Props {
  open: boolean;
  items: BagItem[];
  onClose: () => void;
  setQty: (i: number, q: number) => void;
  remove: (i: number) => void;
  onBrowse: () => void;
}

export function BagDrawer({ open, items, onClose, setQty, remove, onBrowse }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const count = items.reduce((n, i) => n + i.qty, 0);

  return (
    <div className={`drawer-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Sua sacola">
        <header className="drawer-head">
          <h2>Sua sacola {count > 0 && <span className="count">{count}</span>}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar sacola" tabIndex={open ? 0 : -1}>
            <CloseIcon />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="drawer-empty">
            <span className="empty-icon"><BagIcon size={28} /></span>
            <p>Sua sacola está vazia.</p>
            <p className="muted">Escolha suas peças favoritas e envie tudo de uma vez pelo WhatsApp.</p>
            <button className="btn btn-primary" onClick={onBrowse} tabIndex={open ? 0 : -1}>Ver coleção</button>
          </div>
        ) : (
          <>
            <ul className="bag-list">
              {items.map((it, i) => (
                <li key={`${it.product.id}-${it.size}`} className="bag-item">
                  <img src={imageUrl(it.product, 0)} alt="" width={72} height={90} />
                  <div className="bag-info">
                    <p className="bag-name">{it.product.name}</p>
                    <p className="muted">
                      <span className="dot" style={{ background: it.product.hex }} /> {it.product.color} · Tam. {it.size}
                    </p>
                    <div className="bag-row">
                      <div className="stepper stepper-sm">
                        <button onClick={() => setQty(i, it.qty - 1)} aria-label="Diminuir" tabIndex={open ? 0 : -1}><MinusIcon size={14} /></button>
                        <output>{it.qty}</output>
                        <button onClick={() => setQty(i, it.qty + 1)} aria-label="Aumentar" tabIndex={open ? 0 : -1}><PlusIcon size={14} /></button>
                      </div>
                      <button className="link-btn" onClick={() => remove(i)} tabIndex={open ? 0 : -1}>
                        <TrashIcon size={16} /> Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="drawer-foot">
              <p className="muted small">
                Ao enviar, o WhatsApp abre com a lista pronta. A loja confirma valores, disponibilidade e entrega.
              </p>
              <a className="btn btn-primary btn-lg btn-block" href={whatsappUrl(items)} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>
                <WhatsAppIcon /> Enviar pedido pelo WhatsApp
              </a>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
