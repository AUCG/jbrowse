var Browser = {};
Browser.init = function(elemId, trackListId) {
    var viewElem = dojo.byId(elemId);
    //var refSeq = {start: 0, end: 27905053, length: function() {return this.end - this.start}};
    var refSeq = {start: -224036, end: 27905053, length: function() {return this.end - this.start}};
    var zoomLevel = 1/50;
    var zoomCookie = dojo.cookie("zoom");
    if (zoomCookie) 
	zoomLevel = parseFloat(zoomCookie);

    var location = ((refSeq.end + refSeq.start) / 2) | 0;
    var locCookie = dojo.cookie("location");
    if (locCookie)
	location = parseInt(locCookie);
    if (isNaN(location))
	location = ((refSeq.end + refSeq.start) / 2) | 0;
    var gv = new GenomeView(viewElem, 250, 
			    refSeq.start, refSeq.end,
			    zoomLevel, location);
    gv.setY(0);
    viewElem.view = gv;
    //var trackNum = 0;
    //gv.showWait();
//     gv.addTrack(new ImageTrack("Gene_Image", "Gene Image", refSeq, 1000, 
//                                [
//                                 {basesPerTile: 100, height: 68, urlPrefix: "tiles/3R/Genes/100bp/"},
//                                 {basesPerTile: 200, height: 64, urlPrefix: "tiles/3R/Genes/200bp/"},
//                                 {basesPerTile: 500, height: 68, urlPrefix: "tiles/3R/Genes/500bp/"},
//                                 {basesPerTile: 1000, height: 68, urlPrefix: "tiles/3R/Genes/1kbp/"},
//                                 {basesPerTile: 2000, height: 68, urlPrefix: "tiles/3R/Genes/2kbp/"},
//                                 {basesPerTile: 5000, height: 68, urlPrefix: "tiles/3R/Genes/5kbp/"},
//                                 {basesPerTile: 10000, height: 80, urlPrefix: "tiles/3R/Genes/10kbp/"},
//                                 {basesPerTile: 20000, height: 100, urlPrefix: "tiles/3R/Genes/20kbp/"},
//                                 {basesPerTile: 50000, height: 140, urlPrefix: "tiles/3R/Genes/50kbp/"},
//                                 {basesPerTile: 100000, height: 180, urlPrefix: "tiles/3R/Genes/100kbp/"},
//                                 {basesPerTile: 200000, height: 240, urlPrefix: "tiles/3R/Genes/200kbp/"},
//                                 {basesPerTile: 500000, height: 47, urlPrefix: "tiles/3R/Genes/500kbp/"},
//                                 {basesPerTile: 1000000, height: 55, urlPrefix: "tiles/3R/Genes/1Mbp/"},
//                                 {basesPerTile: 2000000, height: 71, urlPrefix: "tiles/3R/Genes/2Mbp/"},
//                                 {basesPerTile: 5000000, height: 208.5, urlPrefix: "tiles/3R/Genes/5Mbp/"},
//                                 {basesPerTile: 10000000, height: 208.5, urlPrefix: "tiles/3R/Genes/10Mbp/"}
//                                 ]));

   
    var changeCallback = function() {
	gv.showVisibleBlocks(true);
    }

    var trackListCreate = function(track, hint) {
	var node = document.createElement("div");
	node.className = "tracklist-label";
	node.appendChild(document.createTextNode(track.key));
	//in the list, wrap the list item in a container for
	//border drag-insertion-point monkeying
	if ("avatar" != hint) {
	    var container = document.createElement("div");
	    container.className = "tracklist-container";
	    container.appendChild(node);
	    node = container;
	}
	node.id = dojo.dnd.getUniqueId();
	return {node: node, data: track, type: ["track"]};
    }
    var tracks = new dojo.dnd.Source(trackListId, {creator: trackListCreate,
						   accept: ["track"],
						   withHandles: false});

    var trackCreate = function(track, hint) {
	var node;
	if ("avatar" == hint) {
	    return trackListCreate(track, hint);
	} else {
	    node = gv.addTrack(new SimpleFeatureTrack(track, refSeq, changeCallback, gv.trackPadding));
	}
	return {node: node, data: track, type: ["track"]};
    }
    var gvSource = new dojo.dnd.Source(gv.container, {creator: trackCreate,
						      accept: ["track"],
						      withHandles: true});
    dojo.subscribe("/dnd/drop", function(source,nodes,iscopy){
	    var trackLabels = dojo.map(gv.trackList(),
				       function(track) { return track.name; });
	    dojo.cookie("tracks", trackLabels.join(","), {expires: 60});
	    gv.showVisibleBlocks();
	    //multi-select too confusing?
	    //gvSource.selectNone();
	});

    var oldTrackList = dojo.cookie("tracks");
    if (oldTrackList) {
	var oldTrackNames = oldTrackList.split(",");
	var insertList = [];
	var availList = [];
	dojo.forEach(trackList, function(trackInfo) {
		var i = dojo.indexOf(oldTrackNames, trackInfo.label);
		if (i >= 0)
		    //preserve oldTrackNames ordering
		    insertList[i] = trackInfo;
		else
		    availList.push(trackInfo);
	    });
	gvSource.insertNodes(false, insertList);
	tracks.insertNodes(false, availList);
    } else {
	tracks.insertNodes(false, trackList);
    }

    dojo.connect(dijit.byId("browserPane"), "resize", function() {
            gv.sizeInit();
	});

}
