# Cantotype

Cantonese phonetic typing app as a 100% client-side JavaScript webapp.

You need the following files:

- `cantotype.html` - the main webapp
- `cantotype.js` - the main program module
- `cantotype_table.js` - the database
- `freehk.woff` - the Free-HK webfont
- `notosanshk.woff` - the Noto Sans HK webfont
- `lastresort.woff` - the Last Resort webfont

You can run this directly from local files using `file://` protocol, or you can place all the files in the same directory on a server.  The `cantotype.html` file can be renamed anything.  However, the other files must have the names shown above (case sensitive).

The `cantotype_table.js` data file is not directly provided in these source files.  Instead, you use the provided `canto_compile.pl` Perl script to generate it from the Unihan database, the HKSCS supplement, and the CC-CEDICT data file, which you can download for free from other sources.  See the documentation within the Perl script for further information how to build the JavaScript data file.  Note that this data file is over 10MB large.  Once you have built the data file with the Perl script, make sure it is named `cantotype_table.js` and have it in the same directory as the rest of the webapp so that it can be loaded.

The font files are not provided by this project, but all are available under free licenses.  You can get Free-HK from `freehkfonts.opensource.hk`.  Use `sfnt2woff` to convert it to WOFF, and make sure you rename the file `freehk.woff`.  You can get Noto Sans HK from Google Fonts.  To get a WOFF from it, take one of the OpenType files and run it through the `snft2woff` utility.  Cantotype expects the name of the font to be `notosanshk.woff`, so rename the result file if necessary.  You can get Last Resort from `unicode-org/last-resort-font` on GitHub.  The compiled TrueType font is available from the releases.  To get a WOFF from it, you can run it through the `snft2woff` utility.  Cantotype expects the name of the font to be `lastresort.woff`, so rename the result file if necessary.

The most widely supported characters will be rendered in the regular script with the Free-HK font.  This font does not include characters specific to Cantonese.  Characters that are not in Free-HK but available in Noto Sans HK will be displayed in that font.  This font includes characters specific to Cantonese.  For characters that are not available in either font, Last Resort will be used, which displays a generic box indicating which Unicode block the character belongs to.  This allows you to see in result lists how widely supported a character is by whether it appears as a regular script (widely supported), sans-serif (not so widely supported), or Last Resort (rare).
