#!/usr/bin/perl

use strict;
use warnings;

use FindBin qw($Bin);
use lib "$Bin/../lib";

use Getopt::Long;
use Bio::DB::SeqFeature::Store;
use JsonGenerator;

my ($path, $trackLabel, $key, $cssClass);
my $autocomplete = "none";
my $tiledir = "tiles";
my $outdir = "data";
my ($getType, $getPhase, $getSubs, $getLabel) = (0, 0, 0, 0);
my $fgColor = "0,0,0";
my $bgColor = "255,255,255";
my $tileWidth = 4000;
my $trackHeight = 100;

my $wig2png = "$Bin/wig2png";
unless (-x $wig2png) {
    die "Can't find binary executable $wig2png (try typing 'make' in jbrowse root directory?)";
}

my $usage = <<USAGE;
 USAGE: $0 --wig <wiggle file> [--tile <tiles directory>] [--out <JSON directory>] [--tracklabel <track identifier>] [--key <human-readable track name>] [--bgcolor <R,G,B>] [--fgcolor <R,G,B>] [--width <tile width>] [--height <tile height>]

    --tile: defaults to "$tiledir"
    --out: defaults to "$outdir"
    --tracklabel: defaults to wiggle filename
    --key: defaults to track label
    --bgcolor: defaults to "$bgColor"
    --fgcolor: defaults to "$fgColor"
    --width: defaults to $tileWidth
    --height: defaults to $trackHeight
USAGE

GetOptions("wig=s" => \$path,
	   "tile=s" => \$tiledir,
	   "out=s" => \$outdir,
	   "tracklabel=s" => \$trackLabel,
	   "key=s" => \$key,
	   "bgcolor=s" => \$bgColor,
	   "fgcolor=s" => \$fgColor,
	   "width=s" => \$tileWidth,
	   "height=s" => \$trackHeight);

if (!defined($path)) {
    die $usage;
}

my @refSeqs = @{JsonGenerator::readJSON("$outdir/refSeqs.js", [], 1)};
die "run prepare-refseqs.pl first to supply information about your reference sequences" if $#refSeqs < 0;

$trackLabel = $path unless defined $trackLabel;
my $tilesubdir = "$tiledir/$trackLabel";

mkdir($outdir) unless (-d $outdir);
mkdir($tiledir) unless (-d $tiledir);
mkdir($tilesubdir) unless (-d $tilesubdir);

system "$wig2png $path $tiledir $outdir $trackLabel $tileWidth $trackHeight $bgColor $fgColor";

foreach my $seqInfo (@refSeqs) {
    my $seqName = $seqInfo->{"name"};
    print "\nworking on seq $seqName\n";
    mkdir("$tilesubdir/$seqName") unless (-d "$tilesubdir/$seqName");

    JsonGenerator::modifyJSFile("$outdir/trackInfo.js", "trackInfo",
		 sub {
		     my $trackList = shift;
		     my $i;
		     for ($i = 0; $i <= $#{$trackList}; $i++) {
			 last if ($trackList->[$i]->{'label'} eq $trackLabel);
		     }
		     $trackList->[$i] =
		       {
			'label' => $trackLabel,
			'key' => defined($key) ? $key : $trackLabel,
			'url' => "$outdir/{refseq}/$trackLabel.json",
			'type' => "ImageTrack",
		       };
		     return $trackList;
		 });
}

=head1 AUTHORS

Mitchell Skinner E<lt>mitch_skinner@berkeley.eduE<gt>
Ian Holmes E<lt>ihh@berkeley.eduE<gt>

Copyright (c) 2007-2009 The Evolutionary Software Foundation

This package and its accompanying libraries are free software; you can
redistribute it and/or modify it under the terms of the LGPL (either
version 2.1, or at your option, any later version) or the Artistic
License 2.0.  Refer to LICENSE for the full license text.

=cut
