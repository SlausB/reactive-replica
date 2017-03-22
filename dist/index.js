'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

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
                var specified;
                for (var placeIndex in this.children) {
                    var candidate = this.children[placeIndex];
                    if (candidate.name === placeName) {
                        specified = candidate;
                        break;
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
                        //appended place isn't user defined so no point calling handleAppend() and/or define ...
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
    appending.parent = place;
    handleAppend(place, appending);
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

    //handle already existing replica:
    if (isFunction(listener.create)) {
        if (place.replica !== undefined) {
            listener.create(place.replica);
        }
    }

    //... and for absent replica as well since application supposed to replicate the present model's shape:
    if (isFunction(listener.remove)) {
        if (place.replica === undefined) {
            listener.remove(place.removedReplica);
        }
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
            onRemove(place, place.replica);

            for (var i = 0; i < place.children.length; ++i) {
                var child = place.children[i];
                child.replicate(undefined);
            }

            place.removedReplica = place.replica;

            delete place.replica;
        }
    }
    //handle CREATE/CHANGE:
    else {
            if (place.replica === undefined) {
                onCreate(place, value);
            }
            //equality determination policy for objects wasn't established yet, but let's put responsibility to handle object's changes to nested Places:
            //be careful with null values (since those are 'object's) - don't let them sneak into model and/or server-side:
            else if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== 'object' || _typeof(place.replica) !== 'object') {
                    if (value !== place.replica) {
                        onChange(place, place.replica, value);
                    }
                }
            //otherwise both are objects - won't change ...

            //we don't care about model's fields which has no attached Places against them:
            for (var i = 0; i < place.children.length; ++i) {
                var child = place.children[i];

                //I suppose we shouldn't care if replicating value isn't of Object type since [] operator should just return undefined (is what we need) in that case:
                child.replicate(value[child.name]);
            }

            place.replica = value;
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

/** Recursively check for possible CREATE since data may already exist.*/
function handleAppend(place, appended) {
    //REMOVE is handled when listener was added to appending place:
    /*//we cannot use just appended.replicate( place.replica ) here because it doesn't treat data absence as REMOVE and vice versa ...
    
    const replica = place.replica === undefined ? undefined : place.replica[ appended.name ]
    if ( replica === undefined )
    {
        onRemove(
            appended,
            place.removedReplica === undefined ? undefined : place.removedReplica[ appended.name ]
        )
    }
    else
    {
        onCreate( appended, replica )
    }
    appended.replica = replica
    
    for ( var i in appended.children )
    {
        var child = appended.children[ i ]
        handleAppend( appended, child )
    }*/
    appended.replicate(place.replica === undefined ? undefined : place.replica[appended.name]);
}

function onCreate(place, created) {
    for (var i in place.listeners) {
        var listener = place.listeners[i];
        if (isFunction(listener.create)) {
            listener.create(created, place);
        }
    }
}

function onChange(place, before, after) {
    for (var i in place.listeners) {
        var listener = place.listeners[i];
        if (isFunction(listener.change)) {
            listener.change(before, after, place);
        }
    }
}

function onRemove(place, old) {
    for (var i in place.listeners) {
        var listener = place.listeners[i];
        if (isFunction(listener.remove)) {
            listener.remove(old, place);
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