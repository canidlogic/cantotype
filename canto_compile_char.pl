#!/usr/bin/env perl
use strict;
use feature 'unicode_strings';
use warnings FATAL => "utf8";

# Non-core dependencies
#
use JSON::Tiny qw(decode_json encode_json);

# Core dependencies
#
use File::Spec;

=head1 NAME

canto_compile_char.pl - Compile character database for Cantotype.

=head1 SYNOPSIS

  canto_compile_char.pl -hkscs HKSCS.json -unihan Unihan/folder > out.js

=head1 DESCRIPTION

This script reads data sources from Unihan and the Hong Kong
Supplemental Character Set (HKSCS), and uses this data to compile the
uncompressed character database file for Cantotype.

The paths to the HKSCS supplement JSON file is given using the C<-hkscs>
option.  The Unihan database is split across multiple files.  The folder
containing these Unihan files is given using the C<-unihan> option, and
the files within that folder must have the same names that they had in
the source C<unihan.zip> file.  See the section on "Data sources" below
for further information where to obtain these data sources.

The uncompressed character database JSON file will be written to
standard output.  Note that Cantotype expects this file to be compressed
with GZip.

=head2 Data file format

The character data table is a JSON array where each element of the array
is a data record.  Records are not stored in any particular order.

Each record is a JavaScript object whose properties define the
properties of a specific Chinese character.  The following properties
are always defined:

=over 4

=item C<cpv>

The numeric Unicode codepoint of the character.  Supplemental characters
are represented directly by their numeric codepoint rather than by a
surrogate pair.  Each record in the C<canto_chars> array has a unique
value for this field, but there is no guarantee of the ordering of
records in the table.  This field is an integer value.

=item C<crd>

The Cantonese reading(s) of the character.  The value is an array of one
or more strings, each of which contains a lowercase Jyutping reading.
No particular ordering is guaranteed within the readings.

=back

The following properties are optional, only defined if available:

=over 4

=item C<dfn>

A string providing a definition gloss of the character's meaning, in
English.  This is taken from the Unihan database, so it is not meant to
be an actual Chinese word definition, but rather just a gloss for that
specific character.

=back

=head2 Character table range

The character table contains a subset of the Chinese characters in
Unicode.  Specifically, the table only includes characters that have a
Big5 mapping defined in the Unihan database B<or> appear in the HKSCS
supplement of Cantonese-specific characters.  Furthermore, only
characters that have at least one Cantonese reading will be included.

=head2 Jyutping format

The C<VALID_INITIALS> and C<VALID_FINALS> variables give the recognized
valid initials and finals in Jyutping syllables.  The tone numbers may
be 1-6.  Also, finals "m" and "ng" may stand by themselves without a
vowel in the final.

=head2 Data sources

The HKSCS file is a JSON file that has a JSON array at the top level.
Each element in this JSON array is a JSON object.  These object elements
must at least have a C<codepoint> property and a C<cantonese> property.
The C<codepoint> property has a string value that contains the Unicode
codepoint as base-16 digits.  The C<cantonese> property is also a
string.  If it is empty, the record is ignored.  Otherwise, it must
consist of one or more Jyutping romanizations, separated by commas.

The HKSCS file is B<not> a complete listing of Cantonese characters.
Instead, it only contains special Cantonese characters that are beyond
the baseline Big5 standard.  You can get a file C<HKSCS2016.json> that
is entitled I<Hong Kong Supplementary Character Set related information
(JSON format)> which has the necessary format from the Office of the
Government Chief Information Officer of Hong Kong, Common Chinese
Language Interface, Download Area, at:

C<https://www.ogcio.gov.hk/en/our_work/business/tech_promotion/ccli/download_area/>

The Unihan files are available from the Unicode consortium in an archive
called C<unihan.zip>.  The archive is available at:

C<https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip>

This script requires the path to a directory that contains all of the
text files extracted from C<unihan.zip>.

The HKSCS and Unihan data files have some typos and obscure characters
in them that this script automatically corrects.  The correction
procedure is smart enough that if the datasets are fixed in the futures,
the corrections will no longer be applied in the future if no longer
necessary.  See C<correct_cmap> function for details of the corrections
that are applied.

=cut

# =========
# Constants
# =========

# All of the valid Jyutping initials, in lowercase, with each initial
# surrounded by colons
#
my $VALID_INITIALS = ":b:p:m:f:d:t:n:l:g:k:ng:h:gw:kw:w:z:c:s:j:";

# All of the valid Jyutping finals, in lowercase, with each final
# surrounded by colons
#
# NOTE: "et" final added in here because it is used in multiple entries
#
my $VALID_FINALS =
  ":aa:aai:aau:aam:aan:aang:aap:aat:aak" .
  ":a:ai:au:am:an:ang:ap:at:ak" .
  ":e:ei:eu:em:eng:ep:et:ek" .
  ":i:iu:im:in:ing:ip:it:ik" .
  ":o:oi:ou:on:ong:ot:ok" .
  ":u:ui:un:ung:ut:uk" .
  ":eoi:eon:eot" .
  ":oe:oeng:oet:oek" .
  ":yu:yun:yut" .
  ":m:ng:";

# ===============
# Local functions
# ===============

# Given a reference to the %cmap hash, apply corrections for typos and
# obscure characters in the input datasets.
#
# IMPORTANT: do this *before* upgrading the cmap with upgrade_cmap().
#
# The following obscure codepoints with non-conformant Jyutping are
# DROPPED from the %cmap if present:
#
#   U+297C4 ("qi1")
#   U+2BAC8 ("bop6")
#
# The following codepoints, if present, have the following corrections
# made to their readings, if the error version is present:
#
#   U+5414  yaa1   -> jaa1
#   U+667B  om2    -> am2
#   U+27C3C zeong6 -> zoeng6
#   U+2BAF2 zoen6  -> zeon6
#   U+2BB1B zoen6  -> zeon6
#   U+2F817 yung2  -> jung2
#
# Parameters:
#
#   1 : hash ref - the %cmap to apply corrections to
#
sub correct_cmap {
  # Check number of parameters
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get argument and check type
  my $cm = shift;
  (ref($cm) eq "HASH") or die "Wrong argument type, stopped";
  
  # Drop the obscure codepoints if present
  for my $cpv (0x297c4, 0x2bac8) {
    if (exists $cm->{"$cpv"}) {
      delete $cm->{"$cpv"};
    }
  }
  
  # Apply corrections
  for my $ca ([ 0x5414, "yaa1"  , "jaa1"  ],
              [ 0x667b, "om2"   , "am2"   ],
              [0x27c3c, "zeong6", "zoeng6"],
              [0x2baf2, "zoen6" , "zeon6" ],
              [0x2bb1b, "zoen6" , "zeon6" ],
              [0x2f817, "yung2" , "jung2" ]) {
    
    # Get parameters for this correction
    my $cpv = $ca->[0];
    my $cer = $ca->[1];
    my $crp = $ca->[2];

    # Skip if codepoint not present
    if (not exists $cm->{"$cpv"}) {
      next;
    }

    # Get reference to readings array
    my $ra = $cm->{"$cpv"};
    
    # Starting from last element of readings array and going to first,
    # drop any readings that are erroneous and set the found_err flag if
    # at least one reading dropped
    my $found_err = 0;
    for(my $i = (scalar @$ra - 1); $i >= 0; $i--) {
      if ($ra->[$i] eq $cer) {
        $found_err = 1;
        splice @$ra, $i, 1;
      }
    }

    # Skip rest of processing if no error reading found
    if (not $found_err) {
      next;
    }
    
    # Check whether the correction is already in the readings array
    my $already = 0;
    for my $r (@$ra) {
      if ($r eq $crp) {
        $already = 1;
        last;
      }
    }

    # Add correction if not already in readings array
    if (not $already) {
      push @$ra, ($crp);
    }
  }
}

# Check whether a given string is a valid Jyutping syllable.
#
# Parameters:
#
#   1 : string - the string to check
#
# Return:
#
#   1 if string is valid Jyutping syllable, 0 if not
#
sub check_reading {
  # Check number of parameters
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get argument as string
  my $str = shift;
  $str = "$str";
  
  # Check for tone suffix and get the main syllable
  ($str =~ /^([a-z]+)[1-6]$/u) or return 0;
  $str = $1;
  
  # Handle syllabic m and ng as special case
  if ($str =~ /^([^aeiouy]*)(?:m|ng)$/u) {
    # Get the initial
    $str = $1;
    
    # If initial is not empty, check that initial is valid
    ((length($str) < 1) or ($VALID_INITIALS =~ /:$str:/u)) or return 0;
    
    # If we got here, syllable is valid as special case with syllabic
    # m or ng
    return 1;
  }
  
  # Split into initial (which may be empty) and final (required)
  ($str =~ /^([^aeiouy]*)([aeiouy].*)$/u) or return 0;
  my $i = $1;
  my $f = $2;
  
  # If initial is not empty, check that initial is valid
  ((length($i) < 1) or ($VALID_INITIALS =~ /:$i:/u)) or return 0;
  
  # Check that final is valid
  ($VALID_FINALS =~ /:$f:/u) or return 0;
  
  # If we got here, syllable is valid Jyutping
  return 1;
}

# Given a path to a directory and a filename within that directory,
# return the full path to that file within the directory.
#
# Parameters:
#
#   1 : string - the path to the directory
#
#   2 : string - the filename
#
# Return:
#
#   string - the path to the file
#
sub subfile {
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get parameters as strings
  my $path_dir  = shift;
  my $path_name = shift;
  
  $path_dir  = "$path_dir";
  $path_name = "$path_name";
  
  # Split the directory
  (my $dvol, my $ddir, undef) = File::Spec->splitpath($path_dir, 1);
  
  # Return the full path
  return File::Spec->catpath($dvol, $ddir, $path_name);
}

# Given a reference to the %cmap hash, initialize it with the core Big5
# codepoints from the Unihan database.
#
# The %cmap hash should be empty when this function is called.
#
# Only core Big5 codepoints defined in Unihan will be added by this
# function.  This does NOT include Cantonese specific extensions with
# HKSCS.
#
# The keys within the %cmap will be set to unsigned decimal integer
# strings for the codepoint value.  The values within the %cmap will all
# be set to empty arrays.
#
# Parameters:
#
#   1 : hash ref - reference to the %cmap
#
#   2 : string - path to the "other mappings" Unihan data file
#
sub grab_big5 {
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get parameters and check types
  my $cm        = shift;
  my $data_path = shift;
  
  (ref($cm) eq 'HASH') or die "Wrong parameter type, stopped";
  $data_path = "$data_path";
  
  # Open the other mappings file
  open(my $fhm, "< :utf8", $data_path) or
    die "Failed to open '$data_path', stopped";
  
  # Process mappings file line by line and add all Big5 Unicode
  # codepoints to the hash, with empty array reference values for now
  while (<$fhm>) {
    # Skip line if blank
    if (/^[ \t\r\n]*$/u) {
      next;
    }
    
    # Skip line if first character is # indicating comment
    if (/^[ \t]*#/u) {
      next;
    }
    
    # If this is a Big5 record, add to the hash
    if (/^[ \t]*U\+([0-9a-fA-F]{4,6})\tkBigFive\t/u) {
      my $cpv = hex($1);
      $cm->{"$cpv"} = [];
    }
  }
  
  # Close the mappings file
  close($fhm);
}

# Given a reference to a %cmap hash that has been initialized, add
# Cantonese readings from the Unihan data.
#
# The %cmap should have been run through grab_big5() first.  That
# function adds codepoint entries for all core Big5 codepoints in the
# Unihan data, and maps each of them to empty array references.
#
# This function will run through all the Cantonese readings in the
# Unihan database and add readings to the codepoints that are already in
# %cmap.  No new codepoints will be added to %cmap by this function.
#
# Parameters:
#
#   1 : hash ref - reference to the %cmap
#
#   2 : string - path to the "readings" Unihan data file
#
sub apply_canto {
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get parameters and check types
  my $cm        = shift;
  my $data_path = shift;
  
  (ref($cm) eq 'HASH') or die "Wrong parameter type, stopped";
  $data_path = "$data_path";
  
  # Open the readings file
  open(my $fhr, "< :utf8", $data_path) or
    die "Failed to open '$data_path', stopped";
  
  # Process readings file line by line, and for any Cantonese reading
  # where the codepoint is already in the mappings file, push all
  # readings onto the array value, after making sure the array doesn't
  # already contain that reading
  while (<$fhr>) {
    # Skip line if blank
    if (/^[ \t\r\n]*$/u) {
      next;
    }
    
    # Skip line if first character is # indicating comment
    if (/^[ \t]*#/u) {
      next;
    }
    
    # If this is a Cantonese reading record, process it
    if (/^[ \t]*U\+([0-9a-fA-F]{4,6})\tkCantonese\t(.+)[\r\n]*$/u) {
      my $cpv = hex($1);
      my $rstr = $2;
      
      # Check that exactly one syllable defined
      ($rstr =~ /^[A-Za-z]+[1-6]$/u) or
        die "Invalid kCantonese value: $rstr stopped";
      
      # Check if reading already present
      my $already = 0;
      for my $r (@{$cm->{"$cpv"}}) {
        if ($r eq $rstr) {
          $already = 1;
          last;
        }
      }
      
      # If not already defined, add the reading
      if (not $already) {
        push @{$cm->{"$cpv"}}, ($rstr);
      }
    }
  }
  
  # Close the readings file
  close($fhr);  
}

# Given a reference to a %cmap hash that has been initialized, drop all
# records that do not have at least one Cantonese reading.
#
# Parameters:
#
#   1 : hash ref - reference to the %cmap
#
sub only_canto {
  # Check parameter count
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get parameter and check type
  my $cm        = shift;
  (ref($cm) eq 'HASH') or die "Wrong parameter type, stopped";

  # Run through all keys and build a list of keys that will be dropped
  my @droplist;
  for my $k (keys %$cm) {
    if (scalar(@{$cm->{$k}}) < 1) {
      push @droplist, ($k);
    }
  }
  
  # Delete all entries from the drop list
  for my $k (@droplist) {
    delete $cm->{$k};
  }
}

# Given a reference to a %cmap hash, add extra Cantonese readings and
# codepoints from the HKSCS supplement.
#
# This function will run through all the codepoints in the HKSCS
# supplement that have at least one Cantonese reading, add the
# codepoints to the %cmap if not already defined, and add the HKSCS
# readings to the codepoint if not already present.
#
# Parameters:
#
#   1 : hash ref - reference to the %cmap
#
#   2 : string - path to the HKSCS data file
#
sub apply_hkscs {
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get parameters and check types
  my $cm        = shift;
  my $data_path = shift;
  
  (ref($cm) eq 'HASH') or die "Wrong parameter type, stopped";
  $data_path = "$data_path";
  
  # Open the HKSCS file in raw mode
  open(my $fhh, "< :raw", $data_path) or
    die "Failed to open '$data_path', stopped";
  
  # Slurp the whole HKSCS file into memory
  my $hkscs;
  {
    local $/;
    $hkscs = <$fhh>;
  }
  
  # Close HKSCS file
  close($fhh);
  
  # If file starts with UTF-8 BOM, remove it
  if (length $hkscs > 3) {
    if ((ord(substr($hkscs, 0, 1)) == 0xef) and
        (ord(substr($hkscs, 1, 1)) == 0xbb) and
        (ord(substr($hkscs, 2, 1)) == 0xbf)) {
      $hkscs = substr($hkscs, 3);
    }
  }
  
  # Decode JSON
  $hkscs = decode_json($hkscs);
  
  # Make sure top-level JSON is array
  (ref($hkscs) eq "ARRAY") or
    die "HKSCS must be JSON array, stopped";
  
  # Go through all JSON records, and for each that has a Cantonese
  # reading, add it to the hash, making sure it's not already in there
  for my $h (@$hkscs) {
    
    # Make sure element is hash reference
    (ref($h) eq "HASH") or
      die "HKSCS elements must be JSON objects, stopped";
    
    # Make sure required codepoint and cantonese properties are there
    (exists $h->{'codepoint'}) or
      die "HKSCS elements must all have codepoint properties, stopped";
    (exists $h->{'cantonese'}) or
      die "HKSCS elements must all have cantonese properties, stopped";
    
    # Get the properties
    my $cpv  = $h->{'codepoint'};
    my $cstr = $h->{'cantonese'};
    
    # Skip if cantonese property is empty
    if ($cstr =~ /^[ \t]*$/u) {
      next;
    }
    
    # Parse the codepoint
    $cpv = hex($cpv);
    
    # Replace periods with commas -- this will fix the "nuk6." typo in
    # HKSCS2016
    $cstr =~ s/\./,/ug;
    
    # Replace all commas with comma followed by space so that there is a
    # space everywhere after commas -- this will fix the "taan3,wan6"
    # typo that is missing a space in HKSCS2016
    $cstr =~ s/,/, /ug;
    
    # Drop all commas -- we can parse the syllables with spaces, and
    # there is a typo in HKSCS2016 at "jing1 mau5" with a missing comma
    # that will be fixed if we go by whitespace instead
    $cstr =~ s/,//ug;
    
    # Trim leading and trailing whitespace
    $cstr =~ s/^[ \t]+//gu;
    $cstr =~ s/[ \t]+$//gu;
    
    # Split by whitespace
    my @car = split " ", $cstr;
    
    # Process each reading
    for my $r (@car) {
      # If codepoint doesn't exist yet, add it with empty array
      if (not exists $cm->{"$cpv"}) {
        $cm->{"$cpv"} = [];
      }
      
      # Check whether reading already present in array
      my $already = 0;
      for my $s (@{$cm->{"$cpv"}}) {
        if ($s eq $r) {
          $already = 1;
          last;
        }
      }
      
      # If not already defined, add the reading
      if (not $already) {
        push @{$cm->{"$cpv"}}, ($r);
      }
    }
  }
}

# Upgrade a %cmap reference from just storing Cantonese readings for
# each codepoint to storing a full descriptive object for each
# codepoint.
#
# Each value in the %cmap must be an array reference when this function
# is called.
#
# The array reference values will be converted into hash reference
# values where the original array reference is stored in a "crd"
# property and the numeric codepoint value is stored in a "cpv"
# property.
#
# This function will also check that all the Jyutping readings are
# valid, using check_reading().
#
# Parameters:
#
#   1 : hash ref - reference to the %cmap
#
sub upgrade_cmap {
  # Check parameter count
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get parameter and check type
  my $cm = shift;
  (ref($cm) eq 'HASH') or die "Wrong parameter type, stopped";
  
  # Go through all the keys and upgrade the values to hash references
  for my $k (keys %$cm) {
    # Get current value
    my $old_val = $cm->{$k};
    
    # Make sure old value is an array reference
    (ref($old_val) eq 'ARRAY') or die "Wrong cmap state, stopped";
    
    # Check all the readings in the array
    for my $r (@$old_val) {
      (check_reading($r)) or die "Invalid Jyutping '$r', stopped";
    }
    
    # Define a new hash for the new value
    my %h;
    
    # Add the properties
    $h{'cpv'} = int($k);
    $h{'crd'} = $old_val;
    
    # Upgrade this key in the cmap
    $cm->{$k} = \%h;
  }
}

# Given a %cmap that has been upgraded with upgrade_cmap(), add "dfn"
# properties for any kDefinition entries found in the Unihan database.
#
# Parameters:
#
#   1 : hash ref - reference to the %cmap
#
#   2 : string - path to the Unihan "readings" data file
#
sub add_defns {
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get parameters and check types
  my $cm        = shift;
  my $data_path = shift;
  
  (ref($cm) eq 'HASH') or die "Wrong parameter type, stopped";
  $data_path = "$data_path";
  
  # Open the readings file so we can add definitions
  open(my $fhd, "< :utf8", $data_path) or
    die "Failed to open '$data_path', stopped";
  
  # Process readings file line by line, and add any definitions to
  # codepoints already in %cmap
  while (<$fhd>) {
    # Skip line if blank
    if (/^[ \t\r\n]*$/u) {
      next;
    }
    
    # Skip line if first character is # indicating comment
    if (/^[ \t]*#/u) {
      next;
    }
    
    # If this is a definition record, process it
    if (/^[ \t]*U\+([0-9a-fA-F]{4,6})\tkDefinition\t(.+)[\r\n]*$/u) {
      my $cpv = hex($1);
      my $dstr = $2;
      
      # Skip this definition record if it is not in the %cmap
      if (not exists $cm->{$cpv}) {
        next;
      }
      
      # Store the definition
      $cm->{$cpv}->{'dfn'} = $dstr;
    }
  }
  
  # Close the readings file
  close($fhd);
}

# ==================
# Program entrypoint
# ==================

# Define a hash that will store parameters we receive on the command
# line
#
my %script_param;

# Parse the command-line parameters and add to %script_param
#
for(my $i = 0; $i <= $#ARGV; $i++) {
  # Get parameter name
  my $p = $ARGV[$i];
  
  # Handle parameter
  if ($p eq "-hkscs") { # ----------------------------------------------
    # Make sure at least one extra parameter
    ($i < $#ARGV) or die "-hkscs requires parameter, stopped";
    
    # Advance to next parameter and get it
    $i++;
    $p = $ARGV[$i];
    
    # Check that parameter not already defined
    (not exists $script_param{'hkscs'}) or 
      die "-hkscs defined twice, stopped";
    
    # Check that file exists
    (-f $p) or die "Can't find file '$p', stopped";
    
    # Store parameter
    $script_param{'hkscs'} = "$p";
    
  } elsif ($p eq "-unihan") { # ----------------------------------------
    # Make sure at least one extra parameter
    ($i < $#ARGV) or die "-unihan requires parameter, stopped";
    
    # Advance to next parameter and get it
    $i++;
    $p = $ARGV[$i];
    
    # Check that parameter not already defined
    (not exists $script_param{'unihan'}) or 
      die "-unihan defined twice, stopped";
    
    # Check that directory exists
    (-d $p) or die "Can't find directory '$p', stopped";
    
    # Store parameter
    $script_param{'unihan'} = "$p";
    
  } else { # -----------------------------------------------------------
    die "Unrecognized parameter '$p', stopped";
  }
}

# Make sure all necessary parameters are now defined
#
for my $p ('hkscs', 'unihan') {
  (exists $script_param{$p}) or
    die "Missing parameter -$p, stopped";
}

# Derive Unihan data file paths and add them to the script parameters
#
$script_param{'unihan_irg'}   = subfile(
                                  $script_param{'unihan'},
                                  "Unihan_IRGSources.txt");
$script_param{'unihan_other'} = subfile(
                                  $script_param{'unihan'},
                                  "Unihan_OtherMappings.txt");
$script_param{'unihan_radst'} = subfile(
                                  $script_param{'unihan'},
                                  "Unihan_RadicalStrokeCounts.txt");
$script_param{'unihan_read'}  = subfile(
                                  $script_param{'unihan'},
                                  "Unihan_Readings.txt");

# Check for existence of Unihan data files
#
(-f $script_param{'unihan_irg'}) or
  die "Can't find file '$script_param{'unihan_irg'}', stopped";
(-f $script_param{'unihan_other'}) or
  die "Can't find file '$script_param{'unihan_other'}', stopped";
(-f $script_param{'unihan_radst'}) or
  die "Can't find file '$script_param{'unihan_radst'}', stopped";
(-f $script_param{'unihan_read'}) or
  die "Can't file file '$script_param{'unihan_read'}', stopped";

# Start with an empty hash, which will map decimal integer codepoints to
# array references containing Jyutping romanizations
#
my %cmap;

# First, grab all the core Big5 codepoints and map them to empty array
# references for now
#
grab_big5(\%cmap, $script_param{'unihan_other'});

# Second, add all Cantonese readings to those codepoints, using the
# Unihan database
#
apply_canto(\%cmap, $script_param{'unihan_read'});

# Third, drop any codepoints that do not have at least one Cantonese
# reading
#
only_canto(\%cmap);

# Fourth, add any additional Cantonese codepoints and readings from the
# HKSCS supplement file
#
apply_hkscs(\%cmap, $script_param{'hkscs'});

# Apply corrections to %cmap and upgrade to have objects for each of the
# codepoints
#
correct_cmap(\%cmap);
upgrade_cmap(\%cmap);

# Add any kDefinition fields that we find in Unihan
#
add_defns(\%cmap, $script_param{'unihan_read'});

# Convert the %cmap into an array @car
#
my @cmap_keys = keys %cmap;
@cmap_keys = sort { int($a) <=> int($b) } @cmap_keys;

my @car;
for my $k (@cmap_keys) {
  push @car, ($cmap{$k});
}

# Make sure table isn't empty
#
($#car > 0) or die "Character table is empty, stopped";

# Encode table into JSON
#
my $jss = encode_json(\@car);
  
# Write JSON to output
#
print "$jss\n";

=head1 AUTHOR

Noah Johnson, C<noah.johnson@loupmail.com>

=head1 COPYRIGHT AND LICENSE

Copyright (C) 2022 Multimedia Data Technology Inc.

MIT License:

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

=cut
