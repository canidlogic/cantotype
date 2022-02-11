# Cantotype

Cantonese phonetic typing app as a 100% client-side JavaScript webapp.

You just need four files:

- `cantotype.html` - the main webapp
- `cantotype_table.js` - the database
- `notosanshk.woff` - the Noto Sans HK webfont
- `lastresort.woff` - the Last Resort webfont

All four files must be on the same server directory.  The `cantotype.html` can be renamed anything, so long as it is in the same directory as the other two files.  The names of the other two files may not be changed without updating their paths within `cantotype.html`.

The font files are not provided by this project.  You can get Noto Sans HK from Google Fonts.  To get a WOFF from it, take one of the OpenType files and run it through the `snft2woff` utility.  Cantotype expects the name of the font to be `notosanshk.woff`, so rename the result file if necessary.  You can get Last Resort from `unicode-org/last-resort-font` on GitHub.  The compiled TrueType font is available from the releases.  To get a WOFF from it, you can run it through the `snft2woff` utility.  Cantotype expects the name of the font to be `lastresort.woff`, so rename the result file if necessary.

Characters that are available in Noto Sans HK will be displayed in that font.  This font includes characters specific to Cantonese.  For characters that are not available in the font, Last Resort will be used, which displays a generic box indicating which Unicode block the character belongs to.  This allows you to see in result lists which characters are available in Noto Sans HK and which are not.

The `cantotype_table.js` file is generated by the `canto_compile.pl` Perl script.  This script generates the database from official HKSCS and Unihan databases.  See the documentation within the script for further information.
