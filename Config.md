# Cantotype configuration script

Cantotype needs a JavaScript configuration file that is specific to the installation to run.  This document specifies what needs to be in that configuration file.

First of all, the file must be named `cantotype_config.js` and placed in the same server directory as the main HTML page for the webapp so that it can be loaded during initialization.

This file must be a JavaScript file that defines a global variable `canto_config` that is set equal to a JavaScript object.  The properties of this JavaScript object determine the configuration parameters.

The following is an annotated example of a configuration file:

    var canto_config = {

      // The URL prefix for data files
      data_base: "/url/to/data/",

      // The name of the data file index
      index_name: "cantotype_data_index.gz",

      // The name of the character database file
      chardb_name: "cantotype_chardb.gz",

      // The name of the word database file
      worddb_name: "cantotype_worddb.gz"

    };

All of the file name properties are in the path established by `data_base`.  The `data_base` variable should end in a slash if it is the name of a folder.  It could also be a path to a CGI script, in which case it might be something like `/cgi-bin/resource.pl?name=`
