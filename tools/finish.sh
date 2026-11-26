#!/usr/bin/env bash
# PhotoCraft finishing pass: colour/contrast, sharpening, soft shadow, studio backdrop.
# Usage: finish.sh <framed_png> <out_file(.webp|.png|.jpg)>
PC="${PHOTOCRAFT_CLI:-/c/Program Files/ArtCraft/PhotoCraft/photocraft-cli.exe}"
"$PC" run "$1" \
  --cmd image.adjustments.vibrance --params '{"vibrance":14,"saturation":0}' \
  --cmd image.adjustments.curves   --params '{"points":[[0,0],[60,55],[190,197],[255,255]]}' \
  --cmd filter.sharpen.smartSharpen --params '{"amount":45,"radius":0.8,"reduceNoise":40}' \
  --cmd layer.layerStyle.dropShadow --params '{"color":"#6b3346","opacity":20,"blend":"multiply","angle":90,"useGlobalLight":false,"distance":18,"spread":0,"size":46}' \
  --cmd layer.newFillLayer.solidColor --params '{"color":"#f7f0ed"}' \
  --cmd layer.arrange.sendToBack --params '{}' \
  --out "$2" --quality 94
