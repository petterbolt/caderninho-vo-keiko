#!/bin/bash
# Baixa todas as fotos reais das receitas do site original
# para dentro da pasta "fotos/" (mesma estrutura que o recipes.json espera).
#
# COMO USAR:
# 1. Coloque este arquivo (baixar-fotos.sh) dentro da pasta do projeto "vo-keiko"
#    (na mesma pasta onde estão o index.html, app.js, recipes.json etc.)
# 2. Coloque também o arquivo "baixar-fotos.txt" do lado dele (mesma pasta).
# 3. Abra o Terminal dentro dessa pasta e rode:
#      chmod +x baixar-fotos.sh
#      ./baixar-fotos.sh
# 4. Espere terminar (pode demorar alguns minutos, são 411 fotos).
# 5. Vai aparecer uma pasta "fotos" com as imagens dentro.

BASE="https://app-receitas-pi.vercel.app"
LISTA="baixar-fotos.txt"
DESTINO="fotos"

mkdir -p "$DESTINO"

total=$(wc -l < "$LISTA" | tr -d ' ')
i=0
ok=0
falhou=0

while IFS= read -r caminho; do
  i=$((i+1))
  # caminho já vem como "fotos/nome-do-arquivo.webp"
  destino_arquivo="$caminho"
  mkdir -p "$(dirname "$destino_arquivo")"
  url="$BASE/$caminho"
  if curl -sS -f -o "$destino_arquivo" "$url"; then
    ok=$((ok+1))
    echo "[$i/$total] OK   -> $caminho"
  else
    falhou=$((falhou+1))
    echo "[$i/$total] FALHOU -> $caminho"
  fi
done < "$LISTA"

echo ""
echo "Concluído: $ok baixadas, $falhou falharam de um total de $total."
echo "As imagens estão na pasta '$DESTINO'."
