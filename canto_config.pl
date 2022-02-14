#!/usr/bin/env perl
use strict;
use feature 'unicode_strings';
use warnings FATAL => "utf8";

# Non-core dependencies
#
use JSON::Tiny qw(encode_json);

=head1 NAME

canto_config.pl - Compile a JavaScript configuration file for Cantotype.

=head1 SYNOPSIS

  canto_config.pl /url/to/index.gz /url/to/sql/ > cantotype_config.js

=head1 DESCRIPTION

Cantotype needs a JavaScript configuration file that is specific to the
installation to run.  This Perl script will generate the necessary
configuration file.

Only two parameters are needed.  The first parameter is the URL to the
Cantotype data index file.  This is a GZip file that stores a JSON
object that defines where all the data files that need to be loaded into
the database should be downloaded from.

The second parameter is used during the initialization of sql.js to
define the locateFile function, which locates files needed by sql.js.
The locateFile function will take the filename given as input and prefix
this parameter value to it to form the returned URL.

This script prints out the configuration file for Cantotype.  This file
must be named C<cantotype_config.js> and placed in the same directory as
the main HTML file for the webapp so that it can be loaded during
initialization.

The configuration file is a JavaScript source file that defines a global
variable named C<canto_config>.  This variable is a JavaScript object
that has properties C<data_index_url> and C<sql_file_base> corresponding
to the URL of the data index file and the URL prefix for SQL files,
respectively.

=cut

# ==================
# Program entrypoint
# ==================

# Check that we got two parameters
#
($#ARGV == 1) or die "Wrong number of parameters, stopped";

# Store the parameters
#
my $arg_index = $ARGV[0];
my $arg_sql   = $ARGV[1];

# Generate the configuration object
#
my %config_obj;

$config_obj{"data_index_url"} = "$arg_index";
$config_obj{"sql_file_base"}  = "$arg_sql";

# Generate the JSON for the configuration object
#
my $js = encode_json(\%config_obj);

# Print the configuration script
#
print "var canto_config = $js;\n";

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
