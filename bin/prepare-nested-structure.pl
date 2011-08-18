#!/usr/bin/env perl

use strict;
use warnings;

use FindBin qw($Bin);
use lib "$Bin/../lib";

use Getopt::Long;
use JsonGenerator;
use Data::Dumper;

my $confFile;
my $outdir = "data";
GetOptions("conf=s" => \$confFile,
           "out=s" => $outdir);

my %categories;
my @seqTracks;
my %definedTracks;
my @rootChildren = ('Favourites');
my %seq;

my $trackRel = "tracks";
my $trackDir = "$outdir/$trackRel";
mkdir($outdir) unless (-d $outdir);
mkdir($trackDir) unless (-d $trackDir);

my @refSeqs = @{JsonGenerator::readJSON("$outdir/refSeqs.js", [], 1)};
die "run prepare-refseqs.pl first to supply information about your reference sequences" if $#refSeqs < 0;
my @trackInfo = @{JsonGenerator::readJSON("$outdir/trackInfo.js", [], 1)};
die "run biodb-to-json.pl first to supply information about your track sequences" if $#trackInfo < 0;

foreach my $track (@trackInfo) {
    if($track->{"type"} eq "SequenceTrack") {
        if($categories{'SequenceTrack'}) {
            push @{$categories{'SequenceTrack'}}, $track->{"key"};
        }
        else {
            $categories{'SequenceTrack'} = [$track->{"key"}];
        }
        $definedTracks{$track->{"key"}} = 2;
        $seq{$track->{"key"}} = 1;
    }
    else {
        $definedTracks{$track->{"key"}} = 1;
    }
}

$definedTracks{'ROOT'} = 3;
$definedTracks{'General'} = 3;
$definedTracks{'Favourites'} = 3;

if($confFile) {

    my $config = JsonGenerator::readJSON($confFile);

    eval "require $config->{db_adaptor}; 1" or die $@;

    my $db = eval {$config->{db_adaptor}->new(%{$config->{db_args}})} or warn $@;
    die "Could not open database: $@" unless $db;

    $db->strict_bounds_checking(1) if $db->can('strict_bounds_checking');
    $db->absolute(1)               if $db->can('absolute');

    my @tracks = @{$config->{tracks}};
    foreach my $track (@tracks) {
        my $group;
        if(! $track->{"category"}) {
            $group = "General";
        }
        else {
            $group = $track->{"category"};
        }

        my $ref = $track->{"track"};

        if(!$definedTracks{$ref}) {
            warn "track " . $ref . " is not defined in trackInfo.js";
        }
        elsif($definedTracks{$ref} == 2) {
            warn "track " . $ref . " is duplicated";
        }
        if($categories{$group}) {
            push @{$categories{$group}}, $ref;
        }
        else {
           $categories{$group} = [$ref];
        }
        $definedTracks{$ref} = 2;
    }
}
else {
    foreach my $track (@trackInfo) {
        my $group = "General";
        my $ref = $track->{"key"};
        if((!$seq{$ref}) && ($track->{"type"} ne "TrackGroup") && ($track->{"type"} ne "ROOT")) {
            if($categories{$group}) {
                push @{$categories{$group}}, $ref;
            }
            else {
                $categories{$group} = [$ref];
            }
        }
        $definedTracks{$ref} = 2;
    }
}

foreach my $category (keys %categories) {
    my @children_ref = ();
    foreach my $track (@{ $categories{$category} }) {
        push @children_ref, { '_reference' => $track};
    }
    JsonGenerator::writeTrackEntry("$outdir/trackInfo.js",
                                   {
                                       'label' => $category,
                                       'key' => $category,
                                       'type' => "TrackGroup",
                                       'children' => \@children_ref
                                   });
    push @rootChildren, $category;
    $definedTracks{$category} = 3;
}

foreach my $track (keys %definedTracks) {
    if($definedTracks{$track} == 1) {  warn "track ". $track . " is not in a category"; }
}

JsonGenerator::writeTrackEntry("$outdir/trackInfo.js",
                               {
                                   'label' => 'Favourites',
                                   'key' => 'Favourites',
                                   'type' => 'TrackGroup',
                               });

my @children_ref = ();
foreach my $child (@rootChildren) {
    push @children_ref, { '_reference' => $child};
}
JsonGenerator::writeTrackEntry("$outdir/trackInfo.js",
                               {
                                   'label' => 'ROOT',
                                   'key' => 'ROOT',
                                   'type' => 'ROOT',
                                   'children' => \@children_ref
                               });

