#!/usr/bin/env perl
use strict;
use feature 'unicode_strings';
use warnings FATAL => "utf8";

# Non-core dependencies
#
use JSON::Tiny qw(encode_json);

=head1 NAME

canto_compile_dict.pl - Compile word database for Cantotype.

=head1 SYNOPSIS

  canto_compile_dict.pl -cedict cedict.txt > out.js

=head1 DESCRIPTION

This script reads the data source from CC-CEDICT and uses this data to
compile the word database for Cantotype.

The path to the decompressed CC-CEDICT data file is given using the
C<-cedict> options.  See the section on "Data sources" below for further
information where to obtain this data source.

The generated dictionary JSON is written to standard output.  Note that
Cantotype expects this table to be compressed with GZip.  This script
writes it out uncompressed.

=head2 Data file format

The word data table is a JSON array where each element of the array is a
data record.  Records are not stored in any particular order.

Each record is itself an array.  The elements of these subarray records
are as follows:

=over 4

=item Element 0

String value holding the traditional character(s) for the word.  For
western names, double-width middle dots may be present.  For proverbs,
double-width commas may be present.

=item Element 1

String value holding the simplified character(s) for the word.  For
western names, double-width middle dots may be present.  For proverbs,
double-width commas may be present.

=item Element 2

Array of strings indicating the Mandarin Pinyin reading of the word.  If
the array has multiple elements, this means a multi-syllable
pronunication.  It does not mean each element is an alternative.  Pinyin
syllables may have their initial letters capitalized for proper names.
Diacritic marks are not used.  Instead, tone is represented by an
integer value 1-5 suffixed to the syllable, with 5 representing neutral
tone.  Also, the U-umlaut character is represented by the letter U
followed by a colon.  Finally, if a double-width middle dot or a
double-width comma was part of the prior record elements, those
punctuation marks will appear as their own element within this reading
array, with a regular middle dot and regular comma used instead of the
double-width varieties.

=item Element 3

Array of strings, each containing a separate English definition of the
Chinese word.  Chinese characters might be included within these
definitions, so it is not safe to assume they are ASCII.

=back

=head2 Data sources

This script requires the CC-CEDICT Chinese dictionary data file.  This
file is available for download from C<www.mdbg.net>.  You must
decompress it before passing it to this script.

=cut

# ===============
# Local functions
# ===============

# Given an array reference, add dictionary entries from the CC-CEDICT
# dictionary.
#
# Each dictionary entry is parsed from the CC-CEDICT data file and then
# pushed onto the end of the given array reference.
#
# Parameters:
#
#   1 : array ref - reference to the dictionary array
#
#   2 : string - path to the CC-CEDICT data file
#
sub import_dictionary {
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get parameters and check types
  my $dm        = shift;
  my $data_path = shift;
  
  (ref($dm) eq 'ARRAY') or die "Wrong parameter type, stopped";
  $data_path = "$data_path";
  
  # Open the dictionary file so we can import records
  open(my $fhd, "< :utf8", $data_path) or
    die "Failed to open '$data_path', stopped";
  
  # Process dictionary file line by line, and add definition records to
  # the array reference
  while (<$fhd>) {
    # Skip line if blank
    if (/^[ \t\r\n]*$/u) {
      next;
    }
    
    # Skip line if first character is # indicating comment
    if (/^[ \t]*#/u) {
      next;
    }
    
    # Parse the dictionary record
    (/^([^ ]+) ([^ ]+) \[([^\]]*)\] \/([^\r\n]*)\/[ \t\r\n]*$/u) or
      die "Invalid CC-CEDICT record '$_', stopped";
    
    my $rf_trad = $1;
    my $rf_simp = $2;
    my $rf_piny = $3;
    my $rf_dfns = $4;

    # Traditional and simplified reading fields are as-is strings
    $rf_trad = "$rf_trad";
    $rf_simp = "$rf_simp";
    
    # Begin by trimming leading and trailing whitespace from pinyin
    # string
    $rf_piny = "$rf_piny";
    $rf_piny =~ s/^[ \t]+//gu;
    $rf_piny =~ s/[ \t]+$//gu;
    
    # Split pinyin reading into entities according to whitespace
    # separators
    my @pya = split " ", $rf_piny;
    
    # For definitions string, split by "/" marks (the opening and
    # closing slash marks are not included in the definitions string)
    my @dfa = split /\//, $rf_dfns;
    
    # Trim each definition of leading and trailing whitespace
    for(my $i = 0; $i <= $#dfa; $i++) {
      $dfa[$i] =~ s/^[ \t]+//gu;
      $dfa[$i] =~ s/[ \t]+$//gu;
    }

    # Push the dictionary record to the end of the dictionary array
    push @$dm, ([$rf_trad, $rf_simp, \@pya, \@dfa]);
  }
  
  # Close the dictionary file
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
  if ($p eq "-cedict") { # ---------------------------------------------
    # Make sure at least one extra parameter
    ($i < $#ARGV) or die "-cedict requires parameter, stopped";
    
    # Advance to next parameter and get it
    $i++;
    $p = $ARGV[$i];
    
    # Check that parameter not already defined
    (not exists $script_param{'cedict'}) or 
      die "-cedict defined twice, stopped";
    
    # Check that file exists
    (-f $p) or die "Can't find file '$p', stopped";
    
    # Store parameter
    $script_param{'cedict'} = "$p";
    
  } else { # -----------------------------------------------------------
    die "Unrecognized parameter '$p', stopped";
  }
}

# Make sure all necessary parameters are now defined
#
for my $p ('cedict') {
  (exists $script_param{$p}) or
    die "Missing parameter -$p, stopped";
}

# Import the CC-CEDICT dictionary
#
my @dar;
import_dictionary(\@dar, $script_param{'cedict'});

# Make sure table isn't empty
#
($#dar > 0) or die "Word table is empty, stopped";

# Encode table into JSON
#
my $jss = encode_json(\@dar);

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
