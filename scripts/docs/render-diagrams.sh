#!/usr/bin/env bash
# Renders every PlantUML diagram under docs/diagrams/ to SVG in docs/diagrams/rendered/
# (Phase 7, Task 30) and fails on the first diagram with a syntax error.
# Needs Java and Graphviz (`apt-get install default-jre graphviz`). The PlantUML jar is
# downloaded once from Maven Central and checked against its published SHA-1.
#   scripts/docs/render-diagrams.sh [png|svg]   (default svg)
set -euo pipefail

FORMAT="${1:-svg}"
VERSION=1.2024.7
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE="${PLANTUML_CACHE:-$HOME/.cache/ai-corp}"
JAR="$CACHE/plantuml-$VERSION.jar"
URL="https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/$VERSION/plantuml-$VERSION.jar"

if [ ! -f "$JAR" ]; then
  mkdir -p "$CACHE"
  curl -sSfL -o "$JAR.tmp" "$URL"
  expected="$(curl -sSfL "$URL.sha1" | cut -c1-40)"
  actual="$(sha1sum "$JAR.tmp" | cut -c1-40)"
  [ "$expected" = "$actual" ] || { echo "PlantUML jar checksum mismatch" >&2; rm -f "$JAR.tmp"; exit 1; }
  mv "$JAR.tmp" "$JAR"
fi

cd "$ROOT/docs/diagrams"
count=0
while IFS= read -r src; do
  out="rendered/${src%.puml}.$FORMAT"
  mkdir -p "$(dirname "$out")"
  # -pipe names the output after the source file, whatever its @startuml/title says
  if ! java -jar "$JAR" -t"$FORMAT" -pipe -failfast2 < "$src" > "$out" 2>/tmp/plantuml-error.log; then
    echo "FAILED: docs/diagrams/$src" >&2
    cat /tmp/plantuml-error.log >&2
    exit 1
  fi
  count=$((count + 1))
done < <(find . -name '*.puml' -not -path './rendered/*' | sed 's#^\./##' | sort)
echo "Rendered $count diagrams to docs/diagrams/rendered/ ($FORMAT)"
