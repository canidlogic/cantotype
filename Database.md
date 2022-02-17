# Cantotype Database Structure

Cantotype uses IndexedDB to store a cache of its dictionary files and webfonts.  This document describes the structure of that cache database.

## Version control

A version number is provided in the IndexedDB open request, which determines how the database is structured.  The following cases apply to the version:

__(1) Current database has newer version:__ If there already exists a Cantotype database but it has a newer version than the version used by the connecting Cantotype instance, the database connection will fail.  You must reload the Cantotype application so that it can use the newer database version.

__(2) Current database has same version:__ If there already exists a Cantotype database with the same version, the Cantotype application can connect to it without any issue and without any restructuring needed.

__(3) Current database has older version:__ If there already exists a Cantotype database but it has an older version, then the browser will check if there currently exist any other active instances of Cantotype using this older version database.  If there are other active instances on the older version, then the new version of Cantotype will be blocked from starting up until all the old instances close their database connections.  If there are no other active instances on the older version, then the new Cantotype instance will delete all existing object stores from the database and create the new database structure, with no data filled in yet.

__(4) No current database:__ If there does not already exist a Cantotype database, a new database will be created during the open request and structured appropriately at the current version number.

This version control only applies to the _structure_ of the cache database, not to the data cached within.

## File store

The cache database has a single object store, named `fstore`.  This store uses "out-of-line" keys, which means that keys are separate from the objects.  The keys are the names of files stored in the cache, and the values are array buffers storing the raw binary data of the cached file, except for the special `image` key.

The special `image` key is a revision number for the whole IndexedDB cache.  If the key is not defined, it is interpreted to be a key value of zero.  Otherwise, the key must map to an integer value that is greater than zero.  Each time the cache database is updated, the image key is incremented.

If the `image` key is not present, the cache should be entirely empty.  Otherwise, if the image key is present, there should also be a special file named `index` in the store.  If no `index` is present when `image` is present, then the image is invalid and must be completely resynchronized.

If `index` is present, then it must be a JSON text file compressed with GZip.  The top-level entity in the index file is a JSON object.  Each property represents a file that is stored in the cache, except that the `index` file is _not_ included.  The value of each property is an array of two elements.  The first element is a string that stores a revision code.  The second element is an integer that stores the number of bytes in the file.  (For compressed files, this stores the compressed size of the file.)  The second element is only used for providing progress updates while downloading data.

The revision code is a string in the format `YYYY-MM-DD:RRR` where `YYYY` is the four-digit year, `MM` is the two-digit month, `DD` is the two-digit day of month, and `RRR` is the three-digit revision code within that day.  Fields must be zero-padded if necessary to length.  The date within the revision code does not actually have to be a valid date, though this is recommended.  Revision codes must be comparable to each other under string comparisons, such that greater revision codes are more recent than lesser revision codes.

## Synchronization

Cantotype always begins by fetching the data file index from the HTTP server.  The data file index has the same format as the special `index` file within the file store, as described in the previous section.  Once the data file index is fetched, Cantotype will perform a single read transaction to grab the `image` and `index` files from the IndexedDB database, if present.  If either `image` or `index` is absent, then all files within the data file index are added to the download list.  Otherwise, the download list will only include entries from the data file index where the revision stored on the HTTP server is more recent than the revision stored in the IndexedDB, or where the IndexedDB does not have any version of the file from the HTTP server.  The `image` code will also be saved in memory, with zero used as the image code if the image code is absent or not valid.

Next, any files on the download list are downloaded from the HTTP server into array buffers using XHR.  The file sizes in the data file index allow the total byte length of the download to be computed, so that the XHR progress event can give accurate progress statistics.  If the download list is empty _and_ there are no extra files in the IndexedDB cache that need to be removed, then the IndexedDB database is already synchronized and nothing further need be done.

Once all files have been downloaded and are held in memory, a single IndexedDB transaction will be used to update the whole cache.  First, since the IndexedDB could have changed in the meantime, the `image` file within the IndexedDB database will once again be queried to determine a current image number, or zero if the `image` file is absent or invalid.  If this image number does not match the image number that was determined from the initial transaction, then synchronization fails because the database has changed in the meantime.  Otherwise, all downloaded files are stored in the cache, the data file index replaces the old `index`, the `image` is incremented by one, and the incremented image number is remembered as the cache revision.  Finally, the last step within the transaction is to iterate through all the keys in the cache and delete any files that are neither `image` nor `index` nor referenced from the cache.  Once this transaction completes, the cache will be syncronized.

The remembered image number is used at the start of all subsequent transactions to check whether the cache changed.  If the remembered image number does not match the number stored in `image`, then some other instance of Cantotype has changed the database and the current instance's cache is no longer valid.
