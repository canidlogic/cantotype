"use strict";

/*
 * cantotype.js
 * ============
 * 
 * Main program module for Cantotype.
 * 
 * Requires cantotype_load.js to be loaded, as well as the generated
 * cantotype_config.js file.
 */

// Wrap everything in an anonymous function that we immediately invoke
// after it is declared -- this prevents anything from being implicitly
// added to global scope
(function() {

  /*
   * Constants
   * =========
   */
  
  /*
   * All the valid Yale initials, each surrounded by colons.
   */
  var VALID_INITIALS = ":b:p:m:f:d:t:n:l:g:k:ng:h:gw:kw:w:j:ch:s:y:";

  /*
   * The maximum number of results that may be returned from a
   * dictionary query.
   */
  var MAX_DICT_RESULTS = 500;

  /*
   * Local data
   * ==========
   */
  
  /*
   * Flag that is set to true once the dictionary has been initialized.
   */
  var m_built = false;
  
  /*
   * Flag that is set once the database is connected.
   */
  var m_conn = false;
  
  /*
   * The image state when the database was first loaded, or -1 if not
   * yet established.
   * 
   * This is established by the syncTransaction() function and must be
   * established before any other transaction can be performed on the
   * database.
   */
  var m_dbimage = -1;
  
  /*
   * The IndexedDB handle, only if m_conn is true.
   */
  var m_db;

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
                  " in ctt_main");
    
    // Throw exception
    throw ("ctt_main:" + func_name + ":" + String(loc));
  }
  
  /*
   * Get a new transaction and run the transaction prefix so that it is
   * properly synchronized.
   * 
   * m_conn must be true and m_dbimage must be greater than zero for
   * this to work.
   * 
   * storeNames and mode are passed through to the IndexedDB function
   * IDBDatabase.transaction(), except that the store "vars" is added
   * to storeNames if not already present.
   * 
   * Once the transaction is created, this will verify that "image" is
   * defined in the "vars" table with a value equal to m_dbimage.  If
   * not, then the database is out of sync and f_err will be invoked
   * with the string "DBSyncError".
   * 
   * The callback f_ready will be invoked with the newly prepped
   * transaction object if successful, otherwise f_err will be invoked
   * with a reason.
   * 
   * The transaction will also automatically have f_err registered as
   * an error handler for both the abort and error events on the
   * transaction.
   * 
   * See "Database.md" for more about how synchronization works.
   * 
   * Parameters:
   * 
   *   storeNames: string array - the stores that will be accessed
   *   during the transaction, passed through to IndexedDB after adding
   *   "vars" if missing
   * 
   *   mode : <any> - passed through to IndexedDB
   * 
   *   f_ready : function - callback invoked with the newly prepped
   *   transaction if successful
   * 
   *   f_err : function - callback invoked with a reason if there is any
   *   problem
   */
  function prepTrans(storeNames, mode, f_ready, f_err) {
    
    var func_name = "prepTrans";
    var tr, r, op;
    var need_vars, i;
    
    // Check state
    if ((!m_conn) || (m_dbimage < 1)) {
      fault(func_name, 50);
    }
    
    // If storeNames is not an array, it might be a DOMStringList, in
    // which case make an array copy of it
    if (!(storeNames instanceof Array)) {
      op = storeNames;
      storeNames = [];
      for(i = 0; i < op.length; i++) {
        storeNames.push(op[i]);
      }
    }
    
    // Check parameters
    if (!(storeNames instanceof Array)) {
      fault(func_name, 100);
    }
    if ((typeof(f_ready) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 110);
    }
    
    // Check if we need to add "vars" to the list of stores
    need_vars = true;
    for(i = 0; i < storeNames.length; i++) {
      if (storeNames[i] === "vars") {
        need_vars = false;
        break;
      }
    }
    
    // Add "vars" if necessary
    if (need_vars) {
      storeNames.push("vars");
    }
    
    // Grab a new transaction
    tr = m_db.transaction(storeNames, mode);
    
    // If we added "vars" to the array, remove it
    if (need_vars) {
      storeNames.pop();
    }
    
    // Register error handler
    tr.onabort = f_err;
    tr.onerror = f_err;
    
    // Query for the "image" variable
    r = tr.objectStore("vars").get("image");
    r.onsuccess = function(ev) {
    
      // If "image" variable not defined, then synchronization error
      if (!(r.result)) {
        f_err("DBSyncError");
        return;
      }
      
      // Check whether image equal to stored image
      if (r.result.var_value === m_dbimage) {
        // Database still in sync, so we are ready
        f_ready(tr);
      
      } else {
        // Database not in sync, so synchronization error
        f_err("DBSyncError");
      }
    };
  }
  
  /*
   * Return the character index of the last character in the string that
   * is a combining acute accent, combining grave accent, or combining
   * macron, or return -1 if no such characters remain.
   *
   * Parameters:
   *
   *   str : string - the string to search
   *
   * Return:
   *
   *   the index of the last such character, or -1
   */
  function lastDiacritic(str) {
    
    var func_name = "lastDiacritic";
    var lastG, lastA, lastM;
    var m;
    
    // Check parameter
    if (typeof str !== "string") {
      fault(func_name, 100);
    }
    
    // Figure out the last index of each relevant diacritic
    lastG = str.lastIndexOf(String.fromCharCode(0x0300));
    lastA = str.lastIndexOf(String.fromCharCode(0x0301));
    lastM = str.lastIndexOf(String.fromCharCode(0x0304));
    
    // Get the maximum value
    m = lastG;
    if (lastA > m) {
      m = lastA;
    }
    if (lastM > m) {
      m = lastM;
    }
    
    // Return the last index or -1
    return m;
  }
  
  /*
   * Return the character index of the last vowel in the string, or
   * return -1 if no vowels remain.
   *
   * Y is not considered a vowel by this function.
   *
   * Parameters:
   *
   *   str : string - the string to search
   *
   * Return:
   *
   *   the index of the last such character, or -1
   */
  function lastVowel(str) {
    
    var func_name = "lastVowel";
    var lastA, lastE, lastI, lastO, lastU;
    var m;
    
    // Check parameter
    if (typeof str !== "string") {
      fault(func_name, 100);
    }
    
    // Figure out the last index of each vowel
    lastA = str.lastIndexOf("a");
    lastE = str.lastIndexOf("e");
    lastI = str.lastIndexOf("i");
    lastO = str.lastIndexOf("o");
    lastU = str.lastIndexOf("u");
    
    // Get the maximum value
    m = lastA;
    if (lastE > m) {
      m = lastE;
    }
    if (lastI > m) {
      m = lastI;
    }
    if (lastO > m) {
      m = lastO;
    }
    if (lastU > m) {
      m = lastU;
    }
    
    // Return the last index or -1
    return m;
  }
  
  /*
   * Return the character index of the first vowel in the string, or
   * return -1 if no vowels remain.
   *
   * Y is not considered a vowel by this function.
   *
   * Parameters:
   *
   *   str : string - the string to search
   *
   * Return:
   *
   *   the index of the first such character, or -1
   */
  function firstVowel(str) {
    
    var func_name = "firstVowel";
    var firstA, firstE, firstI, firstO, firstU;
    var m;
    
    // Check parameter
    if (typeof str !== "string") {
      fault(func_name, 100);
    }
    
    // Figure out the first index of each vowel
    firstA = str.indexOf("a");
    firstE = str.indexOf("e");
    firstI = str.indexOf("i");
    firstO = str.indexOf("o");
    firstU = str.indexOf("u");
    
    // Get the minimum value, but -1 is larger than everything
    m = firstA;
    if ((m === -1) || ((firstE !== -1) && (firstE < m))) {
      m = firstE;
    }
    if ((m === -1) || ((firstI !== -1) && (firstI < m))) {
      m = firstI;
    }
    if ((m === -1) || ((firstO !== -1) && (firstO < m))) {
      m = firstO;
    }
    if ((m === -1) || ((firstU !== -1) && (firstU < m))) {
      m = firstU;
    }
    
    // Return the first index or -1
    return m;
  }
  
  /*
   * Search str for a substring q, but only match when the found
   * substring is neither preceded nor followed by other ASCII letters.
   * 
   * Parameters:
   * 
   *   str : string - the string to search through
   * 
   *   q : string - the substring to search for
   * 
   * Return:
   * 
   *   the index of the first substring match that is not surrounded by
   *   any ASCII letters, or -1 if no such matches
   */
  function indexOfWord(str, q) {
    
    var func_name = "indexOfWord";
    var i, c, suitable;
    
    // Check parameters
    if ((typeof(str) !== "string") || (typeof(q) !== "string")) {
      fault(func_name, 100);
    }
    
    // Return -1 if either string empty
    if ((str.length < 1) || (q.length < 1)) {
      return -1;
    }
    
    // Keep looking for suitable matches
    i = 0;
    for(i = str.indexOf(q, i); i >= 0; i = str.indexOf(q, i)) {
      
      // Start with the suitable flag set
      suitable = true;
      
      // If this match does not start at the very beginning of the
      // string, check previous character and if it is a letter, clear
      // suitable flag
      if (suitable && (i > 0)) {
        c = str.charCodeAt(i - 1);
        if (((c >= 0x41) && (c <= 0x5a)) || 
            ((c >= 0x61) && (c <= 0x7a))) {
          suitable = false;
        }
      }
      
      // If this match does not end at the very end of the string, check
      // next character and if it is a letter, clear suitable flag
      if (suitable && (i + q.length < str.length)) {
         c = str.charCodeAt(i + q.length);
         if (((c >= 0x41) && (c <= 0x5a)) || 
            ((c >= 0x61) && (c <= 0x7a))) {
          suitable = false;
        }
      }
      
      // If match is suitable, then leave loop at current match location
      if (suitable) {
        break;
      }
      
      // If we got here, match is not suitable; if i is not currently at
      // last character of string, advance it one so we start search at
      // next position; otherwise, set it to -1 and end loop
      if (i < str.length - 1) {
        i++;
      } else {
        i = -1;
        break;
      }
    }
    
    // Return the match result
    return i;
  }
  
  /*
   * Add a character record to the database.
   * 
   * m_conn must be true indicating an active database connection,
   * however m_built must be false.
   * 
   * The ce parameter is an object representing the character record to
   * add.  It has the following parameters:
   * 
   *   cpv - the numeric codepoint of the character as an integer
   *   crd - array of Jyutping readings strings
   *   dfn - (optional) English gloss string
   * 
   * All properties except those marked (optional) must be present.
   * 
   * The cpv property must be in Unicode range and not be a surrogate
   * codepoint.
   * 
   * The crd property must have at least one element.  Each Jytuping
   * reading string must be a sequence of one or more lowercase ASCII
   * letters followed by a single decimal digit in range 1-6.
   * 
   * The dfn property, if present, may be any string.
   * 
   * Parameters:
   * 
   *   ce : object - the character record to add to the database
   */
  function addCRecord(ce) {
    
    var func_name = "addCRecord";
    var i;
    
    // Check state
    if (m_built || (!m_conn)) {
      fault(func_name, 50);
    }
    
    // Check parameter
    if (typeof(ce) !== "object") {
      fault(func_name, 100);
    }
    if ((!("cpv" in ce)) || (!("crd" in ce))) {
      fault(func_name, 110);
    }
    
    if (typeof(ce.cpv) !== "number") {
      fault(func_name, 120);
    }
    if (!isFinite(ce.cpv)) {
      fault(func_name, 130);
    }
    ce.cpv = Math.floor(ce.cpv);
    if ((ce.cpv < 0) || (ce > 0x10ffff) ||
          ((ce.cpv >= 0xd800) && (ce.cpv <= 0xdfff))) {
      fault(func_name, 140);
    }
    
    if (!(ce.crd instanceof Array)) {
      fault(func_name, 150);
    }
    if (ce.crd.length < 1) {
      fault(func_name, 160);
    }
    for(i = 0; i < ce.crd.length; i++) {
      if (typeof(ce.crd[i]) !== "string") {
        fault(func_name, 170);
      }
      if (!((/^[a-z]+[1-6]$/).test(ce.crd[i]))) {
        fault(func_name, 180);
      }
    }
    
    if ("dfn" in ce) {
      if (typeof(ce.dfn) !== "string") {
        fault(func_name, 190);
      }
    }
    
    // @@TODO:
  }
  
  /*
   * Add a word record to the database.
   * 
   * m_conn must be true indicating an active database connection,
   * however m_built must be false.
   * 
   * The wa parameter is an array representing the word record to add.
   * It has the following elements:
   * 
   *   1 : traditional character string
   *   2 : simplified character string
   *   3 : array of Pinyin strings
   *   4 : array of definition strings
   * 
   * The array must have exactly these four elements.
   * 
   * The array of Pinyin strings is transformed by this function before
   * it is added to the database.  Specifically, elements are dropped
   * from it unless they have at least one ASCII letter.  Also, the
   * Pinyin is normalized to only have lowercase letters.
   * 
   * Parameters:
   * 
   *   wa : array - the word record to add to the database
   */
  function addWRecord(wa) {
    
    var func_name = "addWRecord";
    var i, pya;
    
    // Check state
    if (m_built || (!m_conn)) {
      fault(func_name, 50);
    }
    
    // Check parameter
    if (!(wa instanceof Array)) {
      fault(func_name, 100);
    }
    if (wa.length !== 4) {
      fault(func_name, 120);
    }
    if ((typeof(wa[0]) !== "string") || (typeof(wa[1]) !== "string")) {
      fault(func_name, 130);
    }
    if ((!(wa[2] instanceof Array)) || (!(wa[3] instanceof Array))) {
      fault(func_name, 140);
    }
    for(i = 0; i < wa[2].length; i++) {
      if (typeof(wa[2][i]) !== "string") {
        fault(func_name, 150);
      }
    }
    for(i = 0; i < wa[3].length; i++) {
      if (typeof(wa[3][i]) !== "string") {
        fault(func_name, 160);
      }
    }
    
    // Build a new Pinyin array, copying over only elements that have at
    // least one letter and transforming to lowercase
    pya = [];
    for(i = 0; i < wa[2].length; i++) {
      if ((/[A-Za-z]/).test(wa[2][i])) {
        pya.push(wa[2][i].toLowerCase());
      }
    }
    
    // @@TODO:
  }
  
  /*
   * Reload the IndexedDB database from the data files.
   * 
   * m_conn must be true indicating an active database connection,
   * however m_built must be false.  m_dbimage must also be greater than
   * zero.
   * 
   * Loading is asynchronous, so you must provide callback functions to
   * invoke on success and on error.  The error function gets a reason.
   * 
   * Parameters:
   * 
   *   f_done : function - callback function to invoke when successful
   * 
   *   f_err : function - callback function which takes a reason
   *   parameter to invoke if initialization fails
   */
  function reloadDB(f_done, f_err) {
    
    var func_name = "reloadDB";
    
    // Check state
    if (m_built || (!m_conn) || (m_dbimage < 1)) {
      fault(func_name, 50);
    }
    
    // Check parameters
    if ((typeof(f_done) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // Prep a read-write transaction on all the object stores
    prepTrans(m_db.objectStoreNames, "readwrite",
      function(tr) {
        var r, i, f;
        
        // When this transaction completes, all records will have been
        // dropped from all stores except the "vars" store; we can then
        // load all the records from the data files, each in a separate
        // transaction
        tr.oncomplete = function(ev) {
          // Go through the data files and add everything to the
          // database; proceed when everything completes successfully
          ctt_load.go(
            function(jsd, ff_done, ff_err) {
              // @@TODO:
              ff_done();
            },
            function(jsd, ff_done, ff_err) {
              // @@TODO:
              ff_done();
            },
            function() {
              // OK, everything has been loaded into the database now
              console.log("loading done");
              
              // @@TODO: set dataver
              // @@TODO: update m_built before calling done callback
            },
            f_err
          );
        };
        
        // Our first task is to drop all records from all object stores,
        // except for the "vars" store
        i = 0;
        f = function(ev) {
          // If i is valid AND the current object store name is "vars"
          // then increment i to skip over the "vars" store
          if ((i < m_db.objectStoreNames.length) &&
              (m_db.objectStoreNames[i] === "vars")) {
            i++;
          }
          
          // Do clear if i is still a valid index, else let this
          // transaction complete and code will continue in the
          // completion handler for this transaction
          if (i < m_db.objectStoreNames.length) {
            // Clear the object store and increment i
            r = tr.objectStore(m_db.objectStoreNames[i]).clear();
            i++;
            
            // Asynchronous callbacks
            r.onerror = f_err;
            r.onsuccess = f;
          }
        };
        f(null);
        
      },
      f_err
    );
  }
  
  /*
   * Perform the synchronization "initial transaction."
   * 
   * m_conn must be true indicating an active database connection,
   * however m_built must be false.  Also, m_dbimage must be -1
   * indicating that no image has been loaded yet.
   * 
   * This is the first transaction that must be performed after the
   * IndexedDB database is opened.  See "Database.md" for further
   * information.
   * 
   * The m_dbimage variable will be set by this procedure.
   * 
   * file_dataver is the dataver from the data file index.
   * 
   * This function proceeds asynchronously.  The f_ready callback is
   * invoked if the database can now be used and no reload is necessary.
   * The f_reload callback is invoked if the database needs to be
   * reloaded before it can be used.  The f_err callback is invoked if
   * there is an error, and it takes a "reason" parameter.
   * 
   * Exactly one of the three callbacks will be invoked by this function
   * eventually.  Note that if f_reload is invoked, f_ready will NOT be
   * invoked.
   * 
   * Parameters:
   * 
   *   file_dataver : string - the version from the data file index
   * 
   *   f_ready : function - callback if database is ready without reload
   * 
   *   f_reload : function - callback if database needs reload
   * 
   *   f_err : function - callback if error, takes reason argument
   */
  function syncTransaction(file_dataver, f_ready, f_reload, f_err) {
    
    var func_name = "syncTransaction";
    var need_reload = false;
    var tr, r;
    
    // Check state
    if (m_built || (!m_conn) || (m_dbimage !== -1)) {
      fault(func_name, 50);
    }
    
    // Check parameters
    if ((typeof(file_dataver) !== "string") ||
        (typeof(f_ready) !== "function") ||
        (typeof(f_reload) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // Our initial transaction is a read-write transaction on "vars"
    tr = m_db.transaction(["vars"], "readwrite");
    
    // Set error handlers on the transaction; these will also be used if
    // any of the component requests of the transaction fail, in which
    // case the errors will bubble up to the transaction
    tr.onabort = f_err;
    tr.onerror = f_err;
    
    // The following handler will be run when the initial transaction is
    // done; by this point, m_dbimage will be set and need_reload will
    // be set appropriately
    tr.oncomplete = function(ev) {
      // At this point, m_dbimage should be set
      if (m_dbimage < 1) {
        f_err("Image check failed!");
      }
      
      // Going by the need_reload flag, invoke the appropriate callback
      if (need_reload) {
        f_reload();
      } else {
        f_ready();
      }
    };
    
    // Look for the "image" variable in the "vars" store
    r = tr.objectStore("vars").get("image");
    r.onsuccess = function(ev) {
      // Check whether "image" was defined
      if (!(r.result)) {
        // "image" not defined, so we need to define it as 1
        r = tr.objectStore("vars").add({
          var_name: "image",
          var_value: 1
        });
        r.onsuccess = function(evb) {
          // We set "image" to 1, so now set our current database image
          // number to 1
          m_dbimage = 1;
          
          // Now check whether "dataver" is defined (it shouldn't be,
          // but let's make sure)
          r = tr.objectStore("vars").get("dataver");
          r.onsuccess = function(evc) {
            // Check if "dataver" is defined
            if (r.result) {
              // "dataver" is defined, so make a note in the console
              // because this wasn't supposed to happen
              console.log("Warning: dataver present without image!");
              
              // Delete the "dataver" record
              r = tr.objectStore("vars").delete("dataver");
              r.onsuccess = function(evd) {
                // We are ready now, set the reload flag and let this
                // transaction complete; code continues in the
                // "complete" event handler on the transaction
                need_reload = true;
              };
              
            } else {
              // "dataver" not defined so we are OK now, set the reload
              // flag and let this transaction complete; code continues
              // in the "complete" event handler on the transaction
              need_reload = true;
            }
          };
        };
        
      } else {
        // "image" is defined, so grab its value as the current database
        // image state
        m_dbimage = r.result.var_value;
        
        // Now query for "dataver"
        r = tr.objectStore("vars").get("dataver");
        r.onsuccess = function(evb) {
          // Check whether "dataver" is defined
          if (!(r.result)) {
            // "dataver" not defined so database data is incomplete and
            // needs to be freshly reloaded; increment the current image
            // number
            m_dbimage++;
            
            // Store the incremented image
            r = tr.objectStore("vars").put({
              var_name: "image",
              var_value: m_dbimage
            });
            r.onsuccess = function(evc) {
              // We are now ready to reload the database, so let this
              // transaction complete; code continues in the "complete"
              // event handler on the transaction
              need_reload = true;
            };
            
          } else {
            // "dataver" defined so check how database version compares
            // to version in data files
            if (r.result.var_value >= file_dataver) {
              // Database version is same or newer than version stored
              // in files, so we can use it without reloading; clear the
              // reload flag and let this transaction complete; code
              // continues in the "complete" event handler on the
              // transaction
              need_reload = false;
              
            } else {
              // Data files have newer version than database so we need
              // first to increment the image number
              m_dbimage++;
              
              // Store the incremented image
              r = tr.objectStore("vars").put({
                var_name: "image",
                var_value: m_dbimage
              });
              r.onsuccess = function(evc) {
                // We need to redo the database, so delete the dataver
                r = tr.objectStore("vars").delete("dataver");
                r.onsuccess = function(evd) {
                
                  // We are now ready to redo the database, so set the
                  // reload flag and let this transaction complete; code
                  // continues in the "complete" event handler on the
                  // transaction
                  need_reload = true;
                };
              };
            }
          }
        };
      }
    };
  }
  
  /*
   * Public functions
   * ================
   */
  
  /*
   * Given user input typed into the search box for a word query, return
   * an array containing indices into the dictionary for every matching
   * word result.
   * 
   * The returned indices are into the array canto_words.  The maximum
   * number of returned results is bounded by the MAX_DICT_RESULTS
   * constant.  If there are more than this many matching results, an
   * array containing the single integer -1 will be returned indicating
   * that the search was too broad.
   * 
   * Parameters:
   * 
   *   str : string - the word query string
   * 
   * Return:
   * 
   *   array containing all matching dictionary indices, or array
   *   containing single -1 integer value if too many results
   */
  function wordQuery(str) {
    
    var func_name = "wordQuery";
    var qta, ra;
    var i, j, da, f;
    
    // Check parameter
    if (typeof str !== "string") {
      fault(func_name, 100);
    }
    
    // Trim leading and trailing whitespace
    str = str.trim();
    
    // If string empty after trimming, return no results
    if (str.length < 1) {
      return [];
    }
    
    // String must only have ASCII letters and whitespace or return no
    // results
    if (!((/^[A-Za-z \t]*$/).test(str))) {
      return [];
    }
    
    // Normalize case to lowercase
    str = str.toLowerCase();
    
    // Split the query string into an array of search terms separated
    // by whitespace
    qta = str.split(/\s+/);
    
    // Find matching dictionary terms up to limit of MAX_DICT_RESULTS
    ra = [];
    for(i = 0; i < canto_words.length; i++) {
      // Get current word definition array
      da = canto_words[i][3];
      
      // Join all the definitions into a single string with definitions
      // separated by spaces
      da = da.join(" ");
      
      // Normalize case of definition string to lowercase
      da = da.toLowerCase();
      
      // Check whether all query terms are somewhere in the definition
      // string, using the indexOfWord function so we only search for
      // full word matches; if any one is missing, then skip this word
      f = true;
      for(j = 0; j < qta.length; j++) {
        if (indexOfWord(da, qta[j]) < 0) {
          f = false;
          break;
        }
      }
      if (!f) {
        continue;
      }
      
      // If we got here, then add this index to the results
      ra.push(i);
      
      // If we have exceeded the query limit, replace with special
      // marker and leave the loop
      if (ra.length > MAX_DICT_RESULTS) {
        ra = [-1];
        break;
      }
    }

    // Return results
    return ra;
  }
  
  /*
   * Given user input typed into the search box for a character query,
   * return an array containing integer values of all character
   * codepoints to display.
   * 
   * The codepoints in the array are in the proper order.  The returned
   * array may be empty if nothing matches.
   * 
   * The indices must first be built with buildIndices() before calling
   * this function or a fault occurs.
   *
   * Parameters:
   *
   *   str : string - the character query string
   *
   * Return:
   *
   *   array containing all matching codepoints as integer values
   */
  function charQuery(str) {
    
    var func_name = "charQuery";
    var c, i;
    var sa, sb, sc;
    var f, nt, m, t;
    var fvi, lvi, ab, af;
    var ra1, ra2;
    
    // Check state
    if (!m_built) {
      fault(func_name, 50);
    }
    
    // Check parameter
    if (typeof str !== "string") {
      fault(func_name, 100);
    }
    
    // First of all, trim leading and trailing whitespace and normalize
    // to NFC
    str = str.trim().normalize("NFC");
    
    // If string is empty after trimming, return empty array
    if (str.length < 1) {
      return [];
    }
    
    // Get the first codepoint of string
    c = str.codePointAt(0);
    
    // Check whether this string has a single codepoint above U+007F AND
    // the NFD decomposition of that codepoint does not begin with a
    // Latin letter; if this is the case, return an array with just that
    // codepoint
    if (c > 0x7f) {
      // Check whether we have a single codepoint in the string
      // (remember that supplemental codepoints take two characters)
      if ((c < 0x10000) && (str.length === 1)) {
        i = true;
      } else if (str.length === 2) {
        i = true;
      } else {
        i = false;
      }
      
      // If single extended codepoint, check whether NFD decomposition
      // begins with an ASCII letter; if it does not, then return a
      // result just of the given codepoint
      if (i) {
        sa = str.normalize("NFD");
        if (sa.length > 0) {
          c = sa.charCodeAt(0);
          if (((c < 0x41) || (c > 0x5a)) &&
              ((c < 0x61) || (c > 0x7a))) {
            return [c];
          }
        }
      }
    }
    
    // Handle Unicode literal
    if ((/^u[0-9a-f]{4,6}$/i).test(str)) {
      // We have a literal string, so begin by dropping the leading "u"
      // character
      str = str.slice(1);
      
      // Get the integer value of the base-16 number
      c = parseInt(str, 16);
      
      // Return just that value if it is in Unicode range, beyond ASCII
      // range, and not a surrogate, else return empty array
      if ((c > 0x7f) && (c <= 0x10ffff) && 
            ((c < 0xd800) || (c > 0xdfff))) {
        return [c];
        
      } else {
        return [];
      }
    }
    
    // Otherwise, if there is a decimal integer somewhere in the value,
    // handle Jyutping
    if ((/[0-9]/).test(str)) {
      
      // Make lowercase
      str = str.toLowerCase();
      
      // If format basically correct, look up; else, return nothing
      if ((/^[a-z]+[1-6]$/).test(str)) {
        // @@TODO:
        // if (str in m_idx_jyu) {
          // Return copy of codepoint array
          // return m_idx_jyu[str].map(x => x);
        // } else {
          return [];
        // }
      } else {
        return [];
      }
    }
    
    // If we got here, we should assume Yale; begin by decomposing to
    // NFD form
    str = str.normalize("NFD");
    
    // Change all combining circumflex marks to combining macrons
    str = str.replace(/\u0302/g, String.fromCharCode(0x0304));
    
    // Change all left single quotes and right single quotes to ASCII
    // apostrophes
    str = str.replace(/\u02018/g, "'");
    str = str.replace(/\u02019/g, "'");
    
    // Process all combining grave accents, acute accents, and macrons
    // starting from end of string to beginning, checking that they are
    // only used immediately behind an ASCII letter (returning no
    // results if not) and then replacing them with the appropriate
    // apostrophe escape code around the letter
    for(i = lastDiacritic(str); i >= 0; i = lastDiacritic(str)) {
      
      // If last diacritic is very first character, then this is not
      // valid so return no results
      if (i === 0) {
        return [];
      }
      
      // Last diacritic must be preceded by an ASCII letter, or else it
      // is not valid so return no results
      c = str.charCodeAt(i - 1);
      if (((c < 0x41) || (c > 0x5a)) && ((c < 0x61) || (c > 0x7a))) {
        return [];
      }
      
      // Get the string before the previous character, the previous
      // character, the codepoint of this diacritic, and everything
      // after this diacritic
      if (i > 1) {
        sa = str.slice(0, i - 1);
      } else {
        sa = "";
      }
      
      sb = str.charAt(i - 1);
      c = str.charCodeAt(i);
      
      if (i < str.length - 1) {
        sc = str.slice(i + 1);
      } else {
        sc = "";
      }
      
      // Remove the diacritic and insert the appropriate apostrophes
      // around the letter that precedes it
      if (c === 0x0300) {
        // Grave accent
        str = sa + "'" + sb + sc;
        
      } else if (c === 0x0301) {
        // Acute accent
        str = sa + sb + "'" + sc;
        
      } else if (c === 0x0304) {
        // Macron
        str = sa + "'" + sb + "'" + sc;
        
      } else {
        // Shouldn't happen
        fault(func_name, 200);
      }
    }
    
    // Now that we have reduced diacritics to apostrophes and handled
    // all substitutions, we can make everything lowercase
    str = str.toLowerCase();
    
    // The only thing that should be left in the string at this point is
    // lowercase ASCII letters and apostrophes; if anything else, string
    // is not valid so return no results in that case
    if (!((/^[a-z']+$/).test(str))) {
      return [];
    }
    
    // First we want to completely handle the case where there are no
    // vowels aeiou anywhere, which can only validly happen when there
    // is a syllabic m or ng nasal
    if (!((/[aeiou]/).test(str))) {
      
      // Look at the end of the string to figure out what syllabic nasal
      // we have and get the final; if we don't have a valid final,
      // return nothing
      m = str.match(/('?m'?h?|n'?g'?h?)$/);
      if (m == null) {
        return [];
      }
      
      // Split into initial and final
      if (m.index > 0) {
        nt = str.slice(0, m.index);
      } else {
        nt = "";
      }
      
      f = str.slice(m.index);
      
      // Check that initial is recognized (if not empty), returning no
      // results if not
      if (nt.length > 0) {
        if (VALID_INITIALS.indexOf(":" + nt + ":") < 0) {
          return [];
        }
      }
      
      // Transform initial to Jyutping
      if (nt === "y") {
        nt = "j";
      } else if (nt === "j") {
        nt = "z";
      } else if (nt === "ch") {
        nt = "c";
      }
      
      // Make sure we don't have the invalid combination of macron with
      // low marker h
      if ((f === "'m'h") || (f === "n'g'h")) {
        return [];
      }
      
      // Replace macron with grave accent
      f = f.replace(/'(m|g)'/g, "'$1");
      
      // If final ends with low marker h, start tone at 6 and remove
      // marker; else, start tone at 3
      if ((/h$/).test(f)) {
        t = 6;
        f = f.slice(0, -1);
      } else {
        t = 3;
      }
      
      // If there is an apostrophe, adjust tone marker and remove the
      // apostrophe
      if ((/'(m|g)/).test(f)) {
        // Grave accent
        t = t - 2;
      
      } else if ((/(m|g)'/).test(f)) {
        // Acute accent
        t = t - 1;
      }
      
      f = f.replace(/'/g, "");
      
      // Now assemble the Jyutping romanization
      str = nt + f + t.toString(10);
      
      // Recursively call this function again with the Jyutping
      return charQuery(str);
    }
    
    // Get indices of first non-Y vowel and last non-Y vowel in string
    fvi = firstVowel(str);
    lvi = lastVowel(str);

    // Should be at least one vowel at this point because we handled the
    // case of no vowels earlier
    if ((fvi === -1) || (lvi === -1)) {
      fault(func_name, 300);
    }
    
    // Figure out whether there is an apostrophe before and/or after the
    // first vowel
    ab = false;
    af = false;
    
    if (fvi > 0) {
      if (str.charAt(fvi - 1) === "'") {
        ab = true;
      }
    }
    
    if (fvi < str.length - 1) {
      if (str.charAt(fvi + 1) === "'") {
        af = true;
      }
    }
    
    // Drop the apostrophes that surround the initial vowel and adjust
    // fvi/lvi if necessary
    if (ab) {
      if (fvi > 1) {
        str = str.slice(0, fvi - 1) + str.slice(fvi);
      } else {
        str = str.slice(1);
      }
      fvi--;
      lvi--;
    }
    
    if (af) {
      if (fvi + 2 >= str.length) {
        str = str.slice(0, -1);
      } else {
        str = str.slice(0, fvi + 1) + str.slice(fvi + 2);
      }
      if (lvi > fvi) {
        lvi--;
      }
    }
    
    // If an "h" after the last vowel, then begin tone at 6, while
    // otherwise begin tone at 3; remove marker h if present
    if (lvi < str.length - 1) {
      if (str.charAt(lvi + 1) === "h") {
        t = 6;
        if (lvi + 2 >= str.length) {
          str = str.slice(0, -1);
        } else {
          str = str.slice(0, lvi + 1) + str.slice(lvi + 2);
        }
        
      } else {
        t = 3;
      }
      
    } else {
      t = 3;
    }
    
    // Adjust tone based on apostrophes that surrounded the initial
    // vowel
    if (ab && af) {
      // Both sides so macron -- make sure we are not currently at tone
      // six, which can't use macron, and return nothing if that is the
      // case
      if (t === 6) {
        return [];
      }
      
      // Macron equivalent in Jyutping to grave accent
      t = t - 2;
      
    } else if (ab) {
      // Apostrophe before so grave accent
      t = t - 2;
      
    } else if (af) {
      // Apostrophe after so acute accent
      t = t - 1;
    }
    
    // We now got the Jyutping tone number and dropped apostrophes and
    // the h marker -- make sure no apostrophes remain
    if (str.indexOf("'") !== -1) {
      return [];
    }
    
    // If the first vowel is a "u" that is preceded by a "y", move the
    // first vowel index back one so that it points to the "y"
    if ((str.charAt(fvi) === "u") && (fvi > 0)) {
      if (str.charAt(fvi - 1) === "y") {
        fvi--;
      }
    }
    
    // Split into initial and final, with final starting on first vowel
    if (fvi > 0) {
      nt = str.slice(0, fvi);
    } else {
      nt = "";
    }
    
    f = str.slice(fvi);

    // Make sure initial is allowed, if present
    if (nt.length > 0) {
      if (VALID_INITIALS.indexOf(":" + nt + ":") < 0) {
        return [];
      }
    }
    
    // Make sure we don't have a "y" initial followed by a final that
    // starts with "yu"
    if ((nt === "y") && ((/^yu/).test(f))) {
      return [];
    }
    
    // Transform initial to Jyutping
    if (nt === "y") {
      nt = "j";
    } else if (nt === "j") {
      nt = "z";
    } else if (nt === "ch") {
      nt = "c";
    }
    
    // If initial is empty and final starts with "yu" then insert "j"
    // as the initial
    if ((nt.length < 1) && ((/^yu/).test(f))) {
      nt = "j";
    }
    
    // If final is just "a" then change to Jyutping "aa"
    if (f === "a") {
      f = "aa";
    }
    
    // If final begins with "eu" then change to "oe" or "eo" depending
    // on what follows
    if ((/^eu/).test(f)) {
      // For eui, eun, eut change to eo, else change to oe
      if ((/^eu[int]$/).test(f)) {
        f = "eo" + f.slice(2);
      } else {
        if (f.length > 2) {
          f = "oe" + f.slice(2);
        } else {
          f = "oe";
        }
      }
    }
    
    // Get the Jyutping version
    str = nt + f + t.toString(10);
    
    // Recursive handling
    if ((/^jyu/).test(str)) {
      // Jyutping starts with "jyu" but Yale romanization conversion is
      // ambiguous because it could also be for "ju" in Jyutping;
      // recursively try both possibilities
      ra1 = charQuery(str);
      ra2 = charQuery("j" + str.slice(2));
      
      // Merge both results and return them
      return ra1.concat(ra2);
      
    } else {
      // No possibility of ambiguity, so recursively invoke with the
      // Jyutping
      return charQuery(str);
    }
  }
  
  /*
   * Given a numeric codepoint value as an integer, look up the record
   * in the global canto_chars array using an index.
   * 
   * You must call buildIndices() before using this function.
   * 
   * The return value is either a valid index into canto_chars or it is
   * -1 indicating that no record matches that codepoint value.
   * 
   * Parameters:
   * 
   *   cpv : integer - the codepoint value to query
   * 
   * Return:
   * 
   *   the index of the character record in canto_chars, or -1 if not
   *   found
   */
  function seekCode(cpv) {
    
    var func_name = "seekCode";
    
    // Check state
    if (!m_built) {
      fault(func_name, 50);
    }
    
    // Check parameter
    if (typeof(cpv) !== "number") {
      fault(func_name, 100);
    }
    cpv = Math.floor(cpv);
    
    // No result if less than zero
    if (cpv < 0) {
      return -1;
    }
    
    // Convert to lowercase hex string
    cpv = cpv.toString(16).toLowerCase();
    
    // Use index to look up result
    // @@TODO:
    // if (cpv in m_idx_cpv) {
    //  return m_idx_cpv[cpv];
    // } else {
      return -1;
    // }
  }
  
  /*
   * Initialize the IndexedDB database so that you may begin using this
   * module.
   * 
   * This function may only be called once.  Must be called before using
   * other functions in this module.
   * 
   * Initialization is asynchronous, so you must provide callback 
   * functions to invoke on success and on error.  The error function
   * gets a reason.
   * 
   * Parameters:
   * 
   *   f_done : function - callback function to invoke when successful
   * 
   *   f_err : function - callback function which takes a reason
   *   parameter to invoke if initialization fails
   */
  function initDB(f_done, f_err) {
    
    var func_name = "initDB";
    var dbo;
    
    // Check state
    if (m_built || m_conn) {
      fault(func_name, 50);
    }
    
    // Check parameters
    if ((typeof(f_done) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // Start a request to open the database with structure version 1
    dbo = window.indexedDB.open("CantotypeDB", 1);
    
    // Error handler for database opening request
    dbo.onerror = function(ev) {
      f_err("Failed to open IndexedDB");
    };
    
    // Error handler if another instance has an older version open
    dbo.onblocked = function() {
      f_err("Blocked; other Cantotype windows must be closed first");
    }
    
    // Handler invoked if we need to create a new database or update an
    // older structure version
    dbo.onupgradeneeded = function(ev) {
      var db, i, obn;
      
      // Get the database handle
      db = ev.target.result;
      
      // Get a copy of any existing object stores from any older version
      obn = [];
      for(i = 0; i < db.objectStoreNames.length; i++) {
        obn.push(db.objectStoreNames[i]);
      }
      
      // Delete any existing object stores from any older version
      for(i = 0; i < obn.length; i++) {
        db.deleteObjectStore(obn[i]);
      }
      
      // We now have a fresh database, so define our object stores
      db.createObjectStore("vars", {keyPath: "var_name"});
      db.createObjectStore("cinfo", {keyPath: "cpv"});
      db.createObjectStore("cread", {keyPath: "jyu"});
      db.createObjectStore("words",
        {keyPath: "wid", autoIncrement: true});
    }
    
    // Function proceeds in the handler for successful open
    dbo.onsuccess = function(ev) {
      var tr, r;
      
      // Set the database handle and open flag
      m_db = dbo.result;
      m_conn = true;
      
      // Before we can do the initial transaction for synchronization,
      // we need to know the dataver of our data files, so get that
      // first
      ctt_load.checkDataver(
        function(dvr) {
          
          // OK, now we are ready to do our initial synchronization
          // transaction; route the done call to our f_done handler, and
          // route the reload call to reloadDB
          syncTransaction(
            dvr,
            f_done,
            function() {
              // Callback if a reload is needed
              reloadDB(f_done, f_err);
            },
            f_err
          );
        },
        f_err
      );
    }
  }
  
  /*
   * Export declarations
   * ===================
   * 
   * All exports are declared within a global "ctt_main" object.
   */
  window.ctt_main = {
    "wordQuery": wordQuery,
    "charQuery": charQuery,
    "seekCode": seekCode,
    "initDB": initDB
  };  
  
}());
