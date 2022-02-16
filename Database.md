# Cantotype Database Structure

Cantotype uses IndexedDB to store its database client-side.  This document describes the structure of that database.

## Version control

There are two levels of version.  The first version level is the _structure version_ of the IndexedDB database.  This is the version number used in the IndexedDB open request.  The following cases apply to the structure version:

__(1) Current database has newer structure version:__ If there already exists a Cantotype database but it has a newer structure version than the structure version used by the connecting Cantotype instance, the database connection will fail.  You must reload the Cantotype application so that it can use the newer database version.

__(2) Current database has same structure version:__ If there already exists a Cantotype database with the same structure version, the Cantotype application can connect to it without any issue and without any restructuring needed.

__(3) Current database has older structure version:__ If there already exists a Cantotype database but it has an older structure version, then the browser will check if there currently exist any other active instances of Cantotype using this older structure version database.  If there are other active instances on the older version, then the new version of Cantotype will be blocked from starting up until all the old instances close their database connections.  If there are no other active instances on the older version, then the new Cantotype instance will delete all existing object stores from the database and create the new database structure, with no data filled in yet.

__(4) No current database:__ If there does not already exist a Cantotype database, a new database will be created during the open request and structured appropriately at the current version number.

The second version level is the _data version_ of the IndexedDB database.  This refers to the version of character and dictionary data that is currently stored in the IndexedDB database.  It is also possible for the IndexedDB database to be empty with no data within it.

The data version is stored within a variable `dataver` in an object store named `vars` (described in next section).  If the variable is not defined, then no data is currently loaded.  There might actually be some data in the database in this case, but it should be assumed incomplete and invalid.  If the data version variable exists, then it is a string of the following format:

    YYYY-MM-DD:RRR

Where `YYYY` is the four-digit, zero-padded year, `MM` is the two-digit, zero-padded month, `DD` is the two-digit, zero-padded day of month, and `RRR` is a three-digit, zero-padded revision code within that day.

After Cantotype connects to the database, it checks the data version number of its data files from the data file index, and it also checks the data version number currently in the database.  If there is no data version in the database or if the data version in the database is less than the data version of the data files, then within a single transaction, all data currently in the database is cleared, new data is loaded from the data files, and the `dataver` variable is added or updated to match the data files that were just loaded.  If the data version of the database is greater than or equal to the data version of the data files, the database is used as-is without reloading.

## Variables store

The database has an object store named `vars` used as a simple key/value store for configuration variables.  Objects in the store have the following format:

    vars objects:
    {
      var_name  : string,
      var_value : (any type)
    }

    key: var_name

The `vars` store is used to hold a variable `dataver` describing the data version, as described in the previous section.  If no such variable is defined, the database does not include any valid data set.

## Character store

The database has an object store named `cinfo` that stores data records for individual Chinese characters.  Objects in the store have the following format:

    cinfo objects:
    {
        cpv : integer,
        crd : array of string,
      ( dfn : string )
    }

    key: cpv

The `cpv` is the numeric Unicode codepoint value of the character.  The `crd` is an array of Cantonese Jyutping readings of the character.  The optional `dfn` property, if defined, is an English gloss of the character, but note that the English gloss might contain Chinese characters!

## Readings store

The database has an object store named `cread` that maps Jyutping readings to all codepoints having that reading.  All codepoints referenced in this object store will be in the `cinfo` object store.  The values in this store can be derived completely from the `cinfo` object store.  Objects in the store have the following format:

    cread objects:
    {
      jyu : string,
      cpa : array of integer
    }

    key: jyu

The `jyu` is a Jyutping syllable in lowercase.  The `cpa` array stores the numeric Unicode codepoints of all characters that have that Cantonese reading _and_ appear in the `cinfo` object store.

## Word store

The database has an object store named `words` that stores all the word definitions given in the dictionary.  Objects in the store have the following format:

    words objects:
    {
        wid : integer,
        tc  : string,
      ( sc  : string, )
        py  : array of string,
        df  : array of string
    }

    key: wid, auto-increment

The `wid` key for this object store is arbitrary and generated automatically with an auto-increment.

`tc` stores the traditional characters for this dictionary entry.  If there are any different simplified characters, `sc` stores the simplified characters for this dictionary entry.  If the traditional and simplified characters are exactly the same, the `sc` property is left out.

`py` is an array of strings representing the Mandarin Pinyin syllables for the word.  Instead of diacritics, a tone numbers is suffixed to the syllable, with 5 standing for neutral tone.  Instead of U-umlaut, the lowercase letter U followed by a colon is used.  Only lowercase letters are used in the syllables.

`df` is an array of strings representing the English definitions attached to this dictionary entry.  However, note that Chinese characters may still be used within the English definitions.
