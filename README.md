# Cantotype

Chinese and Cantonese typing app with phonetic and dictionary support, implemented as a 100% client-side JavaScript webapp.

## Building the databases

Cantotype loads all its character and dictionary data from compressed data files.  You can generate the uncompressed data files using the `canto_compile_char.pl` Perl script to generate the character database and the `canto_compile_dict.pl` Perl script to generate the dictionary database.  These Perl scripts read from provided Unihan, HKSCS supplement, and CC-CEDICT sources to build these database files.  See the documentation of those scripts for further information.

After the scripts generate the decompressed databases, you must compress them by using `gzip` on each.  Cantotype will expect the databases to be in GZip compressed format.

The names of the character databases must only use ASCII alphanumerics, underscore, hyphen, and dot, and dot may neither be the first nor last character, nor may two dots occur in a row.

## Preparing the fonts

Since it is not safe to assume support of the Chinese character set in client fonts, Cantotype uses its own webfonts to ensure that all clients can display the Chinese characters.  All the fonts used by Cantotype are free, but they are not provided directly here.  You need the following font files:

- `freehk.woff` - Free-HK webfont
- `notosanshk.woff` - Noto Sans HK webfont
- `lastresort.woff` - Last Resort webfont

The [Free-HK project](https://freehkfonts.opensource.hk/) provides the Free-HK webfont on the download page of its website, and you can also get it from the [Github page](https://github.com/freehkfonts/freehkkai) (currently, the actual font file is on the "download" branch).  This font is licensed under CC-BY 4.0.

Noto Sans HK is provided by [Google Fonts](https://github.com/googlefonts/noto-cjk) in their `noto-cjk` project on Github.  You can also get this font from the public [Google Fonts](https://fonts.google.com/) page on Google.  This font is licensed under SIL Open Font License 1.1.  Within the `noto-cjk` project, the recommended font is `Sans/SubsetOTF/HK/NotoSansHK-Regular.otf`

Last Resort is provided by the Unicode Consortium at their [Github page](https://github.com/unicode-org/last-resort-font).  You can download the actual font file from the latest release.  This font is licensed under SIL Open Font License 1.1.

After you download the font files, you will need to convert them to the webfont WOFF format.  You can use the program `sfnt2woff` [provided here](https://github.com/kseo/sfnt2woff) to convert each of these fonts to WOFF.

The final step is to rename the WOFF fonts exactly with the names given earlier in this section.

The three fonts form a cascade.  Free-HK is the preferred font, but it only contains 4,700 of the most common Chinese characters.  Characters that are not present in Free-HK will be displayed with Noto Sans HK, which includes less common characters, as well as characters specific to Cantonese.  Characters that are not present in Noto Sans HK either will be displayed with Last Resort, which just provides a placeholder image for missing characters.

This allows you to determine how common a character is by the way it is rendered.  Free-HK is a regular script font, which indicates the character is common.  Noto Sans HK is a straight sans-serif font, which indicates the character is less common or specific to Cantonese.  Last Resort has distinctive boxes indicating the character is missing, so you can tell that the character is not widely supported.

## Constructing the data directory

Put the two GZipped character databases and the WOFF fonts you created in the preceding steps into a single directory that will serve as the data directory for Cantotype.

You must now create a data index for all these files in the data directory.  Within the data directory, create a JSON text file that will serve as the index.  This JSON text file stores a JSON object.  Each property name of the JSON object matches the name of a data file in the directory.  Each property value is an array of two values:  the first is a string _revision code_ and the second is the size of the file in bytes as an integer.  For compressed files, use the compressed file size, not the decompressed file size.  Do not include the data index file itself within the data index.

An example JSON data index file is shown here:

    {
      "cantotype_chardb.gz": ["2022-02-17:001", 428188],
      "cantotype_worddb.gz": ["2022-02-17:001", 3962377],
      "freehk.woff": ["2022-02-17:001", 3729996],
      "notosanshk.woff": ["2022-02-17:001", 4900632],
      "lastresort.woff": ["2022-02-17:001", 616672]
    }

The revision code should be in the format `YYYY-MM-DD:RRR` where `RRR` is a revision code specific to that particular calendar date.  Revision codes are used for keeping track of versions of the files in the local cache.  Each time you change or update one of the files, you must give it a more recent revision code so that the cache can be updated properly.

Once you have completed the JSON data index file, use `gzip` to compress it.  The name of the data index file must follow the same restrictions given earlier for the database names.

## Generating the configuration file

You also must generate a JavaScript configuration file that tells Cantotype about the specific installation and allows it to locate its data files.  See `Config.md` for further information about how to generate this configuration file.  Within the configuration file, you will tell Cantotype where to find the data directory on the server that you constructed in the previous step, and what the names of the data index file, character database, word database, and CSS template files are within that data directory.

Do __not__ compress this configuration file with `gzip` and do __not__ place it in the data directory.

Instead, you must name this file `cantotype_config.js` and place it in the same directory as the main Cantotype HTML page.

## Configuring additional files

You must also configure the `cantotype.webmanifest` and the `cantotype_ws.js` files.  See `Config.md` for further information about how to do this.

## Fetching the libraries

In order to speed up download of the rather large data files, the data files are compressed with GZip and decompressed client-side.  The [Pako](https://github.com/nodeca/pako) library is used to decompress these GZipped files on the client side.  From the `dist` directory of the Pako project, you will need the `pako_inflate.js` script and place this in the same directory as the main Cantotype HTML page.  You can also use `pako_inflate.min.js` provided that you rename it to `pako_inflate.js`.

## Using a server

Although Cantotype is completely client-side and does not use any server-side scripting, some of the client-side technologies it uses are not reliable unless they are used over HTTP.  This means that it is __not__ recommended to run Cantotype directly in the file system using the `file://` protocol.

You can either place Cantotype on an Internet server, or you can use the simple [Jacques](https://github.com/canidlogic/jacques) HTTP server script to serve Cantotype locally over HTTP.  Jacques has been used during the development of Cantotype, so it is officially supported and should work without issue.

Note, however, that installing Cantotype as an app and using it in offline mode with the service worker will probably require loading it over HTTPS.  Service worker technology requires HTTPS for security reasons.  The app will still work as a normal website when served over HTTP, though, and data caching should still work.

## Assembling the files

All in the same directory on the HTTP server, you need the following files:

- `cantotype.html` - the main webapp HTML page
- `cantotype.webmanifest` - the webapp manifest file
- `cantotype.js` - the main program module
- `cantotype_config.js` - the generated configuration script
- `cantotype_load.js` - the data loading module
- `cantotype_style.css` - the CSS stylesheet
- `cantotyep_sw.js` - the service worker module
- `cantotype_ui.js` - the presentation tier module
- `pako_inflate.js` - the Pako GZip decompressor

All of these files must have the exact same names listed above (case sensitive), except that the main `cantotype.html` page can be renamed anything you want, including using it as the index page for the server directory.

You must also copy all the icons within the `icons` folder of this project to the program directory or a subdirectory of it.  The web manifest will give the relative URL to these icons.  You do not need the README file from the `icons` folder, just the actual icons.

As described earlier, the `cantotype_config.js` file within this directory will tell Cantotype where it can find the data directory.

You may want to verify that the HTTP server understands the file extensions of all the files listed earlier in this section, as well as the file extension used for the generated data files.  Here is a list of MIME content types for each of the extensions, which is useful if you are creating a JSON website file for use with the Jacques HTTP server:

      Extension   |         MIME type
    ==============+===========================
     .css         | text/css
     .gz          | application/gzip
     .html        | text/html
     .js          | text/javascript
     .png         | image/png
     .webmanifest | application/manifest+json
     .woff        | font/woff

Since the web manifest is a JSON file, you can also give it an `application/json` MIME type if the MIME type given above is causing you trouble.

__!!! CAUTION CAUTION CAUTION !!!__

The GZip data files must be delivered to the client in compressed form.  Unfortunately, HTTP servers might try to be clever and serve `.gz` files with an HTTP `Content-Encoding` header indicating `gzip` compression.  This means that the browser will decompress the GZip data files before passing them to Cantotype.  And then Cantotype will try to decompress them again.  __This will not work!!__  If Cantotype is refusing to start because of troubles loading the database, and the browser web console has messages about decompression failing, this is probably what is happening.

A quick fix for this is to change the extension of the compressed data files from `.gz` to something else, maybe something generic like `.dat`.  (You do _not_ need to do this for the WOFF fonts.)  If you can set a MIME type, setting it to `application/octet-stream` will not cause Cantotype any trouble and may prevent clever HTTP servers from trying to serve the data with a `Content-Encoding`.  Of course, if you are going to rename the data files, you will have to update the data file index and the configuration file with the new names.

You can check what the server is serving by downloading one of the GZip data files directly by the URL.  Then rename it if necessary to have a `.gz` extension and try running `gzip` on it.  If `gzip` works successfully, then the server is correctly serving the compressed data.  If `gzip` complains, then the file is probably an uncompressed text file, and the server is using `Content-Encoding` headers which will __not__ work with Cantotype!

## Running the program

Provided that all the files are generated and assembled as described in this README, you just need to navigate to wherever you placed the main Cantotype HTML page and the webapp should start.  Since no server-side scripting is required, you may run Cantotype even if your HTTP server only allows static websites.

You can also install Cantotype as a "Progressive Web App" (PWA).  Some browsers may present a pop-up offering to install Cantotype, or others may have an `Install` option in the browser menu somewhere.  This will allow you to use Cantotype as an offline app, even when no internet connection is available.  Make sure Cantotype has downloaded a copy of its data files before trying to use it offline, though.

(As mentioned before, offline web app functionality will likely require the site to be served over HTTPS.)
