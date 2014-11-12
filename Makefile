BASEDIR = $(PWD)
APOLLO_ROOT_DIRECTORY=$(BASEDIR)
APOLLO_BUILD_DIRECTORY=$(APOLLO_ROOT_DIRECTORY)
APOLLO_WEBAPP_DIRECTORY=$(APOLLO_ROOT_DIRECTORY)/src/main/webapp
APOLLO_JBROWSE_DIRECTORY=$(APOLLO_WEBAPP_DIRECTORY)/jbrowse
JBROWSE_GIT_DIRECTORY=$(APOLLO_ROOT_DIRECTORY)/jbrowse-github
JBROWSE_GITHUB=https://github.com/GMOD/jbrowse
JBROWSE_VERSION=dev
GIT_VERSION=`git rev-parse --verify HEAD`
POM_VERSION=`mvn validate | grep Building | cut -d' ' -f4`


run: copy-webapollo-config
	mvn tomcat7:run
package: copy-webapollo-config
	mvn package
release: download-jbrowse copy-webapollo-plugin version build-jbrowse
	mv $(JBROWSE_GIT_DIRECTORY)/JBrowse-$(JBROWSE_VERSION) $(APOLLO_JBROWSE_DIRECTORY)
debug: download-jbrowse copy-webapollo-plugin version build-jbrowse
	mv $(JBROWSE_GIT_DIRECTORY)/JBrowse-$(JBROWSE_VERSION)-dev $(APOLLO_JBROWSE_DIRECTORY)
unoptimized: download-jbrowse copy-webapollo-plugin version
	cp -R $(JBROWSE_GIT_DIRECTORY) $(APOLLO_JBROWSE_DIRECTORY) && rm -rf $(APOLLO_JBROWSE_DIRECTORY)/.git
build-jbrowse:
	ulimit -n 1000;cd $(JBROWSE_GIT_DIRECTORY)&&$(MAKE) -f build/Makefile release-notest
version:
	echo "<a href='https://github.com/GMOD/Apollo/commit/$(GMOD_VERSION)' target='_blank'>Version: $(POM_VERSION)</a>" > $(APOLLO_WEBAPP_DIRECTORY)/version.jsp
download-jbrowse:
	test -d $(JBROWSE_GIT_DIRECTORY) || git clone --recursive $(JBROWSE_GITHUB) $(JBROWSE_GIT_DIRECTORY)

copy-webapollo-plugin:
	cp -R $(APOLLO_ROOT_DIRECTORY)/client/apollo $(JBROWSE_GIT_DIRECTORY)/plugins/WebApollo
copy-webapollo-config:
	if [ -e $(APOLLO_ROOT_DIRECTORY)/config.xml ]; then cp $(APOLLO_ROOT_DIRECTORY)/config.xml $(APOLLO_WEBAPP_DIRECTORY)/config/config.xml; \
	    else echo "no config.xml found"; fi;
	if [ -e $(APOLLO_ROOT_DIRECTORY)/config.properties ]; then cp $(APOLLO_ROOT_DIRECTORY)/config.properties $(APOLLO_WEBAPP_DIRECTORY)/config/config.properties; \
	    else echo "no config.properties found"; fi;
	if [ -e $(APOLLO_ROOT_DIRECTORY)/blat_config.xml ]; then cp $(APOLLO_ROOT_DIRECTORY)/blat_config.xml $(APOLLO_WEBAPP_DIRECTORY)/config/blat_config.xml; \
	    else echo "no blat_config.xml found"; fi;
	if [ -e $(APOLLO_ROOT_DIRECTORY)/hibernate.xml ]; then cp $(APOLLO_ROOT_DIRECTORY)/hibernate.xml $(APOLLO_WEBAPP_DIRECTORY)/config/hibernate.xml; \
	    else echo "no hibernate.xml found"; fi;
	if [ -e $(APOLLO_ROOT_DIRECTORY)/log4j2.json ]; then cp $(APOLLO_ROOT_DIRECTORY)/log4j2.json $(APOLLO_WEBAPP_DIRECTORY)/src/main/resources/log4j2.json; \
	    else echo "no log4j2.json found"; fi;
	if [ -e $(APOLLO_ROOT_DIRECTORY)/log4j2-test.json ]; then cp $(APOLLO_ROOT_DIRECTORY)/log4j2-test.json $(APOLLO_WEBAPP_DIRECTORY)/src/test/resources/log4j2-test.json; \
	    else echo "no log4j2-test.json found"; fi;

clean: clean-webapp
	mvn clean
clean-webapp:
	rm -rf $(APOLLO_JBROWSE_DIRECTORY)
clean-repos: clean
	rm -rf $(JBROWSE_GIT_DIRECTORY)
clean-jbrowse-repo: clean
	cd $(JBROWSE_GIT_DIRECTORY)&&$(MAKE) -f build/Makefile superclean
test:
	mvn test
test-jbrowse:
	cd $(JBROWSE_GIT_DIRECTORY)&&prove -I $(JBROWSE_GIT_DIRECTORY)/src/perl5/ -r $(JBROWSE_GIT_DIRECTORY)/tests/perl_tests


.PHONY: clean clean-webapp clean-jbrowse-repo clean-repos debug release build-jbrowse github copy-webapollo-plugin copy-webapollo-config version test package test-jbrowse download-jbrowse
