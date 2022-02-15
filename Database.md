# Cantotype Database Structure

Cantotype uses a client-side SQLite database to store information about characters and words.  In initial versions of Cantotype, these data tables were stored with simple JavaScript arrays and object-based indices.  However, the large size of the data tables caused usability problems with this simple JavaScript approach.  Current versions of Cantotype have switched to using an client-side, in-memory database based on a webassembly-compiled version of SQLite.  This document describes the structure of that database.

## charlist table

The `charlist` table stores all the basic information about individual characters.  It has the following structure:

    CREATE TABLE charlist(
      cid INTEGER PRIMARY KEY,
      cpv INTEGER UNIQUE NOT NULL,
      cgl TEXT
    );

    CREATE UNIQUE INDEX charlist_cpv
      ON charlist(cpv);

The `cid` is the SQLite `rowid` alias field.  The `cpv` is the numeric codepoint of the character, which must be unique within the table.

The `cgl` field optionally stores an English gloss of the character.  It may be NULL if there is no gloss available.

## charjyu table

The `charjyu` table stores Cantonese Jyutping readings of characters in the `charlist` table.  It has the following structure:

    CREATE TABLE charjyu(
      jid INTEGER PRIMARY KEY,
      cid INTEGER NOT NULL
            REFERENCES charlist(cid),
      jor INTEGER NOT NULL,
      jyu TEXT NOT NULL,
      UNIQUE(cid, jor)
    );

    CREATE UNIQUE INDEX charjyu_key
      ON charjyu(cid, jor);

    CREATE INDEX charjyu_cid
      ON charjyu(cid);
    CREATE INDEX charjyu_jyu
      ON charjyu(jyu);

This table associates a sequence of Cantonese Jyutping readings with records from the `charlist` table.  `jid` is the SQLite `rowid` alias field.

The `cid` field is a foreign key that selects a record in the `charlist` table, defining which character this reading is for.  The `jor` field is an integer value that is solely used for sorting the Jyutping readings in a well-defined order, with lower integer values preceding higher integer values.  Together, the `cid` and `jor` field pair must be unique within the table.

Finally, the `jyu` field stores the actual Jyutping reading.  All letters used within the reading are lowercase.

## wordlist table

The `wordlist` table stores all the basic information about word definitions.  It has the following structure:

    CREATE TABLE wordlist(
      wid INTEGER PRIMARY KEY,
      wtr TEXT NOT NULL,
      wsm TEXT NOT NULL
    );

    CREATE INDEX wordlist_wtr
      ON wordlist(wtr);
    CREATE INDEX wordlist_wsm
      ON wordlist(wsm);

The `wid` field is the SQLite `rowid` alias field.  The `wtr` field is the traditional character transcription of the word.  The `wsm` field is the simplified character transcription of the word.  If the traditional and simplified transcriptions are equivalent, both fields will have the same values.

## wordpny table

The `wordpny` table stores the Pinyin syllables of words in the `wordlist` table.  It has the following structure:

    CREATE TABLE wordpny(
      pid INTEGER PRIMARY KEY,
      wid INTEGER NOT NULL
            REFERENCES wordlist(wid),
      por INTEGER NOT NULL,
      pny TEXT NOT NULL,
      UNIQUE(wid, por)
    );

    CREATE UNIQUE INDEX wordpny_key
      ON wordpny(wid, por);

    CREATE INDEX wordpny_wid
      ON wordpny(wid);
    CREATE INDEX wordpny_pny
      ON wordpny(pny);

This table associates a sequence of Mandarin Pinyin syllables with records from the `wordlist` table.  `pid` is the SQLite `rowid` alias field.

The `wid` field is a foreign key that selects a record in the `wordlist` table, defining which word this syllable belongs to.  The `por` field is an integer value that is solely used for sorting the Pinyin syllables in a well-defined order, with lower integer values preceding higher integer values.  Together, the `wid` and `por` field pair must be unique within the table.

Finally, the `pny` field stores the actual Pinyin syllable.  Decimal number suffixes for the tone number are used instead of diacritic marks on the vowels, with 5 meaning the neutral tone.  U-umlaut is represented by the lowercase letter U followed by a colon.  All letters used within the Pinyin are lowercase, even for syllables that represent proper names.

This table does not store "syllables" containing only punctuation marks.  Each syllable must have at least one ASCII letter.

## worddfn table

The `worddfn` table stores the English definitions of words in the `wordlist` table.  It has the following structure:

    CREATE TABLE worddfn(
      did INTEGER PRIMARY KEY,
      wid INTEGER NOT NULL
            REFERENCES wordlist(wid),
      dor INTEGER NOT NULL,
      dtx TEXT NOT NULL,
      UNIQUE(wid, dor)
    );

    CREATE UNIQUE INDEX worddfn_key
      ON worddfn(wid, dor);

    CREATE INDEX worddfn_wid
      ON worddfn(wid);

This table associates a sequence of English definitions with records from the `wordlist` table.  `did` is the SQLite `rowid` alias field.

The `wid` field is a foreign key that selects a record in the `wordlist` table, defining which word this definition belongs to.  The `dor` field is an integer value that is solely used for sorting the definitions in a well-defined order, with lower integer values preceding higher integer values.  Together, the `wid` and `dor` field pair must be unique within the table.

Finally, the `dtx` field stores the actual definition.  Although definitions are in English, Chinese characters might still be used in the definitions, so be sure to use a font that supports Han characters when rendering definitions.
