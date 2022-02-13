"use strict";

/*
 * cantotype_load.js
 * =================
 * 
 * Data loading module for Cantotype.
 * 
 * Requires pako_inflate.js to be loaded.
 */

// Wrap everything in an anonymous function that we immediately invoke
// after it is declared -- this prevents anything from being implicitly
// added to global scope
(function() {
  
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
   * single parameter that stores the result of JSON.parse() on the
   * decompressed file data.  If there is an error, f_err() is called
   * with a single parameter that stores the exception that occurred.
   * 
   * Parameters:
   * 
   *   src : string - the URL of the GZip file to load
   * 
   *   f_done : function - callback that takes a single argument which
   *   is the parsed JSON result
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
          f_done(js);
          
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
   * Asynchronous data file loader function.
   * 
   * To use this, you need to have a data file index array already
   * loaded from the index file.  This array is passed as the dfl
   * parameter.  Each element of this array is a subarray of two
   * elements, where the first element is a string URL of a data file to
   * load and the second element is a string data file type that is
   * either "char" or "word".
   * 
   * Each call to this function is for a data file that has just been
   * read.  The first call to this function therefore needs the first
   * data file to already be loaded and passed to this function.
   * 
   * dfi is the index within the dfl array of the data file that has
   * just been loaded, while js is the parsed JSON representation of
   * this data file that has just been loaded.
   * 
   * The f_ce, f_we, f_done, and f_err parameters are passed through
   * from the "go" function -- see that function for further
   * information.
   * 
   * After the current data file has been processed, this function will
   * check whether there are more elements in the file array to process.
   * If there are, the next element will be loaded and this function
   * will recursively be called asynchronously with dfi one greater and
   * js having the next parsed file representation.  If there are no
   * more elements to process, then f_done() will be invoked.
   * 
   * Parameters:
   * 
   *   dfl : array - the array of data file subarrays
   * 
   *   dfi : integer - the index in dfl of the data file that has just
   *   completed loading
   * 
   *   js : <any> - the parsed JSON representation of the data file at
   *   index dfi within dfl
   * 
   *   f_ce : function - callback function that takes a single parameter
   *   of an object storing attributes of a character
   * 
   *   f_we : function - callback function that takes a single parameter
   *   of a four-element array storing a dictionary word entry
   * 
   *   f_done : function - callback function invoked when all records
   *   have successfully been reported through the f_ce and f_we
   *   callbacks
   * 
   *   f_err : function - callback function invoked with a single
   *   parameter of an exception object when any of the f_ce or f_we
   *   callbacks throws an exception, or when there is an error during
   *   asynchronous processing
   */
  function loadDataFile(dfl, dfi, js, f_ce, f_we, f_done, f_err) {
    
    var func_name = "loadDataFile";
    var i, j;
    
    // Check error parameter
    if (typeof(f_err) !== "function") {
      fault(func_name, 50);
    }
    
    // Wrap rest of function in try-catch that redirects errors to the
    // f_err callback
    try {
    
      // Check parameters
      if ((!(dfl instanceof Array)) ||
          (typeof(dfi) !== "number") ||
          (typeof(f_ce) !== "function") ||
          (typeof(f_we) !== "function") ||
          (typeof(f_done) !== "function") ||
          (typeof(f_err) !== "function")) {
        fault(func_name, 100);
      }
      
      for(i = 0; i < dfl.length; i++) {
        if (!(dfl[i] instanceof Array)) {
          fault(func_name, 110);
        }
        if (dfl[i].length !== 2) {
          fault(func_name, 120);
        }
        if (typeof(dfl[i][0]) !== "string") {
          fault(func_name, 130);
        }
        if (typeof(dfl[i][1]) !== "string") {
          fault(func_name, 140);
        }
        if ((dfl[i][1] !== "char") && (dfl[i][1] !== "word")) {
          fault(func_name, 150);
        }
      }
      
      if (!isFinite(dfi)) {
        fault(func_name, 160);
      }
      dfi = Math.floor(dfi);
      if (!((dfi >= 0) && (dfi < dfl.length))) {
        fault(func_name, 170);
      }
      
      // Process the current file based on its type
      if (dfl[dfi][1] === "char") {
        // Character data file -- top-level entity must be array
        if (!(js instanceof Array)) {
          fault(func_name, 210);
        }
        
        // Process each element
        for(i = 0; i < js.length; i++) {
          // Check that element is a JSON object
          if ((typeof(js[i]) !== "object") || 
                (js[i] instanceof Array)) {
            fault(func_name, 220);
          }
          
          // Process this character element
          f_ce(js[i]);
        }
        
      } else if (dfl[dfi][1] === "word") {
        // Word data file -- top-level entity must be array
        if (!(js instanceof Array)) {
          fault(func_name, 250);
        }
        
        // Process each element
        for(i = 0; i < js.length; i++) {
          // Check that element is a JSON array
          if (!(js[i] instanceof Array)) {
            fault(func_name, 260);
          }
          
          // Check that array has exactly four elements
          if (js[i].length !== 4) {
            fault(func_name, 270);
          }
          
          // Check that first two elements are strings
          if ((typeof(js[i][0]) !== "string") ||
                (typeof(js[i][1]) !== "string")) {
            fault(func_name, 275);
          }
          
          // Check that last two elements are arrays
          if ((!(js[i][2] instanceof Array)) ||
                (!(js[i][3] instanceof Array))) {
            fault(func_name, 280);
          }
          
          // Check that third element subarray contains only strings
          for(j = 0; j < js[i][2].length; j++) {
            if (typeof(js[i][2][j]) !== "string") {
              fault(func_name, 284);
            }
          }
          
          // Check that fourth element subarray contains only strings
          for(j = 0; j < js[i][3].length; j++) {
            if (typeof(js[i][3][j]) !== "string") {
              fault(func_name, 288);
            }
          }
          
          // Process this word element
          f_we(js[i]);
        }
        
      } else {
        // Shouldn't happen
        fault(func_name, 209);
      }
      
      // Check whether there are further data files to process
      if (dfi < dfl.length - 1) {
        // More files to process, so asynchronously load next one and
        // recursively call this function to process it
        dfi++;
        loadGZJSON(dfl[dfi][0], function(js_data) {
            
          try {
            loadDataFile(dfl, dfi, js_data, f_ce, f_we, f_done, f_err);
          } catch (ex) {
            f_err(ex);
          }
          
        }, f_err);
        
      } else {
        // We just processed the last file, so we can finish
        f_done();
      }
    
    } catch (ex) {
      f_err(ex);
    }
  }
  
  /*
   * Public functions
   * ================
   */
  
  /*
   * Asynchronously load all the character and dictionary data records
   * for Cantotype.
   * 
   * This function will return immediately.  All loading will be done
   * through the given callback functions.
   * 
   * Whenever a character record is ready, the f_ce function will be
   * called with a single argument, which is a JavaScript object that
   * stores all the attributes of the character as properties of the
   * object.
   * 
   * Whenever a word record is ready, the f_we function will be called
   * with a single argument, which is an array of four elements.  The
   * first element is a string of traditional characters, the second
   * element is a string of simplified character, the third element is
   * an array of strings corresponding to the Pinyin syllables, and the
   * fourth element is an array of strings corresponding to all the
   * definitions.
   * 
   * See the canto_compile.pl script for further information about the
   * data format.
   * 
   * Both the f_ce and f_we functions may throw exceptions.  If an
   * exception is thrown, it will be caught and then passed to the f_err
   * callback as a parameter.
   * 
   * If the function manages asynchronously to report all the data
   * records to the f_ce and f_we callbacks, and none of those callbacks
   * throw an exception, then at the end of the operation, the f_done
   * callback will be called to indicate the loading operation is
   * complete.
   * 
   * If any of the f_ce or f_we callbacks throw an exception, or if
   * there is any kind of error while asynchronously processing the
   * data, the f_err callback will be called with the exception as an
   * argument.
   * 
   * Eventually, either the f_done or f_err callback will be invoked to
   * indicate the end of the asynchronous loading operation.
   * 
   * Parameters:
   * 
   *   f_ce : function - callback function that takes a single parameter
   *   of an object storing attributes of a character
   * 
   *   f_we : function - callback function that takes a single parameter
   *   of a four-element array storing a dictionary word entry
   * 
   *   f_done : function - callback function invoked when all records
   *   have successfully been reported through the f_ce and f_we
   *   callbacks
   * 
   *   f_err : function - callback function invoked with a single
   *   parameter of an exception object when any of the f_ce or f_we
   *   callbacks throws an exception, or when there is an error during
   *   asynchronous processing
   */
  function go(f_ce, f_we, f_done, f_err) {
    
    var func_name = "go";
    
    // Check parameters
    if ((typeof(f_ce) !== "function") ||
        (typeof(f_we) !== "function") ||
        (typeof(f_done) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // First we want to load the index file, function continues
    // asynchronously in the callback
    loadGZJSON("cantotype_index.gz", function(js_index) {
      
      var ca, i;
      
      // Wrap handling in a try-catch that reports to the f_err callback
      // if there is any exception
      try {
        // Parsed JSON should be object
        if (typeof(js_index) !== "object") {
          fault(func_name, 200);
        }

        // Parse JSON should contain "charlist" and "wordlist"
        // properties
        if (!(("charlist" in js_index) && ("wordlist" in js_index))) {
          fault(func_name, 210);
        }
        
        // charlist and wordlist properties must be arrays
        if (!((js_index.charlist instanceof Array) &&
              (js_index.wordlist instanceof Array))) {
          fault(func_name, 220);
        }
        
        // Build a combined array that will have a two-element subarray
        // for each element; the first element in each subarray is a URL
        // and the second element in each subarray is a string that is
        // either "word" or "char" for the type of data file to process
        ca = [];
        
        for(i = 0; i < js_index.charlist.length; i++) {
          if (typeof(js_index.charlist[i]) !== "string") {
            fault(func_name, 230);
          }
          ca.push([js_index.charlist[i], "char"]);
        }
        
        for(i = 0; i < js_index.wordlist.length; i++) {
          if (typeof(js_index.wordlist[i]) !== "string") {
            fault(func_name, 240);
          }
          ca.push([js_index.wordlist[i], "word"]);
        }
        
        // Check whether there is at least one data file to process
        if (ca.length > 0) {
          // Asynchronously invoke the loader function with the first
          // data file in the list
          loadGZJSON(ca[0][0], function(js_data) {
            
            try {
              loadDataFile(ca, 0, js_data, f_ce, f_we, f_done, f_err);
            } catch (ex) {
              f_err(ex);
            }
            
          }, f_err);
          
        } else {
          // No further data files to process, so invoke the done
          // callback
          f_done();
        }
      } catch (ex) {
        f_err(ex);
      }
      
    }, f_err);
  }

  /*
   * Export declarations
   * ===================
   * 
   * All exports are declared within a global "ctt_main" object.
   */
  window.ctt_load = {
    "go": go
  };

}());
