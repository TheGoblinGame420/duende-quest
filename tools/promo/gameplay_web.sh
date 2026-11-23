#!/usr/bin/env bash
# Clips de gameplay de la portada (seccion «Miralo antes de entrar»).
# Parte de las tomas crudas de _promo_kit/raw (verticales 1080x1920 a 60 fps, grabadas
# del juego real con scripts/record-clips.mjs) y saca dos clips mudos y ligeros en 4:5:
#   assets/video/gameplay-3d.mp4  +  assets/video/gameplay-3d.jpg  (ORIGINS)
#   assets/video/gameplay-2d.mp4  +  assets/video/gameplay-2d.jpg  (CLASSIC)
# Uso (desde la raiz del repo):  bash tools/promo/gameplay_web.sh
# Para cambiar las tomas, edita las listas de abajo: archivo, inicio (s), duracion (s).
set -euo pipefail
RAW=_promo_kit/raw
OUT=assets/video
TMP=_promo_kit/tmp_web; rm -rf "$TMP"; mkdir -p "$TMP"   # ruta relativa: ffmpeg de Windows no entiende /tmp de Git Bash
ANCHO=540; ALTO=676          # 4:5, pares (H.264)

# recorte: las tomas 2D dejan negro abajo (donde iban los botones); las 3D van centradas.
pieza() {  # salida entrada inicio dur y_recorte
  ffmpeg -v error -y -ss "$3" -t "$4" -i "$RAW/$2" -an \
    -vf "crop=1080:1350:0:$5,scale=$ANCHO:$ALTO:flags=lanczos,fps=30,setsar=1" \
    -c:v libx264 -preset veryfast -crf 16 -pix_fmt yuv420p "$1"
}
unir() {   # salida crf pieza...
  local salida=$1 crf=$2; shift 2
  : > "$TMP/lista.txt"
  for p in "$@"; do echo "file '$(basename "$p")'" >> "$TMP/lista.txt"; done   # relativo a la lista
  ffmpeg -v error -y -f concat -safe 0 -i "$TMP/lista.txt" -an \
    -c:v libx264 -preset slow -crf "$crf" -profile:v main -pix_fmt yuv420p \
    -movflags +faststart -g 60 "$salida"
}

# ── ORIGINS (3D): volar con alas y pelea contra una manada ──
pieza "$TMP/a1.mp4" clip1_3d_fly.webm 0.6 4.2 285
pieza "$TMP/a2.mp4" clip3_3d_pvp.webm 0.8 5.6 285
unir "$OUT/gameplay-3d.mp4" 30 "$TMP/a1.mp4" "$TMP/a2.mp4"
ffmpeg -v error -y -ss 6.2 -i "$OUT/gameplay-3d.mp4" -frames:v 1 -q:v 4 "$OUT/gameplay-3d.jpg"

# ── CLASSIC (2D): jefe, captura de criatura, compañero y una zona alta ──
pieza "$TMP/b1.mp4" clip2_2d_boss.webm 0.8 4.0 170
pieza "$TMP/b2.mp4" clip4_2d_capture.webm 1.2 4.0 170
pieza "$TMP/b3.mp4" clip7_2d_companero.webm 3.2 3.4 170
pieza "$TMP/b4.mp4" clip6_2d_cumbres.webm 1.0 2.2 170
unir "$OUT/gameplay-2d.mp4" 31 "$TMP/b1.mp4" "$TMP/b2.mp4" "$TMP/b3.mp4" "$TMP/b4.mp4"
ffmpeg -v error -y -ss 1.6 -i "$OUT/gameplay-2d.mp4" -frames:v 1 -q:v 4 "$OUT/gameplay-2d.jpg"

rm -rf "$TMP"
for f in gameplay-3d gameplay-2d; do
  printf '%s.mp4  %s KB  %s s   poster %s KB\n' "$f" "$(( $(stat -c %s "$OUT/$f.mp4") / 1024 ))" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$f.mp4")" "$(( $(stat -c %s "$OUT/$f.jpg") / 1024 ))"
done
