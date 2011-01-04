#!/bin/sh
# Use jsdoc-toolkit to build up-to-date documentation.
SCRIPT_DIR=$(dirname $(readlink -f $0))
JSDD="$SCRIPT_DIR/jsdoc-toolkit"
TEMPLATE="$SCRIPT_DIR/doc-template"

OUTPUT=$(readlink -f "$SCRIPT_DIR/../docs/")
SOURCE=$(readlink -f "$SCRIPT_DIR/../src/js/")

echo "Path to jsdoc-toolkit: $JSDD"
echo "Path to template: $TEMPLATE"
echo "Path to source: $SOURCE"
echo "Path to write output: $OUTPUT"
echo 
echo "Executing jsdoc-toolkit..."
java -Djsdor.dir=$JSDD -jar $JSDD/jsrun.jar $JSDD/app/run.js -p -t=$TEMPLATE \
  -d=$OUTPUT $SOURCE