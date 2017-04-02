'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/** Position within server-side DOM hierarchy.
TODO: implement more processing efficient (i.e. less memory efficient) approach with static (growing-only) model without dynamic allocation.
*/
var Place = function () {
    function Place(name, replica) {
        _classCallCheck(this, Place);

        this.replica = undefined;
        this.name = undefined;
        this.children = [];
        this.listeners = [];
        this.busy = false;
        this.postponedCommands = [];
        this.removedReplica = undefined;

        this.name = name;
        this.replica = replica;
    }

    /** Handle server-side data.*/

    /** JS-native server-side value which was last replicated to this place of client-side.*/


    _createClass(Place, [{
        key: 'replicate',
        value: function replicate(value) {
            postpone(this, {
                type: REPLICATE,
                value: value
            });
        }

        /** Get child of this Place under specified path. Name is right within the path. Create all the intermediate places.*/

    }, {
        key: 'resolve',
        value: function resolve(path) {
            //undefined or else if just current place:
            if (typeof path !== 'string') {
                return this;
            }

            var place = this;
            var actualPath = path.split('.');
            for (var i = 0; i < actualPath.length; ++i) {
                var placeName = actualPath[i];

                //looking for specified place:
                var specified = undefined;
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    for (var _iterator = this.children[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var candidate = _step.value;

                        if (candidate.name === placeName) {
                            specified = candidate;
                            break;
                        }
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }

                if (specified) {
                    place = specified;
                }
                //creating the intermediate one:
                else {
                        var parent = place;
                        place = new Place(placeName);
                        parent.children.push(place);

                        //appended place isn't user defined so no point replicating it just pass already any existing value:
                        place.replica = parent.replica === undefined ? undefined : parent.replica[place.name];
                    }
            }
            return place;
        }

        /** Add event listener of specified type to current place.*/

    }, {
        key: 'listen',
        value: function listen(listener, path) {
            postpone(this, {
                type: LISTEN,
                listener: listener,
                path: path
            });
        }

        /** Stop listening on specified event.*/

    }, {
        key: 'forget',
        value: function forget(listener, path) {
            postpone(this, {
                type: FORGET,
                listener: listener,
                path: path
            });
        }

        /** Remove from it's parent. Children and listeners remain untouched.*/

    }, {
        key: 'remove',
        value: function remove(place, path) {
            postpone(this, {
                type: REMOVE,
                removing: place,
                path: path
            });
        }

        /** Add another model element as a child to this one or fill intermediate places.
        @param path What intermediate places to create and pass. When omitted is the same as empty string. Intermediate places are separated with dot.
        */

    }, {
        key: 'append',
        value: function append(place, path) {
            postpone(this, {
                type: APPEND,
                place: place,
                path: path
            });
        }

        /** Server-side model's name.*/

        /** Fields.*/


        /** What will be notified when this place will be .*/


        /** True while model is being replicated and so currently propagating events. Any client-side modifications (through append(), remove() ...) will be postponed until replication finished.*/


        /** Everything what may modify replica's structure so has to be postponed until model isn't busy to avoid race conditions.
        { type, path, ... }
        */


        /** Last removed value stored to replicate to appending REMOVE listeners.*/

    }]);

    return Place;
}();

//TODO: invoke target function directly to avoid intermediate objects creation if place is not busy


exports.default = Place;
function postpone(place, command) {
    place.postponedCommands.push(command);

    if (!place.busy) {
        handlePostpones(place);
    }
}

function append(place, appending, path) {
    place = place.resolve(path);
    place.children.push(appending);

    appending.replicate(place.replica === undefined ? undefined : place.replica[appending.name]);
}

function remove(place, removing, path) {
    place = place.resolve(path);

    var index = place.children.indexOf(removing);
    if (index < 0) {
        console.error('Model: remove(): not enlisted within parent\'s children');
        return;
    }
    //using replacement instead of removement to make it faster:
    place.children[index] = place.children[place.children.length - 1];
    place.children.pop();
}

function listen(place, listener, path) {
    place = place.resolve(path);
    place.listeners.push(listener);

    //... and for absent replica as well since application supposed to replicate the present model's shape:
    if (place.replica === undefined) {
        issueRemove(listener, place, place.removedReplica);
    }
    //handle already existing replica:
    else {
            issueCreate(listener, place, place.replica);
        }
}

function forget(place, listener, path) {
    place = place.resolve(path);

    var before = place.listeners.length;

    place.listeners = place.listeners.filter(function (item) {
        return item !== listener;
    });
}

function replicate(place, value) {
    place.busy = true;

    //handle REMOVE:
    if (value === undefined) {
        if (place.replica !== undefined) {
            place.removedReplica = place.replica;
            delete place.replica;
            onRemove(place, place.removedReplica);

            for (var i = 0; i < place.children.length; ++i) {
                var child = place.children[i];
                child.replicate(undefined);
            }
        }
    }
    //handle CREATE/CHANGE:
    else {
            var old = place.replica;
            place.replica = value;

            if (old === undefined) {
                onCreate(place, value);
            }
            //okey, let application choose what change is, since arrays are also objects:
            /*//equality determination policy for objects wasn't established yet, but let's put responsibility to handle object's changes to nested Places:
            //be careful with null values (since those are 'object's) - don't let them sneak into model and/or server-side:
            else if ( typeof value !== 'object' || typeof old !== 'object' )
            {
                if ( value !== old )
                {
                    onChange( place, value, old )
                }
            }
            //otherwise both are objects - won't change ...*/
            else if (value != old) {
                    onChange(place, value, old);
                }

            //we don't care about model's fields which has no attached Places against them:
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = place.children[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var _child = _step2.value;

                    //I suppose we shouldn't care if replicating value isn't of Object type since [] operator should just return undefined (is what we need) in that case:
                    _child.replicate(value[_child.name]);
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }
        }

    place.busy = false;
}

function handlePostpones(place) {
    for (var i = 0; i < place.postponedCommands.length; ++i) {
        var command = place.postponedCommands[i];
        switch (command.type) {
            case LISTEN:
                listen(place, command.listener, command.path);
                break;

            case FORGET:
                forget(place, command.listener, command.path);
                break;

            case REMOVE:
                remove(place, command.removing, command.path);
                break;

            case APPEND:
                append(place, command.place, command.path);
                break;

            case REPLICATE:
                replicate(place, command.value);
                break;

            default:
                throw 'Replica.handlePostpones(): undefined command type.';
        }
    }
    place.postponedCommands.length = 0;
}

function issueCreate(listener, place, created) {
    if (listener.create === true) {
        if (isFunction(listener.change)) {
            listener.change(created, undefined, place);
        }
    } else if (isFunction(listener.create)) {
        listener.create(created, place);
    }
}

function onCreate(place, created) {
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = place.listeners[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var listener = _step3.value;

            issueCreate(listener, place, created);
        }
    } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
            }
        } finally {
            if (_didIteratorError3) {
                throw _iteratorError3;
            }
        }
    }
}

function onChange(place, after, before) {
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
        for (var _iterator4 = place.listeners[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var listener = _step4.value;

            if (listener.change === true) {
                if (isFunction(listener.create)) {
                    listener.create(after, place);
                }
            } else if (isFunction(listener.change)) {
                listener.change(after, before, place);
            }
        }
    } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
            }
        } finally {
            if (_didIteratorError4) {
                throw _iteratorError4;
            }
        }
    }
}

function issueRemove(listener, place, old) {
    if (isFunction(listener.remove)) {
        listener.remove(old, place);
    }
}

function onRemove(place, old) {
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
        for (var _iterator5 = place.listeners[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var listener = _step5.value;

            issueRemove(listener, place, old);
        }
    } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
            }
        } finally {
            if (_didIteratorError5) {
                throw _iteratorError5;
            }
        }
    }
}

var LISTEN = 1;
var FORGET = 2;
var REMOVE = 3;
var APPEND = 4;
var REPLICATE = 5;

/** From underscore.js.*/
function isFunction(obj) {
    return !!(obj && obj.constructor && obj.call && obj.apply);
}