// Function for parsing GBrowse config files
// Input : The text in a file (with newlines)
// Output : a JS object

// Based (now extremely loosely) on
// https://github.com/shockie/node-iniparser -> released under the MIT license

function parseGBConfig(data){

    this.regex = {
        section:   /^\s*\[\s*([^\]]*)\s*\]\s*$/,
        param:     /^(\w[\w\.\-\_\:\s]+)=\s*(.*?)\s*$/,
        halfParam: /^(\w[\w\.\-\_\:\s]+)=\s*$/,
        comment:   /^\s*#.*$/,
        emptyLine: /^\s*$/,
        newLine:   /\r\n|\r|\n/
    };
    this.value = {};
    this.lines = data.split(this.regex.newLine);
    this.section = null;
    var n = this.lines.length;


    //Process each line
    for (var i = 0; i < n; i++) {
        if (this.regex.comment.test(this.lines[i])) {                      //      #this is a comment
            // do nothing, since it's a comment.
        } else if (this.regex.halfParam.test(this.lines[i])) {             //      name = 
            i = MultiLine(i); // skips lines, so get where to continue
        } else if (this.regex.param.test(this.lines[i])) {                 //      name = value
            Param(i);
        } else if (this.regex.section.test(this.lines[i])) {               //      [section_name]
            Section(i);
        }
    };


    return this.value; //Returns the JS object
}

function Param(i) {
    var match = this.lines[i].match(this.regex.param);
    if (this.section) {
        if (!isNaN(match[2])) {
            match[2] = parseInt(match[2]);
        }
        this.value[this.section][match[1].trim()] = match[2];
    } else {
        if (!isNaN(match[2].trim())) {
            match[2] = parseInt(match[2].trim());
        }
        this.value[match[1].trim()] = match[2].trim();
    }
}

function MultiLine (i){
    var line = this.lines; var rx = this.regex;
    var lineNum = i+1;
    var tmpStrVal = '';
    // while (line is defined, not a parameter or function)
    while (typeof line[lineNum] !== 'undefined' && (! ( rx.param.test(line[lineNum]) || rx.section.test(line[lineNum])))){
        //if (line not comment or empty)
        if (! ( rx.comment.test(line[lineNum]) || rx.emptyLine.test(line[lineNum]) )) {
            if (tmpStrVal === ''){
                tmpStrVal += line[lineNum].trim();
            } else {
                tmpStrVal = tmpStrVal + ' ' + line[lineNum].trim();
            }
        }
        lineNum++;
    }
    var match = this.lines[i].match(this.regex.param);
    if (this.section) {
        this.value[this.section][match[1].trim()] = tmpStrVal;
    } else {
        this.value[match[1].trim()] = tmpStrVal;
    }
    return lineNum - 1; //The line it should continue at.
}

function Section (i) {
    var match = this.lines[i].match(this.regex.section);
    this.value[match[1].trim()] = {};
    this.section = match[1].trim();
}

