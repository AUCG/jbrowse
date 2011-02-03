package BioperlFlattener;

use strict;
use warnings;
use JsonGenerator;

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

sub new {
    my ($class, $label, $segName, $setStyle,
        $extraMap, $extraHeaders) = @_;

    my %style = ("key" => $label,
                 %builtinDefaults,
		 %$setStyle);

    JsonGenerator::evalSubStrings(\%style);

    my $self = {};

    $self->{style} = \%style;
    $self->{label} = $label;
    $self->{getLabel} = ($style{autocomplete} =~ /label|all/);
    $self->{getAlias} = ($style{autocomplete} =~ /alias|all/);

    my $idSub = $style{idSub} || sub  {
        return $_[0]->can('primary_id') ? $_[0]->primary_id : $_[0]->id;
    };

    my @curFeatMap = @featMap;
    my @curMapHeaders = @mapHeaders;

    unless ($style{noId}) {
        push @curFeatMap, $idSub;
        push @curMapHeaders, "id";
    }

    @curFeatMap = (@curFeatMap, @$extraMap);
    @curMapHeaders = (@curMapHeaders, @$extraHeaders);

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

    #my @allSubfeatures;
    #$self->{allSubfeatures} = \@allSubfeatures;
    #my $subfeatId = $style{idSub} || sub {
    #    return $_[0]->can('primary_id') ? $_[0]->primary_id : $_[0]->id;
    #};
    #if ($autoshareSubs) {
    #    $subfeatId = sub {
    #        my $feat = shift;
    #        return $feat->primary_tag 
    #            . "|" . $feat->start 
    #            . "|" . $feat->end 
    #            . "|" . $feat->strand;
    #    }
    #}
    # %seenSubfeatures is so that shared subfeatures don't end up
    # in @{$self->{allSubfeatures}} more than once
    my %seenSubfeatures;
    if ($style{subfeatures}) {
        push @curFeatMap, sub {
            my ($feat, $flatten) = @_;
            my @flattened;
            my @subFeatures = $feat->get_SeqFeatures;
            return undef unless (@subFeatures);

            my $sfClasses = $style{subfeature_classes};
            my @subfeatIndices;
            foreach my $subFeature (@subFeatures) {
                #filter out subfeatures we don't care about
                #print "type: " . $subFeature->primary_tag . " (" . $sfClasses->{$subFeature->primary_tag} . ")\n";
                #next unless
                #  $sfClasses && $sfClasses->{$subFeature->primary_tag};
                #my $subId = $subfeatId->($subFeature);
                #my $subIndex = $seenSubfeatures{$subId};
                #if (!defined($subIndex)) {
                #    push @allSubfeatures, [map {&$_($subFeature)} @subfeatMap];
                push @flattened, [map {&$_($subFeature)} @subfeatMap];
                #    $subIndex = $#allSubfeatures;
                #    $seenSubfeatures{$subId} = $subIndex;
                #}
                #push @subfeatIndices, $subIndex;
            }
            #return \@subfeatIndices;
            return \@flattened;
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

sub flatten {
    my ($self, $feature) = @_;

    if ($self->{getLabel} || $self->{getAlias}) {
        push @{$self->{names}}, [map {$_->($feature)} @{$self->{nameMap}}];
    }

    return [map {&$_($feature)} @{$self->{curFeatMap}}];
}

sub featureHeaders {
    my ($self) = @_;
    return $self->{curMapHeaders};
}

sub subfeatureHeaders {
    my ($self) = @_;
    return $self->{subfeatHeaders};
}

sub names {
    my ($self) = @_;
    return $self->{names};
}

sub unique {
    my %saw;
    return (grep(defined($_) && !$saw{$_}++, @_));
}

1;
