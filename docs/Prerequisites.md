### Prerequisites

Note: see the [Quick-start guide](Quick_start_guide.md "wikilink") for the
quickest way to take care of pre-requisites.

-   System prerequisites
    -   Any Unix like system (e.g., Unix, Linux, Mac OS X)
    -   Servlet container (must support servlet spec 3.0+) [officially
        supported: Tomcat 7]
    -   Java 7+
    -   Maven3+ (most package managers will have this)
    -   Relational Database Management System [officially supported:
        PostgreSQL]
    -   Git
-   Perl prerequisites for WebApollo's authorization scripts
    -   Crypt::PBKDF2
    -   DBI
    -   DBD::Pg
-   Data generation pipeline prerequisites (see [JBrowse
    prerequisites](http://gmod.org/wiki/JBrowse_Configuration_Guide "wikilink") for more
    information on its prerequisites)
    -   System packages
        -   libpng12-0 (optional, for JBrowse imagetrack)
        -   libpng12-dev (optional, for JBrowse imagetrack)
        -   zlib1g (Debian/Ubuntu)
        -   zlib1g-dev (Debian/Ubuntu)
        -   zlib (RedHat/CentOS)
        -   zlib-devel (RedHat/CentOS)
        -   libexpat1-dev (Debian/Ubuntu)
        -   expat-dev (RedHat/CentOS)
-   Sequence search (optional)
    -   Blat (download
        [Linux](http://hgdownload.cse.ucsc.edu/admin/exe/linux.x86_64/)
        or
        [OSX](http://hgdownload.cse.ucsc.edu/admin/exe/macOSX.x86_64/|Mac)
        binaries)
### Conventions

This guide will use the following conventions to make it more concise
(you might want to keep these convention definitions handy so that you
can easily reference them as you go through this guide):

-   WEB\_APOLLO\_DIR
    -   Location where the tarball was uncompressed and will include
        `WebApollo-RELEASE_DATE` (e.g.,
        `~/webapollo/WebApollo-2012-10-08`)
-   WEB\_APOLLO\_SAMPLE\_DIR
