import { useCallback, useEffect, useMemo, useState } from "react";
import { products, TYPES, BOTTOMS, COLORS, type Product, type Bottom } from "./catalog";
import { STORE, phoneLabel, asset, instagramUrl, instagramLabel } from "./config";
import { whatsappHelloUrl, type BagItem } from "./whatsapp";
import { sharedBagFromHash } from "./share";
import { useBag } from "./bag";
import { ProductCard } from "./components/ProductCard";
import { ProductModal } from "./components/ProductModal";
import { BagDrawer } from "./components/BagDrawer";
import { ArrowIcon, BagIcon, CheckIcon, DumbbellIcon, HeartIcon, InstagramIcon, LeafIcon, PaletteIcon, WhatsAppIcon } from "./components/Icons";

const byName = products.reduce<Record<string, Product[]>>((acc, p) => {
  (acc[p.name] ||= []).push(p);
  return acc;
}, {});

// hero looks (transparent cut-outs in /public/hero) -> the products they open
const HERO_LOOKS = ["p35", "p41"].map((id) => products.find((p) => p.id === id)!);

// the brand's own words (from the allFit Instagram campaign)
const BENEFITS = [
  { icon: LeafIcon, title: "Tecido premium", text: "Maciez e respirabilidade." },
  { icon: DumbbellIcon, title: "Alta sustentação", text: "Mais segurança em cada treino." },
  { icon: HeartIcon, title: "Conforto que veste bem", text: "Modelagem que valoriza o corpo." },
  { icon: PaletteIcon, title: "Cores que inspiram", text: "Estilo e atitude para todos os momentos." },
];

export default function App() {
  const bag = useBag();
  const [type, setType] = useState("all");
  const [bottom, setBottom] = useState<Bottom | null>(null);
  const [open, setOpen] = useState<Product | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [shared, setShared] = useState<BagItem[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  // deep links: #p12 opens that product, #s=27M2.5G opens a shared bag
  useEffect(() => {
    const sync = () => {
      const fromLink = sharedBagFromHash(location.hash);
      if (fromLink) {
        setShared(fromLink);
        setOpen(null);
        setBagOpen(true);
        return;
      }
      const id = location.hash.slice(1);
      setOpen(products.find((p) => p.id === id) ?? null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setPastHero(window.scrollY > window.innerHeight * 0.75);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openProduct = useCallback((p: Product) => {
    history.replaceState(null, "", `#${p.id}`);
    setOpen(p);
  }, []);
  const closeProduct = useCallback(() => {
    history.replaceState(null, "", location.pathname + location.search);
    setOpen(null);
  }, []);

  const typeMatch = TYPES.find((t) => t.id === type)!.match;
  const inType = useMemo(() => products.filter(typeMatch), [typeMatch]);
  const visible = useMemo(
    () =>
      inType.filter(
        (p) => !bottom || p.bottom === bottom,
      ),
    [inType, bottom],
  );

  const pickType = (id: string) => {
    setType(id);
    setBottom(null);
  };
  const clearFilters = () => {
    setType("all");
    setBottom(null);
  };
  const goShop = (t?: string) => {
    if (t) pickType(t);
    setBagOpen(false);
    document.getElementById("colecao")?.scrollIntoView({ behavior: "smooth" });
  };

  const clearHash = () => history.replaceState(null, "", location.pathname + location.search);
  const closeBag = useCallback(() => {
    setBagOpen(false);
    setShared((cur) => {
      if (cur) clearHash();
      return null;
    });
  }, []);
  const finishShared = (msg: string) => {
    setShared(null);
    clearHash();
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const addToBag = (p: Product, size: string, qty: number, color: string) => {
    bag.add(p, size, qty, color);
    setToast(`${p.name} (${size}) adicionado à sacola`);
    window.setTimeout(() => setToast(null), 2600);
  };

  const hasFilters = type !== "all" || !!bottom;

  return (
    <>
      <div className="announce">
        <span className="show-md">Looks que motivam</span>
        <span className="show-md">Qualidade que você sente</span>
        <span>5% de desconto no pagamento à vista</span>
      </div>

      <header className={`header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container header-in">
          <a href="#" className="brand" aria-label="allFit, início" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <img src={asset("logo.png")} alt="allFit" width={360} height={206} />
          </a>
          <nav className="nav" aria-label="Categorias">
            {TYPES.slice(1).map((t) => (
              <button key={t.id} onClick={() => goShop(t.id)}>{t.label}</button>
            ))}
          </nav>
          <button className="bag-btn" onClick={() => setBagOpen(true)} aria-label={`Abrir sacola, ${bag.count} itens`}>
            <BagIcon size={22} />
            <span className="bag-label">Sacola</span>
            {bag.count > 0 && <span className="badge" key={bag.count}>{bag.count}</span>}
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-in">
            <div className="hero-media">
              <span className="hero-arch" aria-hidden />
              <button className="hero-look hero-look-1" onClick={() => openProduct(HERO_LOOKS[0])} aria-label={`Ver ${HERO_LOOKS[0].name} ${HERO_LOOKS[0].color}`}>
                <img src={asset("hero/look-1.webp")} alt="" width={537} height={950} fetchPriority="high" />
              </button>
              <button className="hero-look hero-look-2" onClick={() => openProduct(HERO_LOOKS[1])} aria-label={`Ver ${HERO_LOOKS[1].name} ${HERO_LOOKS[1].color}`}>
                <img src={asset("hero/look-2.webp")} alt="" width={453} height={950} />
              </button>
            </div>
            <div className="hero-copy">
              <h1>
                Sua melhor versão começa <em>aqui</em>.
              </h1>
              <p className="lead">
                Conforto, estilo e performance para o seu dia. Escolha o look e o tamanho aqui no site, e a gente finaliza o pedido com você pelo WhatsApp.
              </p>
              <div className="hero-ctas">
                <button className="btn btn-primary btn-lg" onClick={() => goShop()}>
                  Ver a coleção <ArrowIcon size={18} />
                </button>
                <a className="text-link" href={whatsappHelloUrl()} target="_blank" rel="noopener noreferrer">
                  Tirar dúvidas no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="benefits" aria-label="Por que allFit">
          <ul className="container benefits-in">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon size={26} />
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="colecao" className="shop">
          <div className="container">
            <div className="shop-head">
              <h2 className="section-title">Coleção</h2>
              <p className="result-count" aria-live="polite">
                {visible.length} {visible.length === 1 ? "peça" : "peças"}
                {hasFilters && <button className="link-btn" onClick={clearFilters}>Limpar filtros</button>}
              </p>
            </div>

            <div className="filters">
              <div className="tabs" role="tablist" aria-label="Tipo de peça">
                {TYPES.map((t) => (
                  <button key={t.id} role="tab" aria-selected={type === t.id} className={`tab ${type === t.id ? "is-active" : ""}`} onClick={() => pickType(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {type === "conjunto" && (
                <div className="chips chips-sub" aria-label="Peça de baixo do conjunto">
                  {BOTTOMS.map((b) => {
                    const n = inType.filter((p) => p.bottom === b.id).length;
                    return (
                      <button key={b.id} className={`chip chip-sm ${bottom === b.id ? "is-active" : ""}`} onClick={() => setBottom(bottom === b.id ? null : b.id)} aria-pressed={bottom === b.id}>
                        {b.label} <span className="chip-n">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>

            {visible.length ? (
              <div className="grid">
                {visible.map((p, i) => (
                  <ProductCard key={p.id} product={p} colors={COLORS.length} onOpen={openProduct} index={i} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <p>Nenhuma peça com esses filtros.</p>
                <button className="btn btn-ghost" onClick={clearFilters}>Limpar filtros</button>
              </div>
            )}
          </div>
        </section>

        <section className="help">
          <div className="container help-in">
            <div>
              <h2>Ficou com dúvida no tamanho ou na cor?</h2>
              <p>Manda uma mensagem. A gente responde pelo WhatsApp e te ajuda a escolher.</p>
            </div>
            <div className="help-actions">
              <a className="btn btn-dark btn-lg" href={whatsappHelloUrl()} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={20} /> {phoneLabel}
              </a>
              {instagramUrl && (
                <a className="text-link" href={instagramUrl} target="_blank" rel="noopener noreferrer">
                  <InstagramIcon size={18} />&nbsp;Novidades primeiro no {instagramLabel}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-in">
          <div className="footer-brand">
            <img src={asset("logo.png")} alt="allFit" className="footer-logo" width={360} height={206} />
            <p>Conforto, estilo e performance para o seu dia.</p>
          </div>
          <nav className="footer-col" aria-label="Categorias">
            <h3>Loja</h3>
            {TYPES.slice(1).map((t) => (
              <button key={t.id} onClick={() => goShop(t.id)}>{t.label}</button>
            ))}
          </nav>
          <div className="footer-col">
            <h3>Atendimento</h3>
            <a href={whatsappHelloUrl()} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={16} /> {phoneLabel}</a>
            {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer"><InstagramIcon size={16} /> {instagramLabel}</a>}
            <span>Pedidos e pagamento combinados pelo WhatsApp.</span>
          </div>
        </div>
        <div className="container footer-legal">
          <span>© {new Date().getFullYear()} {STORE.name}</span>
          <span>As cores podem variar um pouco conforme a tela.</span>
        </div>
      </footer>

      <a
        className={`fab ${bag.count > 0 ? "has-bag" : ""}`}
        href={whatsappHelloUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        hidden={bagOpen || !!open || !pastHero || bag.count > 0}
      >
        <WhatsAppIcon size={28} />
      </a>

      {bag.count > 0 && !bagOpen && !open && (
        <button className="bag-bar" onClick={() => setBagOpen(true)}>
          <span className="bag-bar-info"><BagIcon size={18} /> {bag.count} {bag.count === 1 ? "item" : "itens"} na sacola</span>
          <span className="bag-bar-cta">Finalizar <ArrowIcon size={16} /></span>
        </button>
      )}

      {open && (
        <ProductModal product={open} variants={byName[open.name]} onClose={closeProduct} onSwitch={openProduct} onAdd={addToBag} />
      )}

      <BagDrawer
        open={bagOpen}
        items={bag.items}
        shared={shared}
        onClose={closeBag}
        setQty={bag.setQty}
        remove={bag.remove}
        onBrowse={() => goShop()}
        onUseShared={() => { bag.replaceWith(shared ?? []); finishShared("Sacola carregada"); }}
        onMergeShared={() => { bag.mergeIn(shared ?? []); finishShared("Peças adicionadas à sua sacola"); }}
        onClear={bag.clear}
      />

      <div className={`toast ${toast && !bagOpen ? "is-on" : ""}`} role="status" aria-live="polite">
        {toast && (
          <>
            <CheckIcon size={18} /> {toast}
            <button className="link-btn" onClick={() => { setToast(null); setBagOpen(true); }}>Ver sacola</button>
          </>
        )}
      </div>
    </>
  );
}
