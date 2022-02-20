# Cantotype configuration script

Cantotype needs a JavaScript configuration file that is specific to the installation as well as a few other tweaks to run correctly.  This document specifies how to configure Cantotype to run properly.

## Configuration file

First of all, you must create a file named `cantotype_config.js` and place it in the same server directory as the main HTML page for the webapp so that it can be loaded during initialization.

This file must be a JavaScript file that defines a global variable `canto_config` that is set equal to a JavaScript object.  The properties of this JavaScript object determine the configuration parameters.

The following is an annotated example of a configuration file:

    var canto_config = {

      // The URL prefix for program files
      code_base: "/url/to/code/",

      // The URL prefix for data files
      data_base: "/url/to/data/",

      // The name of the data file index
      index_name: "cantotype_data_index.gz",

      // The name of the character database file
      chardb_name: "cantotype_chardb.gz",

      // The name of the word database file
      worddb_name: "cantotype_worddb.gz"

    };

The `code_base` property is where all the program files for Cantotype reside on the server.  This variable should end in a slash if it is the name of a folder.

All of the file name properties are in the path established by `data_base`.  The `data_base` variable should end in a slash if it is the name of a folder.  It could also be a path to a CGI script, in which case it might be something like `/cgi-bin/resource.pl?name=`

## Manifest configuration

Edit the `cantotype.webmanifest` manifest, which is also a JSON file.

First, you must make sure that the `start_url` property is the URL to the main HTML page for the webapp on the server.  This can be something like `/path/to/cantotype.html` or if you are using the HTML page as the index page within a directory it can be something like `/path/to/cantotype/` -- it should, however, be an absolute path to the page on the server.

Second, you must make sure that all of the icon references have proper URLs.  These can be relative to the directory of the webapp.

## Service worker configuration

Edit the `cantotype_sw.js` script.  There is a clearly marked `CONFIGURATION AREA` within the script that you need to edit properly.

First, set the `cache_name` variable to a unique name for this cache.  It is recommended that you use a name like `Cantotype-2022-02-19-004` where 2022-02-19 is the date of the version and 004 is a revision number within that date.  Each time the Cantotype program files change in any way, the `cache_name` should be updated to a new, unique value.  This indicates that clients should reload the program file caches.  (You do _not_ need to change this when data files change, since data files are not handled by this service worker.  See `DataCache.md` for further information.)

Second, make sure that the `code_base` variable is set to the same value as it is in the configuration file you defined earlier.  Unfortunately, the service work is not able to read from this configuration file, so it needs its own copy of the variable.

Third, set the `html_name` variable to the name of the main HTML page of the webapp within the `code_base` directory.  If you are setting the HTML page to be the index page of the `code_base` directory, you should set the `html_name` variable to the empty string `""`

Fourth, make sure the program file listing defined in `program_files` is sound.  The only thing you should need to watch for here is the icon paths, which must be relative to the program directory.  The other names need to remain the same for the program to work correctly.
