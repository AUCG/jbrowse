#!/bin/bash
: ${APOLLO_ROOT_DIRECTORY:=`pwd`}
: ${APOLLO_BUILD_DIRECTORY:="$APOLLO_ROOT_DIRECTORY/build"}
: ${APOLLO_WEBAPP_DIRECTORY:="$APOLLO_ROOT_DIRECTORY/web-app"}
: ${APOLLO_JBROWSE_DIRECTORY:="$APOLLO_WEBAPP_DIRECTORY/jbrowse"}
: ${APOLLO_JBROWSE_GITHUB:="$APOLLO_ROOT_DIRECTORY/jbrowse-github"}

grails test-app :unit
if [[ $1 == jbrowse ]]; then
    if [[ -d $APOLLO_JBROWSE_DIRECTORY ]]; then
        cd $APOLLO_JBROWSE_DIRECTORY
        prove -I src/perl5/ -r tests/perl_tests
        cd $APOLLO_ROOT_DIRECTORY
    else 
        echo "JBrowse not installed yet. Run build.sh"
    fi
fi
    
