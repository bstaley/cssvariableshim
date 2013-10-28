/*
*Check out the site here: http://cssvariableshim.azurewebsites.net/
*
*   Copyright 2013 Brandon R Staley
*
*   Licensed under the Apache License, Version 2.0 (the "License");
*   you may not use this file except in compliance with the License.
*   You may obtain a copy of the License at
*
*       http://www.apache.org/licenses/LICENSE-2.0
*
*   Unless required by applicable law or agreed to in writing, software
*   distributed under the License is distributed on an "AS IS" BASIS,
*   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*   See the License for the specific language governing permissions and
*   limitations under the License.
*
*Developed by: Brandon R Staley(bstaley0@gmail.com)
*Date header added: 2013-09-13 10:07am
*Purpose: As a runtime shim for changing style sheet properties.
*Dependencies: javascript
*Tested on browsers: Chrome 28+, Firefox 22+, IE 9+, O 16+
*Usage: In theory it should be able to be used on any browser.
*Contributers:
*/

//all css files with variables or variable references.
var referenced_style_files = [];
//not used yet but tracks all non-variable properties and values.
var styleCache = [];
//all properties that have a variable reference.
var variableCache = [];
//all variable references from all sheets
var variableDefinitions = { selectorNames: [], properties: [] };
//all variable references from all sheets
var queuedChanges = { selectorNames: [], properties: [] };
//will let us know when all files have been read
var fileReadCount = 0;
/**
 * Private. An extension on the element class to include a set style function.
 *@param   String    name   property name of the css style your would like to change.
 *@param   String    value  value the css style your would like to assign to the name.
 */
Element.prototype.setStyle = function (name, value) {

    var styleAttr = this.getAttribute('style');
    if (styleAttr !== null && styleAttr !== undefined) {

        var existed = (styleAttr.indexOf(name) !== -1);
        var styleSplit = styleAttr.split(';');
        var fullStyle = '';

        if (existed) {

            existed = false;

            for (var i = 0; i < styleSplit.length; i++) {
                if (styleSplit[i] !== '') {
                    var styleSplitTwo = styleSplit[i].split(':');
                    var xname = styleSplitTwo[0];
                    var xval = styleSplitTwo[1];
                    if (xname.trim() === name) {
                        xval = value;
                        existed = true;
                    }
                    fullStyle += xname + ':' + xval + ';';
                }
            }

            if (!existed) { fullStyle += name + ':' + value + ';'; }

            this.setAttribute('style', fullStyle);
        }
        else {
            this.setAttribute('style', name + ':' + value + '; ' + styleAttr);
        }
    }
    else {
        this.setAttribute('style', name + ':' + value + '; ');
    }
};

/**
 * Public. Sets all of the style files and fills styleCache, variableCache and variableDefinitions
 *@param   Array    ref_sty_fi   PARAMETER NOT REQUIRED-list style file locations here if you would like to order them or exclude some. Otherwise all stylesheets will be loaded.
 */
function setStyleFiles(ref_sty_fi) {
    if (ref_sty_fi !== undefined)
    { referenced_style_files = ref_sty_fi; }
    else {
        for (var i = 0; i < document.styleSheets.length; i++) {
            if (document.styleSheets[i].href !== null) {
                referenced_style_files[referenced_style_files.length] = document.styleSheets[i].href;
            }
        }
    }
    setUpVaribles();
}

/**
 * Private. Called by setStyleFiles. Fills all global variables. referenced_style_files must be filled first.
 */
function setUpVaribles() {
    for (var i = 0; i < referenced_style_files.length; i++) {
        readAFile(referenced_style_files[i]);
    }

}

/**
 * Private. Called by setUpVaribles. Fills all global variables. referenced_style_files must be passed.
 *@param   String   file    location of a css file.
 */
//MISLEADING: This does way more then just read a file
function readAFile(file) {
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, true);
    rawFile.onreadystatechange = function () {
        if (rawFile.readyState === 4) {
            if (rawFile.status === 200 || rawFile.status === 0) {
                //local css file data
                var file = rawFile.responseText;
                //split each line
                var lines = file.split('\r\n');
                //informs us if we are within a section or on selectors
                var onGuts = false;

                //all css pairs in a the file
                var stylePackage = { selectorNames: [], properties: [] };
                //all css pairs that have a variable
                var variablePackage = { selectorNames: [], properties: [] };

                for (var i = 0; i < lines.length; i++) {
                    var splitLine = [];
                    //blank lines are not our friends
                    if (lines[i] !== '') {
                        //will define a variable
                        if (lines[i].trim().substring(0, 3) === '/*@') {
                            //enters the variable into the definitions
                            splitLine = lines[i].trim().replace(';', '').replace('/*', '').replace('*/', '').split(':');
                            variableDefinitions.selectorNames[variableDefinitions.selectorNames.length] = splitLine[0];
                            variableDefinitions.properties[variableDefinitions.properties.length] = splitLine[1];
                        }
                            //variables defined on one line
                        else if (lines[i].indexOf('{') !== -1 && lines[i].indexOf('}') !== -1) {
                            splitLine = lines[i].replace('}', '').split('{');
                            splitSelectors(splitLine[0], stylePackage);
                            splitProperties(splitLine[1], stylePackage, variablePackage);
                        }
                        else if (lines[i].indexOf('{') !== -1) {
                            //this is the beginning of a css section.
                            onGuts = true;
                            splitSelectors(lines[i].trim().replace('{', ''), stylePackage);
                            if (lines[i].indexOf(';') !== -1)
                            { splitProperties(lines[i].trim(), stylePackage, variablePackage); }
                        }
                        else if (lines[i].indexOf('}') !== -1) {
                            //end of a section, meaning there will either be an eof coming or more selectors
                            //at any rate add everything to the cache's
                            splitProperties(lines[i].trim().replace('}', ''), stylePackage, variablePackage);
                            styleCache[styleCache.length] = stylePackage;
                            //if nothing here, then nothing to cache
                            if (variablePackage.selectorNames.length !== 0) {
                                variableCache[variableCache.length] = variablePackage;
                            }
                            stylePackage = { selectorNames: [], properties: [] };
                            variablePackage = { selectorNames: [], properties: [] };
                            onGuts = false;
                        }
                        else if (onGuts) {
                            //add properties
                            splitProperties(lines[i].trim(), stylePackage, variablePackage);
                        }
                        else {
                            //add selectors
                            splitSelectors(lines[i].trim(), stylePackage);
                        }

                    }
                }
                fileReadCount++;
                if (referenced_style_files.length === fileReadCount) {
                    if (queuedChanges.selectorNames.length === 0) {
                        refreshTheme();
                    }
                    else {
                        swapMultipleProperties(queuedChanges);
                    }
                }
            }
        }
    };
    rawFile.send(null);
}

/**
 * Private. Called by setUpVaribles. Detects variables within sections of the css files
 *@param   String   line            css property line.
 *@param   Array    stylePackage    current list of styles within this sheet.
 *@param   Array    variablePackage  current list of variables within this sheet.
 */
function splitProperties(line, stylePackage, variablePackage) {
    //usefull if everything is declared on one line
    var splitLine = line.split(';');

    if (splitLine.length !== 0) {
        //enumerate through each css property
        for (var i = 0; i < splitLine.length; i++) {
            if (splitLine[i] !== '') {
                //if the line contains '/*@' that means a variable is assigned
                if (splitLine[i].indexOf('/*@') !== -1) {
                    //if the length doesnt match that means this is the first variable in this section
                    if (variablePackage.selectorNames.length !== stylePackage.selectorNames.length)
                    { variablePackage.selectorNames = stylePackage.selectorNames; }
                    //gets the property name
                    var firstSplit = splitLine[i].replace('*/', '').split(':');
                    //gets the variable
                    var secondSplit = firstSplit[1].split('/*');
                    //combines them without the default
                    variablePackage.properties[variablePackage.properties.length] = (firstSplit[0] + ':' + secondSplit[1]);
                }
                stylePackage.properties[stylePackage.properties.length] = splitLine[i];
            }
        }

    }
}

/**
 * Private. Called by setUpVaribles. Gets all of the selectors outside of the sections of the css files
 *@param   String   line            css property line.
 *@param   Array    stylePackage    current list of styles within this sheet.
 */
function splitSelectors(line, stylePackage) {
    //css selectors are seporated by commas
    var splitLine = line.split(',');

    if (splitLine.length !== 0) {
        for (var i = 0; i < splitLine.length; i++) {
            //if the selector is not empty add a new trimmed selector to styles
            if (splitLine[i] !== '') {
                stylePackage.selectorNames[stylePackage.selectorNames.length] = splitLine[i].trim();
            }
        }

    }
}

/**
 * Public. Called by setUpVaribles, but could be called by a user to reset. Using current variables it refreshes the styles.
 */
function refreshTheme() {
    for (var i = 0; i < variableCache.length; i++) {
        for (var x = 0; x < variableCache[i].selectorNames.length; x++) {
            //handles each selector in the variableCache List
            var selector = variableCache[i].selectorNames[x];
            //v.9.197+ we split these up because hover need special attention
            if (selector.indexOf(':hover') === -1) {
                for (var y = 0; y < variableCache[i].properties.length; y++) {

                    //splitLine will give you the property and value, ex. (background-color,@beefJerky)
                    var splitLine = variableCache[i].properties[y].split(':');

                    //special attention is needed for hover. In order to handle that we set the mouseover and mouseleave functions.

                    configureStyle(selector, splitLine);
                }
            }
            else {
                for (var y = 0; y < variableCache[i].properties.length; y++) {

                    //splitLine will give you the property and value, ex. (background-color,@beefJerky)
                    var splitLine = variableCache[i].properties[y].split(':');

                    //need to set a data attribute so we can have the original value
                    //also because the getFile function is asyncrous we need to set it here for later use
                    getElementPerformFunction(selector.split(':')[0], function (slctr) {
                        if (y === 0) { slctr.setAttribute('data-hover', ''); }
                        slctr.setAttribute('data-hover', slctr.getAttribute('data-hover') + '^' + splitLine.join('|'));
                    });
                    //Neat little method i've come up with to get the element or elements and perform some action
                    getElementPerformFunction(selector.split(':')[0], function (slctr) {
                        slctr.onmouseover = function () { handleOnHover(this); };
                    });

                    getElementPerformFunction(selector.split(':')[0], function (slctr) {
                        slctr.onmouseout = function () { handleOffHover(this); };
                    });
                }
            }
        }
    }
}

/**
 * Private. Called by multiples. Will figure out what kind of element you are trying to select and perform a function.
 *@param   String   selector    the element that is being hovered.
 *@param   Function func        a function that will be performed on the selector, !NOTE!:the selector as an element is passed back into the function.
 */
function getElementPerformFunction(selector, func) {
    //if outerHTML is undefinded, most likly this is a string selector
    if (selector.outerHTML === undefined) {
        //special selectors
        if (selector.indexOf('+') !== -1 || selector.indexOf(']') !== -1) {
            //javascripts querySelector works well here
            var bySpecial = document.querySelectorAll(selector);
            if (bySpecial !== null) {
                for (var i = 0; i < bySpecial.length; i++) {
                    func(bySpecial[i]);
                }
                return;
            }
        }
            //finds variable with a # selector tries by id first
        else if (selector.indexOf('#') !== -1) {
            //by id 
            var byId = document.getElementById(selector.replace('#', ''));
            if (byId !== null) {
                func(byId);
                return;
            }
                //by random selector like p #daBomb
            else {
                var bySpecial = document.querySelectorAll(selector);
                if (bySpecial !== null) {
                    for (var i = 0; i < bySpecial.length; i++) {
                        func(bySpecial[i]);
                    }
                    return;
                }
            }
        }
        else if (selector.indexOf('.') !== -1) {
            //by class
            var byClass = document.getElementsByClassName(selector.replace('.', ''));
            if (byClass !== null) {
                for (var i = 0; i < byClass.length; i++) {
                    func(byClass[i]);
                }
                return;
            }
                //by random selector like p .daBomb
            else {
                var bySpecial = document.querySelectorAll(selector);
                if (bySpecial !== null) {
                    for (var i = 0; i < bySpecial.length; i++) {
                        func(bySpecial[i]);
                    }
                    return;
                }
            }
        }
        //catch all, i guess
        var byTag = document.getElementsByTagName(selector);
        if (byTag !== null) {
            for (var n = 0; n < byTag.length; n++) {
                func(byTag[n]);
            }
            return;
        }
    }
        //is not a string selector but an element already
    else {
        func(selector);
    }
}

/**
 * Private. Called by mouseover, set within refreshTheme. Handles attributes who have a variable assigned in hover and have invoked hover.
 *@param   String   selector    the element that is being hovered.
 */
function handleOnHover(selector) {
    var dataHover = selector.getAttribute('data-hover');

    if (dataHover !== null) {
        var dataHoverSplit = dataHover.split('^');
        for (var i = 0; i < dataHoverSplit.length ; i++) {
            if (dataHover.split('^')[i] !== '') {
                var sLine = [];
                sLine = dataHover.split('^')[i].split('|');
                configureStyle(selector, sLine);
            }
        }
    }
}

/**
 * Private. Called by mouseleave, set within refreshTheme. Handles attributes who have a variable assigned in hover and have left hover.
 *@param   String   selector    the element that is being hovered.
 */
function handleOffHover(selector) {
    var dataHover = selector.getAttribute('data-hover');

    if (dataHover !== null) {
        var dataHoverSplit = dataHover.split('^');
        for (var z = 0; z < dataHoverSplit.length ; z++) {
            if (dataHoverSplit[z] !== '') {
                var sLine = [];
                sLine = dataHoverSplit[z].split('|');

                //first we need to know which variable, in variableCache, is trying to hover.

                if (getVarCacSel('#' + selector.id + ':hover') !== undefined) {
                    if (getVarCacSel('#' + selector.id) !== undefined) {
                        //make sure that the varCache not only has the selector but the property too.
                        var varCacProp = getVarCacProp('#' + selector.id, sLine[0]);
                        if (varCacProp !== undefined) {
                            //if we find that there is a id within variableCache we use the property to reset the value
                            configureStyle(selector, varCacProp.split(':'));
                        }
                            //if no property then erase it.
                        else {
                            selector.setStyle(sLine[0], '');
                        }
                    }
                        //if no property then erase it.
                    else {
                        selector.setStyle(sLine[0], '');
                    }
                }
                else {
                    var classNames = selector.className.split(' ');
                    for (var i = 0; i < classNames.length; i++) {
                        if (getVarCacSel('.' + classNames[i] + ':hover') !== undefined) {
                            if (getVarCacSel('.' + classNames[i]) !== undefined) {
                                //make sure that the varCache not only has the selector but the property too.
                                var varCacProp = getVarCacProp('.' + classNames[i], sLine[0]);
                                if (varCacProp !== undefined) {
                                    //if we find that there is a class within variableCache we use the property to reset the value
                                    configureStyle(selector, varCacProp.split(':'));
                                }
                                    //if no property then erase it.
                                else {
                                    selector.setStyle(sLine[0], '');
                                }
                            }
                                //if no property then erase it.
                            else {
                                selector.setStyle(sLine[0], '');
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Private. Called by multiples. Make the property changes needed.
 *@param   String   selector    the element that is being changed.
 *@param   Array    splitLine   the css property and value.
 */
function configureStyle(selector, splitLine) {

    //will need to parse out !important
    var isImportant = false;

    //as not to change the main variable
    var localSplit = splitLine[1];

    if (localSplit.indexOf('!important') !== -1) {
        isImportant = true;
        localSplit = localSplit.replace('!important', '');
    }

    //if it does not have a lessen or greaten indicator
    if (localSplit.indexOf('<') === -1 && localSplit.indexOf('>') === -1 && localSplit.indexOf('~') === -1) {
        var varDefProp = getVarDefProp(localSplit);
        //make sure this isn't an image we are changing the color of.
        if (!colorChangePerformed(selector, splitLine[0], varDefProp)) {
            //make the change & add back in !important if needed.
            getElementPerformFunction(selector, function (slctr) {
                slctr.setStyle(splitLine[0], varDefProp + ((isImportant) ? ' !important' : ''));
            });
        }
    }
    else {
        //color stuff
        if (localSplit.indexOf('<') !== -1) {
            var varDefProp = configureForHSL(localSplit, '<');
            //make sure this isn't an image we are changing the color of.
            if (!colorChangePerformed(selector, splitLine[0], varDefProp)) {
                //make the change & add back in !important if needed.
                getElementPerformFunction(selector, function (slctr) {
                    slctr.setStyle(splitLine[0], varDefProp + ((isImportant) ? ' !important' : ''));
                });
            }
        }
        else if (localSplit.indexOf('>') !== -1) {
            var varDefProp = configureForHSL(localSplit, '>');
            //make sure this isn't an image we are changing the color of.
            if (!colorChangePerformed(selector, splitLine[0], varDefProp)) {
                //make the change & add back in !important if needed.
                getElementPerformFunction(selector, function (slctr) {
                    slctr.setStyle(splitLine[0], varDefProp + ((isImportant) ? ' !important' : ''));
                });
            }
        }
        else if (localSplit.indexOf('~') !== -1) {
            var varDefProp = configureForHSL(localSplit, '~');
            //make sure this isn't an image we are changing the color of.
            if (!colorChangePerformed(selector, splitLine[0], varDefProp)) {
                //make the change & add back in !important if needed.
                getElementPerformFunction(selector, function (slctr) {
                    slctr.setStyle(splitLine[0], varDefProp + ((isImportant) ? ' !important' : ''));
                });
            }
        }
    }
}

/**
 * Private. Called by configureStyle. Checks to see if we need to change an image's color.
 *@param   String   selector    the element that is being changed.
 *@param   String   property    the css property.
 *@param   String   cssValue    the css value.
 */
function colorChangePerformed(selector, property, cssValue) {
    //make sure its a background-image and the variable is a color.
    if (property === 'background-image' && (cssValue.indexOf('hsl') !== -1 || cssValue.indexOf('rgb') !== -1)) {
        getElementPerformFunction(selector, function (slctr) {
            pushChange(slctr, ColorHelper.changeColor, cssValue);
        });
        return true;
    }
    return false;
}

/**
 * Private. Called by configureStyle. Lightens or darkens a color, can be HSL or RGB.
 *@param   String   fullLine    The whole property line within the section in the css.
 *@param   String   splitBy     What to parse the line by.
 */
function configureForHSL(fullLine, splitBy) {
    var partLine = fullLine.split(splitBy);
    var varDefProp = getVarDefProp(partLine[0]);
    if (varDefProp.indexOf('rgb') !== -1) {
        //clean out all of the rgb markup.
        var colors = varDefProp.replace('rgb', '').replace('(', '').replace(')', '').split(',');
        //send the string values to the converter. then assign the result to varDefProp so HSL can do its job.
        varDefProp = 'hsl(' + rgbToHsl(colors[0], colors[1], colors[2]).join(',') + ')';
    }
    if (varDefProp.indexOf('hsl') !== -1) {
        var hslSplit = varDefProp.split(',');
        //darkens
        if (splitBy === '>')
        { hslSplit[2] = ((+hslSplit[2].replace('%', '').replace(')', '').trim()) - (+partLine[1])).toString() + '%)'; }
            //lightens
        else if (splitBy === '<') {
            hslSplit[2] = ((+hslSplit[2].replace('%', '').replace(')', '').trim()) + (+partLine[1])).toString() + '%)';
        }
            //changes opacity
        else if (splitBy === '~') {
            if (hslSplit.length === 3) {
                hslSplit[0] = hslSplit[0].replace('hsl', 'hsla')
                hslSplit[2] = hslSplit[2].replace(')', '');
                hslSplit[hslSplit.length] = partLine[1] + ')';
            }
            else if (hslSplit.length === 4) {
                hslSplit[3] = partLine[1] + ')';
            }
        }
        varDefProp = hslSplit.join(',');
    }

    return varDefProp;
}

/**
 * Private. Called by multiples. Gets the property, from a selector, of a variableDefinitions item.
 *@param   String   keySelector     the selector associated with the property.
 */
function getVarDefProp(keySelector) {
    return variableDefinitions.properties[variableDefinitions.selectorNames.indexOf(keySelector)];
}

/**
 * Private. Called by handleOffHover. Doesn't really do much other then make sure the select exist in the variableCache.
 *@param   String   keySelector     the selector associated with the selector.
 */
function getVarCacSel(keySelector) {
    for (var i = 0; i < variableCache.length; i++) {
        if (variableCache[i].selectorNames.indexOf(keySelector) !== -1) {
            return variableCache[i].selectorNames[variableCache[i].selectorNames.indexOf(keySelector)];
        }
    }
    return undefined;
}

/**
 * Private. Called by handleOffHover. Gets the property that is associated with a specific selector.
 *@param   String   selector    the element that is being changed.
 *@param   Array    splitLine   the css property and value.
 */
function getVarCacProp(keySelector, keyProperty) {
    for (var i = 0; i < variableCache.length; i++) {
        //make sure the selector is in this item
        if (variableCache[i].selectorNames.indexOf(keySelector) !== -1) {
            for (var x = 0; x < variableCache[i].properties.length; x++) {
                //if the property is in this item return it
                if (variableCache[i].properties[x].indexOf(keyProperty) !== -1) {
                    return variableCache[i].properties[x];
                }
            }
        }
    }
    return undefined;
}

/**
 * Public. Called by the user. Allows that user to swap out a variable, giving the ability to hot swap a variable definition.
 *@param   Object   selectorName_Property   expects 'selectorName' and 'property' ex. {selectorName:'@abc', property:'123px'}.
 *@param   Boolean  refresh                 force a refresh of the variables and assignments. only needs to be called once during a change set at the end.
 */
function swapAProperty(selectorName_Property, refresh) {
    //due to a seporate thread that reads the files, we need to check to see if the files are still loading
    if (fileReadCount !== referenced_style_files.length) { queueChangeUp(selectorName_Property); return; }
    //tell us if we need to refresh
    for (var i = 0; i < variableDefinitions.selectorNames.length; i++) {
        if (variableDefinitions.selectorNames[i] === selectorName_Property.selectorName) {
            //swap a prop
            variableDefinitions.properties[i] = selectorName_Property.property;
        }
    }
    if (refresh) { refreshTheme(); }
}

/**
 * Public. Called by the user. Allows that user to swap out multiple variables.
 *@param   ArrayofObject   selectorNames_Properties   expects an Array of 'selectorName' and 'property' ex. {selectorNames:new Array('@abc','@def'), properties:new Array('123px','456px')}.
 */
//Needs work
function swapMultipleProperties(selectorNames_Properties) {
    //due to a seporate thread that reads the files, we need to check to see if the files are still loading
    if (fileReadCount !== referenced_style_files.length) {
        for (var i = 0; i < selectorNames_Properties.selectorNames.length; i++) {
            queueChangeUp({ selectorName: selectorNames_Properties.selectorNames[i], property: selectorNames_Properties.properties[i] });
        }
        return;
    }

    for (var i = 0; i < selectorNames_Properties.selectorNames.length; i++) {
        swapAProperty({ selectorName: selectorNames_Properties.selectorNames[i], property: selectorNames_Properties.properties[i] });
    }
    refreshTheme();
}

/**
 * Private. Called by swapAProperty. Allows users to queue up property swapping until all of the style files are read in.
 *@param   Object   selectorName_Property   expects 'selectorName' and 'property' ex. {selectorName:'@abc', property:'123px'}.
 */
function queueChangeUp(selectorName_Property) {
    queuedChanges.selectorNames[queuedChanges.selectorNames.length] = selectorName_Property.selectorName;
    queuedChanges.properties[queuedChanges.properties.length] = selectorName_Property.property;
}

//Image Color Changing
ColorHelper = {};

/**
 * Private. Called by ColorHelper.setFunction. Gets all of the pixels within an image.
 *@param   object   img   an image element.
 */
ColorHelper.getPixels = function (img) {
    var c, ctx;
    if (img.getContext) {
        c = img;
        try { ctx = c.getContext('2d'); } catch (e) { }
    }
    if (!ctx) {
        c = this.getCanvas(img.width, img.height);
        ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
    }
    return ctx.getImageData(0, 0, c.width, c.height);
};

/**
 * Private. Called by ColorHelper.getPixels. Creates a new canvas object.
 *@param   Number   w   canvas width.
 *@param   Number   h   canvas height.
 */
ColorHelper.getCanvas = function (w, h) {
    //create a new canvas
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};

/**
 * Private. Called by pushChange. Executes a function you tell it to.
 *@param   Function func        the function this function should execute.
 *@param   Object   image       created img element.
 *@param   Object   var_args    not used.
 */
ColorHelper.setFunction = function (func, image, var_args) {
    var args = [this.getPixels(image)];
    //pushes on the color attributes we send it.
    for (var i = 2; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    //executes the method
    return func.apply(null, args);
};

/**
 * Private. Used by pushChange. Changes the color pixel by pixel.
 *@param   Object   pixels   stores the pixel data.
 *@param   Array    colors   (r,g,b)
 *@param   Object   args     Not used.
 */
ColorHelper.changeColor = function (pixels, colors, args) {
    var d = pixels.data;
    //easy if the color isn't transpartent then change it to whatever i tell you.
    for (var i = 0; i < d.length; i += 4) {
        if (d[i] !== 0) { d[i] = colors[0]; }
        if (d[i + 1] !== 0) { d[i + 1] = colors[1]; }
        if (d[i + 2] !== 0) { d[i + 2] = colors[2]; }
    }
    return pixels;
};

/**
 * Private. Called by colorChangePerformed. Changes the color of an image pixel by pixel.
 *@param   Object   selector   the canvas to change.
 *@param   Function func       which color modifier to call.
 *@param   String   cssColor   Either hsl or rgb color.
 */
function pushChange(selector, func, cssColor) {

    var c = selector;
    //must be a canvas in order for this to work.
    if (c.nodeName === 'CANVAS') {
        var colors = [];
        //if HSL convert to rgb
        if (cssColor.indexOf('hsl') !== -1) {
            //pull out hsl markup
            colors = cssColor.replace('hsl', '').replace('(', '').replace(')', '').split(',');
            colors = hslToRgb(colors[0], colors[1], colors[2]);
        }
        else if (cssColor.indexOf('rgb') !== -1) {
            //pull out rgb markup
            colors = cssColor.replace('rgb', '').replace('(', '').replace(')', '').split(',');
        }

        //create a new img tag
        var img = document.createElement('img');
        //set the width and height as the same
        img.width = c.getAttribute('width');
        img.height = c.getAttribute('height');
        //take the background-image assigned to the canvas and set it to the src of the img
        var rawUrl = '';
        //make background-image setable
        c.setStyle('background-image', '');
        //Due to different methods to extract the same data, this if statement was born.
        if (window.getComputedStyle) {
            rawUrl = window.getComputedStyle(c, "").backgroundImage;
        }
        else {
            rawUrl = c.currentStyle.backgroundImage;
        }
        img.src = rawUrl.replace('url', '').replace('(', '').replace(')', '').replace(/\"/g, '');
        //clear the canvas background
        c.setStyle('background-image', 'url()');
        //Do the color work
        var idata = ColorHelper.setFunction(func, img, colors);
        c.setAttribute('width', idata.width);
        c.setAttribute('height', idata.height);
        var ctx = c.getContext('2d');
        //paint the image
        ctx.putImageData(idata, 0, 0);
    }
    else {
        throw ('this will only work with a canvas element');
    }
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, (s * 100) + '%', (l * 100) + '%'];
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  l       The lightness
 * @return  Array           The RGB representation
 */
function hslToRgb(h, s, l) {
    var r, g, b;
    h = (+h.replace('%', '').trim()) / 360;
    s = (+s.replace('%', '').trim()) / 100;
    l = (+l.replace('%', '').trim()) / 100;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
}

/**
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and v in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSV representation
 */
function rgbToHsv(r, g, b) {
    r = r / 255, g = g / 255, b = b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, v];
}

/**
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes h, s, and v are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  v       The value
 * @return  Array           The RGB representation
 */
function hsvToRgb(h, s, v) {
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return [r * 255, g * 255, b * 255];
}
