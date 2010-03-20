package JsonGenerator;

use base 'Exporter';
our @EXPORT_OK = qw/ readJSON writeJSON modifyJSFile /;

use strict;
use warnings;

use NCList;
use JSON 2;
use IO::File;
use Fcntl ":flock";
use POSIX qw(ceil floor);

#in JSON, features are represented by arrays (we could use
#hashes, but then we'd have e.g. "start" and "end" in the JSON
#for every feature, which would take up too much space/bandwidth)
#@featMap maps from feature objects to arrays
my @featMap = (
	       sub {shift->start - 1},
	       sub {int(shift->end)},
	       sub {int(shift->strand)},
	      );
my @mapHeaders = ('start', 'end', 'strand');
#positions of "start" and "end" in @mapHeaders (for NCList)
my $startIndex = 0;
my $endIndex = 1;
#position of the lazy subfeature file name in the fake feature.
my $lazyIndex = 2;

sub featureLabelSub {
    return $_[0]->display_name if $_[0]->can('display_name');
    return $_[0]->info         if $_[0]->can('info'); # deprecated
    return $_[0]->seq_id       if $_[0]->can('seq_id');
    return eval{$_[0]->primary_tag};
}

my %builtinDefaults =
  (
   "label"        => \&featureLabelSub,
   "autocomplete" => "none",
   "class"        => "feature"
  );

sub unique {
    my %saw;
    return (grep(defined($_) && !$saw{$_}++, @_));
}

sub readJSON {
    my ($file, $default, $skipAssign) = @_;
    if (-s $file) {
        my $OLDSEP = $/;
        my $fh = new IO::File $file, O_RDONLY
            or die "couldn't open $file: $!";
        flock $fh, LOCK_SH;
        # optionally skip variable assignment line
        $fh->getline() if $skipAssign;
        undef $/;
        $default = JSON::from_json(<$fh>);
        $fh->close()
            or die "couldn't close $file: $!";
        $/ = $OLDSEP;
    }
    return $default;
}

sub writeJSON {
    my ($file, $toWrite, $opts) = @_;

    # create JSON object
    my $json = new JSON;
    # set opts
    if (defined($opts) and ref($opts) eq 'HASH') {
        for my $method (keys %$opts) {
            $json->$method( $opts->{$method} );
        }
    }

    # check depth
    my $depth = findDepth($toWrite);
    my $maxDepth = $json->get_max_depth;
    if ($depth >= $maxDepth) {
	my @deepPath = @{deepestPath($toWrite)};
	my $warning = "WARNING: found deep path (depth = " . $depth . ", max depth allowed = " . $maxDepth . ")\n";
	warn $warning;
	for my $n (0..$#deepPath) {
	    my $elem = $deepPath[$n];
	    my $type = ref($elem);
	    if ($type eq 'HASH') {
		warn $n, ": { ", join(", ", map("$_ => $$elem{$_}", keys %$elem)), " }\n";
	    } elsif ($type eq 'ARRAY') {
		warn $n, ": [ ", join(", ", map(defined($_) ? $_ : "undef", @$elem)), " ]\n";
	    } else {
		warn $n, ": ", $elem, "\n";
	    }
	}
	warn $warning;  # repeat the warning after printing the trace
    }

    # write
    my $fh = new IO::File $file, O_WRONLY | O_CREAT
      or die "couldn't open $file: $!";
    flock $fh, LOCK_EX;
    $fh->seek(0, SEEK_SET);
    $fh->truncate(0);
    $fh->print($json->encode($toWrite));
    $fh->close()
      or die "couldn't close $file: $!";
}

sub modifyJSFile {
    my ($file, $varName, $callback) = @_;
    my ($data, $assign);
    my $fh = new IO::File $file, O_RDWR | O_CREAT
      or die "couldn't open $file: $!";
    flock $fh, LOCK_EX;
    # if the file is non-empty,
    if (($fh->stat())[7] > 0) {
        # get variable assignment line
        $assign = $fh->getline();
        # get data
        my $jsonString = join("", $fh->getlines());
        $data = JSON::from_json($jsonString) if (length($jsonString) > 0);
        # prepare file for re-writing
        $fh->seek(0, SEEK_SET);
        $fh->truncate(0);
    }
    # add assignment line
    $fh->print("$varName = \n");
    # modify data, write back
    $fh->print(JSON::to_json($callback->($data), {pretty => 1}));
    $fh->close()
      or die "couldn't close $file: $!";
}

# turn perl subs from the config file into callable functions
sub evalSubStrings {
    my $hashref = shift;
    foreach my $key (keys %{$hashref}) {
        next if ("CODE" eq (ref $hashref->{$key}));

        if ("HASH" eq (ref $hashref->{$key})) {
            evalSubStrings($hashref->{$key});
        } else {
            $hashref->{$key} = eval($hashref->{$key})
              if (defined($hashref->{$key}) && $hashref->{$key} =~ /^\s*sub\s*{.*}\s*$/);
        }
    }
}

sub new {
    my ($class, $label, $segName, $setStyle,
        $extraMap, $extraHeaders,
        $autoshareSubs) = @_;

    my %style = ("key" => $label,
                 %builtinDefaults,
		 %$setStyle);

    evalSubStrings(\%style);

    my $self = {};

    $self->{style} = \%style;
    $self->{label} = $label;
    $self->{getLabel} = ($style{autocomplete} =~ /label|all/);
    $self->{getAlias} = ($style{autocomplete} =~ /alias|all/);

    my $idSub = $style{idSub} || sub  {
        return $_[0]->can('primary_id') ? $_[0]->primary_id : $_[0]->id;
    };

    my @curFeatMap = (@featMap, $idSub, @$extraMap);
    my @curMapHeaders = (@mapHeaders, "id", @$extraHeaders);

    if ($style{label}) {
	push @curFeatMap, $style{label};
	push @curMapHeaders, "name";
    }

    if ($style{phase}) {
        push @curFeatMap, sub {shift->phase};
        push @curMapHeaders, "phase";
    }

    if ($style{type}) {
        push @curFeatMap, sub {shift->primary_tag};
        push @curMapHeaders, "type";
    }

    if ($style{extraData}) {
        foreach my $extraName (keys %{$style{extraData}}) {
            push @curMapHeaders, $extraName;
            push @curFeatMap, $style{extraData}->{$extraName};
        }
    }

    my @subfeatMap = (@featMap, sub {shift->primary_tag});
    my @subfeatHeaders = (@mapHeaders, "type");

    my @allSubfeatures;
    $self->{allSubfeatures} = \@allSubfeatures;
    my $subfeatId = $style{idSub} || sub {
        return $_[0]->can('primary_id') ? $_[0]->primary_id : $_[0]->id;
    };
    if ($autoshareSubs) {
        $subfeatId = sub {
            my $feat = shift;
            return $feat->primary_tag 
                . "|" . $feat->start 
                . "|" . $feat->end 
                . "|" . $feat->strand;
        }
    }
    # %seenSubfeatures is so that shared subfeatures don't end up
    # in @{$self->{allSubfeatures}} more than once
    my %seenSubfeatures;
    if ($style{subfeatures}) {
        push @curFeatMap, sub {
            my ($feat, $flatten) = @_;
            my @subFeatures = $feat->get_SeqFeatures;
            return undef unless (@subFeatures);

            my $sfClasses = $style{subfeature_classes};
            my @subfeatIndices;
            foreach my $subFeature (@subFeatures) {
                #filter out subfeatures we don't care about
                #print "type: " . $subFeature->primary_tag . " (" . $sfClasses->{$subFeature->primary_tag} . ")\n";
                next unless
                  $sfClasses && $sfClasses->{$subFeature->primary_tag};
                my $subId = $subfeatId->($subFeature);
                my $subIndex = $seenSubfeatures{$subId};
                if (!defined($subIndex)) {
                    push @allSubfeatures, [map {&$_($subFeature)} @subfeatMap];
                    $subIndex = $#allSubfeatures;
                    $seenSubfeatures{$subId} = $subIndex;
                }
                push @subfeatIndices, $subIndex;
            }
            return \@subfeatIndices;
        };
        push @curMapHeaders, 'subfeatures';
    }

    my @nameMap =
      (
       sub {$label},
       $style{label},
       sub {$segName},
       sub {int(shift->start) - 1},
       sub {int(shift->end)},
       sub {$_[0]->can('primary_id') ? $_[0]->primary_id : $_[0]->id}
      );

    if ($self->{getLabel} || $self->{getAlias}) {
	if ($self->{getLabel} && $self->{getAlias}) {
	    unshift @nameMap, sub {[unique($style{label}->($_[0]),
					   $_[0]->attributes("Alias"))]};
	} elsif ($self->{getLabel}) {
	    unshift @nameMap, sub {[$style{label}->($_[0])]};
	} elsif ($self->{getAlias}) {
	    unshift @nameMap, sub {[$_[0]->attributes("Alias")]};
	}
    }

    $self->{sublistIndex} = $#curFeatMap + 1;

    $self->{nameMap} = \@nameMap;
    $self->{curFeatMap} = \@curFeatMap;
    $self->{curMapHeaders} = \@curMapHeaders;
    $self->{subfeatMap} = \@subfeatMap;
    $self->{subfeatHeaders} = \@subfeatHeaders;
    $self->{features} = [];
    $self->{names} = [];

    bless $self, $class;
}

sub addFeature {
    my ($self, $feature) = @_;

    if ($self->{getLabel} || $self->{getAlias}) {
        push @{$self->{names}}, [map {$_->($feature)} @{$self->{nameMap}}];
    }

    push @{$self->{features}}, [map {&$_($feature)} @{$self->{curFeatMap}}]
}

sub featureCount {
    my ($self) = @_;
    return $#{$self->{features}} + 1;
}

sub hasFeatures {
    my ($self) = @_;
    return $#{$self->{features}} >= 0;
}

sub generateTrack {
    my ($self, $outDir, $subfeatureLimit, $featureLimit,
        $refStart, $refEnd) = @_;

    mkdir($outDir) unless (-d $outDir);
    unlink (glob "$outDir/lazyfeatures*");
    unlink (glob "$outDir/subfeatures*");
    writeJSON("$outDir/names.json", $self->{names}, {pretty => 0})
        if ($self->{getLabel} || $self->{getAlias});

    my @sortedFeatures = sort {
	if ($a->[$startIndex] != $b->[$startIndex]) {
	    $a->[$startIndex] - $b->[$startIndex];
	} else {
	    $b->[$endIndex] - $a->[$endIndex];
	}
    } @{$self->{features}};

    my $histBinBases = 1000;
    my @histogram = ((0) x ceil($refEnd / $histBinBases));
    foreach my $feat (@sortedFeatures) {
        my $firstBin = int($feat->[$startIndex] / $histBinBases);
        $firstBin = 0 if ($firstBin < 0);
        my $lastBin = int($feat->[$endIndex] / $histBinBases);
        next if ($lastBin < 0);
        for (my $bin = $firstBin; $bin <= $lastBin; $bin++) {
            $histogram[$bin]++;
        }
    }

    #add fake features for chunking
    my @fakeFeatures;
    if (($#sortedFeatures / $featureLimit) > 1.5) {
        #make it so that the chunks are roughly the same size
        $featureLimit = int((($#sortedFeatures + 1)
                              / int((($#sortedFeatures + 1)
                                      / $featureLimit) + .5)) + 1);
        #print STDERR "adjusted featureLimit: $featureLimit\n";
        for (my $chunkFirst = 0;
             $chunkFirst < $#sortedFeatures;
             $chunkFirst += $featureLimit) {

            my $chunkLast = $chunkFirst + $featureLimit - 1;
            $chunkLast = $chunkLast > $#sortedFeatures ?
                $#sortedFeatures : $chunkLast;
            #print STDERR "$chunkFirst - $chunkLast\n";
            my $fakeFeature = [];
            $fakeFeature->[$startIndex] =
                $sortedFeatures[$chunkFirst][$startIndex];
            my $maxEnd = 0;
            for (my $i = $chunkFirst; $i <= $chunkLast; $i++) {
                $maxEnd = $sortedFeatures[$i][$endIndex]
                    if $sortedFeatures[$i][$endIndex] > $maxEnd;
            }
            $fakeFeature->[$endIndex] = $maxEnd + 1;
            #print STDERR "(bases " . $fakeFeature->[$startIndex] . " - " . $fakeFeature->[$endIndex] . ")\n";
            $fakeFeature->[$lazyIndex] = {
                'path' => "$outDir/lazyfeatures-" . $chunkFirst . ".json",
                'state' => "lazy"
            };
            push @fakeFeatures, $fakeFeature;
        }
    }

    push @sortedFeatures, @fakeFeatures;

    my $featList = NCList->new($startIndex, $endIndex,
                               $self->{sublistIndex}, \@sortedFeatures);

    #strip out subtrees (have to do this before we start writing out
    # subtrees in case one subtree is within another subtree)
    my %subTrees;
    foreach my $fake (@fakeFeatures) {
        if (!defined($fake->[$self->{sublistIndex}])) {
            warn "feature chunk " . $fake->[$startIndex] . " .. " . $fake->[$endIndex] . " ended up empty (that's OK, just sub-optimal)\n";
            $fake->[$lazyIndex]->{state} = "loaded";
        } else {
            $subTrees{$fake->[$lazyIndex]->{path}} =
                $fake->[$self->{sublistIndex}];
            $fake->[$self->{sublistIndex}] = undef;
        }
    }

    foreach my $path (keys %subTrees) {
        writeJSON($path,
                  $subTrees{$path},
                  {pretty => 0});
    }

    my $rangeMap = [];
    if ($self->{style}->{subfeatures} && (@{$self->{allSubfeatures}})) {
        #chunk subfeatures
        my $firstIndex = 0;
        my $subFile = 1;
        while ($firstIndex < $#{$self->{allSubfeatures}}) {
            my $lastIndex = $firstIndex + $subfeatureLimit - 1;
            $lastIndex = $#{$self->{allSubfeatures}}
              if $lastIndex > $#{$self->{allSubfeatures}};
            writeJSON("$outDir/subfeatures-$subFile.json",
                      [@{$self->{allSubfeatures}}[$firstIndex..$lastIndex]],
                      {pretty => 0});
            push @$rangeMap, {start => int($firstIndex),
                              end   => int($lastIndex),
                              url   => "$outDir/subfeatures-$subFile.json"};
            $subFile++;
            $firstIndex = $lastIndex + 1;
        }
    }

    #use Data::Dumper;
    #$Data::Dumper::Maxdepth = 2;
    #print Dumper($featList->{'topList'});
    my $trackData = {
                     'label' => $self->{label},
                     'key' => $self->{style}->{key},
                     'sublistIndex' => $self->{sublistIndex},
                     'lazyIndex' => $lazyIndex,
                     'headers' => $self->{curMapHeaders},
                     'featureCount' => $#{$self->{features}} + 1,
                     'type' => "FeatureTrack",
                     'className' => $self->{style}->{class},
                     'subfeatureClasses' => $self->{style}->{subfeature_classes},
                     'arrowheadClass' => $self->{style}->{arrowheadClass},
                     'clientConfig' => $self->{style}->{clientConfig},
                     'featureNCList' => $featList->nestedList,
                     'rangeMap' => $rangeMap,
                     'subfeatureHeaders' => $self->{subfeatHeaders},
                     'histogram' => \@histogram,
                     'histBinBases' => $histBinBases
                    };
    $trackData->{urlTemplate} = $self->{style}->{urlTemplate}
      if defined($self->{style}->{urlTemplate});
    writeJSON("$outDir/trackData.json",
              $trackData,
              {pretty => 0, max_depth => 2048});
}

# findDepth returns the depth of the deepest element(s) in the structure
# the code is the iterative form of findDepth($obj) = 1 + max(map(findDepth($_), childArray($obj)))
# where childArray($obj) = values(%$obj) [for a hash], @$obj [for an array] or the empty list [for a scalar]
sub findDepth {
    my ($obj) = @_;
    my ($depth, $childArray, $childIndex);
    my @stack;

  FD_NEW_OBJ:
    my $type = ref($obj);
    $childArray = $type eq 'HASH' ? [values %$obj] : ($type eq 'ARRAY' ? $obj : []);
    $depth = 0;
    $childIndex = 0;
  FD_CHILD_LOOP:
    if ($childIndex < @$childArray) {
	push @stack, [$depth, $childArray, $childIndex];
	$obj = $childArray->[$childIndex];
	goto FD_NEW_OBJ;
    } elsif (@stack) {
	my $childDepth = $depth + 1;
	my $vars = pop @stack;
	($depth, $childArray, $childIndex) = @$vars;
	if ($childDepth > $depth) {
	    $depth = $childDepth;
	}
	++$childIndex;
	goto FD_CHILD_LOOP;
    }

    return $depth + 1;
}

# deepestPath returns the path to (the first of) the deepest element(s) in the structure
# the code is the iterative form of deepestPath($obj) = ($obj, longest(map(deepestPath($_), childArray($obj))))
# where childArray($obj) = values(%$obj) [for a hash], @$obj [for an array] or the empty list [for a scalar]
# and longest(@x1, @x2, ... @xn) returns the longest of the given arrays (or the first such, in the event of a tie)
sub deepestPath {
    my ($obj) = @_;
    my ($trace, $childArray, $childIndex);
    my @stack;

  DP_NEW_OBJ:
    my $type = ref($obj);
    $childArray = $type eq 'HASH' ? [values %$obj] : ($type eq 'ARRAY' ? $obj : []);
    $trace = [];
    $childIndex = 0;
  DP_CHILD_LOOP:
    if ($childIndex < @$childArray) {
	push @stack, [$obj, $trace, $childArray, $childIndex];
	$obj = $childArray->[$childIndex];
	goto DP_NEW_OBJ;
    } elsif (@stack) {
	my $childTrace = [$obj, @$trace];
	my $vars = pop @stack;
	($obj, $trace, $childArray, $childIndex) = @$vars;
	if (@$childTrace > @$trace) {
	    $trace = $childTrace;
	}
	++$childIndex;
	goto DP_CHILD_LOOP;
    }

    return [$obj, @$trace];
}

1;

=head1 AUTHOR

Mitchell Skinner E<lt>mitch_skinner@berkeley.eduE<gt>

Copyright (c) 2007-2009 The Evolutionary Software Foundation

This package and its accompanying libraries are free software; you can
redistribute it and/or modify it under the terms of the LGPL (either
version 2.1, or at your option, any later version) or the Artistic
License 2.0.  Refer to LICENSE for the full license text.

=cut
