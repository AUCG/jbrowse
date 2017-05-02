#!/usr/bin/env bash

for i in dojo dijit dojox jszlib json-schema lazyload dgrid; do
    cp -R node_modules/$i src/$i;
done;

cp -R node_modules/dojo-util src/util
cp -R node_modules/filesaver.js src/FileSaver
cp -R node_modules/jdataview src/jDataView
cp -R node_modules/dojo-dstore src/dstore


