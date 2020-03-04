// The same copy of the original work of https://github.com/seratch/apriori.js
// with two minor modifications: read from a local file with JavaScript and replace " by '
(function(root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define('apriori', [], factory);
    } else {
        root['Apriori'] = factory();
    }
}(this, function() {

    'use strict';

    var Apriori;
    (function(Apriori) {
        var AnalysisResult = (function() {
            function AnalysisResult(frequentItemSets, associationRules) {
                this.frequentItemSets = frequentItemSets;
                this.associationRules = associationRules;
            }
            return AnalysisResult;
        }
        )();
        Apriori.AnalysisResult = AnalysisResult;

        var FrequentItemSet = (function() {
            function FrequentItemSet(itemSet, support) {
                this.itemSet = itemSet;
                this.support = support;
            }
            return FrequentItemSet;
        }
        )();
        Apriori.FrequentItemSet = FrequentItemSet;

        var AssociationRule = (function() {
            function AssociationRule(lhs, rhs, confidence) {
                this.lhs = lhs;
                this.rhs = rhs;
                this.confidence = confidence;
            }
            return AssociationRule;
        }
        )();
        Apriori.AssociationRule = AssociationRule;

        var Algorithm = (function() {
            function Algorithm(minSupport, minConfidence, debugMode) {
                this.minSupport = minSupport ? minSupport === 0 ? 0 : minSupport : 0.15;
                this.minConfidence = minConfidence ? minConfidence === 0 ? 0 : minConfidence : 0.6;
                this.debugMode = debugMode || false;
            }
            Algorithm.prototype.analyze = function(transactions) {
                var self = this;
                var beforeMillis = new Date().getTime();

                var frequencies = {};
                var frequentItemSets = {};

                var oneElementItemSets = self.toOneElementItemSets(transactions);
                var oneCItemSets = self.findItemSetsMinSupportSatisfied(oneElementItemSets, transactions, self.minSupport, frequencies);
                var currentLItemSets = oneCItemSets;
                var itemSetSize = 1;

                if (self.debugMode) {
                    console.log('Before finding item sets: ' + self.getTime(beforeMillis) + ' ms');
                }
                var extractItemSet = function(f) {
                    return f.itemSet;
                };
                while (currentLItemSets.length !== 0) {
                    frequentItemSets[itemSetSize] = currentLItemSets;
                    var joinedSets = ArrayUtils.toFixedSizeJoinedSets(currentLItemSets.map(extractItemSet), itemSetSize + 1);
                    currentLItemSets = self.findItemSetsMinSupportSatisfied(joinedSets, transactions, self.minSupport, frequencies);
                    itemSetSize += 1;
                }
                if (self.debugMode) {
                    console.log('After finding item sets: ' + self.getTime(beforeMillis) + ' ms');
                }

                var calculateSupport = function(itemSet, frequencies, transactions) {
                    var frequency = frequencies[itemSet.toString()];
                    return frequency ? frequency / transactions.length : 0;
                };
                var foundSubSets = [];
                var isTheRuleAlreadyFound = function(itemSet) {
                    var found = false;
                    foundSubSets.forEach(function(subset) {
                        if (!found)
                            found = subset.toString() === itemSet.toString();
                    });
                    return found;
                };

                if (self.debugMode) {
                    console.log('Before calculating association rules: ' + self.getTime(beforeMillis) + ' ms');
                }
                var associationRules = [];
                var currentItemSet;
                var saveAssociationRuleIfFound = function(subsetItemSet) {
                    var diffItemSet = ArrayUtils.getDiffArray(currentItemSet, subsetItemSet);
                    if (diffItemSet.length > 0) {
                        var itemSupport = calculateSupport(currentItemSet, frequencies, transactions)
                          , subsetSupport = calculateSupport(subsetItemSet, frequencies, transactions)
                          , confidence = itemSupport / subsetSupport;

                        if (!isNaN(confidence) && !isTheRuleAlreadyFound(subsetItemSet) && confidence >= self.minConfidence) {
                            foundSubSets.push(subsetItemSet);
                            associationRules.push(new Apriori.AssociationRule(subsetItemSet,diffItemSet,confidence));
                        }
                    }
                };
                var saveAllAssociationRulesIfFound = function(itemSet) {
                    currentItemSet = itemSet;
                    ArrayUtils.toAllSubSets(currentItemSet).forEach(saveAssociationRuleIfFound);
                };
                for (var k in frequentItemSets) {
                    var itemSets = frequentItemSets[k].map(extractItemSet);
                    if (itemSets.length === 0 || itemSets[0].length <= 1) {
                        continue;
                    }
                    itemSets.forEach(saveAllAssociationRulesIfFound);
                }
                if (self.debugMode) {
                    console.log('After calculating association rules: ' + self.getTime(beforeMillis) + ' ms');
                }

                var analysisResult = new AnalysisResult(frequentItemSets,associationRules);
                if (self.debugMode) {
                    console.log('AnalysisResult: ' + JSON.stringify(analysisResult));
                    console.log('Apriori.Algorithm\'s total spent time: ' + self.getTime(beforeMillis) + ' ms');
                }
                return analysisResult;
            }
            ;

            Algorithm.prototype.toOneElementItemSets = function(transactions) {
                var nestedArrayOfItem = [];
                transactions.forEach(function(transaction) {
                    transaction.forEach(function(item) {
                        nestedArrayOfItem.push(new Array(item));
                    });
                });
                return ArrayUtils.toArraySet(nestedArrayOfItem);
            }
            ;

            Algorithm.prototype.findItemSetsMinSupportSatisfied = function(itemSets, transactions, minSupport, frequencies) {
                var filteredItemSets = []
                  , localFrequencies = {};

                itemSets.forEach(function(itemSet) {
                    transactions.forEach(function(transaction) {
                        if (ArrayUtils.isSubSetArrayOf(itemSet, transaction)) {
                            if (!frequencies[itemSet.toString()])
                                frequencies[itemSet.toString()] = 0;
                            if (!localFrequencies[itemSet.toString()])
                                localFrequencies[itemSet.toString()] = 0;
                            frequencies[itemSet.toString()] += 1;
                            localFrequencies[itemSet.toString()] += 1;
                        }
                    });
                });
                var alreadyAdded = false;
                var setAsAlreadyAddedIfFound = function(f) {
                    if (!alreadyAdded)
                        alreadyAdded = f.itemSet.toString() === itemSet.toString();
                };
                for (var strItemSet in localFrequencies) {
                    var itemSet = strItemSet.split(',').sort()
                      , localCount = localFrequencies[itemSet.toString()]
                      , support = localCount / transactions.length;

                    if (support >= minSupport) {
                        alreadyAdded = false;
                        filteredItemSets.forEach(setAsAlreadyAddedIfFound);
                        if (!alreadyAdded) {
                            filteredItemSets.push(new FrequentItemSet(itemSet,support));
                        }
                    }
                }
                return filteredItemSets;
            }
            ;

            Algorithm.prototype.showAnalysisResult = function(data) {
                var self = this;
                var transactions = ArrayUtils.readCSVToArray(data, ',');
                var analysisResult = self.analyze(transactions);
                console.log(JSON.stringify(analysisResult.associationRules));
                return (analysisResult.associationRules);
            }
            ;

            Algorithm.prototype.getTime = function(initial) {
                return new Date().getTime() - initial;
            }
            ;
            return Algorithm;
        }
        )();
        Apriori.Algorithm = Algorithm;

        var ArrayUtils = (function() {
            function ArrayUtils() {}
            ArrayUtils.toStringSet = function(array) {
                var uniqueArray = [];
                array.forEach(function(e) {
                    if (uniqueArray.indexOf(e) === -1)
                        uniqueArray.push(e);
                });
                return uniqueArray;
            }
            ;
            ArrayUtils.toArraySet = function(arrayOfArray) {
                var foundElements = {}
                  , uniqueArray = [];
                arrayOfArray.forEach(function(array) {
                    if (!foundElements.hasOwnProperty(array.toString())) {
                        uniqueArray.push(array);
                        foundElements[array.toString()] = true;
                    }
                });
                return uniqueArray;
            }
            ;
            ArrayUtils.toAllSubSets = function(array) {
                var op = function(n, sourceArray, currentArray, allSubSets) {
                    if (n === 0) {
                        if (currentArray.length > 0) {
                            allSubSets[allSubSets.length] = ArrayUtils.toStringSet(currentArray);
                        }
                    } else {
                        for (var j = 0; j < sourceArray.length; j++) {
                            var nextN = n - 1
                              , nextArray = sourceArray.slice(j + 1)
                              , updatedCurrentSubSet = currentArray.concat([sourceArray[j]]);
                            op(nextN, nextArray, updatedCurrentSubSet, allSubSets);
                        }
                    }
                };
                var allSubSets = [];
                array.sort();
                for (var i = 1; i < array.length; i++) {
                    op(i, array, [], allSubSets);
                }
                allSubSets.push(array);
                return ArrayUtils.toArraySet(allSubSets);
            }
            ;
            ArrayUtils.toFixedSizeJoinedSets = function(itemSets, length) {
                var joinedSetArray = [];
                itemSets.forEach(function(itemSetA) {
                    itemSets.forEach(function(itemSetB) {
                        if (ArrayUtils.getDiffArray(itemSetA, itemSetB).length > 0) {
                            var mergedArray = [].concat(itemSetA).concat(itemSetB)
                              , joinedSet = ArrayUtils.toStringSet(mergedArray);
                            if (joinedSet.length === length)
                                joinedSetArray.push(joinedSet);
                        }
                    });
                });
                return ArrayUtils.toArraySet(joinedSetArray);
            }
            ;
            ArrayUtils.isSubSetArrayOf = function(targetArray, superSetArray) {
                var isSubSetArray = true;
                targetArray.forEach(function(item) {
                    if (isSubSetArray && superSetArray.indexOf(item) === -1)
                        isSubSetArray = false;
                });
                return isSubSetArray;
            }
            ;
            ArrayUtils.getDiffArray = function(arrayA, arrayB) {
                var diffArray = [];
                arrayA.forEach(function(e) {
                    if (arrayB.indexOf(e) === -1)
                        diffArray.push(e);
                });
                return diffArray;
            }
            ;
            ArrayUtils.readCSVToArray = function(inputString, delimiter) {
                delimiter = delimiter || ',';
                var regexp = new RegExp(("(\\" + delimiter + "|\\r?\\n|\\r|^)" + "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" + "([^\"\\" + delimiter + "\\r\\n]*))"),'gi');
                inputString = inputString.split("\"").join("'");
                var arrayOfRows = [[]];
                var matched;
                while (!!(matched = regexp.exec(inputString))) {
                    var matchedDelimiter = matched[1];
                    if (matchedDelimiter.length && matchedDelimiter !== delimiter) {
                        arrayOfRows.push([]);
                    }
                    var matchedValue = matched[2] ? matched[2].replace(new RegExp('""','g'), '"') : matched[3];
                    if (matchedValue.length > 0) {
                        arrayOfRows[arrayOfRows.length - 1].push(matchedValue);
                    }
                }
                return arrayOfRows;
            }
            ;
            return ArrayUtils;
        }
        )();
        Apriori.ArrayUtils = ArrayUtils;
    }
    )(Apriori || (Apriori = {}));
    //# sourceMappingURL=apriori.js.map

    return Apriori;

}));

///////////////////////////////
// taken as is from https://github.com/tcorral/JSONC

/*global gzip, Base64*/
(function() {

    var root, JSONC = {}, isNodeEnvironment, _nCode = -1, toString = {}.toString;

    /**
		   * set the correct root depending from the environment.
		   * @type {Object}
		   * @private
		   */
    root = this;
    /**
		   * Check if JSONC is loaded in Node.js environment
		   * @type {Boolean}
		   * @private
		   */
    isNodeEnvironment = typeof exports === 'object' && typeof module === 'object' && typeof module.exports === 'object' && typeof require === 'function';
    /**
		   * Checks if the value exist in the array.
		   * @param arr
		   * @param v
		   * @returns {boolean}
		   */
    function contains(arr, v) {
        var nIndex, nLen = arr.length;
        for (nIndex = 0; nIndex < nLen; nIndex++) {
            if (arr[nIndex][1] === v) {
                return true;
            }
        }
        return false;
    }

    /**
		   * Removes duplicated values in an array
		   * @param oldArray
		   * @returns {Array}
		   */
    function unique(oldArray) {
        var nIndex, nLen = oldArray.length, aArr = [];
        for (nIndex = 0; nIndex < nLen; nIndex++) {
            if (!contains(aArr, oldArray[nIndex][1])) {
                aArr.push(oldArray[nIndex]);
            }
        }
        return aArr;
    }

    /**
		   * Escapes a RegExp
		   * @param text
		   * @returns {*}
		   */
    function escapeRegExp(text) {
        return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    /**
		   * Returns if the obj is an object or not.
		   * @param obj
		   * @returns {boolean}
		   * @private
		   */
    function _isObject(obj) {
        return toString.call(obj) === '[object Object]';
    }

    /**
		   * Returns if the obj is an array or not
		   * @param obj
		   * @returns {boolean}
		   * @private
		   */
    function _isArray(obj) {
        return toString.call(obj) === '[object Array]';
    }

    /**
		   * Converts a bidimensional array to object
		   * @param aArr
		   * @returns {{}}
		   * @private
		   */
    function _biDimensionalArrayToObject(aArr) {
        var obj = {}, nIndex, nLen = aArr.length, oItem;
        for (nIndex = 0; nIndex < nLen; nIndex++) {
            oItem = aArr[nIndex];
            obj[oItem[0]] = oItem[1];
        }
        return obj;
    }

    /**
		   * Convert a number to their ascii code/s.
		   * @param index
		   * @param totalChar
		   * @param offset
		   * @returns {Array}
		   * @private
		   */
    function _numberToKey(index, totalChar, offset) {
        var sKeys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=_!?()*'
          , aArr = []
          , currentChar = index;
        totalChar = totalChar || sKeys.length;
        offset = offset || 0;
        while (currentChar >= totalChar) {
            aArr.push(sKeys.charCodeAt((currentChar % totalChar) + offset));
            currentChar = Math.floor(currentChar / totalChar - 1);
        }
        aArr.push(sKeys.charCodeAt(currentChar + offset));
        return aArr.reverse();
    }

    /**
		   * Returns the string using an array of ASCII values
		   * @param aKeys
		   * @returns {string}
		   * @private
		   */
    function _getSpecialKey(aKeys) {
        return String.fromCharCode.apply(String, aKeys);
    }

    /**
		   * Traverse all the objects looking for keys and set an array with the new keys
		   * @param json
		   * @param aKeys
		   * @returns {*}
		   * @private
		   */
    function _getKeys(json, aKeys) {
        var aKey, sKey, oItem;

        for (sKey in json) {

            if (json.hasOwnProperty(sKey)) {
                oItem = json[sKey];
                if (_isObject(oItem) || _isArray(oItem)) {
                    aKeys = aKeys.concat(unique(_getKeys(oItem, aKeys)));
                }
                if (isNaN(Number(sKey))) {
                    if (!contains(aKeys, sKey)) {
                        _nCode += 1;
                        aKey = [];
                        aKey.push(_getSpecialKey(_numberToKey(_nCode)), sKey);
                        aKeys.push(aKey);
                    }
                }
            }
        }
        return aKeys;
    }

    /**
		   * Method to compress array objects
		   * @private
		   * @param json
		   * @param aKeys
		   */
    function _compressArray(json, aKeys) {
        var nIndex, nLenKeys;

        for (nIndex = 0,
        nLenKeys = json.length; nIndex < nLenKeys; nIndex++) {
            json[nIndex] = JSONC.compress(json[nIndex], aKeys);
        }
    }

    /**
		   * Method to compress anything but array
		   * @private
		   * @param json
		   * @param aKeys
		   * @returns {*}
		   */
    function _compressOther(json, aKeys) {
        var oKeys, aKey, str, nLenKeys, nIndex, obj;
        aKeys = _getKeys(json, aKeys);
        aKeys = unique(aKeys);
        oKeys = _biDimensionalArrayToObject(aKeys);

        str = JSON.stringify(json);
        nLenKeys = aKeys.length;

        for (nIndex = 0; nIndex < nLenKeys; nIndex++) {
            aKey = aKeys[nIndex];
            str = str.replace(new RegExp(escapeRegExp('"' + aKey[1] + '"'),'g'), '"' + aKey[0] + '"');
        }
        obj = JSON.parse(str);
        obj._ = oKeys;
        return obj;
    }

    /**
		   * Method to decompress array objects
		   * @private
		   * @param json
		   */
    function _decompressArray(json) {
        var nIndex, nLenKeys;

        for (nIndex = 0,
        nLenKeys = json.length; nIndex < nLenKeys; nIndex++) {
            json[nIndex] = JSONC.decompress(json[nIndex]);
        }
    }

    /**
		   * Method to decompress anything but array
		   * @private
		   * @param jsonCopy
		   * @returns {*}
		   */
    function _decompressOther(jsonCopy) {
        var oKeys, str, sKey;

        oKeys = JSON.parse(JSON.stringify(jsonCopy._));
        delete jsonCopy._;
        str = JSON.stringify(jsonCopy);
        for (sKey in oKeys) {
            if (oKeys.hasOwnProperty(sKey)) {
                str = str.replace(new RegExp('"' + sKey + '"','g'), '"' + oKeys[sKey] + '"');
            }
        }
        return str;
    }

    /**
		   * Compress a RAW JSON
		   * @param json
		   * @param optKeys
		   * @returns {*}
		   */
    JSONC.compress = function(json, optKeys) {
        if (!optKeys) {
            _nCode = -1;
        }
        var aKeys = optKeys || [], obj;

        if (_isArray(json)) {
            _compressArray(json, aKeys);
            obj = json;
        } else {
            obj = _compressOther(json, aKeys);
        }
        return obj;
    }
    ;
    /**
		   * Use LZString to get the compressed string.
		   * @param json
		   * @param bCompress
		   * @returns {String}
		   */
    JSONC.pack = function(json, bCompress) {
        var str = JSON.stringify((bCompress ? JSONC.compress(json) : json));
        return Base64.encode(String.fromCharCode.apply(String, gzip.zip(str, {
            level: 9
        })));
    }
    ;
    /**
		   * Decompress a compressed JSON
		   * @param json
		   * @returns {*}
		   */
    JSONC.decompress = function(json) {
        var str, jsonCopy = JSON.parse(JSON.stringify(json));
        if (_isArray(jsonCopy)) {
            _decompressArray(jsonCopy);
        } else {
            str = _decompressOther(jsonCopy);
        }
        return str ? JSON.parse(str) : jsonCopy;
    }
    ;
    function getArr(str) {
        var nIndex = 0
          , nLen = str.length
          , arr = [];
        for (; nIndex < nLen; nIndex++) {
            arr.push(str.charCodeAt(nIndex));
        }
        return arr;
    }

    /**
		   * Returns the JSON object from the LZW string
		   * @param gzipped
		   * @param bDecompress
		   * @returns {Object}
		   */
    JSONC.unpack = function(gzipped, bDecompress) {
        var aArr = getArr(Base64.decode(gzipped))
          , str = String.fromCharCode.apply(String, gzip.unzip(aArr, {
            level: 9
        }))
          , json = JSON.parse(str);
        return bDecompress ? JSONC.decompress(json) : json;
    }
    ;
    /*
		   * Expose Hydra to be used in node.js, as AMD module or as global
		   */
    root.JSONC = JSONC;
    if (isNodeEnvironment) {
        module.exports = JSONC;
    } else if (typeof define !== 'undefined') {
        define('jsoncomp', [], function() {
            return JSONC;
        });
    }
}
.call(this));

window['data'] = {};

function handleFileSelect(evt) {
    var file = evt.target.files[0];
    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: function(results) {
            window.data = results;
            sparse_columns = [];
            if (results.errors > 0)
                console.error(result.errors);
            data.meta.fields.map(function(column) {
                value_count = _.countBy(_.pluck(data.data, column))[null];
                if (value_count >= 0 && value_count / data.data.length > 0.8)
                    sparse_columns.push(column)
            })
            var learning_dataset = _.map(data.data, function(row) {
                return _.omit(row, sparse_columns);
            }).slice(0, 100);
            JSONC.compress(learning_dataset)
            // console.log(JSON.stringify(learning_dataset))
            header = "\"" + _.values(learning_dataset[0]._).join("\",\"") + "\"\n";
            learning_dataset = header + _.map(learning_dataset, function(obj) {
                return "\"" + _.values(obj).slice(0, -1).join("\",\"") + "\"\n"
            }).join('');
            result = new Apriori.Algorithm(0.01,0.01,false).showAnalysisResult(learning_dataset).filter(function(elem) {
                return elem.lhs[0] != "''" && elem.rhs[0] != "''"
            });
			document.getElementById("demo").innerHTML = JSON.stringify(result);
        }
    });

}

$(document).ready(function() {
    $("#csv-file").change(handleFileSelect);
});
