//utility stuff, should move
var is_ie = navigator.appVersion.indexOf('MSIE') >= 0;
var is_ie6 = navigator.appVersion.indexOf('MSIE 6') >= 0;
function addCommas(nStr)
{
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

function Animation(subject, callback, steps) {
    if (subject === undefined) return;
    if ("animation" in subject) subject.animation.stop();
    this.index = 0;
    this.steps = steps;
    this.subject = subject;
    this.callback = callback;

    var myAnim = this;
    this.animID = setInterval(function() { myAnim.animate() }, 30);
    this.animFunction = function() { myAnim.animate(); };
    //setTimeout(this.animFunction, 30);

    subject.animation = this;
}

Animation.prototype.animate = function () {
    if (this.index < this.steps) {
        this.index += 1;
        this.step(this.index, this.steps);
        //setTimeout(this.animFunction, 30);
    } else {
        this.stop();
    }
}

Animation.prototype.stop = function() {
    clearInterval(this.animID);
    if (this.index == this.steps) this.callback(this);
    delete this.subject.animation;
}    

function Slider(view, callback, steps, distance) {
    Animation.call(this, view, callback, steps)
    this.slideStart = view.getX();
    this.slideDistance = distance;
    view.showVisibleBlocks(this.slideStart - distance,
                           this.slideStart + view.dim.width - distance);
}

Slider.prototype = new Animation();

Slider.prototype.step = function(index, steps) {
        //var x = (2 * (slideIndex / slideSteps)) - 1;
        //    slideStart - (slideDistance * (3/4) * ((2/3) + x - ((x^3)/3)));
    this.subject.setX(((this.slideStart -
                        (this.slideDistance * 
                         //cos will go from 1 to -1, we want to go from 0 to 1
                         ((-0.5 * Math.cos((index / steps) * Math.PI)) + 0.5)))
                       //truncate
                       | 0) );
}

function Zoomer(scale, toScroll, callback, steps, zoomLoc) {
    Animation.call(this, toScroll, callback, steps);
    this.toZoom = toScroll.container;
    var cWidth = this.toZoom.clientWidth;

    this.zero = cWidth * Math.min(1, scale);
    this.one = cWidth * Math.max(1, scale);
    this.mult = this.one - this.zero;
    this.zoomingIn = scale > 1;
    this.zoomLoc = zoomLoc;
}

Zoomer.prototype = new Animation();

Zoomer.prototype.step = function(index, steps) {
    var zoomFraction = (this.zoomingIn ? index : (steps - index)) / steps;
    var x = this.subject.getX();
    var eWidth = this.subject.elem.clientWidth;
    var cWidth = this.subject.container.clientWidth;
    var center =
        (x + (eWidth * this.zoomLoc)) / cWidth;
    newWidth = ((zoomFraction * zoomFraction) * this.mult) + this.zero;
    newLeft = (center * newWidth) - (eWidth * this.zoomLoc);
    newLeft = Math.min(newLeft, newWidth - eWidth);
    //this.subject.offset -= x - newLeft;
    this.toZoom.style.width = newWidth + "px";
    this.subject.setX(newLeft);
}

function GenomeView(elem, stripeWidth, startbp, endbp, zoomLevel) {
    //all coordinates are interbase


    //measure text width for the max zoom level
    var widthTest = document.createElement("div");
    widthTest.className = "sequence";
    widthTest.style.display = "none";
    var widthText = "12345678901234567890123456789012345678901234567890" 
    widthTest.appendChild(document.createTextNode(widthText));
    elem.appendChild(widthTest);
    this.charWidth = Element.getWidth(widthTest) / widthText.length;
    this.seqHeight = Element.getHeight(widthTest);
    elem.removeChild(widthTest);

    var heightTest = document.createElement("div");
    heightTest.className = "pos-label";
    heightTest.style.display = "none";
    heightTest.appendChild(document.createTextNode("42"));
    elem.appendChild(heightTest);
    this.posHeight = Element.getHeight(heightTest);
    elem.removeChild(heightTest);

    //starting bp of the reference sequence
    this.startbp = startbp;
    //ending bp of the reference sequence
    this.endbp = endbp;
    //current scale, in pixels per bp
    this.pxPerBp = zoomLevel;
    //width, in pixels of the vertical stripes
    this.stripeWidth = stripeWidth;
    //the page element that the GenomeView lives in
    this.elem = elem;

    this.container = document.createElement("div");
    this.container.style.cssText =
        "background-color: lightgrey;" +
        "position: absolute; left: 0px; top: 0px;";
    elem.appendChild(this.container);

    //set up size state (zoom levels, stripe percentage, etc.)
    this.sizeInit();

    this.tracks = [];
    //width, in pixels of the "regular" (not min or max zoom) stripe
    this.regularStripe = stripeWidth;
    //width, in pixels, of stripes at full zoom (based on the sequence
    //character width)
    this.fullZoomStripe = this.charWidth * (stripeWidth / 10);
    //width, in pixels, of stripes at min zoom (so the view covers
    //the whole ref seq)
    this.minZoomStripe = this.regularStripe * (this.zoomLevels[0] / this.zoomLevels[1]);
    //distance, in pixels, from the beginning of the reference sequence
    //to the beginning of the first active stripe
    this.offset = 0;
    //largest value for the sum of this.offset and this.getX()
    //this prevents us from scrolling off the right end of the ref seq
    this.maxLeft = this.bpToPx(this.endbp) - this.dim.width;
    //distance, in pixels, between each track
    this.trackPadding = 20;
    this.trackHeights = [];
    this.trackLabels = [];

    var view = this;

    if (is_ie6) {
        view.getX = function() { return -parseInt(view.container.style.left); }
        view.getY = function() { return -parseInt(view.container.style.top); }
        view.getPosition = function() {
            return {x: -parseInt(view.container.style.left),
                    y: -parseInt(view.container.style.top)};
        }
        view.setX = function(x) {
            view.container.style.left =
                (-Math.max(Math.min(view.maxLeft - view.offset, x), 0)) + "px";
        }
        view.setY = function(y) {
            view.container.style.top = (-Math.max(y, 0)) + "px";
        }
        view.setPosition = function(pos) {
            view.container.style.left =
                (-Math.max(Math.min(view.maxLeft - view.offset, pos.x), 0)) + "px";
            view.container.style.top =
                (-Math.max(pos.y, 0)) + "px";
        }
    } else {
        view.getX = function() { return view.elem.scrollLeft; }
        view.getY = function() { return view.elem.scrollTop; }
        view.getPosition = function() {
            return {x: view.elem.scrollLeft,
                    y: view.elem.scrollTop};
        }
        view.setX = function(x) {
            view.elem.scrollLeft =
                Math.max(Math.min(view.maxLeft - view.offset, x), 0);
        }
        view.setY = function(y) {
             view.elem.scrollTop = (y < 0 ? 0 : y);
        }
        view.setPosition = function(pos) {
            view.elem.scrollLeft =
                Math.max(Math.min(view.maxLeft - view.offset, pos.x), 0);
            view.elem.scrollTop =
                (pos.y < 0 ? 0 : pos.y);
        }
    }

    view.dragEnd = function(event) {
        Event.stopObserving(view.elem, "mouseup", view.dragEnd);
        Event.stopObserving(view.elem, "mousemove", view.dragMove);
        Event.stopObserving(document.body, "mouseout", view.checkDragOut)
        view.elem.style.cursor = "url(\"openhand.cur\"), move";
        document.body.style.cursor = "default";
        Event.stop(event);
        view.scrollUpdate();
    }

    var htmlNode = document.body.parentNode;
    view.checkDragOut = function(event) {
        if (htmlNode === (event.relatedTarget || event.toElement))
            view.dragEnd(event);
    }

    view.dragMove = function(event) {
        var deltaX = Event.pointerX(event) - view.dragStartPos.x;
        var deltaY = Event.pointerY(event) - view.dragStartPos.y;
        view.setPosition({x: view.winStartPos.x - deltaX,
                          y: view.winStartPos.y - deltaY});
        var newY = view.getY();
        var stripe;
        for (var i = 0; i < view.stripeCount; i++) {
            stripe = view.stripes[i];
            stripe.posLabel.style.top = newY + "px";
            if ("seqNode" in stripe)
                stripe.seqNode.style.top = (newY + (1.2 * view.posHeight)) + "px";
        }
        Event.stop(event);
        view.showVisibleBlocks();
    }

    view.dragStart = function(event) {
        if (!Event.isLeftClick(event)) return;
        if ("animation" in view) view.animation.stop();
        Event.observe(view.elem, "mouseup", view.dragEnd);
        Event.observe(view.elem, "mousemove", view.dragMove);
        Event.observe(document.body, "mouseout", view.checkDragOut)

        view.dragStartPos = {x: Event.pointerX(event), 
                             y: Event.pointerY(event)};
        view.winStartPos = view.getPosition();

        document.body.style.cursor = "url(\"closedhand.cur\"), move";
        view.elem.style.cursor = "url(\"closedhand.cur\"), move";
        Event.stop(event);
    }

    Event.observe(view.elem, "mousedown", view.dragStart);

    var afterSlide = function() {
        view.scrollUpdate();
        document.body.style.cursor = "default";
    };

    Event.observe("moveLeft", "click", 
                  function() {
                      document.body.style.cursor = "wait";
                      new Slider(view, afterSlide, 40, view.dim.width * 0.9);
                  });
    Event.observe("moveRight", "click",
                  function() {
                      document.body.style.cursor = "wait";
                      new Slider(view, afterSlide, 40, -view.dim.width * 0.9);
                  });
    //Event.observe("stepLeft", "click",
    //              function() {new Slider(view, afterSlide, 20, view.dim.width * .5)});
    //Event.observe("stepRight", "click",
    //              function() {new Slider(view, afterSlide, 20, -view.dim.width * .5)});

    var zoomSteps = 15;
    if (is_ie) zoomSteps = 15;
    //should these two be Zoomer state?
    var zoomStart;
    var zoomTrans;

    var afterZoom = function(anim) {
        //estimate the number of steps to finish the zoom in one second
        zoomSteps = anim.index / (((new Date()).getTime() - zoomStart) / 1000);
        //console.log("zoomSteps: %d, anim.index: %d", zoomSteps, anim.index);
        if (zoomSteps < 1) zoomSteps = 1;
        //average with the current number of steps for the target zoom level
        //(this is to reduce the effect of sporadic slowdowns due to (e.g.) GC)
        if (view.zoomSteps[zoomTrans])
            zoomSteps = (view.zoomSteps[zoomTrans] + zoomSteps) / 2;
        zoomSteps = Math.round(zoomSteps);
        if (zoomSteps > 20) zoomSteps = 20;
        view.zoomSteps[zoomTrans] = zoomSteps;
        view.zoomUpdate();
        document.body.style.cursor = "default";
    };

    var zoomIn = 
        function(event) {
        if (view.curZoom < (view.zoomLevels.length - 1)) {
            document.body.style.cursor = "wait";
            var x = view.getX();
            for (var i = 0; i < view.stripeCount; i++) {
                if ((((i + 1) * view.stripeWidth) < x)
                    || ((i * view.stripeWidth) > (x + view.dim.width))) {
                    view.container.removeChild(view.stripes[i]);
                    view.stripes[i] = undefined;
                }
            }
            var scale = view.zoomLevels[view.curZoom + 1] / view.zoomLevels[view.curZoom];
            zoomTrans = view.curZoom + "-" + (view.curZoom + 1);
            view.curZoom += 1;
            view.pxPerBp = view.zoomLevels[view.curZoom];
            view.maxLeft = view.bpToPx(view.endbp) - view.dim.width;
            if (view.zoomSteps[zoomTrans])
                zoomSteps = view.zoomSteps[zoomTrans];
            zoomStart = (new Date()).getTime();
            new Zoomer(scale, view, afterZoom, zoomSteps, 0.5);
        }
    }

    Event.observe("zoomIn", "click", zoomIn);

    var zoomOut = 
        function(event) {
        if ((view.zoomLevels.length - 1) == view.curZoom) {
            for (var i = 0; i < view.stripeCount; i++)
                view.stripes[i].seqNode.style.display = "none";
        }
        if (view.curZoom > 0) {
            document.body.style.cursor = "wait";
            var x = view.getX();
            var scale = view.zoomLevels[view.curZoom - 1] / view.zoomLevels[view.curZoom];
            var edgeDist = view.bpToPx(view.endbp) - (view.offset + x + view.dim.width);
            //zoomLoc is a number on [0,1] that indicates
            //the fixed point of the zoom
            var zoomLoc = Math.max(0.5, 1 - (((edgeDist * scale) / (1 - scale)) / view.dim.width));
            edgeDist = x + view.offset;
            zoomLoc = Math.min(zoomLoc, ((edgeDist * scale) / (1 - scale)) / view.dim.width);
            zoomTrans = view.curZoom + "-" + (view.curZoom - 1);
            if (view.zoomSteps[zoomTrans])
                zoomSteps = view.zoomSteps[zoomTrans];
            view.curZoom -= 1;
            view.pxPerBp = view.zoomLevels[view.curZoom];
            zoomStart = (new Date()).getTime();
            new Zoomer(scale, view, afterZoom, zoomSteps, zoomLoc);
        }
    }

    Event.observe("zoomOut", "click", zoomOut);

    Event.observe(view.elem, "doubleclick", function (event) {console.log("doubleclick");});

    var zooms = [zoomOut, zoomOut, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomOut, zoomIn, zoomIn, zoomIn];

    var thisZoom;

    var profile = function() {
        zooms[thisZoom++]();
        if (thisZoom < zooms.length)
            setTimeout(profile, 3000);
        else
            $('profTime').appendChild(document.createTextNode(" " + (new Date().getTime() - startTime) / 1000));
    }
    
    var startTime;

    Event.observe("profile", "click", function() {
            thisZoom = 0;
            startTime = new Date().getTime();
            
            setTimeout(profile, 2000);
        });

    Event.observe(window, "resize", function() { view.sizeInit(); });

    this.makeStripes();
}

GenomeView.prototype.pxToBp = function(pixels) {
    return (pixels / this.pxPerBp) + this.startbp;
}

GenomeView.prototype.bpToPx = function(bp) {
    return (bp - this.startbp) * this.pxPerBp;
}

GenomeView.prototype.sizeInit = function() {
    this.dim = {width: this.elem.clientWidth, 
                height: this.elem.clientHeight};//Element.getDimensions(elem);

    //scale values, in pixels per bp, for all zoom levels
    this.zoomLevels = [1/500000, 1/200000, 1/100000, 1/50000, 1/20000, 1/10000, 1/5000, 1/2000, 1/1000, 1/500, 1/200, 1/100, 1/50, 1/20, 1/10, 1/5, 1/2, 1, 2, 5, this.charWidth];
    //make sure we don't zoom out too far
    while (((this.endbp - this.startbp) * this.zoomLevels[0]) 
           < this.dim.width) {
        this.zoomLevels.shift();
    }
    this.zoomSteps = [];
    this.zoomLevels.unshift(this.dim.width / (this.endbp - this.startbp));
    
    this.curZoom = 0;
    while (this.pxPerBp > this.zoomLevels[this.curZoom])
        this.curZoom++;
    this.pxPerBp = this.zoomLevels[this.curZoom];

    delete this.stripePercent;
    //25, 50, 100 don't work as well due to the way scrollUpdate works
    var possiblePercents = [20, 10, 5, 4, 2, 1];
    for (var i = 0; i < possiblePercents.length; i++) {
        if (((100 / possiblePercents[i]) * this.stripeWidth)
            > (this.dim.width * 3)) {
            this.stripePercent = possiblePercents[i];
            break;
        }
    }

    if (this.stripePercent === undefined)
        throw new RangeError("stripeWidth too small: " + stripeWidth + ", " + this.dim.width);

    this.stripeCount = Math.round(100 / this.stripePercent);

    this.container.style.width = (this.stripeCount * this.stripeWidth) + "px";

    var newHeight = parseInt(this.container.style.height);
    newHeight = (newHeight > this.dim.height ? newHeight : this.dim.height);

    this.container.style.height = newHeight + "px";

    if (this.stripes) {
        for (var i = this.stripeCount - 1; i < this.stripes.length; i++) {
            if (this.stripes[i]) {
                this.container.removeChild(this.stripes[i]);
                this.stripes[i] = undefined;
            }
        }
        this.stripes.length = this.stripeCount;
        for (var i = 0; i < this.stripes.length; i++) {
            if (this.stripes[i]) {
                this.stripes[i].style.left = (i * this.stripePercent) + "%";
                this.stripes[i].style.width = this.stripePercent + "%";
                this.stripes[i].style.height = newHeight + "px";
            } else {
                this.stripes[i] = this.makeStripe(this.pxToBp(i * this.stripeWidth + this.offset),
                                                  i * this.stripePercent);
                this.container.appendChild(this.stripes[i]);
            }
        }
        this.showVisibleBlocks();
    }
}

GenomeView.prototype.zoomUpdate = function() {
    var x = this.getX();
    var eWidth = this.elem.clientWidth;
    var centerPx = ((eWidth / 2) + x + this.bpToPx(this.startBase));
    if ((this.zoomLevels.length - 1) == this.curZoom) {
        this.stripeWidth = this.fullZoomStripe;
    } else if (0 == this.curZoom) {
        this.stripeWidth = this.minZoomStripe;
    } else {
        this.stripeWidth = this.regularStripe;
    }
    this.container.style.width = (this.stripeCount * this.stripeWidth) + "px";
    var centerStripe = Math.round(centerPx / this.stripeWidth);
    var firstStripe = (centerStripe - ((this.stripeCount) / 2)) | 0;
    if (firstStripe < 0) firstStripe = 0;
    this.offset = firstStripe * this.stripeWidth;
    this.maxOffset = this.bpToPx(this.endbp) - this.stripeCount * this.stripeWidth;
    this.maxLeft = this.bpToPx(this.endbp) - this.dim.width;
    this.setX((centerPx - this.offset) - (eWidth / 2));
    this.clearStripes();
    this.makeStripes();
    this.showVisibleBlocks();
}    

GenomeView.prototype.scrollUpdate = function() {
    var x = this.getX();
    var cWidth = Element.getWidth(this.container);
    var eWidth = Element.getWidth(this.elem);
    var dx = (cWidth / 2) - ((eWidth / 2) + x);
    //If dx is negative, we add stripes on the right, if positive,
    //add on the left.
    //We remove stripes from the other side to keep cWidth the same.
    //The end goal is to minimize dx while making sure the surviving
    //stripes end up in the same place.

    var numStripes = this.stripes.length;
    var dStripes = (dx / this.stripeWidth) | 0;
    if (0 == dStripes) return;
    var changedStripes = Math.abs(dStripes);

    var newOffset = this.offset - (dStripes * this.stripeWidth)
    //newOffset = Math.min(this.maxOffset, newOffset)
    newOffset = Math.max(0, newOffset);

    dStripes = ((this.offset - newOffset) / this.stripeWidth) | 0;

    if (this.offset == newOffset) return;
    this.offset = newOffset;
    this.startBase = Math.round(this.pxToBp(this.offset));

    var newStripes = new Array(numStripes);
    for (var i = 0; i < numStripes; i++) {
        var newIndex = i + dStripes;
        if ((newIndex < 0) || (newIndex >= numStripes)) {
            //We're not keeping this stripe around, so delete
            //the old one and create a corresponding new one.

            //TODO: collect features from outgoing stripes that extend
            //onto the current view.

            //delete + create
            while (newIndex < 0) newIndex += numStripes;
            while (newIndex >= numStripes) newIndex -= numStripes;
            //alert("deleting: " + i + ", creating: " + newIndex);
            newStripes[newIndex] = 
                this.makeStripe(this.pxToBp(newIndex * this.stripeWidth
                                            + this.offset),
                                newIndex * this.stripePercent);
            //(newIndex > 0 ? newStripes[newIndex - 1] : undefined));

            this.container.replaceChild(newStripes[newIndex], this.stripes[i]);
        } else {
            //move stripe
            newStripes[newIndex] = this.stripes[i];
            newStripes[newIndex].style.left =
                ((newIndex) * this.stripePercent) + "%";
            //alert("moving " + i + " to " + (newIndex));
        }
    }
    //TODO: re-add features from deleted stripes

    this.stripes = newStripes;
    var newX = x + (dStripes * this.stripeWidth);
    this.setX(newX);
    var firstVisible = (newX / this.stripeWidth) | 0;

    if ((this.rightFilled + dStripes < 0)
        || (this.leftFilled + dStripes >= this.stripeCount)) {
        this.fillStripe(this.stripes[firstVisible], undefined, undefined);
        this.leftFilled = firstVisible;
        this.rightFilled = firstVisible;
    } else {
        this.leftFilled = Math.max(0, Math.min(this.stripeCount - 1,
                                                this.leftFilled + dStripes));
        this.rightFilled = Math.max(0, Math.min(this.stripeCount - 1,
                                               this.rightFilled + dStripes));
    }
    this.heightUpdate();
}

GenomeView.prototype.fillStripe = function(stripe, leftStripe, rightStripe) {
    var blocks = Array(this.tracks.length);
    var blockHeights = Array(this.tracks.length);

    var totalHeight = this.topSpace();

    for (var i = 0; i < this.tracks.length; i++) {
        var leftBlock, rightBlock;
        if (leftStripe && leftStripe.blocks) leftBlock = leftStripe.blocks[i];
        if (rightStripe && rightStripe.blocks) rightBlock = rightStripe.blocks[i];
        var blockDiv = document.createElement("div");
        blockDiv.style.cssText = "position: absolute; left: 0px; top: " + totalHeight + "px; width: 100%;";
        blockHeights[i] = this.tracks[i].fillBlock(blockDiv, 
                                                   leftBlock, rightBlock,
                                                   stripe.startBase,
                                                   stripe.startBase + Math.round(this.stripeWidth / this.pxPerBp), 
                                                   this.pxPerBp, 5);

        totalHeight += this.trackHeights[i] + this.trackPadding;
        blockDiv.style.height = totalHeight + "px";
        blocks[i] = blockDiv;
        stripe.appendChild(blockDiv);
    }
    stripe.blockHeights = blockHeights;
    stripe.blocks = blocks;
}

GenomeView.prototype.showVisibleBlocks = function(startX, endX) {
    var pos = this.getPosition();
    if (startX === undefined) startX = pos.x;
    if (endX === undefined) endX = pos.x + this.dim.width;
    var leftVisible = Math.max(0, (startX / this.stripeWidth) | 0);
    var rightVisible = Math.min(this.stripeCount - 1,
                               Math.ceil(endX / this.stripeWidth));
    
    for (var i = this.leftFilled - 1; i >= leftVisible; i--) {
        this.fillStripe(this.stripes[i], undefined, this.stripes[i + 1]);
        this.leftFilled = i;
    }
    for (var i = this.rightFilled + 1; i < rightVisible; i++) {
        this.fillStripe(this.stripes[i], this.stripes[i - 1], undefined);
        this.rightFilled = i;
    }
    this.heightUpdate();
        
    //    for (var i = 0; i < this.stripeCount; i++) {
    //        stripe = this.stripes[i];
//         if ((!stripe.shown) && (i >= leftVisible) && (i < lastVisible)) {
//             stripe.style.visibility="visible";
//             stripe.shown = true;
//         } else if ((stripe.shown) && ((i < leftVisible) || (i >= lastVisible))) {
//             stripe.style.visibility="hidden";
//             stripe.shown = false;
//         }

//        if ((!("blocks" in stripe)
//            && (i >= leftVisible)
//            && (i < lastVisible)) {
                //stripe.blocks.each(function(block) { stripe.appendChild(block); });
    //                for (var j = 0; j < this.tracks.length; j++) {
    //                    this.fillStripe(stripe, j,
    //                                    i > 0 ? this.stripes[i - 1] : undefined,
    //                                    i < 
//         } else if (("blocks" in stripe)
//                    && ((i < leftVisible) 
//                        || (i >= lastVisible))) {
//             stripe.blocks.each(function(block) { stripe.removeChild(block); });
//        }
//    }
}

GenomeView.prototype.makeStripe = function(startBase, startPercent) {
    var stripe = document.createElement("div");
    stripe.style.cssText =
    "position: absolute; left: " + startPercent
    + "%; top: 0px; width: " + (this.stripePercent) + "%;"
    + "height: " + this.dim.height + "px;"
    //+ "background-color: " + (i % 2 ? "#eee;" : "#fff;")
    + "border-style: none none none solid; border-width: 1px; border-color: black;"
    + "background-color: white;";
    //+ "visibility: hidden;";

    var y = this.getY();

    startBase = Math.round(startBase);
    stripe.startBase = startBase;
    var posLabel = document.createElement("div");
    posLabel.className = "pos-label";
    posLabel.appendChild(document.createTextNode(addCommas(startBase)));
    posLabel.style.top = y + "px";
    stripe.appendChild(posLabel);
    stripe.posLabel = posLabel;

    if ((this.zoomLevels.length - 1) == this.curZoom) {
        var seqNode = document.createElement("div");
        seqNode.className = "sequence";
        seqNode.appendChild(
            document.createTextNode(
                this.getSeq(startBase, startBase + this.regularStripe / 10)));
        seqNode.style.cssText = "top: " + (y + (1.2 * this.posHeight)) + "px;";
        stripe.appendChild(seqNode);
        stripe.seqNode = seqNode;
    }

    return stripe;
}

GenomeView.prototype.getSeq = function(start, end) {
    var dummySeq = "ACCTGACCTGACCTGACCTGACCTGACCTGACCTGACCTGACCTGACCTG";
    dummySeq = dummySeq.substr(0, end - start);
    return dummySeq;
}

GenomeView.prototype.topSpace = function() {
    if ((this.zoomLevels.length - 1) == this.curZoom)
        return (1.5 * this.posHeight) + this.seqHeight;
    else
        return 1.5 * this.posHeight;
}

GenomeView.prototype.heightUpdate = function() {
    var lastTop = this.topSpace();
    var curHeight;
    for (var track = 0; track < this.tracks.length; track++) {
        curHeight = 0;
        for (var stripe = 0 ; stripe < this.stripes.length; stripe++) {
            if ("blockHeights" in this.stripes[stripe])
                curHeight = 
                    Math.max(curHeight, 
                             this.stripes[stripe].blockHeights[track]);
        }
        for (var stripe = 0; stripe < this.stripes.length; stripe++) {
            if ("blocks" in this.stripes[stripe])
                this.stripes[stripe].blocks[track].style.top = lastTop + "px";
        }
        this.trackHeights[track] = curHeight;
        lastTop += curHeight + this.trackPadding;
    }
    var newHeight = Math.max(lastTop, this.dim.height);
    this.container.style.height = newHeight + "px";
    for (var stripe = 0 ; stripe < this.stripes.length; stripe++)
        this.stripes[stripe].style.height = newHeight + "px";
}

GenomeView.prototype.clearStripes = function() {
    for (var i = 0; i < this.stripes.length; i++)
        if (this.stripes[i] !== undefined)
            this.container.removeChild(this.stripes[i]);
}

GenomeView.prototype.makeStripes = function() {
    var stripe;
    var x = this.getX();
    var firstVisible = (x / this.stripeWidth) | 0;
    //var lastVisible = Math.ceil((x + this.dim.width) / this.stripeWidth);
    this.stripes = new Array(this.stripeCount);
    for (var i = 0; i < this.stripeCount; i++) {
        stripe = this.makeStripe(this.pxToBp((i * this.stripeWidth) + this.offset),
                                 i * this.stripePercent);
        this.stripes[i] = stripe;
        //if (i >= firstVisible && i < lastVisible) {
        //    stripe.blocks.each(function(block) { stripe.appendChild(block); });
        //    stripe.hasBlocks = true;
            //stripe.style.visibility="visible";
        //}
        this.container.appendChild(stripe);
    }
    this.fillStripe(this.stripes[firstVisible], undefined, undefined);
    this.leftFilled = firstVisible;
    this.rightFilled = firstVisible;
    this.startBase = Math.round(this.pxToBp(this.offset));
    this.showVisibleBlocks();
    this.heightUpdate();
}

GenomeView.prototype.addTrack = function(track) {
    var trackNum = this.tracks.length;
    this.tracks.push(track);
    var trackHeight = 0;
    var totalHeight = this.topSpace();
    for (var t = 0; t < this.trackHeights.length; t++)
        totalHeight += this.trackHeights[t] + this.trackPadding;
    var leftBlock = undefined;
    var blockHeight;
    for (var i = this.leftFilled; i <= this.rightFilled; i++) {
        var stripe = this.stripes[i];
        var blockDiv = document.createElement("div");
        blockDiv.style.cssText = "position: absolute; left: 0px; top: " + totalHeight + "px; width: 100%;"
        blockHeight = track.fillBlock(blockDiv, 
                                      leftBlock, undefined,
                                      stripe.startBase,
                                      stripe.startBase + Math.round(this.stripeWidth / this.pxPerBp), 
                                      this.pxPerBp, 5);
        leftBlock = blockDiv;
        trackHeight = Math.max(trackHeight, blockHeight);
        blockDiv.style.height = blockHeight + "px";
        stripe.blocks.push(blockDiv);
        stripe.blockHeights.push(blockHeight);
        stripe.appendChild(blockDiv);
    }
    this.trackHeights.push(trackHeight);
    totalHeight += trackHeight + this.trackPadding;
    totalHeight = Math.max(totalHeight, this.dim.height);
    for (var i = 0; i < this.stripeCount; i++)
        this.stripes[i].style.height = totalHeight + "px";
    this.container.style.height = totalHeight + "px";

    //var tLabel = document.createElement("div");
    //tLabel.className = "track-label";
    //tLabel.style.cssText = "position:absolute; left: 0px;"; 
}
