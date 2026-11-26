import { useEffect, useState } from "react";
import { imageUrl } from "../catalog";
import { whatsappUrl, type BagItem } from "../whatsapp";
import { bagShareUrl } from "../share";
import { BagIcon, CheckIcon, CloseIcon, LinkIcon, MinusIcon, PlusIcon, TrashIcon, WhatsAppIcon } from "./Icons";

interface Props {
  open: boolean;
  items: BagItem[];
  /** A bag received through a share link, shown until the visitor decides what to do with it. */
  shared: BagItem[] | null;
  onClose: () => void;
  setQty: (i: number, q: number) => void;
  remove: (i: number) => void;
  onBrowse: () => void;
  onUseShared: () => void;
  onMergeShared: () => void;
  onClear: () => void;
}

const sum = (items: BagItem[]) => items.reduce((n, i) => n + i.qty, 0);

export function BagDrawer({ open, items, shared, onClose, setQty, remove, onBrowse, onUseShared, onMergeShared, onClear }: Props) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");
  const [confirmClear, setConfirmClear] = useState(false);

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

  useEffect(() => setShareState("idle"), [items, open]);
  useEffect(() => setConfirmClear(false), [open]);

  const share = async () => {
    const url = bagShareUrl(items);
    const text = `Minha sacola allFit (${sum(items)} ${sum(items) === 1 ? "peça" : "peças"})`;
    try {
      // phones: native share sheet (WhatsApp, Instagram, etc.)
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Sacola allFit", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState("copied");
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") setShareState("error");
    }
  };

  const tab = open ? 0 : -1;
  const list = shared ?? items;
  const count = sum(list);

  const rows = (editable: boolean) => (
    <ul className="bag-list">
      {list.map((it, i) => (
        <li key={`${it.product.id}-${it.size}`} className="bag-item">
          <img src={imageUrl(it.product, 0)} alt="" width={72} height={90} />
          <div className="bag-info">
            <p className="bag-name">{it.product.name}</p>
            <p className="muted">
              <span className="dot" style={{ background: it.product.hex }} /> {it.product.color} · Tam. {it.size}
            </p>
            {editable ? (
              <div className="bag-row">
                <div className="stepper stepper-sm">
                  <button onClick={() => setQty(i, it.qty - 1)} aria-label="Diminuir" tabIndex={tab}><MinusIcon size={14} /></button>
                  <output>{it.qty}</output>
                  <button onClick={() => setQty(i, it.qty + 1)} aria-label="Aumentar" tabIndex={tab}><PlusIcon size={14} /></button>
                </div>
                <button className="link-btn" onClick={() => remove(i)} tabIndex={tab}>
                  <TrashIcon size={16} /> Remover
                </button>
              </div>
            ) : (
              <p className="bag-qty">Quantidade: {it.qty}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`drawer-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={shared ? "Sacola compartilhada" : "Sua sacola"}>
        <header className="drawer-head">
          <h2>{shared ? "Sacola compartilhada" : "Sua sacola"} {count > 0 && <span className="count">{count}</span>}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar sacola" tabIndex={tab}>
            <CloseIcon />
          </button>
        </header>

        {shared ? (
          <>
            <p className="shared-note">Alguém montou esta sacola e te enviou o link. Você pode usar, juntar com a sua ou pedir direto.</p>
            {rows(false)}
            <footer className="drawer-foot">
              <a className="btn btn-primary btn-lg btn-block" href={whatsappUrl(shared)} target="_blank" rel="noopener noreferrer" tabIndex={tab}>
                <WhatsAppIcon /> Pedir estas peças pelo WhatsApp
              </a>
              <div className="shared-actions">
                <button className="btn btn-ghost" onClick={onUseShared} tabIndex={tab}>Usar esta sacola</button>
                {items.length > 0 && (
                  <button className="btn btn-ghost" onClick={onMergeShared} tabIndex={tab}>Juntar com a minha ({sum(items)})</button>
                )}
              </div>
            </footer>
          </>
        ) : items.length === 0 ? (
          <div className="drawer-empty">
            <span className="empty-icon"><BagIcon size={28} /></span>
            <p>Sua sacola está vazia.</p>
            <p className="muted">Escolha suas peças favoritas e envie tudo de uma vez pelo WhatsApp.</p>
            <button className="btn btn-primary" onClick={onBrowse} tabIndex={tab}>Ver coleção</button>
          </div>
        ) : (
          <>
            <div className="bag-tools">
              {confirmClear ? (
                <div className="clear-confirm" role="alertdialog" aria-label="Confirmar esvaziar sacola">
                  <span>Esvaziar a sacola?</span>
                  <button className="link-btn danger" onClick={() => { onClear(); setConfirmClear(false); }} tabIndex={tab}>Sim, esvaziar</button>
                  <button className="link-btn" onClick={() => setConfirmClear(false)} tabIndex={tab}>Cancelar</button>
                </div>
              ) : (
                <button className="link-btn" onClick={() => setConfirmClear(true)} tabIndex={tab}>
                  <TrashIcon size={16} /> Esvaziar sacola
                </button>
              )}
            </div>
            {rows(true)}
            <footer className="drawer-foot">
              <p className="muted small">
                O WhatsApp abre com a lista pronta e um link da sacola com as fotos. A loja confirma valores, disponibilidade e entrega.
              </p>
              <a className="btn btn-primary btn-lg btn-block" href={whatsappUrl(items)} target="_blank" rel="noopener noreferrer" tabIndex={tab}>
                <WhatsAppIcon /> Enviar pedido pelo WhatsApp
              </a>
              <button className={`btn btn-ghost btn-block ${shareState === "copied" ? "is-done" : ""}`} onClick={share} tabIndex={tab}>
                {shareState === "copied" ? <><CheckIcon size={18} /> Link copiado</> : <><LinkIcon size={18} /> Compartilhar sacola</>}
              </button>
              {shareState === "error" && (
                <p className="share-fallback" role="alert">
                  Não deu para copiar. Copie o link: <input readOnly value={bagShareUrl(items)} onFocus={(e) => e.currentTarget.select()} aria-label="Link da sacola" />
                </p>
              )}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
