# Cantotype Database Structure

Cantotype uses IndexedDB to store its database client-side.  This document describes the structure of that database.

## Version control

There are two levels of version.  The first version level is the _structure version_ of the IndexedDB database.  This is the version number used in the IndexedDB open request.  The following cases apply to the structure version:

__(1) Current database has newer structure version:__ If there already exists a Cantotype database but it has a newer structure version than the structure version used by the connecting Cantotype instance, the database connection will fail.  You must reload the Cantotype application so that it can use the newer database version.

__(2) Current database has same structure version:__ If there already exists a Cantotype database with the same structure version, the Cantotype application can connect to it without any issue and without any restructuring needed.

__(3) Current database has older structure version:__ If there already exists a Cantotype database but it has an older structure version, then the browser will check if there currently exist any other active instances of Cantotype using this older structure version database.  If there are other active instances on the older version, then the new version of Cantotype will be blocked from starting up until all the old instances close their database connections.  If there are no other active instances on the older version, then the new Cantotype instance will delete all existing object stores from the database and create the new database structure, with no data filled in yet.

__(4) No current database:__ If there does not already exist a Cantotype database, a new database will be created during the open request and structured appropriately at the current version number.

The second version level is the _data version_ of the IndexedDB database.  This refers to the version of character and dictionary data that is currently stored in the IndexedDB database.  It is also possible for the IndexedDB database to be empty with no data within it.

The data version is stored within two variables `dataver` and `image` in an object store named `vars` (described in next section).  The `image` variable is an integer that starts out at one and is incremented each time the data within the database is reloaded.  If the `image` variable is not present, then the `dataver` variables is not present either, and the database is completely empty in this case.

If the `image` variable is present but the `dataver` variable is absent, it means either that the database is currently in the process of being rebuilt or that a rebuild of the database was interrupted and the database is now incomplete.  There is no way to reliably distinguish between these two alternative situations.

If both the `image` and `dataver` variables are present, it means that the database is completely loaded with the dataset given by the data version in `dataver`.  The `dataver` is a string of the following format:

    YYYY-MM-DD:RRR

Where `YYYY` is the four-digit, zero-padded year, `MM` is the two-digit, zero-padded month, `DD` is the two-digit, zero-padded day of month, and `RRR` is a three-digit, zero-padded revision code within that day.  Cantotype does not actually check that the given date is a valid date, it just uses decimal digits to compare data versions numerically.

## Synchronization

Multiple instances of Cantotype might access the database at the same time.  Furthermore, with the way IndexedDB works, it is not feasible to load all of the data records in a single transaction.  This means that while the database is being rebuilt, it may be in an incomplete state and other instances of Cantotype might try to access the incomplete database.  Synchronization protocols are therefore required to ensure that the database is kept coherent across multiple instances of Cantotype.

There are two parts of this synchronization protocol:  the _initial transaction_ and the _transaction prefix._  The initial transaction must always be the first transaction performed after opening the Cantotype database.  The transaction prefix must always be preformed at the start of any transaction subsequent to the initial transaction.

The __initial transaction__ is always the first transaction performed after connecting to the Cantotype database.  This must be a read-write transaction on the `vars` store.  Here is the algorithm for the initial transaction:

    SINGLE READ-WRITE TRANSACTION ON "VARS":
      - Query "image" variable
        + NOT DEFINED:
        |   - Define "image" as 1 and make sure no "dataver"
        |   - Store 1 as current image state
        |   - Reload database
        |
        + DEFINED:
            - Query "dataver" variable
              + NOT DEFINED:
              |   - Increment "image"
              |   - Store incremented value as current image state
              |   - Reload database
              |
              + DEFINED:
                  - Compare "dataver" to the dataver of data files
                    + DATABASE SAME OR NEWER THAN DATA FILES:
                    |   - Store "image" as current image state
                    |    (No database reload necessary)
                    |
                    + DATABASE OLDER THAN DATA FILES:
                        - Increment "image"
                        - Store incremented value as current image state
                        - Delete "dataver"
                        - Reload database

In other words, the initial transaction only uses the database as-is if both `image` and `dataver` are defined in the `vars` store _and_ the version in `dataver` from the `vars` store is greater than or equal to the `dataver` in the data file index.  In all other cases, a database reload is necessary.  Each time the database reload begins, the `dataver` variable is removed if present and the `image` variable is incremented (or defined as 1 if it does not exist).

The "current image state" defined in the algorithm above is remembered.  Then, at the start of every transaction after the initial transaction, the following procedure must be done:

    AT THE START OF EVERY SUBSEQUENT TRANSACTION:
      - Query "image" variable
        + NOT DEFINED:
        |   - Database changed, need to reload app
        |
        + DEFINED:
            - IF "image" NOT EQUAL TO current image state:
              THEN:
                - Database changed, need to reload app

In other words, this transaction prefix verifies that the `image` variable has not changed since the initial transaction.  If there has been any change of the `image` variable, then the transaction may not proceed and any further use of the Cantotype database is disallowed until the Cantotype app instance is reloaded.  This happens when a new Cantotype app instance has been started _and_ that new instance has begun reloading the database with newer data.

If a new Cantotype instance is started up while a previous Cantotype instance is still in the midst of reloading the database, the new Cantotype instance will increase the `image` number and begin a fresh reload.  The old Cantotype instance will detect this change to the `image` number within the prefix of the next transaction and then stop the reload with an error so that the newer instance may finish its fresh reload.

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
