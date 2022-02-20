# Cantotype Data Cache

Cantotype is divided into _program files_ and _data files._  Data files are:  the compressed JSON character database, the compressed JSON word database, the WOFF webfonts, and the compressed JSON data file index.  All other files in Cantotype are program files.

The data files are handled specially because, with the exception of the data file index, all of the data files are quite large in byte size.  This is in comparison to the program files, which are very small in comparison even when taken collectively.

The data files may be available for download from the HTTP server that is serving the Cantotype webapp.  The data files may also be available from a local IndexedDB file cache stored on the client.  When IndexedDB is not available or disallowed by the client, the data files might only be available from HTTP.  When the client is offline without an active network connection, the data files might only be available from IndexedDB.  When the client is online and has IndexedDB enabled, the data files might be available both from the local cache and from the HTTP server, though it is not guaranteed that both versions of the data files are the same.

This document describes how the data files are loaded and kept synchronized.  (For offline use, the program files are expected to be handled by service workers and data caches.  Since the data caches are not necessarily designed for storing large amounts of data, the data files are not handled this way, instead being cached in IndexedDB, which is designed for larger amounts of offline storage.)

## Data file index format

On both the HTTP server and the IndexedDB cache, there is a _data file index_ that stores information about all other data files.  The structure of the data file index is exactly the same on the HTTP server and the IndexedDB cache.  On the HTTP server, the `cantotype_config.js` configuration file will have information where to find the data file directory and what the name of the data index file is within this directory.  In the IndexedDB cache, the data file index is always stored as an array buffer in the object store `fstore` with the key `index`.

The data file index must be a JSON text file compressed with GZip.  The top-level entity in the index file is a JSON object.  Each property represents a file that is stored in the cache (excluding the index file itself).  The value of each property is an array of two elements.  The first element is a string that stores a revision code.  The second element is an integer that stores the number of bytes in the file.  (For compressed files, this stores the compressed size of the file.)  The second element is only used for providing progress updates while downloading data.

The names of files stored in the data file index may only include ASCII alphanumerics, underscore, hyphen, and period, the length must be at least one, and period may neither be first nor last character, nor may a period immediately follow another period.  Moreover, no file may be named `index`.

The revision code is a string in the format `YYYY-MM-DD:RRR` where `YYYY` is the four-digit year, `MM` is the two-digit month, `DD` is the two-digit day of month, and `RRR` is the three-digit revision code within that day.  Fields must be zero-padded if necessary to length.  The date within the revision code does not actually have to be a valid date, though this is recommended.  Revision codes must be comparable to each other under string comparisons, such that greater revision codes are more recent than lesser revision codes.

## IndexedDB format

The IndexedDB cache is a database named `CantotypeCache` that has a single object store named `fstore`.  This object store has keys separate from values, where the key is the filename and the value is an array buffer that stores the raw bytes of the file.  For compressed files, the file is stored in compressed format within the IndexedDB cache.  The key `index` is reserved for the data file index, which was described in the previous section.  All other keys within the IndexedDB cache are also keys within the JSON object in the data file index.  Reading and writing should be done in single transactions to ensure the database is always in a consistent state.  If there is no `index` key then the cache database should be assumed to be empty.

A version number is provided in the IndexedDB open request, which determines how the database is structured.  The following cases apply:

__(1) IndexedDB not available:__ If the IndexedDB database can't be opened, a warning is written to console and a flag is set to download all resources over HTTP and not attempt to use the cache at all.  The IndexedDB database might not be available in private browsing, or if the client decides to block it.  If the client is offline, Cantotype will not be able to load in this case because there is no source of data files.

__(2) Current database has newer version:__ If there already exists a Cantotype database but it has a newer version than the version used by the connecting Cantotype instance, the database connection will fail.  This case is handled the same way as case (1) above.

__(3) Current database has same version:__ If there already exists a Cantotype database with the same version, the Cantotype application can connect to it without any issue and without any restructuring needed.

__(4) Current database has older version:__ If there already exists a Cantotype database but it has an older version, then the browser will check if there currently exist any other active instances of Cantotype using this older version database.  If there are other active instances on the older version, then the new version of Cantotype will be blocked from connecting, in which case it is handled like case (1) above.  If there are no other active instances on the older version, then the new Cantotype instance will delete all existing object stores from the database and create the new database structure, with no data filled in yet.

__(5) No current database:__ If there does not already exist a Cantotype database, a new database will be created during the open request and structured appropriately at the current version number.

This version control only applies to the _structure_ of the cache database, not to the data cached within.

## Offline mode check

The first step to loading the data files is to determine whether the browser is offline.  This begins by checking whether `navigator.onLine` is `false`.  If this property is `false` then the browser is definitely in offline mode.  If this property is any value other than exactly `false`, then the browser might be online or it might be offline.

If the browser offline state was not definitively determined in the previous step, then the next step is to attempt an HTTP download and JSON parse of the current data file index.  If this succeeds, then the browser is definitely online.  If this fails, then the browser should be assumed to be offline.

The following algorithm summarizes the steps above:

    1. IF navigator.onLine === false
       + THEN:
       |  2. offline = true
       |
       + ELSE:
          3. TRY download and parse data index
             + SUCCESS:
             |  4. offline = false
             |
             + FAILURE:
                5. offline = true

If the result of this algorithm is that `offline` is `true`, then attempt to connect to the IndexedDB and read the index as well as all files from that cached index within a single read transaction.  If this works, then the cached data files are loaded and there is no need for synchronization because we can't connect to the HTTP server.  If this fails, then the data file loading procedure fails because there is no way to get the data files until the client reconnects to the network.

If the result of this algorithm is that `offline` is `false`, then proceed to the next section.

## First pass

The first pass of loading attempts to fill in data files using cached data from the IndexedDB.  If connecting to the IndexedDB failed, or if there is no valid `index` within the IndexedDB, or any other problem with the IndexedDB, then skip this pass and proceed to the second pass.

For each entry in the HTTP data file index, check whether the key exists in the IndexedDB index _and_ the revision code in the IndexedDB index is the same or more recent than the revision code in the HTTP data file index.  If both of these conditions are satisfied, then the data file is loaded from the IndexedDB.  For consistency, this whole first pass must be done within a single read transaction on the IndexedDB.

## Second pass

The second pass of loading downloads any remaining files from the HTTP server.  For each entry in the HTTP data index file that does not yet have its data, use XHR to download the data file from the HTTP server.  At the end of this pass, we will have all of our necessary data.

## Synchronization

Once we have all of our data, we attempt to synchronize the IndexedDB cache.  Loading of the Cantotype webapp does not need to wait for synchronization to complete, since synchronization is merely to speed up loads of future instances of Cantotype.  Synchronization must be done within a single write transaction to ensure consistency.

The first step in the transaction is to load the `index` entry from the IndexedDB, if present.  (Note that this may have changed in the meantime since we last fetched it!)  If the `index` entry was not present or is not valid, then delete everything in the IndexedDB store and store the index and all data files that we currently have in memory.

Otherwise, compare the `index` from the IndexedDB with the data file index currently in memory.  Build two lists:  an update list, and a removal list.  Any key that is present in the IndexedDB but not in the data file index goes on the removal list.  Any key that is present in the data file index but not IndexedDB goes on the update list.  For each key that is present in both, use the revision code to check whether the version in the IndexedDB or the version in our data file index is more recent, or if they are equal.  If the version in the IndexedDB is older, then add the key to the update list.

If at the end of this comparison both the update and removal lists are empty, then the cache is already synchronized and we don't need to do anything further.

In all other cases, delete everything on the removal list from the IndexedDB and store everything on the update list from the data file index to the IndexedDB.  Finally, create a copy of the data file index without the attached binary files and store it to the IndexedDB as the new `index` file.
