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
    
    // @@TODO:
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
