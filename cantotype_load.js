"use strict";

/*
 * cantotype_load.js
 * =================
 * 
 * Data loading module for Cantotype.
 * 
 * Requires pako_inflate.js to be loaded.
 * 
 * Requires generated configuration script cantotype_config.js to be
 * loaded.
 */

// Wrap everything in an anonymous function that we immediately invoke
// after it is declared -- this prevents anything from being implicitly
// added to global scope
(function() {
  
  /*
   * Local data
   * ==========
   */
  
  /*
   * Flag that is set to true once initDB() has completed.
   */
  var m_loaded = false;
  
  /*
   * Object mapping cached file names to raw array buffers storing the
   * data, which may still be compressed.
   * 
   * Only available if m_loaded.  This does not include the index file.
   */
  var m_files;
  
  /*
   * Object mapping cached file names to object URLs for WOFF blobs that
   * have been defined for them.
   * 
   * Only available if m_loaded.  Only includes entries for files that
   * have actually been requested as WOFF blobs URLs.
   */
  var m_woffs;
  
  /*
   * Local functions
   * ===============
   */
  
  /*
   * Report an error to console and throw an exception for a fault
   * occurring within this module.
   *
   * Parameters:
   *
   *   func_name : string - the name of the function in this module
   *
   *   loc : number(int) - the location within the function
   */
  function fault(func_name, loc) {
    
    // If parameters not valid, set to unknown:0
    if ((typeof func_name !== "string") || (typeof loc !== "number")) {
      func_name = "unknown";
      loc = 0;
    }
    loc = Math.floor(loc);
    if (!isFinite(loc)) {
      loc = 0;
    }
    
    // Report error to console
    console.log("Fault at " + func_name + ":" + String(loc) +
                  " in ctt_load");
    
    // Throw exception
    throw ("ctt_load:" + func_name + ":" + String(loc));
  }
  
  /*
   * Download and load a GZipped JSON file asynchronously.
   * 
   * src is the URL of the file to load.  This file should be a .gz file
   * that stores a JSON text file.  The unzip process will be done
   * client-side through JavaScript, so the HTTP request and response
   * will NOT use any transfer coding.
   * 
   * This function returns immediately.  The download and load is done
   * asynchronously.  If the process succeeds, f_done() is called with a
   * parameter that stores the result of JSON.parse() on the inflated
   * file data, and a second parameter that stores the raw data of the
   * compressed index file in an array buffer.  If there is an error,
   * f_err() is called with a single parameter that stores the exception
   * that occurred.
   * 
   * Parameters:
   * 
   *   src : string - the URL of the GZip file to load
   * 
   *   f_done : function - callback that takes a the parsed JSON result
   *   and the raw compressed data
   * 
   *   f_err : function - callback that takes a single argument which is
   *   the exception that caused the operation to fail
   */
  function loadGZJSON(src, f_done, f_err) {
    
    var func_name = "loadGZJSON";
    var req;
    
    // Check parameters
    if ((typeof(src) !== "string") ||
        (typeof(f_done) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // Create a request to download the binary file
    req = new XMLHttpRequest();
    req.open("GET", src);
    req.responseType = "arraybuffer";
    req.overrideMimeType("application/octet-stream");
    
    // Function continues in callback when the request is done
    req.onreadystatechange = function() {
      var raw_data, str, js;
      
      // Only interested in the callback if request is done
      if (req.readyState === XMLHttpRequest.DONE) {
        // Check whether request was successful
        if (req.status === 200) {
          // We got all the binary data, so retrieve it
          raw_data = req.response;
          
          // Decompress the data to a string
          try {
            str = pako.inflate(raw_data, {"to": "string"});
          } catch (err) {
            // Decompression failed
            console.log("Failed to decompress '" + src + "'!");
            f_err("ctt_load:loadGZJSON:190");
            return;
          }
      
          // Parse the string as JSON
          try {
            js = JSON.parse(str);
          } catch (err) {
            // JSON parsing failed
            console.log("Failed to parse JSON '" + src + "'!");
            f_err("ctt_load:loadGZJSON:195");
            return;
          }
      
          // If we got here, we finally have the parsed JSON, so invoke
          // the done callback
          f_done(js, raw_data);
          
        } else {
          // File request failed
          console.log("Failed to download '" + src + "'!");
          f_err("ctt_load:loadGZJSON:200");
        }
      }
    };
    
    // Asynchronously start the request
    req.send(null);
  }
  
  /*
   * Verify that the parsed representation of a data file index is
   * valid.
   * 
   * Do not use this on parsed representations that have any raw data
   * added into them, or they will not validate.
   * 
   * Parameters:
   * 
   *   js - the parsed representation to verify
   * 
   * Return:
   * 
   *   true if valid, false if not
   */
  function verifyIndex(js) {
    
    var k, ar;
    
    // Check type
    if (typeof(js) !== "object") {
      return false;
    }
    if (js instanceof Array) {
      return false;
    }
    
    // Check each entry
    for(k in js) {
      // Get the array
      ar = js[k];
      
      // Entry must be an array
      if (!(ar instanceof Array)) {
        return false;
      }
      
      // Each array must be length two
      if (ar.length !== 2) {
        return false;
      }
      
      // First element must be string and second must be finite number
      // that is integer zero or greater
      if ((typeof(ar[0]) !== "string") ||
            (typeof(ar[1]) !== "number")) {
        return false;
      }
      if (!isFinite(ar[1])) {
        return false;
      }
      if (ar[1] !== Math.floor(ar[1])) {
        return false;
      }
      if (!(ar[1] >= 0)) {
        return false;
      }
      
      // Check string format of first element
      if (!((/^[0-9]{4}-[0-9]{2}-[0-9]{2}\:[0-9]{3}$/).test(ar[0]))) {
        return false;
      }
    }
    
    // If we got here, the index is valid
    return true;
  }
  
  /*
   * Attempt to connect to the IndexedDB with the appropriate version.
   * 
   * If this works out, f_db is called with the opened database handle.
   * 
   * If there is any problem, f_nodb is called with no parameter.
   * 
   * Parameters:
   * 
   *   f_db : function - callback that takes an IndexedDB handle if we
   *   opened the database
   * 
   *   f_nodb : function - callback that takes nothing, called if we
   *   couldn't connect to IndexedDB
   */
  function connectIXDB(f_db, f_nodb) {
    
    var func_name = "connectIXDB";
    var odr, db, i, osn;
    
    // Check parameters
    if ((typeof(f_db) !== "function") ||
        (typeof(f_nodb) !== "function")) {
      fault(func_name, 100);
    }
    
    // Attempt to open a connection
    try {
      odr = window.indexedDB.open("CantotypeCache", 1);
      
      // If there is an error opening the database or the database is
      // blocked because another version of the database is in use, then
      // proceed with the callback for no database connection
      odr.onerror = function(ev) {
        f_nodb();
      };
      odr.onblocked = function(ev) {
        f_nodb();
      };
      
      // If there is no current database or an older version, we need to
      // clear the database and update its structure
      odr.onupgradeneeded = function(ev) {
        // Get the database handle for restructuring
        db = ev.target.result;
        
        // Delete any existing object stores
        osn = [];
        for(i = 0; i < db.objectStoreNames.length; i++) {
          osn.push(db.objectStoreNames[i]);
        }
        for(i = 0; i < osn.length; i++) {
          db.deleteObjectStore(osn[i]);
        }
        
        // Create the fstore object store, which has out-of-line keys
        // and no auto-increment
        db.createObjectStore("fstore");
      };
      
      // If we get this callback, we have connected to the database with
      // the proper version
      odr.onsuccess = function(ev) {
        f_db(odr.result);
      };
      
    } catch (exa) {
      // Couldn't open a connection
      f_nodb();
    }
  }
  
  /*
   * Given a database connection to IndexedDB and a parsed
   * representation of the data index file that has all binary data
   * within it, as well as the raw byte buffer of the compressed data
   * index file, update the IndexedDB cache if necessary.
   * 
   * This returns quickly, and errors are only noted on the console.
   * Since the cache is not required for program operation, the main
   * Cantotype program does not need to wait for the update to complete.
   * 
   * This function will also take care of closing the database
   * connection.
   * 
   * Parameters:
   * 
   *   db : the database connection
   * 
   *   jsi : the parsed representation with data files within it
   * 
   *   raw_index : the raw array buffer of the compressed data index
   */
  function syncCache(db, jsi, raw_index) {
    
    var func_name = "syncCache";
    var tr, r, f, f2, f_full, f_upd, str, jsx, upl, rml, ka, i;
    
    // Perform the whole synchronization in a single transaction
    tr = db.transaction(["fstore"], "readwrite");
    
    // On any kind of return from the transaction, we will close the
    // database handle; on error returns, a warning is written to the
    // console but it is otherwise ignored
    tr.onerror = function(ev) {
      console.log("Warning: IndexedDB sync failed on error!");
      db.close();
    };
    tr.onabort = function(ev) {
      console.log("Warning: IndexedDB sync aborted!");
      db.close();
    };
    tr.onsuccess = function(ev) {
      db.close();
    }
    
    // Define a callback that will be invoked if we need to reload the
    // whole cache
    f_full = function() {
      // Begin by clearing all records out of the cache
      r = tr.objectStore("fstore").clear();
      r.onsuccess = function(eva) {
        
        // Cache is now empty; add everything including the raw_index
        // itself
        ka = Object.keys(jsi);
        i = -1;
        f = function() {
          
          // If i has special value of -1, add the index, increment i
          // and loop again
          if (i < 0) {
            r = tr.objectStore("fstore").add(raw_index, "index");
            r.onsuccess = function(evb) {
              i++;
              f();
            };
            return;
          }
          
          // If we have added everything, let the transaction complete
          if (i >= ka.length) {
            return;
          }
          
          // Add the current data file, increment i and loop again
          r = tr.objectStore("fstore").add(jsi[ka[i]][2], ka[i]);
          r.onsuccess = function(evb) {
            i++;
            f();
          };
        };
        f();
      };
    };
    
    // Define a callback that will be invoked if we need to update at
    // least part of the cache
    f_upd = function() {
      
      // Add or overwrite all keys on the update list, as well as the
      // data index
      i = -1;
      f = function() {
        
        // If i has special value of -1, update the index, increment i
        // and loop again
        if (i < 0) {
          r = tr.objectStore("fstore").put(raw_index, "index");
          r.onsuccess = function(evb) {
            i++;
            f();
          };
          return;
        }
        
        // If we have added everything, next step is to get all the
        // keys in the IndexedDB store
        if (i >= upl.length) {
          r = tr.objectStore("fstore").getAllKeys();
          r.onsuccess = function(evb) {
            
            // If we got the key list, then redo the removal list using
            // the actual keys from the store (in case the store has
            // extra elements not in its old index); else, leave the
            // removal list as-is
            if (r.result) {
              rml = [];
              for(i = 0; i < r.result.length; i++) {
                // Don't put the "index" on the removal list
                if (r.result[i] === "index") {
                  continue;
                }
                
                // Otherwise, put on removal list if not in the HTTP
                // index
                if (!(r.result[i] in jsi)) {
                  rml.push(r.result[i]);
                }
              }
            }
            
            // Finally, delete anything on the removal list
            i = 0;
            f2 = function() {
              
              // If we have removed everything on the removal list, let
              // the transaction finish
              if (i >= rml.length) {
                return;
              }
              
              // Remove current item, increment i and loop
              r = tr.objectStore("fstore").delete(rml[i]);
              r.onsuccess = function(evc) {
                i++;
                f2();
              };
            };
            f2();
            
          };
          return;
        }
        
        // Add or overwrite the current update key, increment i and loop
        // again
        r = tr.objectStore("fstore").put(jsi[upl[i]][2], upl[i]);
        r.onsuccess = function(evb) {
          i++;
          f();
        };
      };
      f();
    };
    
    // First thing we do is try to read the index
    r = tr.objectStore("fstore").get("index");
    r.onsuccess = function(eva) {
    
      // If we couldn't read the index from IndexedDB, do a full reload
      if (!(r.result)) {
        f_full();
        return;
      }
      
      // Attempt to decompress, parse, and verify the index; if this
      // fails, do a full reload
      try {
        str = pako.inflate(r.result, {"to": "string"});
      } catch (err) {
        // Decompression failed
        console.log("Warning: Failed to decompress IndexedDB index!");
        f_full();
        return;
      }
  
      try {
        jsx = JSON.parse(str);
      } catch (err) {
        // JSON parsing failed
        console.log("Warning: Failed to parse IndexedDB index!");
        f_full();
        return;
      }
      
      if (!verifyIndex(jsx)) {
        console.log("Warning: IndexedDB index didn't verify!");
        f_full();
        return;
      }
      
      // We got the index from the IndexedDB cache, so now compare it to
      // the HTTP index and construct an update list and a removal list
      upl = [];
      rml = [];
      
      ka = Object.keys(jsi);
      
      for(i = 0; i < ka.length; i++) {
        // We are going through the HTTP index here -- check whether
        // current key is in the IndexedDB index; if it is not, add it
        // to the update list and continue
        if (!(ka[i] in jsx)) {
          upl.push(ka[i]);
          continue;
        }
        
        // If we got here, the key is in both the HTTP index and the
        // IndexedDB index; add it to the update list if the IndexedDB
        // revision is older than the HTTP revision
        if (jsx[ka[i]][0] < jsi[ka[i]][0]) {
          upl.push(ka[i]);
        }
      }
      
      ka = Object.keys(jsx);
      
      for(i = 0; i < ka.length; i++) {
        // We are going through the IndexedDB index here -- check
        // whether current key is in the HTTP index; if it is not, add
        // it to the removal list and continue
        if (!(ka[i] in jsi)) {
          rml.push(ka[i]);
        }
      }
      
      // If both lists are empty, just let this transaction complete
      // since the cache is already synchronized; otherwise, do an
      // update operation
      if ((upl.length > 0) || (rml.length > 0)) {
        f_upd();
      }
    };
  }
  
  /*
   * Perform the first pass over the data file index to load any data
   * that has already been cached.
   * 
   * db is assumed to be a connection to the Cantotype IndexedDB
   * database.  jsi is assumed to be the parsed representation of the
   * data file index.
   * 
   * While working, status reports may be sent to f_status with a string
   * parameter.
   * 
   * f_done is called with no parameters if the pass completes
   * successfully.  Cached data may have been added into the passed data
   * file index in this case.
   * 
   * f_err is called if the pass fails, with a reason parameter.
   * 
   * Parameters:
   *
   *   db : the handle to the IndexedDB cache database
   * 
   *   jsi : the parsed data file index
   *  
   *   f_done : function called when pass is complete
   * 
   *   f_status : function called to report loading progress with a
   *   string parameter holding the current loading status
   * 
   *   f_err : function called to report error with a reason parameter
   */
  function dataPassOne(db, jsi, f_done, f_status, f_err) {
    
    var func_name = "dataPassOne";
    var tr, r, done_called, str, jsx, ka, i, f, raw_data;
    
    // Check all but the db and jsi parameters
    if ((typeof(f_done) !== "function") ||
        (typeof(f_status) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // We need to make sure we only call f_done() once, so set the flag
    // to false to begin with
    done_called = false;
    
    // Begin a read transaction for the pass
    tr = db.transaction(["fstore"], "readonly");
    
    // If there is a problem with the transaction, we will just call
    // done and get the files over HTTP instead
    tr.onabort = function(ev) {    
      if (!done_called) {
        done_called = true;
        f_done();
      }
    };
    
    tr.onerror = function(ev) {
      if (!done_called) {
        done_called = true;
        f_done();
      }
    };
    
    // If there transaction succeeds, we call done
    tr.onsuccess = function(ev) {
      if (!done_called) {
        done_called = true;
        f_done();
      }
    };
    
    // Read the index file from the IndexedDB database
    r = tr.objectStore("fstore").get("index");
    r.onsuccess = function(eva) {

      // If we didn't get a result for the index, end the transaction
      if (!(r.result)) {
        tr.abort();
        return;
      }
      
      // Decompress the index to a string
      try {
        str = pako.inflate(r.result, {"to": "string"});
      } catch (err) {
        // Decompression failed
        tr.abort();
        return;
      }
  
      // Parse the string as JSON
      try {
        jsx = JSON.parse(str);
      } catch (err) {
        // JSON parsing failed
        tr.abort();
        return;
      }
      
      // Verify index is valid
      if (!verifyIndex(jsx)) {
        tr.abort();
        return;
      }
      
      // Get all keys from the HTTP data file index
      ka = Object.keys(jsi);
      
      // We will process each of those keys within a callback function
      i = 0;
      f = function() {
        
        // While i is in range, skip any keys that we can't load from
        // the cache
        while (i < ka.length) {
          // If this key isn't in the cache index, skip it
          if (!(ka[i] in jsx)) {
            i++;
            continue;
          }
          
          // If the cache version is older than the HTTP version, skip
          // it
          if (jsx[ka[i]][0] < jsi[ka[i]][0]) {
            i++;
            continue;
          }
          
          // If we got here, then we can load current key from cache
          break;
        }
        
        // If we have processed all the keys, we are done
        if (i >= ka.length) {
          done_called = true;
          f_done();
          return;
        }
        
        // If we get here, then we have an entry we want to load from
        // the cache
        r = tr.objectStore("fstore").get(ka[i]);
        r.onsuccess = function(evb) {
          
          // If we got our result, add it to jsi
          if (r.result) {
            jsi[ka[i]].push(r.result);
          }
          
          // Increment i and process next key
          i++;
          f();
        };
        
      };
      f();
    };
  }
  
  /*
   * Perform the second pass over the data file index to fetch missing
   * data over HTTP.
   * 
   * jsi is assumed to be the parsed representation of the data file
   * index, which may already have some data loaded into it.
   * 
   * While working, status reports may be sent to f_status with a string
   * parameter.
   * 
   * f_done is called with no parameters if the pass completes
   * successfully.  All data will have been added into the passed data
   * file index in this case.
   * 
   * f_err is called if the pass fails, with a reason parameter.
   * 
   * Parameters:
   *
   *   jsi : the parsed data file index
   *  
   *   f_done : function called when pass is complete
   * 
   *   f_status : function called to report loading progress with a
   *   string parameter holding the current loading status
   * 
   *   f_err : function called to report error with a reason parameter
   */
  function dataPassTwo(jsi, f_done, f_status, f_err) {
    
    var func_name = "dataPassTwo";
    var ka, i, f;
    var req, raw_data;
    var str, all_bytes, so_far;
    
    // Check parameters, except jsi
    if ((typeof(f_done) !== "function") ||
        (typeof(f_status) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // Get all keys of the index
    ka = Object.keys(jsi);
    
    // Initialize download statistics
    so_far = 0;
    all_bytes = 0;
    
    for(i = 0; i < ka.length; i++) {
      if (jsi[ka[i]].length < 3) {
        all_bytes = all_bytes + jsi[ka[i]][1];
      }
    }
    
    // Define a callback function that will be invoked for each key in
    // the index using i as an iterator and then invoke it the first
    // time
    i = 0;
    f = function() {
      
      // Skip over any entries that have been already downloaded
      while (i < ka.length) {
        if (jsi[ka[i]].length > 2) {
          i++;
        } else {
          break;
        }
      }
      
      // If there are no more keys left to process, then we are done
      if (i >= ka.length) {
        f_done();
        return;
      }
      
      // If we got here, we have another entry to process, so first of
      // all send a progress update, ignoring errors from that
      try {
        if (all_bytes > 0) {
          str = "Downloading ... ";
          str = str + 
                  (Math.floor((so_far / all_bytes) * 100)).toString(10);
          str = str + "%";
        } else {
          str = "Downloading...";
        }
        f_status(str);
      } catch (ex) {
        // Ignore status report errors
      }
      
      // Create a request to download the binary file
      req = new XMLHttpRequest();
      req.open("GET", canto_config.data_base + ka[i]);
      req.responseType = "arraybuffer";
      req.overrideMimeType("application/octet-stream");
      
      // Add an event to monitor download progress and give status
      // updates
      req.onprogress = function(evp) {
        // Wrap in a try-catch because we can ignore status update
        // errors
        try {
          if (all_bytes > 0) {
            str = "Downloading ... ";
            str = str +
                  (Math.floor(((so_far + evp.loaded) / all_bytes)
                      * 100)).toString(10);
            str = str + "%";
          } else {
            str = "Downloading...";
          }
          f_status(str);
          
        } catch (exp) {
          // Ignore progress report errors
        }
      };
      
      // Function continues in callback when the request is done
      req.onreadystatechange = function() {
        
        // Only interested in the callback if request is done
        if (req.readyState === XMLHttpRequest.DONE) {
          // Check whether request was successful
          if (req.status === 200) {
            // We got all the binary data, so retrieve it
            raw_data = req.response;
            
            // Update the download statistics
            so_far = so_far + jsi[ka[i]][1];
            
            // Add the raw data to the current record
            jsi[ka[i]].push(raw_data);
            
            // Increment i and do next loop
            i++;
            f();
          
          } else {
            // Failed to download
            f_err("Failed to download " +
                  canto_config.data_base + ka[i]);
          }
        }
      };
      
      // Asynchronously start the download
      req.send(null);
    };
    f();
  }
  
  /*
   * Attempt to load all data files from the cache without using HTTP.
   * 
   * While loading is in progress, the f_status callback may be called
   * with a string containing a progress report that can be shown to the
   * user to indicate how far along the loading process is.
   * 
   * If loading finishes successfully, f_ready will be called with no
   * parameters.  If there is any failure, f_err will be called with a
   * reason parameter.
   * 
   * Parameters:
   * 
   *   f_ready : function called when load is complete
   * 
   *   f_status : function called to report loading progress with a
   *   string parameter holding the current loading status
   * 
   *   f_err : function called to report loading error with a reason
   *   parameter
   */
  function cacheLoad(f_ready, f_status, f_err) {
    
    var func_name = "cacheLoad";
    var tr, r, str, jsx, i, f, ka, k;
    
    // Check parameters
    if ((typeof(f_ready) !== "function") ||
        (typeof(f_status) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // Connect to the IndexedDB cache
    connectIXDB(
      function(db) {
        // We are connected, so now try to load everything from a single
        // read transaction
        tr = db.transaction(["fstore"], "readonly");
        
        // On error or abort, report that loading failed
        tr.onerror = function(ev) {
          f_err("Offline and failed to load from cache");
        };
        tr.onabort = function(ev) {
          f_err("Offline and failed to load from cache");
        }
        
        // First, load the index
        r = tr.objectStore("fstore").get("index");
        r.onsuccess = function(ev) {
          
          // Abort the transaction if no index in the cache
          if (!(r.result)) {
            tr.abort();
            return;
          }
          
          // Decompress, parse, and verify the index
          try {
            str = pako.inflate(r.result, {"to": "string"});
          } catch (err) {
            // Decompression failed
            f_err("Offline and failed to load from cache");
            return;
          }
      
          try {
            jsx = JSON.parse(str);
          } catch (err) {
            // JSON parsing failed
            f_err("Offline and failed to load from cache");
            return;
          }
          
          if (!verifyIndex(jsx)) {
            f_err("Offline and failed to load from cache");
            return;
          }
          
          // Get all of the data file keys
          ka = Object.keys(jsx);
          
          // Load all of the raw data from the cache
          i = 0;
          f = function() {
            
            // If we have loaded everything, then update module state
            // and invoke done handler
            if (i >= ka.length) {
              m_files = {};
              for(k in jsx) {
                m_files[k] = jsx[k][2];
              }
              
              // Start the WOFF map at empty
              m_woffs = {};
              
              // Set loaded flag
              m_loaded = true;
              
              // Invoke ready callback
              f_ready();
              return;
            }
            
            // Load the current file into memory
            r = tr.objectStore("fstore").get(ka[i]);
            r.onsuccess = function(evb) {
            
              // Fail if we didn't find the key
              if (!(r.result)) {
                f_err("Offline and failed to load from cache");
                return;
              }
            
              // Add the data to the structure
              jsx[ka[i]].push(r.result);
            
              // Increment i and loop back
              i++;
              f();
            };
            
          };
          f();
        
        };
        
      },
      function() {
        // Couldn't connect to cache, so loading fails
        f_err("Offline and failed to load from cache");
      }
    );
  }
  
  /*
   * Public functions
   * ================
   */
  
  /*
   * Decompress, parse, and return a JSON data file that has been loaded
   * by this module.
   * 
   * You must use initDB() first and have that return through the
   * f_ready callback before this function can be used.
   * 
   * Parameters:
   * 
   *   fname : string - the name of the file to load
   * 
   * Return:
   * 
   *   the parsed representation of that JSON file
   */
  function jsonData(fname) {
    
    var func_name = "jsonData";
    var js;
    
    // Check state
    if (!m_loaded) {
      fault(func_name, 50);
    }
    
    // Check parameter
    if (typeof(fname) !== "string") {
      fault(func_name, 100);
    }
    
    // Check that we have the data file
    if (!(fname in m_files)) {
      throw("Can't find requested data file '" + fname + "'");
    }
    
    // Try to decompress and parse JSON
    try {
      js = JSON.parse(pako.inflate(m_files[fname], {"to": "string"}));
    } catch (ex) {
      throw("Can't load JSON from data file '" + fname + "'");
    }
    
    // Return parsed data
    return js;
  }
  
  /*
   * Store a file of the given name into a Blob of type font/woff and
   * return an object URL that can be used to access it.
   * 
   * Object URLs are cached, so that if the same file name is requested
   * multiple times, the same object URL will be returned for each
   * request.
   * 
   * You must use initDB() first and have that return through the
   * f_ready callback before this function can be used.
   * 
   * Parameters:
   * 
   *   fname : string - the name of the file to load
   * 
   * Return:
   * 
   *   an object URL to a WOFF blob for this file
   */
  function woffURL(fname) {
    
    var func_name = "woffURL";
    var b;
    
    // Check state
    if (!m_loaded) {
      fault(func_name, 50);
    }
    
    // Check parameter
    if (typeof(fname) !== "string") {
      fault(func_name, 100);
    }
    
    // If we already have this object URL cached, return it
    if (fname in m_woffs) {
      return m_woffs[fname];
    }
    
    // Not cached yet, so check that we have the data file
    if (!(fname in m_files)) {
      throw("Can't find requested data file '" + fname + "'");
    }
    
    // Turn the data file into a WOFF blob
    b = new Blob([m_files[fname]], {"type": "text/css"});
    
    // Create an object URL for the WOFF blob
    b = URL.createObjectURL(b);
    
    // Add the object URL to the WOFF blob URL cache
    m_woffs[fname] = b;
    
    // Return URL
    return b;
  }
  
  /*
   * Asynchronously load all database files from HTTP and the IndexedDB
   * cache, and update the IndexedDB cache if possible.
   * 
   * While loading is in progress, the f_status callback may be called
   * with a string containing a progress report that can be shown to the
   * user to indicate how far along the loading process is.
   * 
   * If loading finishes successfully, f_ready will be called with no
   * parameters.  If there is any failure, f_err will be called with a
   * reason parameter.
   * 
   * Parameters:
   * 
   *   f_ready : function called when load is complete
   * 
   *   f_status : function called to report loading progress with a
   *   string parameter holding the current loading status
   * 
   *   f_err : function called to report loading error with a reason
   *   parameter
   */
  function initDB(f_ready, f_status, f_err) {
    
    var func_name = "initDB";
    var k;
    
    // Check parameters
    if ((typeof(f_ready) !== "function") ||
        (typeof(f_status) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // If browser indicates it is in offline mode, then perform a cache
    // load
    if (navigator.onLine === false) {
      cacheLoad(f_ready, f_status, f_err);
      return;
    }
    
    // First we need to get and parse the data index file from HTTP
    loadGZJSON(canto_config.data_base + canto_config.index_name,
      function(js_index, raw_index) {
        
        // Verify the index file
        if (!verifyIndex(js_index)) {
          f_err("Data file index not valid");
          return;
        }
        
        // Now attempt a connection to IndexedDB
        connectIXDB(
          function(db) {
            // We got IndexedDB open, so perform the first pass over the
            // data index to load any locally cached data
            dataPassOne(db, js_index,
              function() {
                // Now perform the second pass to fetch any missing data
                // over HTTP
                dataPassTwo(js_index,
                  function() {
                    // Finally, we'll try to update the cached data in
                    // the IndexedDB; this isn't strictly necessary for
                    // the program, so we can let this update run
                    // asynchronously without waiting for it to complete
                    // and without checking for errors
                    try {
                      syncCache(db, js_index, raw_index);
                    } catch (exb) {
                      console.log("Failed to syncCache.");
                    }
                    
                    // Our data index file has all the data, so now copy
                    // that into m_files
                    m_files = {};
                    for(k in js_index) {
                      m_files[k] = js_index[k][2];
                    }
                    
                    // Start the WOFF map at empty
                    m_woffs = {};
                    
                    // Set loaded flag
                    m_loaded = true;
                    
                    // We can now invoke the completion callback
                    f_ready();
                    
                  },
                  f_status, f_err
                );
                
              },
              f_status, f_err
            );
            
          },
          function() {
            // IndexedDB not available, so we just perform the second
            // pass to load everything
            dataPassTwo(js_index,
              function() {
                // Our data index file has all the data, so now copy
                // that into m_files
                m_files = {};
                for(k in js_index) {
                  m_files[k] = js_index[k][2];
                }
                
                // Start the WOFF map at empty
                m_woffs = {};
                
                // Set loaded flag
                m_loaded = true;
                
                // Invoke ready callback
                f_ready();
                
              },
              f_status, f_err
            );
          }
        );
        
      },
      function(reason) {
        // Failed to load data index over HTTP, so assume we are offline
        // and perform a cache load
        cacheLoad(f_ready, f_status, f_err);
      }
    );
  }

  /*
   * Export declarations
   * ===================
   * 
   * All exports are declared within a global "ctt_main" object.
   */
  window.ctt_load = {
    "jsonData": jsonData,
    "woffURL": woffURL,
    "initDB": initDB
  };

}());
