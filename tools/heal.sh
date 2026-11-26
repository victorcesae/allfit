#!/usr/bin/env bash
# PhotoCraft retouch: content-aware spot-heal each point twice (mannequin nipple bumps).
# Usage: heal.sh <in.png> <out.png> "x1,y1 x2,y2 ..." [brush_px] [contentAware|proximityMatch]
PC="${PHOTOCRAFT_CLI:-/c/Program Files/ArtCraft/PhotoCraft/photocraft-cli.exe}"
size="${4:-110}"; type="${5:-contentAware}"; args=()
for p in $3 $3; do
  args+=(--cmd paint.spotHealing --params "{\"points\":[[${p%,*},${p#*,}]],\"size\":$size,\"hardness\":0,\"type\":\"$type\"}")
done
"$PC" run "$1" "${args[@]}" --out "$2"
