# AllFit — loja

Vitrine de moda fitness. O cliente escolhe a peça, cor e tamanho e o pedido abre no WhatsApp com a mensagem pronta.

## Rodar

```
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/ (a Vercel publica automaticamente a cada push na main: https://useallfit.vercel.app)
```

## Configurar

`src/config.ts`
- `whatsapp`: número da dona com DDI + DDD, só dígitos (ex. `5511999998888`). Vazio = o WhatsApp abre e o cliente escolhe o contato.
- `instagram`, `sizes`.

## Cores da loja

`src/data/colors.json` é a cartela de cores que a loja produz (nome + hex). O cliente pode escolher **qualquer** cor dessa lista em **qualquer** modelo; a cor escolhida vai na mensagem do WhatsApp, na sacola e no link compartilhado.
- Se a cor escolhida já tem foto daquele modelo (mesmo nome de cor no catálogo), o site mostra a foto real.
- Se não tem, o site **simula** a cor nos **looks de estúdio** (mantendo dobras e sombras) e mostra "Simulação de cor". As fotos no manequim nunca são repintadas: mostram sempre a peça real. Máscaras dos looks: `public/masks/<id>-l<n>.png` (`tools/looks_cut.py`).
- Depois de trocar a cartela, rode `node tools/gen_api_data.mjs` (pré-visualizações do WhatsApp).

## Catálogo

`src/data/catalog.json` — cada produto: nome, tipo (`conjunto | top | cropped | macaquinho | macacao`), peça de baixo do conjunto (`short | legging | flare | saia`), cor, família de cor (filtro) e `photos` = índices das fotos em `looks/` (ordenadas por nome; a primeira é a frente, a segunda as costas).

Link direto para um produto: `https://seusite/#p12`; numa cor da cartela: `https://seusite/#p12/azul` (a URL muda quando o cliente escolhe a cor). A sacola guarda a cor de cada peça.

## Looks de estúdio

`looks-novos/` (colagens) → `tools/looks_cut.py` + `tools/looks_map.json` (recorta cada look, tira etiquetas, amplia com Swin2SR, PhotoCraft: sombra e fundo) → `public/products/<id>-l0/l1.webp` (frente/costas) e as máscaras de cor. `looks` no catálogo = quantos looks o produto tem; eles vêm antes das fotos no manequim.

## Fotos (pipeline)

`looks/` (originais) → `tools/matte.py` (remove só o fundo com BiRefNet; mantém manequim e etiquetas, bordas suaves) → `tools/retouch_orig.py` + `tools/retouch_points.json` (remove os mamilos do manequim) → `tools/frame.py` (enquadra 1080×1350 sem serrilhado) → `tools/sleeve_volume.py` (dá volume às mangas compridas vazias) → `tools/finish.sh` (PhotoCraft: vibrance, curva, smart sharpen leve, sombra, fundo de estúdio) → `tools/export.py` (gera `public/products/*.webp` e `recortes/<tipo>/<cor>/*.png` transparentes) .

## Links com pré-visualização

- `/s/<código>`: sacola compartilhada (ex. `/s/27M2.5Gc2`; `c<n>` = cor da cartela). Uma peça mostra o cartão do look na cor escolhida; várias peças mostram todos os looks juntos, cada um na sua cor (`api/bag-image.js`).
- `/p/<id>` e `/p/<id>/<cor>`: um produto, na cor de foto ou numa cor da cartela (ex. `/p/p15/azul`). A imagem numa cor diferente é pintada na hora (`api/og-image.js`, mesmo algoritmo de `src/recolor.ts`).
- Cartões e miniaturas fixos: `python tools/og_looks.py` (gera `public/og/`) e `python tools/og_store.py` (`public/og.jpg`). Rode depois de mudar looks, nomes ou preços, junto com `node tools/gen_api_data.mjs`.

`api/share.js` gera as tags Open Graph e leva a pessoa para a loja. O WhatsApp guarda a pré-visualização em cache por link.

`tools/segment.py` (recorte só da roupa) é usado para gerar a máscara da peça que o retoque usa.

Precisa de Python com `torch transformers "rembg[cpu]" pillow numpy scipy` e do PhotoCraft (`photocraft-cli`).
