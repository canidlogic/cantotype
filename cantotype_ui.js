"use strict";

/*
 * cantotype_ui.js
 * ===============
 * 
 * Presentation tier module for Cantotype.
 * 
 * The cantotype_config.js, cantotype.js, and cantotype_load.js modules
 * must be loaded before this one.
 * 
 * All these scripts should be loaded as "defer" so that they run in the
 * order declared after the page DOM has loaded.
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
   * The character offset that follows the input cursor in the typing
   * box, which is updated whenever the typing box loses focus.
   */
  var m_caret = 0;

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
                  " in ctt_html");
    
    // Throw exception
    throw ("ctt_html:" + func_name + ":" + String(loc));
  }

  /*
   * Escape a string if necessary so that it can be included within
   * HTML markup.
   *
   * This first escapes & as &amp;, and then escapes < as &lt; and > as
   * &gt;
   *
   * Parameters:
   *
   *   str : string - the string to escape
   *
   * Return:
   *
   *   the escaped string
   */
  function htmlEsc(str) {
    
    var func_name = "htmlEsc";
    
    // Check parameter
    if (typeof str !== "string") {
      fault(func_name, 100);
    }
    
    // Replace ampersand
    str = str.replace(/&/g, "&amp;");
    
    // Replace markup characters
    str = str.replace(/</g, "&lt;");
    str = str.replace(/>/g, "&gt;");
    
    // Return escaped string
    return str;
  }

  /*
   * Public functions
   * ================
   */

  /*
   * Find the element with the given ID and set its display property to
   * "block" to show it.
   *
   * Assumes that the element is properly displayed with "block".
   *
   * Parameters:
   *
   *   elid : string - the ID of the element to show
   */
  function appear(elid) {
    
    var func_name = "appear";
    var e;
    
    // Check parameter
    if (typeof elid !== "string") {
      fault(func_name, 100);
    }
    
    // Get the element
    e = document.getElementById(elid);
    if (e == null) {
      fault(func_name, 200);
    }
    
    // Show the element
    e.style.display = "block";
  }

  /*
   * Find the element with the given ID and set its display property to
   * "none" to hide it.
   *
   * Parameters:
   *
   *   elid : string - the ID of the element to hide
   */
  function dismiss(elid) {
    
    var func_name = "dismiss";
    var e;
    
    // Check parameter
    if (typeof elid !== "string") {
      fault(func_name, 100);
    }
    
    // Get the element
    e = document.getElementById(elid);
    if (e == null) {
      fault(func_name, 200);
    }
    
    // Hide the element
    e.style.display = "none";
  }

  /*
   * Event handler for generated links from codepoint numbers that
   * should automatically type the character into the typing box.
   */
  function typeChar(c) {
    
    var func_name = "typeChar";
    var e, si, str, prefix, suffix;
    
    // Check parameter
    if (typeof(c) !== "number") {
      fault(func_name, 100);
    }
    if (!isFinite(c)) {
      fault(func_name, 101);
    }
    c = Math.floor(c);
    if ((c < 0) || (c > 0x10ffff) ||
          ((c >= 0xd800) && (c <= 0xdfff))) {
      fault(func_name, 102);
    }
    
    // Ignore call if character is zero nul
    if (c === 0) {
      return;
    }
    
    // Convert character to string
    c = String.fromCodePoint(c);
    
    // Look up the typing box
    e = document.getElementById("txtWrite");
    if (e == null) {
      fault(func_name, 200);
    }
    
    // Get the index of the character that follows the input cursor
    si = m_caret;

    // If this index is not an number, set it to -1
    if (typeof si !== "number") {
      si = -1;
    }
    
    // Floor the index to an integer
    si = Math.floor(si);
    
    // If not in range (including character index that would come after
    // everything that has been typed), set to end of range
    if ((si < 0) || (si > e.value.length)) {
      si = e.value.length;
    }
    
    // Get the string in the box
    str = e.value;
    
    // Divide string into prefix and suffix
    if (si > 0) {
      prefix = str.slice(0, si);
    } else {
      prefix = "";
    }
    
    if (si < str.length) {
      suffix = str.slice(si);
    } else {
      suffix = "";
    }
    
    // Insert the new codepoint
    str = prefix + c + suffix;
    
    // Update the typing box and move cursor to end of entered text
    e.value = str;
    m_caret = si + c.length;
  }

  /*
   * Event handler for when the "append" button is clicked with the
   * codepoint box.
   */
  function handleCodebox() {
    
    var func_name = "handleCodebox";
    var e, str, sa, cps, found_err, x, c, si;
    var prefix, suffix;
    
    // Begin by hiding the error box if shown
    dismiss("divErrLine");
    
    // Get the codebox element
    e = document.getElementById("txtCode");
    if (e == null) {
      fault(func_name, 100);
    }
    
    // Get the value of the codebox string
    str = e.value;
    
    // Start with empty codepoint string
    cps = "";
    
    // Split codebox string using space, tab, and line break as
    // delimiter
    sa = str.split(/[ \t\r\n]+/);
    
    // Add all codepoints to the codepoint string
    found_err = false;
    for(x = 0; x < sa.length; x++) {
      // Get current codepoint element
      c = sa[x];
      
      // If current codepoint element is empty, skip it
      if (c.length < 1) {
        continue;
      }
      
      // Make sure we got a sequence of 1-6 hex digits
      if (!((/^[0-9A-Fa-f]{1,6}$/).test(c))) {
        found_err = true;
        break;
      }
      
      // Convert to numeric value
      c = parseInt(c, 16);
      
      // Check that Unicode codepoint range, not nul, and not surrogate
      if ((c < 1) || (c > 0x10ffff) || 
            ((c >= 0xd800) && (c <= 0xdfff))) {
        found_err = true;
        break;
      }
      
      // Add to codepoint string
      cps = cps + String.fromCodePoint(c);
    }
    
    // Check for error
    if (found_err) {
      appear("divErrLine");
      return;
    }
    
    // Ignore if nothing to add
    if (cps.length < 1) {
      return;
    }
    
    // If we got here successfully, look up the typing box
    e = document.getElementById("txtWrite");
    if (e == null) {
      fault(func_name, 200);
    }
    
    // Get the index of the character that follows the input cursor
    si = m_caret;
    
    // If this index is not an number, set it to -1
    if (typeof si !== "number") {
      si = -1;
    }
    
    // Floor the index to an integer
    si = Math.floor(si);
    
    // If not in range (including character index that would come after
    // everything that has been typed), set to end of range
    if ((si < 0) || (si > e.value.length)) {
      si = e.value.length;
    }
    
    // Get the string in the box
    str = e.value;
    
    // Divide string into prefix and suffix
    if (si > 0) {
      prefix = str.slice(0, si);
    } else {
      prefix = "";
    }
    
    if (si < str.length) {
      suffix = str.slice(si);
    } else {
      suffix = "";
    }
    
    // Insert the new codepoint string
    str = prefix + cps + suffix;
    
    // Update the typing box and move cursor to end of entered text
    e.value = str;
    m_caret = si + cps.length;
  }

  /*
   * Given a set of character results, write them to the result DIV.
   *
   * The given da parameter must be an object that has parameters
   * "clist" and "ctable".  The "clist" is an array that has array
   * indices into the "ctable" array.  The "clist" determines the order
   * in which characters are displayed in the results.  The "ctable"
   * stores the actual character data to display.  The elements of the
   * "ctable" are objects having the following properties:
   *
   *   "cpv" - numeric integer codepoint of the character
   *   "crd" - array of Jyutping reading strings of the character
   *   "dfn" - string for English gloss, or property not defined if
   *           gloss not available
   *
   * Note that the "ctable" format is the exact same as the "ctable"
   * format used in listWordResults.
   *
   * Parameters:
   *
   *   da : object - the character results to list
   */
  function listCharResults(da) {
    
    var func_name = "listCharResults";
    var str, i, j, ce, eResult;
    
    // Check parameter
    if (typeof(da) !== "object") {
      fault(func_name, 100);
    }
    if ((!("clist" in da)) || (!("ctable" in da))) {
      fault(func_name, 110);
    }
    if ((!(da.clist instanceof Array)) ||
        (!(da.ctable instanceof Array))) {
      fault(func_name, 120);
    }
    for(i = 0; i < da.clist.length; i++) {
      if (typeof(da.clist[i]) !== "number") {
        fault(func_name, 130);
      }
      if (!isFinite(da.clist[i])) {
        fault(func_name, 140);
      }
      da.clist[i] = Math.floor(da.clist[i]);
      if ((da.clist[i] < 0) || (da.clist[i] >= da.ctable.length)) {
        fault(func_name, 150);
      }
    }
    for(i = 0; i < da.ctable.length; i++) {
      if (typeof(da.ctable[i]) !== "object") {
        fault(func_name, 160);
      }
      if ((!("cpv" in da.ctable[i])) ||
          (!("crd" in da.ctable[i]))) {
        fault(func_name, 170);
      }
      if (typeof(da.ctable[i].cpv) !== "number") {
        fault(func_name, 180);
      }
      if (!isFinite(da.ctable[i].cpv)) {
        fault(func_name, 190);
      }
      da.ctable[i].cpv = Math.floor(da.ctable[i].cpv);
      if ((da.ctable[i].cpv < 0) || (da.ctable[i].cpv > 0x10ffff) ||
            ((da.ctable[i].cpv >= 0xd800) &&
              (da.ctable[i].cpv <= 0xdfff))) {
        fault(func_name, 200);
      }
      if (!(da.ctable[i].crd instanceof Array)) {
        fault(func_name, 210);
      }
      for(j = 0; j < da.ctable[i].crd.length; j++) {
        if (typeof(da.ctable[i].crd[j]) !== "string") {
          fault(func_name, 220);
        }
      }
      if ("dfn" in da.ctable[i]) {
        if (typeof(da.ctable[i].dfn) !== "string") {
          fault(func_name, 230);
        }
      }
    }
    
    // Get the result DIV
    eResult = document.getElementById("divResults");
    if (eResult == null) {
      fault(func_name, 300);
    }
    
    // Build the HTML results from the object
    if (da.clist.length > 0) {
      // At least one result, so begin results table
      str = "<table class=\"rtable\">";
      
      // Add each result
      for(i = 0; i < da.clist.length; i++) {
        // Get the character entry
        ce = da.ctable[da.clist[i]];
        
        // Add character and codepoint, with codepoint being a link that
        // types the character
        str = str + "<tr><td class=\"han\">";
        str = str + String.fromCodePoint(ce.cpv);
        str = str + "</td><td class=\"cpt\">";
        str = str + "<a href=\"javascript:void ctt_html.typeChar("
        str = str + (ce.cpv).toString(10);
        str = str + ");\">";
        str = str + (ce.cpv).toString(16).toLowerCase();
        str = str + "</a>";
        
        // Add all readings
        str = str + "</td><td class=\"cpr\">";
        if (ce.crd.length > 0) {
          // At least one reading to add
          for(j = 0; j < ce.crd.length; j++) {
            if (j > 0) {
              str = str + ", ";
            }
            str = str + ce.crd[j];
          }
          
        } else {
          // No readings
          str = str + "&nbsp;"
        }
        
        // Add definition, if available
        str = str + "</td><td class=\"cpd\">";
        if ("dfn" in ce) {
          str = str + htmlEsc(ce.dfn);
        } else {
          str = str + "&nbsp;";
        }
        
        // Finish row
        str = str + "</td></tr>";
      }
      
      // End results table
      str = str + "</table>";
      
    } else {
      // No results
      str = "<p>No matches found!</p>";
    }
    
    // Update results
    eResult.innerHTML = str;
  }

  /*
   * Given a set of word results, write them to the result DIV.
   *
   * The given da parameter must be an object that has parameters
   * "wlist" and "ctable".  
   *
   * The "wlist" is an array where each element is an object
   * representing a located dictionary entry.  Dictionary entry objects
   * have the following properties:
   *
   *   "tc" - traditional character string
   *   "sc" - simplified character string
   *   "py" - array of Pinyin syllable strings
   *   "df" - array of English gloss strings (might include Chinese!)
   *   "cc" - array of character code indices
   *
   * The "cc" array contains array indices into the "ctable" for the
   * component characters that should be displayed for this entry.
   *
   * The "ctable" stores the character data for component characters.
   * The elements of the "ctable" are objects having the following
   * properties:
   *
   *   "cpv" - numeric integer codepoint of the character
   *   "crd" - array of Jyutping reading strings of the character
   *   "dfn" - string for English gloss, or property not defined if
   *           gloss not available
   *
   * Note that the "ctable" format is the exact same as the "ctable"
   * format used in listWordResults.
   *
   * Parameters:
   *
   *   da : object - the word results to list
   */
  function listWordResults(da) {
    
    var func_name = "listWordResults";
    var str, i, j, k, ce, eResult;
    
    // Check parameter
    if (typeof(da) !== "object") {
      fault(func_name, 100);
    }
    if ((!("wlist" in da)) || (!("ctable" in da))) {
      fault(func_name, 110);
    }
    if ((!(da.wlist instanceof Array)) ||
        (!(da.ctable instanceof Array))) {
      fault(func_name, 120);
    }
    for(i = 0; i < da.wlist.length; i++) {
      if (typeof(da.wlist[i]) !== "object") {
        fault(func_name, 130);
      }
      if ((!("tc" in da.wlist[i])) ||
          (!("sc" in da.wlist[i])) ||
          (!("py" in da.wlist[i])) ||
          (!("df" in da.wlist[i])) ||
          (!("cc" in da.wlist[i]))) {
        fault(func_name, 132);
      }
      if ((typeof(da.wlist[i].tc) !== "string") ||
          (typeof(da.wlist[i].sc) !== "string") ||
          (!(da.wlist[i].py instanceof Array)) ||
          (!(da.wlist[i].df instanceof Array)) ||
          (!(da.wlist[i].cc instanceof Array))) {
        fault(func_name, 134);
      }
      for(j = 0; j < da.wlist[i].py.length; j++) {
        if (typeof(da.wlist[i].py[j]) !== "string") {
          fault(func_name, 136);
        }
      }
      for(j = 0; j < da.wlist[i].df.length; j++) {
        if (typeof(da.wlist[i].df[j]) !== "string") {
          fault(func_name, 137);
        }
      }
      for(j = 0; j < da.wlist[i].cc.length; j++) {
        if (typeof(da.wlist[i].cc[j]) !== "number") {
          fault(func_name, 138);
        }
        if (!isFinite(da.wlist[i].cc[j])) {
          fault(func_name, 140);
        }
        da.wlist[i].cc[j] = Math.floor(da.wlist[i].cc[j]);
        if ((da.wlist[i].cc[j] < 0) ||
              (da.wlist[i].cc[j] >= da.ctable.length)) {
          fault(func_name, 150);
        }
      }
    }
    for(i = 0; i < da.ctable.length; i++) {
      if (typeof(da.ctable[i]) !== "object") {
        fault(func_name, 160);
      }
      if ((!("cpv" in da.ctable[i])) ||
          (!("crd" in da.ctable[i]))) {
        fault(func_name, 170);
      }
      if (typeof(da.ctable[i].cpv) !== "number") {
        fault(func_name, 180);
      }
      if (!isFinite(da.ctable[i].cpv)) {
        fault(func_name, 190);
      }
      da.ctable[i].cpv = Math.floor(da.ctable[i].cpv);
      if ((da.ctable[i].cpv < 0) || (da.ctable[i].cpv > 0x10ffff) ||
            ((da.ctable[i].cpv >= 0xd800) &&
              (da.ctable[i].cpv <= 0xdfff))) {
        fault(func_name, 200);
      }
      if (!(da.ctable[i].crd instanceof Array)) {
        fault(func_name, 210);
      }
      for(j = 0; j < da.ctable[i].crd.length; j++) {
        if (typeof(da.ctable[i].crd[j]) !== "string") {
          fault(func_name, 220);
        }
      }
      if ("dfn" in da.ctable[i]) {
        if (typeof(da.ctable[i].dfn) !== "string") {
          fault(func_name, 230);
        }
      }
    }
    
    // Get the result DIV
    eResult = document.getElementById("divResults");
    if (eResult == null) {
      fault(func_name, 300);
    }
    
    // Build HTML results string
    str = "";
    if (da.wlist.length > 0) {
      // Matches found, so add each result
      for(i = 0; i < da.wlist.length; i++) {
        
        // First comes the headword as a traditional character
        str = str + "<p class=\"dictp\">"
        str = str + "<span class=\"dicthw\">";
        str = str + htmlEsc(da.wlist[i].tc);
        
        // If the simplified character is different, put it in
        // parentheses
        if (da.wlist[i].sc !== da.wlist[i].tc) {
          str = str + " (" + htmlEsc(da.wlist[i].sc) + ")";
        }
        
        // Finish the headword span and line break
        str = str + "</span><br/>";
        
        // Now all the word definitions, with multiple definitions
        // separated by semicolons
        str = str + "<span class=\"dictdef\">";
        for(j = 0; j < da.wlist[i].df.length; j++) {
          if (j > 0) {
            str = str + "; ";
          }
          str = str + htmlEsc(da.wlist[i].df[j]);
        }
        str = str + "</span>";
        
        // Third line controls the character block that follows, which
        // is hidden by default
        str = str + "<br/>";
        str = str + "<a href=\"javascript:void ctt_html.appear('"
        str = str + "dyndiv" + i;
        str = str + "');\">[&nbsp;Show&nbsp;]</a> ";
        str = str + "<a href=\"javascript:void ctt_html.dismiss('"
        str = str + "dyndiv" + i;
        str = str + "');\">[&nbsp;Hide&nbsp;]</a>";
        
        // Finish the word block
        str = str + "</p>";
        
        // We will put the character table in a dynamic DIV, which is
        // hidden by default, and the visibility controlled by the links
        // at the end of the definition block
        str = str + "<div style=\"display: none;\" ";
        str = str + "id=\"dyndiv" + i + "\">";
        
        // Build the character table within the dynamic DIV
        if (da.wlist[i].cc.length > 0) {
          // Begin the table
          str = str + "<table class=\"rtable\">";
          
          // Generate all the character rows
          for(j = 0; j < da.wlist[i].cc.length; j++) {
            // Get the character information
            ce = da.ctable[da.wlist[i].cc[j]];
            
            // Begin the row
            str = str + "<tr>";
            
            // Add the character cell
            str = str + "<td class=\"han\">";
            str = str + String.fromCodePoint(ce.cpv);
            str = str + "</td>";
            
            // Add the character code with a link that types the
            // character
            str = str + "<td class=\"cpt\">";
            str = str + "<a href=\"javascript:void ctt_html.typeChar("
            str = str + ce.cpv.toString(10);
            str = str + ");\">";
            str = str + ce.cpv.toString(16).toLowerCase();
            str = str + "</a>";
            str = str + "</td>";
            
            // Add all the Jyutping readings
            str = str + "<td class=\"cpr\">";
            if (ce.crd.length > 0) {
              for(k = 0; k < ce.crd.length; k++) {
                if (k > 0) {
                  str = str + ", ";
                }
                str = str + ce.crd[k];
              }
            } else {
              str = str + "&nbsp;"
            }
            str = str + "</td>";
            
            // Add definition, if available
            str = str + "<td class=\"cpd\">";
            if ("dfn" in ce) {
              str = str + htmlEsc(ce.dfn);
            } else {
              str = str + "&nbsp;";
            }
            str = str + "</td>";
            
            // End the row
            str = str + "</tr>";
          }
          
          // End the table
          str = str + "</table>";
          
        } else {
          // No component characters
          str = str + "(No characters)";
        }
        
        // Finish the dynamic DIV
        str = str + "</div>";
      }
      
    } else {
      // No matches
      str = "<p>No matches found!</p>";
    }
    
    // Update results
    eResult.innerHTML = str;
  }

  /*
   * Event handler for when the query character button is clicked.
   */
  function queryChar() {
    
    var func_name = "queryChar";
    var e, eResult;
    var q, cpa, cpi, ce, da, i;
    
    // Get the result DIV
    eResult = document.getElementById("divResults");
    if (eResult == null) {
      fault(func_name, 100);
    }
    
    // Clear results
    eResult.innerHTML = "&nbsp;";
    
    // Get the query word
    e = document.getElementById("txtInput");
    if (e == null) {
      fault(func_name, 110);
    }
    q = e.value;
    
    // Perform the character query
    cpa = ctt_main.charQuery(q);
    
    // Build the result object
    da = {"clist": [], "ctable": []};
    for(i = 0; i < cpa.length; i++) {
      // Look for codepoint record (or -1 if none)
      cpi = ctt_main.seekCode(cpa[i]);
      
      // Get the character entry
      if (cpi >= 0) {
        ce = canto_chars[cpi];
      } else {
        ce = {"cpv": cpa[i], "crd": []};
      }
      
      // Add to results
      da.clist.push(i);
      da.ctable.push(ce);
    }
    
    // Print results
    listCharResults(da);
  }

  /*
   * Event handler for when the query word button is clicked.
   */
  function queryWord() {
    
    var func_name = "queryChar";
    var e, eResult;
    var q, dwi, da, dr, c, ca, ce, ci, cpi, ccount, i, j, k;
    
    // Get the result DIV
    eResult = document.getElementById("divResults");
    if (eResult == null) {
      fault(func_name, 100);
    }
    
    // Clear results
    eResult.innerHTML = "&nbsp;";
    
    // Get the query word
    e = document.getElementById("txtInput");
    if (e == null) {
      fault(func_name, 110);
    }
    q = e.value;
    
    // Perform the query
    dwi = ctt_main.wordQuery(q);
    
    // If too many matches found, report the error and proceed no
    // further
    if ((dwi.length === 1) && (dwi[0] === -1)) {
      // Too many matches found
      eResult.innerHTML = "<p>Too many matches found!</p>";
      return;
    }
    
    // Define an index object that will map base-16 codepoint value
    // strings to their position within the ctable, and add a counter of
    // how many character entries have been defined so far
    ci = {};
    ccount = 0;
    
    // Build the results object
    da = {"wlist": [], "ctable": []};
    for(i = 0; i < dwi.length; i++) {
      // Get the dictionary record
      dr = canto_words[dwi[i]];
      
      // Get all the (traditional) characters as an array of codepoints
      ca = [];
      for(j = 0; j < dr[0].length; j++) {
        c = dr[0].codePointAt(j);
        ca.push(c);
        if (c >= 0x10000) {
          j++;
        }
      }
      
      // For each codepoint in the codepoint array, add it to the
      // character table if not already present, and then replace it in
      // the codepoint array with an index into the ctable
      for(j = 0; j < ca.length; j++) {
        
        // Get the key value for this codepoint
        k = ca[j].toString(16).toLowerCase();
        
        // Add to ctable if not already present
        if (!(k in ci)) {
          // Get a character record for this codepoint
          cpi = ctt_main.seekCode(ca[j]);
          if (cpi >= 0) {
            // Character record found, so get it
            ce = canto_chars[cpi];
            
          } else {
            // No character record found, so generate one with just the
            // codepoint value and empty required fields
            ce = {"cpv": ca[j], "crd": []};
          }
          
          // Push the character record onto the character table
          da.ctable.push(ce);
          
          // Add the mapping to the index and increase the ccount
          ci[k] = ccount;
          ccount++;
        }
        
        // Replace the codepoint value in the array with its index into
        // the characters table
        ca[j] = ci[k];
      }
      
      // Add the dictionary entry to the results object
      da.wlist.push({
        "tc": dr[0],
        "sc": dr[1],
        "py": dr[2],
        "df": dr[3],
        "cc": ca
      });
    }
    
    // Print the results
    listWordResults(da);
  }

  /*
   * Event handler for when the document is fully loaded.
   *
   * This should be registered later.
   */
  function handleLoad() {
    
    var func_name = "handleLoad";
    var eSplash;
    
    // Get splash DIV for reporting loading errors
    var eSplash = document.getElementById("divSplash");
    
    // Asynchronously initialize the database before proceeding
    ctt_load.initDB(
      function() {
        // Callback invoked when database initialization is successful
        var e, eTypeBox, eErrLine, eCSS;
        var f, csst, i;
    
        // Define function that we will call once all database loading
        // and index building is done
        f = function() {
          // Build the CSS for linking the webfonts, and set the webfont
          // URLs to data URLs into our data files
          csst = "";
          for(i = 0; i < font_config.length; i++) {
            csst = csst + "@font-face { ";
            csst = csst + "font-family: '" + font_config[i][0] + "'; ";
            csst = csst + "font-style: normal; ";
            csst = csst + "font-weight: normal; ";
            csst = csst + "src: url('" +
                          ctt_load.woffURL(font_config[i][1]) + "'); ";
            csst = csst + "}\n";
          }
          
          // Convert the dynamic CSS into a blob of type text/css
          csst = new Blob([csst], {"type": "text/css"});
          
          // Convert the CSS stylesheet blob into a string storing an
          // object URL that references the blob
          csst = URL.createObjectURL(csst);
          
          // Now create a <link> element that will link to this CSS URL
          eCSS = document.createElement("link");
          eCSS.setAttribute("href", csst);
          eCSS.setAttribute("rel", "stylesheet");
          
          // Find the first <style> element in this page
          e = document.getElementsByTagName("style");
          if (e.length < 1) {
            fault(func_name, 600);
          }
          e = e[0];
          
          // Insert the <link> element before this first <style>
          e.parentNode.insertBefore(eCSS, e);
          
          // Wait for the event loop so that the CSS update can take
          // effect
          setTimeout(
            function() {
              
              // Add an event handler to the typing box that updates the
            // position for insertion whenever focus is lost from the
            // element
            eTypeBox = document.getElementById("txtWrite");
            if (eTypeBox == null) {
              fault(func_name, 700);
            }
            eTypeBox.onblur = function(ev) {
              m_caret = eTypeBox.selectionStart;
            };
            
            // Add an event handler to the codepoint box that
            // immediately hides the error DIV for codepoints if there
            // is any input
            e = document.getElementById("txtCode");
            if (e == null) {
              fault(func_name, 800);
            }
            
            eErrLine = document.getElementById("divErrLine");
            if (eErrLine == null) {
              fault(func_name, 810);
            }
            
            e.oninput = function(ev) {
              eErrLine.style.display = "none";
            };
            
            // Hide the splash-screen DIV and show the main DIV
            e = document.getElementById("divSplash");
            if (e == null) {
              fault(func_name, 900);
            }
            e.style.display = "none";
            
            e = document.getElementById("divMain");
            if (e == null) {
              fault(func_name, 910);
            }
            e.style.display = "block";
              
            },
            0
          );
          
        };
    
        // Update status
        if (eSplash != null) {
          eSplash.innerHTML = "Decompressing character database...";
        }
    
        // Now we need a potentially long synchronous decompress and
        // load of indices, so we are going to handle that by setting a
        // timeout of zero so we get called back after a run of the
        // event loop; do this with both data tables and building the
        // indices
        setTimeout(
          function() {
          
            // Load character database
            canto_chars = ctt_load.jsonData(canto_config.chardb_name);
          
            // Update status
            if (eSplash != null) {
              eSplash.innerHTML = "Decompressing word database...";
            }
            
            // Let the event loop run again
            setTimeout(
              function() {
                
                // Load word database
                canto_words = ctt_load.jsonData(
                  canto_config.worddb_name);
                
                // Update status
                if (eSplash != null) {
                  eSplash.innerHTML = "Building database indices...";
                }
                
                // Let the event loop run again
                setTimeout(
                  function() {
                    
                    // Build data indices
                    ctt_main.buildIndices();
                    
                    // All done, so now we can finish initializing the
                    // app
                    f();
                  },
                  0
                );
                
              },
              0
            );
          },
          0
        );
        
      },
      function(report) {
        // Callback invoked for a progress report
        if (eSplash != null) {
          eSplash.innerHTML = report;
        }
      },
      function(reason) {
        // Callback invoked if there was an error
        console.log("Database init failed: " + reason);
        if (eSplash != null) {
          eSplash.innerHTML =
            "ERROR: Database initialization failed!<br/>" +
            "<br/>" +
            "Reason: " + htmlEsc(reason);
        }
      }
    );
  }

  /*
   * Export declarations
   * ===================
   * 
   * All exports are declared within a global "ctt_html" object.
   */
  window.ctt_html = {
    "appear": appear,
    "dismiss": dismiss,
    "typeChar": typeChar,
    "handleCodebox": handleCodebox,
    "listCharResults": listCharResults,
    "listWordResults": listWordResults,
    "queryChar": queryChar,
    "queryWord": queryWord,
    "handleLoad": handleLoad
  };

}());


// Since we loaded this script module with defer, this doesn't run until
// after the page has loaded the DOM, so we can start directly here by
// calling the service worker if supported for offline support, and then
// calling the loading procedure
//
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register(
    canto_config.code_base + 'cantotype_sw.js');
};

ctt_html.handleLoad();
