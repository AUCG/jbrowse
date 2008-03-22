
function SimpleFeatureTrack(name, featArray, className, levelHeight, refSeq,
			    histScale, labelScale, padding) {
    //className: CSS class for the features
    //padding: min pixels between each feature horizontally

    Track.call(this, name);
    this.count = featArray.length;
    this.features = new NCList(featArray, featArray[0].length);
    //this.features.sort(function(a, b) {return a.start - b.start;});
    //this.features.sort(function(a, b) {return a[0] - b[0];});
    this.className = className;
    this.levelHeight = levelHeight;
    this.refSeq = refSeq;
    this.histScale = histScale;
    this.labelScale = labelScale;
    this.numBins = 25;
    this.histLabel = false;
    this.padding = padding;
}

SimpleFeatureTrack.prototype = new Track("");

SimpleFeatureTrack.prototype.setViewInfo = function(numBlocks, trackDiv,
                                                    labelDiv, widthPct,
                                                    widthPx) {
    Track.prototype.setViewInfo.apply(this, [numBlocks, trackDiv, labelDiv,
                                             widthPct, widthPx]);
    this.setLabel(this.name);
}

SimpleFeatureTrack.prototype.getFeatures = function(startBase, endBase) {
    var result = Array();
    var f = this.features;
    var i;
    try {
        for (i = 0, len = f.length; i < len; i++) {
            //if ((f[i].end >= startBase) && (f[i].start <= endBase))
            if ((f[i][1] >= startBase) && (f[i][0] <= endBase))
                result.push(f[i]);
        }
    } catch(e) {
        alert(e.message + "\ni: " + i + "\nf.length: " + f.length + "\n" + Object.toJSON(f[i]));
    }
    return result;
}

SimpleFeatureTrack.prototype.fillHist = function(block, leftBase, rightBase,
						 stripeWidth) {
    var hist = this.features.histogram(leftBase, rightBase, this.numBins);
    //console.log(hist);
    var maxBin = 0;
    for (var bin = 0; bin < this.numBins; bin++)
	maxBin = Math.max(maxBin, hist[bin]);
    var binDiv;
    for (var bin = 0; bin < this.numBins; bin++) {
        binDiv = document.createElement("div");
	binDiv.className = "hist-" + this.className;
        binDiv.style.cssText = 
            "left: " + ((bin / this.numBins) * 100) + "%; "
            + "height: " + (2 * hist[bin]) + "px;"
	    + "bottom: 0px;"// + this.trackPadding + "px;"
            + "width: " + (((1 / this.numBins) * 100) - (100 / stripeWidth)) + "%;";
        if (Util.is_ie6) binDiv.appendChild(document.createComment());
        block.appendChild(binDiv);
    }
    //TODO: come up with a better method for scaling than 2 px per count
    return 2 * maxBin;
}

SimpleFeatureTrack.prototype.endZoom = function(destScale, destBlockBases) {
    if (destScale < this.histScale) {
        this.setLabel(this.name + "<br>per " + Math.round(destBlockBases / this.numBins) + "bp");
    } else {
        this.setLabel(this.name);
    }
    this.clear();
}

SimpleFeatureTrack.prototype.fillBlock = function(block, leftBlock, rightBlock, leftBase, rightBase, scale, stripeWidth) {
    //console.log("scale: %d, histScale: %d", scale, this.histScale);
    if (scale < this.histScale) {
        //this.setLabel(this.name + "<br>per " + Math.round((rightBase - leftBase) / this.numBins) + "bp");
	return this.fillHist(block, leftBase, rightBase, stripeWidth);
    } else {
        //this.setLabel(this.name);
	return this.fillFeatures(block, leftBlock, rightBlock, 
				 leftBase, rightBase, scale);
    }
}

SimpleFeatureTrack.prototype.transfer = function(sourceBlock, destBlock) {
    //transfer(sourceBlock, destBlock) is called when sourceBlock gets deleted.
    //Any child features of sourceBlock that extend onto destBlock should get
    //moved onto destBlock.

    if (!(sourceBlock && destBlock)) return;

    var sourceSlots;
    if (sourceBlock.startBase < destBlock.startBase)
	sourceSlots = sourceBlock.rightSlots;
    else
	sourceSlots = sourceBlock.leftSlots;

    if (sourceSlots === undefined) return;

    var destLeft = destBlock.startBase;
    var destRight = destBlock.endBase;
    var blockWidth = destRight - destLeft;
    var sourceSlot;

    for (var i = 0; i < sourceSlots.length; i++) {
	//if the feature div in this slot is a child of sourceBlock,
	//and if the feature overlaps destBlock,
	//move to destBlock & re-position
	sourceSlot = sourceSlots[i];
	if (sourceSlot && (sourceSlot.parentNode === sourceBlock)) {
	    if ((sourceSlot.feature[1] > destLeft)
		&& (sourceSlot.feature[0] < destRight)) {
		var featLeft = (100 * (sourceSlot.feature[0] - destLeft) / blockWidth);
		sourceSlot.style.left = featLeft + "%";
		destBlock.appendChild(sourceSlot);
		if ("label" in sourceSlot) {
		    sourceSlot.label.style.left = featLeft + "%";
		    destBlock.appendChild(sourceSlot.label);
		}
	    }
	}
    }	    
}

SimpleFeatureTrack.prototype.fillFeatures = function(block, 
						     leftBlock, rightBlock,
						     leftBase, rightBase,
						     scale) {
    //arguments:
    //block: div to be filled with info
    //leftBlock: div to the left of the block to be filled
    //rightBlock: div to the right of the block to be filled
    //leftBase: starting base of the block
    //rightBase: ending base of the block
    //scale: pixels per base at the current zoom level
    //0-based
    //returns: height of the block, in pixels

    var slots = [];

    //are we filling right-to-left (true) or left-to-right (false)?
    //this affects how we do layout
    var goLeft = false;

    //determine dimensions of labels (height, per-character width)
    if (!("nameHeight" in this)) {
	var heightTest = document.createElement("div");
	heightTest.className = "feature-label";
	heightTest.style.height = "auto";
	heightTest.style.visibility = "hidden";
	heightTest.appendChild(document.createTextNode("1234567890"));
	document.body.appendChild(heightTest);
	this.nameHeight = heightTest.clientHeight;
	this.nameWidth = heightTest.clientWidth / 10;
	document.body.removeChild(heightTest);
    }

    startSlots = new Array();
    if (leftBlock !== undefined) {
        slots = leftBlock.rightSlots.concat();
        block.leftSlots = startSlots;
    } else if (rightBlock !== undefined) {
        slots = rightBlock.leftSlots.concat();
        block.rightSlots = startSlots;
        goLeft = true;
    } else {
	block.leftSlots = startSlots;
    }

    var levelUnits = "px";
    var blockWidth = rightBase - leftBase;
    var maxLevel = 0;

    var callback = function(event) {
	event = event || window.event;
	if (event.shiftKey) return;
	var feat = YAHOO.util.Event.getTarget((event || window.event)).feature;
	alert("clicked on feature\nstart: " + feat[0] +
	      ", end: " + feat[1] +
	      ", strand: " + feat[2] +
	      ", ID: " + feat[3]);
    };

    var featDiv;
    var leftSlots = new Array();
    var glyphHeight = this.levelHeight;
    var levelHeight = this.levelHeight;
    var className = this.className;
    var labelScale = this.labelScale;
    var basePadding = Math.max(1, this.padding / scale);
    var basesPerLabelChar = this.nameWidth / scale;
    if (scale > labelScale) levelHeight += this.nameHeight + (levelHeight >> 1);

    var featCallback = function(feature) {
        var level;
	//featureEnd is how far right the feature extends,
	//including its label if applicable
	var featureEnd = feature[1];
	if (scale > labelScale)
	    featureEnd = Math.max(featureEnd, 
				  feature[0] + (feature[3].length 
						* basesPerLabelChar));
        slotLoop: for (var j = 0; j < slots.length; j++) {
	    if (!slots[j]) {
		level = j;
		break;
	    }
            if (feature === slots[j].feature) {
		if (!startSlots[j]) startSlots[j] = slots[j];
		return; //does this catch all repeats?
	    }
	    var otherEnd = slots[j].feature[1];
	    if (scale > labelScale) otherEnd = Math.max(otherEnd, slots[j].feature[0] + (slots[j].feature[3].length * basesPerLabelChar));
            if (((otherEnd + basePadding) >= feature[0])
                && ((slots[j].feature[0] - basePadding) <= featureEnd)) {
		//this feature overlaps
                continue;
            } else {
                level = j;
                break;
            }
        }

        featDiv = document.createElement("div");
	featDiv.feature = feature;
	featDiv.layoutEnd = featureEnd;

        //featDiv.setAttribute("fName", feature[3]);
        switch (feature[2]) {
        case 1:
            featDiv.className = "plus-" + className; break;
        case 0:
            featDiv.className = className; break;
        case -1:
            featDiv.className = "minus-" + className; break;
        }

        if (level === undefined) {
	    //create a new slot
            slots.push(featDiv);
            level = slots.length - 1;
        } else {
	    //div goes into an existing slot
	    slots[level] = featDiv;
	}

        maxLevel = Math.max(level, maxLevel);

	if (!startSlots[level]) startSlots[level] = featDiv;

        featDiv.style.cssText = 
            //"left: " + (100 * (feature.start - leftBase) / blockWidth) + "%; "
            "left: " + (100 * (feature[0] - leftBase) / blockWidth) + "%; "
        //+ "top: " + (levels[i] * this.levelHeight) + levelUnits + ";"
            + "top: " + (level * levelHeight) + levelUnits + ";"
            //+ " width: " + (100 * ((feature.end - feature.start) / blockWidth)) + "%;";
            + " width: " + (100 * ((feature[1] - feature[0]) / blockWidth)) + "%;";

        if (scale > labelScale) {
            var labelDiv = document.createElement("div");
            labelDiv.className = "feature-label";
            labelDiv.appendChild(document.createTextNode(feature[3]));
            labelDiv.style.cssText = 
                "left: " + (100 * (feature[0] - leftBase) / blockWidth) + "%; "
                + "top: " + ((level * levelHeight) + glyphHeight) + levelUnits + ";";
	    featDiv.label = labelDiv;
            block.appendChild(labelDiv);
        }

	//ie6 doesn't respect the height style if the div is empty
        if (Util.is_ie6) featDiv.appendChild(document.createComment());
        featDiv.onclick = callback;
        //Event.observe measurably slower
        //TODO: handle IE leaks (
        //Event.observe(featDiv, "click", callback);
        block.appendChild(featDiv);
    }

    var startBase = goLeft ? rightBase : leftBase;
    var endBase = goLeft ? leftBase : rightBase;

    this.features.iterate(startBase, endBase, featCallback);

    if (goLeft)
	block.leftSlots = slots;
    else
	block.rightSlots = slots;

    return ((maxLevel + 1) * levelHeight);
}

SimpleFeatureTrack.prototype.layout = function(features, levels, slots, basePadding) {
    var maxLevel = 0;
    featLoop: for (var i = 0; i < features.length; i++) {
        slotLoop: for (var j = 0; j < slots.length; j++) {
            if (features[i] === slots[j]) continue featLoop;
            //alert("i:" + i + ", j: " + j + "; " + slots[j].start + "-" + slots[j].end + ", " + features[i].start + "-" + features[i].end + ", basePadding: " + basePadding);
            //if (((slots[j].end + basePadding) >= features[i].start)
            //    && ((slots[j].start - basePadding) <= features[i].end)) {
            if (((slots[j][1] + basePadding) >= features[i][0])
                && ((slots[j][0] - basePadding) <= features[i][1])) {
                continue slotLoop;
            } else {
                slots[j] = features[i];
                levels[i] = j;
                maxLevel = Math.max(j, maxLevel);
                continue featLoop;
            }
        }
        if (levels[i] === undefined) {
            slots.push(features[i]);
            levels[i] = slots.length - 1;
        }
    }
    return maxLevel;
}
