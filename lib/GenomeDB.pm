package GenomeDB;

use strict;
use warnings;
use File::Spec;

use FeatureTrack;
use JsonFileStorage;

my $defaultTracklist = {
                        formatVersion => 1,
                        tracks => []
                       };

sub new {
    my ($class, $dataDir) = @_;

    my $self = {
                dataDir => $dataDir,
                rootStore => JsonFileStorage->new($dataDir, 0, {pretty => 1}),
                trackDirTempl => File::Spec->join($dataDir, "tracks",
                                                  "{tracklabel}", "{refseq}"),
                trackUrlTempl => File::Spec->join("tracks",
                                                  "{tracklabel}", "{refseq}")
               };
    bless $self, $class;

    return $self;
}

sub trackListPath {
    my ($self) = @_;
    return File::Spec->join($self->{dataDir}, "trackList.json");
}

sub writeTrackEntry {
    my ($self, $track) = @_;

    my $setTrackEntry = sub {
        my ($trackData) = @_;
        unless (defined($trackData)) {
            $trackData = $defaultTracklist;
        }
        # we want to add this track entry to the "tracks" list,
        # replacing any existing entry with the same label,
        # and preserving the original ordering
        my $trackIndex;
        my $trackList = $trackData->{tracks};
        foreach my $index (0..$#{$trackList}) {
            $trackIndex = $index
              if ($trackList->[$index]->{label} eq $track->label);
        }
        $trackIndex = ($#{$trackList} + 1) unless defined($trackIndex);

        $trackList->[$trackIndex] = {
                                     label => $track->label,
                                     key => $track->key,
                                     type => $track->type,
                                     config => $track->config
                                    };
        return $trackData;
    };

    $self->{rootStore}->modify($self->trackListPath, $setTrackEntry);
}

sub createFeatureTrack {
    my ($self, $trackLabel, $config, $key) = @_;
    (my $urlTempl = $self->{trackUrlTempl}) =~ s/\{tracklabel\}/$trackLabel/g;
    $config->{urlTemplate} = $urlTempl;
    return FeatureTrack->new($self->trackDir($trackLabel),
                             $trackLabel, $config, $key);
}

sub getTrack {
    my ($self, $trackLabel) = @_;

    my $trackList = $self->{rootStore}->get($self->trackListPath,
                                            $defaultTracklist);
    my @selected = grep { $_->{label} eq $trackLabel } @{$trackList->{tracks}};

    return undef
      if ($#selected < 0);
    # this should never happen
    die "multiple tracks labeled $trackLabel"
      if $#selected > 0;
    my $trackDesc = $selected[0];
    if ($trackDesc->{type} eq "FeatureTrack") {
        return FeatureTrack->new($self->trackDir($trackLabel),
                                 $trackDesc->{label},
                                 $trackDesc->{config},
                                 $trackDesc->{key});
    }
    die "track type \"" . $trackDesc->{type} . "\" not implemented";
}

sub trackDir {
    my ($self, $trackLabel) = @_;
    (my $result = $self->{trackDirTempl}) =~ s/\{tracklabel\}/$trackLabel/g;
    return $result;
}

# sub startLoad {
#     my ($self, $track, $refName, $chunkBytes,
#         $compress, $classes) = @_;

#                  urlTemplate =>
#                      "tracks/$trackLabel/{refseq}/trackData." . $store->ext,
#     my $outDir = File::Spec->join($self->{dataDir}, "tracks",
#                                   $trackLabel, $refName);
#     return TrackLoad->new($self, $outDir, $chunkBytes, $compress, $classes);
# }

#sub finishLoad {
#    my ($self, $trackLoad) = @_;
#}


1;

=head1 AUTHOR

Mitchell Skinner E<lt>jbrowse@arctur.usE<gt>

Copyright (c) 2007-2011 The Evolutionary Software Foundation

This package and its accompanying libraries are free software; you can
redistribute it and/or modify it under the terms of the LGPL (either
version 2.1, or at your option, any later version) or the Artistic
License 2.0.  Refer to LICENSE for the full license text.

=cut
