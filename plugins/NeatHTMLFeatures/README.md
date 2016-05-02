#NeatHTMLFeatures - a JBrowse plugin.

It applies intron hats and a gradient 'tubular' look to features and subfeatures of HTMLFeatures tracks.
This is refactored from HTMLFeaturesEx.js implementation and the insertion/modification to DOM elements are done out-of-band,
due to difference between HTMLFeatures and DragableHTMLFeatures feature DOMs.

What it does:
- draws intron hats and inverted hats for reverse direction features.
- it applies a gradient 'tubular' look to features and subfeatures, inheriting the feature colors and properties.
- modifies UTR to be a outlined box, inheriting the original color.
- generally functional in stand-alone JBrowse.
- special considerations have been made for the unique way Web Apollo renders it's nested subfeatures.


##Install / Activate:

For JBrowse 1.11.6+, copy the NeatHTMLFeatures directory to the 'plugins' directory.
Add this to appropriate trackList.json under the plugins section (create one if it doesn't exist):

    "plugins": [ 
        'NeatHTMLFeatures'
    ],

For Apollo 2.x, copy the NeatHTMLFeatures directory to the web-apps/jbrowse/plugins directory.
Add this to web-apps/jbrowse/plugins/WebApollo/json/annot.json:

    "plugins" : [
      {
         "location" : "./plugins/WebApollo",
         "name" : "WebApollo"
      },
	  {
		 "location" : "./plugins/NeatHTMLFeatures",
		 "name" : "NeatHTMLFeatures"
	  }
    ],


#Config Options:
Introns remain ON for all feature tracks.
Gradient Features are ON by default, but can be disabled.

They can be turned off globally in the config file by setting gradientFeatures = 0 in the plugin definition, for example:

    "plugins": [
        {
            "name": "NeatHTMLFeatures",
            "gradientFeatures": 0
        }
    ],

When gradientFeatures = 0 (globally off) in the plugins definition, gradient features can be enabled on per track basis with gradientFeatures = 1 in the track configuration, for example:

    "tracks": [
        {
            ...
            "type" : "FeatureTrack",
            "label" : "ReadingFrame",
            "gradientFeatures" : 1,
            ...
        }
    ]
