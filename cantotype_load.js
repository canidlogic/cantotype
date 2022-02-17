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
   * Public functions
   * ================
   */
  
  /*
   * Asynchronously load all the character and dictionary data records
   * from the Cantotype data files.
   * 
   * This function will return immediately.  All loading will be done
   * through the given callback functions.
   * 
   * Records are loaded in blocks corresponding to how records are split
   * across source data files.  Whenever a block of character records
   * are ready, the f_ce function will be invoked with the parsed
   * representation of those records, a callback to invoke when done,
   * and a callback to invoke in case or error, which takes a reason.
   * 
   * Whenever a word record is ready, the f_we function will be called,
   * which has the same interface as the f_ce function.
   * 
   * See the canto_compile.pl script for further information about the
   * data format within these data arrays.
   * 
   * Both the f_ce and f_we functions may throw exceptions.  If an
   * exception is thrown, it will be caught and then passed to the f_err
   * callback as a parameter.
   * 
   * If the function manages asynchronously to report all the data
   * records to the f_ce and f_we callbacks, and all of those callbacks
   * invoke the done callback without throwing an exception, then at the
   * end of the operation, the f_done callback will be called to
   * indicate the loading operation is complete.
   * 
   * If any of the f_ce or f_we callbacks throw an exception, or if they
   * call the error callback, or if there is any kind of error while
   * asynchronously processing the data, the f_err callback will be
   * called with the exception as an argument.
   * 
   * Eventually, either the f_done or f_err callback will be invoked to
   * indicate the end of the asynchronous loading operation.
   * 
   * Parameters:
   * 
   *   f_ce : function - callback function that takes a array parameter
   *   of character records to process, a "done" callback function that
   *   has no arguments, and an "error" callback function that has a
   *   single reason argument
   * 
   *   f_we : function - callback function that takes a array parameter
   *   of word records to process, a "done" callback function that has
   *   no arguments, and an "error" callback function that has a single
   *   reason argument
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
    loadGZJSON(
        canto_config.data_base + canto_config.index_name,
        function(js_index) {
      
      var ca, i, f;
      
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
          ca.push([
            canto_config.data_base + js_index.charlist[i],
            "char"
          ]);
        }
        
        for(i = 0; i < js_index.wordlist.length; i++) {
          if (typeof(js_index.wordlist[i]) !== "string") {
            fault(func_name, 240);
          }
          ca.push([
            canto_config.data_base + js_index.wordlist[i],
            "word"
          ]);
        }
        
        // Process data files
        i = 0;
        f = function() {
          // If i is past the end of the combined array, invoke the done
          // handler and leave
          if (i >= ca.length) {
            f_done();
            return;
          }
          
          // Not past the end, so asynchronously load this data file
          loadGZJSON(
            ca[i][0],
            function(js_data) {
              
              // Invoke the proper handler function for this block
              if (ca[i][1] === "char") {
                // Increment i so we process the next data file next
                // time
                i++;
                
                // Invoke the character data handler
                f_ce(js_data, f, f_err);
                
              } else if (ca[i][1] === "word") {
                // Increment i so we process the next data file next
                // time
                i++;
                
                // Invoke the word data handler
                f_we(js_data, f, f_err);
                
              } else {
                // Shouldn't happen
                fault(func_name, 300);
              }
              
            },
            f_err
          );
        };
        f();
        
      } catch (ex) {
        f_err(ex);
      }
      
    }, f_err);
  }

  /*
   * Load just the data index file to determine the data version string
   * in the current data file list.
   * 
   * This is much faster than the go() operation, so you can use this to
   * check if you really need to reload the database or whether
   * everything is already in there.
   * 
   * The f_check function is called on success, and it gets a single
   * string parameter that is the dataver stored in the data file index.
   * 
   * The f_err function is called on failure, and takes a reason
   * parameter.
   * 
   * Parameters:
   * 
   *   f_check : function - callback that takes a string which will hold
   *   the dataver read from the data file index
   * 
   *   f_err : function - error callback that takes a reason parameter
   */
  function checkDataver(f_check, f_err) {
    
    var func_name = "checkDataver";
    
    // Check parameters
    if ((typeof(f_check) !== "function") ||
        (typeof(f_err) !== "function")) {
      fault(func_name, 100);
    }
    
    // Asynchronously load the index file, function continues in the
    // callback
    loadGZJSON(
        canto_config.data_base + canto_config.index_name,
        function(js_index) {
      
      // Wrap handling in a try-catch that reports to the f_err callback
      // if there is any exception
      try {
      
        // Parsed JSON should be object
        if (typeof(js_index) !== "object") {
          fault(func_name, 200);
        }
        
        // Parsed object should have a "dataver" parameter
        if (!("dataver" in js_index)) {
          fault(func_name, 210);
        }
      
        // "dataver" should be a string
        if (typeof(js_index.dataver) !== "string") {
          fault(func_name, 220);
        }
        
        // Check dataver format
        if (!((/^[0-9]{4}-[0-9]{2}-[0-9]{2}:[0-9]{3}$/
                ).test(js_index.dataver))) {
          fault(func_name, 230);
        }
      
        // Invoke the callback with the version
        f_check(js_index.dataver);
      
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
    "go": go,
    "checkDataver": checkDataver
  };

}());
