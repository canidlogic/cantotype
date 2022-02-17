# Cantotype Database Structure

Cantotype uses IndexedDB to store a cache of its dictionary files and webfonts.  This document describes how loading of the data files works with the cache.

## Data file index download

The first step to working with the cache is always to download and parse the current data file index over HTTP.  This will allow the client to figure out what can be loaded from the cache.

The data file index must be a JSON text file compressed with GZip.  The top-level entity in the index file is a JSON object.  Each property represents a file that is stored in the cache (excluding the index file itself).  The value of each property is an array of two elements.  The first element is a string that stores a revision code.  The second element is an integer that stores the number of bytes in the file.  (For compressed files, this stores the compressed size of the file.)  The second element is only used for providing progress updates while downloading data.

The names of files stored in the data file index may only include ASCII alphanumerics, underscore, hyphen, and period, the length must be at least one, and period may neither be first nor last character, nor may a period immediately follow another period.  Moreover, no file may be named `index`.

The revision code is a string in the format `YYYY-MM-DD:RRR` where `YYYY` is the four-digit year, `MM` is the two-digit month, `DD` is the two-digit day of month, and `RRR` is the three-digit revision code within that day.  Fields must be zero-padded if necessary to length.  The date within the revision code does not actually have to be a valid date, though this is recommended.  Revision codes must be comparable to each other under string comparisons, such that greater revision codes are more recent than lesser revision codes.

## Database version control

A version number is provided in the IndexedDB open request, which determines how the database is structured.  The following cases apply:

__(1) IndexedDB not available:__ If the IndexedDB database can't be opened, a warning is written to console and a flag is set to download all resources over HTTP and not attempt to use the cache at all.  The IndexedDB database might not be available in private browsing, or if the client decides to block it.

__(2) Current database has newer version:__ If there already exists a Cantotype database but it has a newer version than the version used by the connecting Cantotype instance, the database connection will fail.  This case is handled the same way as case (1) above.

__(3) Current database has same version:__ If there already exists a Cantotype database with the same version, the Cantotype application can connect to it without any issue and without any restructuring needed.

__(4) Current database has older version:__ If there already exists a Cantotype database but it has an older version, then the browser will check if there currently exist any other active instances of Cantotype using this older version database.  If there are other active instances on the older version, then the new version of Cantotype will be blocked from connecting, in which case it is handled like case (1) above.  If there are no other active instances on the older version, then the new Cantotype instance will delete all existing object stores from the database and create the new database structure, with no data filled in yet.

__(5) No current database:__ If there does not already exist a Cantotype database, a new database will be created during the open request and structured appropriately at the current version number.

This version control only applies to the _structure_ of the cache database, not to the data cached within.

## Assembling data files

At this point, we have the data file index from the HTTP server, and either we have connected to the IndexedDB database or we have determined that IndexedDB is not available for some reason.

If the IndexedDB database is available, it has a single object store, named `fstore`.  This store uses "out-of-line" keys, which means that keys are separate from the objects.  The keys are the names of files stored in the cache, and the values are array buffers storing the raw binary data of the cached file.

There is also an index file in the IndexedDB database that always has the name `index`.  This file has the same format as the data file index described earlier.  This index file documents what is currently stored in the cache.

We want to use the parsed data file index that we got from the HTTP server earlier and add an element to each array value that is an array buffer storing all the binary data for that file.  We perform two passes over the parsed data file index.  In the first pass, we attempt to load data from the IndexedDB cache.  In the second pass, we fill in all missing data by HTTP downloads.

The first pass is only performed if we managed to connect to the IndexedDB.  In this case, the first pass is done in a single read transaction to keep everything consistent.  The first step is to load and parse the `index` entry from the cache.  If the `index` entry is not present or it fails to parse, then end the transaction and proceed to the second pass.  If we get the `index` from the IndexedDB successfully, then iterate through everything in the parsed data file index we got from the HTTP server.  For each entry, check whether an entry exists in the `index` from the IndexedDB that has the same name _and_ has a revision code that is equal to or more recent than the revision code in the data file index.  If so, then load the data file from the IndexedDB and add it to the parsed data file index.

At the start of the second pass, we first go through and count the total number of bytes in the files that we haven't fetched yet, so that we can make progress reports.  Then, go through the parsed data file index.  For each entry, if the data is not present, download it from the HTTP server within an XHR operation, with sensible progress reports for the user.

At the end of these two passes, each entry in the data file index will have an array buffer attached containing all the binary data for that resource, either from HTTP download or from an equivalent cached entry that was fetched in a single transaction from IndexedDB.

## Synchronization

Now that all data files are assembled in memory, the last step is to update the IndexedDB cache if we have a database connection.  We perform the whole update in a single read-write transaction to keep everything consistent.

The first step in the transaction is to load the `index` entry from the IndexedDB, if present.  (Note that this may have changed in the meantime since we last fetched it!)  If the `index` entry was not present or is not valid, then delete everything in the IndexedDB store and store the index and all data files that we currently have in memory.

Otherwise, compare the `index` from the IndexedDB with the data file index currently in memory.  Build two lists:  an update list, and a removal list.  Any key that is present in the IndexedDB but not in the data file index goes on the removal list.  Any key that is present in the data file index but not IndexedDB goes on the update list.  For each key that is present in both, use the revision code to check whether the version in the IndexedDB or the version in our data file index is more recent, or if they are equal.  If the version in the IndexedDB is older, then add the key to the update list.

If at the end of this comparison both the update and removal lists are empty, then the cache is already synchronized and we don't need to do anything further.

In all other cases, delete everything on the removal list from the IndexedDB and store everything on the update list from the data file index to the IndexedDB.  Finally, create a copy of the data file index without the attached binary files and store it to the IndexedDB as the new `index` file.
