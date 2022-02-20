"use strict";

/*
 * cantotype_sw.js
 * ===============
 * 
 * Service worker module for Cantotype.
 * 
 * This module is responsible for allowing all program files of
 * Cantotype to be cached client-side so that the webapp may be used
 * offline.
 * 
 * However, this module does NOT handle the data files of Cantotype.
 * See "DataCache.md" for further information about how data files are
 * cached.
 */

                      /* * * * * * * * * * * * *
                       *                       *
                       *  CONFIGURATION AREA   *
                       *  ==================   *
                       *                       *
                       * * * * * * * * * * * * */

// Cache name that is unique to this specific program file collection
var cache_name = "Cantotype-2022-02-19-002";

// Local copy of code_base from the configuration script
var code_base = "/url/to/code/";

// The name of the main HTML page of the webapp, which will be suffixed
// to the code_base defined above; use an empty string if you are using
// the index page "/" within the code_base directory
var html_name = "cantotype.html";

// All of the program files, which will be suffixed to the code_base
// defined above; do NOT include this service worker script in this list
// and do NOT include any of the data files
var program_files = [
  html_name,
  "cantotype_style.css",
  "cantotype.js",
  "cantotype_config.js",
  "cantotype_load.js",
  "cantotype_ui.js",
  "pako_inflate.js",
  "icons/icon_32.png",
  "icons/icon_64.png",
  "icons/icon_128.png",
  "icons/icon_256.png",
  "icons/icon_512.png"
];

                      /* * * * * * * * * * * * *
                       *                       *
                       *   END CONFIGURATION   *
                       *   =================   *
                       *                       *
                       * * * * * * * * * * * * */

var i;

// Prefix the code_base to all of the program_files
//
for(i = 0; i < program_files.length; i++) {
  program_files[i] = code_base + program_files[i];
}

// Handle the install event, where we will create the cache
//
self.addEventListener("install", function(ev) {
  // This event lasts until the promise we define has completed
  ev.waitUntil(new Promise(function(resolutionFunc, rejectFunc) {
    // Open caching object with our unique cache name
    caches.open(cache_name).then(
      function(cache) {
        // We opened the cache, now add all of our program files to it
        cache.addAll(program_files).then(
          resolutionFunc,
          rejectFunc
        );
      },
      rejectFunc
    );
  }));
});

// Handle the activate event, where we will clear any older cache
// versions
//
self.addEventListener("activate", function(ev) {
  // This event lasts until the promise we define has completed
  ev.waitUntil(new Promise(function(resolutionFunc, rejectFunc) {
    
    var j, f;
    
    // Find all the keys for all defined caches
    caches.keys().then(
      function(keyList) {
        
        // Delete each cache except the version we defined here
        j = 0;
        f = function() {
          
          // Skip until we get a name that doesn't match our own
          while (j < keyList.length) {
            if (keyList[j] === cache_name) {
              j++;
            } else {
              break;
            }
          }
          
          // Resolve if we have gone through all cache names
          if (j >= keyList.length) {
            resolutionFunc(null);
            return;
          }
          
          // Delete this cache, increment j and loop again
          caches.delete(keyList[j]).then(
            function(b) {
              j++;
              f();
            },
            rejectFunc
          );
          
        };
        f();
        
      },
      rejectFunc
    );
    
  }));
});

// Handle the fetch event, where we will serve program files from our
// cache, but pass through all data file requests
//
self.addEventListener("fetch", function(ev) {
  // We provide here a promise that resolves to the response the browser
  // should use for the fetch request from our webapp
  ev.respondWith(new Promise(function(resolutionFunc, rejectFunc) {
    
    // Query our cache to see if we have a cached response for this
    caches.match(ev.request).then(
      function(response){
        
        // Check if we got a cached response
        if (response) {
          // We got a cached response, so resolve with that
          resolutionFunc(response);
          return;
        }
        
        // We did not have a cached response, so pass through to fetch
        fetch(ev.request).then(
          function(fr) {
            // Pass through the fetch response
            resolutionFunc(fr);
          },
          rejectFunc
        );
        
      },
      rejectFunc
    );
    
  }));
});
