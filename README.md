# AllFit — loja

Vitrine de moda fitness. O cliente escolhe a peça, cor e tamanho e o pedido abre no WhatsApp com a mensagem pronta.

## Rodar

```
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/ (publicado automaticamente no GitHub Pages a cada push na main)
```

## Configurar

`src/config.ts`
- `whatsapp`: número da dona com DDI + DDD, só dígitos (ex. `5511999998888`). Vazio = o WhatsApp abre e o cliente escolhe o contato.
- `instagram`, `sizes`.

## Catálogo

`src/data/catalog.json` — cada produto: nome, tipo (`conjunto | top | cropped | macaquinho | macacao`), peça de baixo do conjunto (`short | legging | flare | saia`), cor, família de cor (filtro) e `photos` = índices das fotos em `looks/` (ordenadas por nome; a primeira é a frente, a segunda as costas).

Link direto para um produto: `https://seusite/#p12`.

## Fotos (pipeline)

`looks/` (originais) → `tools/matte.py` (remove só o fundo com BiRefNet; mantém manequim e etiquetas, bordas suaves) → `tools/retouch_orig.py` + `tools/retouch_points.json` (remove os mamilos do manequim) → `tools/frame.py` (enquadra 1080×1350 sem serrilhado) → `tools/finish.sh` (PhotoCraft: vibrance, curva, smart sharpen leve, sombra, fundo de estúdio) → `tools/export.py` (gera `public/products/*.webp` e `recortes/<tipo>/<cor>/*.png` transparentes).

`tools/segment.py` (recorte só da roupa) é usado para gerar a máscara da peça que o retoque usa.

Precisa de Python com `torch transformers "rembg[cpu]" pillow numpy scipy` e do PhotoCraft (`photocraft-cli`).
