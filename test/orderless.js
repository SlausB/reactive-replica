import 'babel-polyfill'
import Place from '../index'

/** Invokes specified test in all possible orders what defined as equivalent by API's specification.*/
export class Orderless
{
    constructor()
    {
        this.layer()
    }
    
    listen( path, name, listener, placePath )
    {
        this.back().listens.push( {
            path : path,
            name : name,
            listener : listener,
            placePath : placePath
        } )
    }
    
    forget( path, name, listener, placePath )
    {
        this.back().forgets.push( {
            path : path,
            name : name,
            listener : listener,
            placePath : placePath
        } )
    }
    
    append( path, name, placePath )
    {
        this.back().appends.push( {
            path : path,
            name : name,
            placePath : placePath
        } )
    }
    
    remove( path, name, placePath )
    {
        this.back().removes.push( {
            path : path,
            name : name,
            placePath : placePath
        } )
    }
    
    replicate( replication )
    {
        this.back().replicates.push( replication )
    }
    
    back()
    {
        return this.layers[ this.layers.length - 1 ]
    }
    
    /** Put another layer to which all future calls will be applied.*/
    layer()
    {
        this.layers.push( new Layer )
    }
    
    /** Executes at the end of it's layer.*/
    expect( expectation )
    {
        this.back().expectations.push( expectation )
    }
    
    //TODO: permutations against layers (good thing tests aren't that inclined to rely on versatility in-between layers):
    run()
    {
        var previous = undefined
        for ( var layerIndex = 0; layerIndex < this.layers.length; ++ layerIndex )
        {
            previous = new Permutation( this.layers[ layerIndex ], previous )
        }
    }
    
    layers = []
}

class Permutation
{
    static LISTEN = 1
    static FORGET = 2
    static APPEND = 3
    static REMOVE = 4
    static REPLICATE = 5
    
    constructor( layer, previous )
    {
        this.layer = layer
        this.previous = previous
        
        var remaining = []
        function permute( type, target )
        {
            for ( var i = 0; i < target.length; ++ i )
            {
                remaining.push( {
                    type : type,
                    index : i
                } )
            }
        }
        permute( Permutation.LISTEN, layer.listens )
        permute( Permutation.FORGET, layer.forgets )
        permute( Permutation.APPEND, layer.appends )
        permute( Permutation.REMOVE, layer.removes )
        permute( Permutation.REPLICATE, layer.replicates )
        
        this.run( remaining )
    }
    
    run( remaining )
    {
        //all the specified actions of current layer applied:
        if ( remaining.length < 1 )
        {
            //just once when processing previous layers:
            if ( ! this.final )
            {
                this.final = this.permutation.slice( 0 )
            }
            
            this.apply( this.permutation )
        }
        else
        {
            for ( var remainingIndex = 0; remainingIndex < remaining.length; ++ remainingIndex )
            {
                var remainingAction = remaining[ remainingIndex ]
                
                this.permutation.push( remainingAction )
                
                var clone = remaining.filter( function( action, index ) { return index !== remainingIndex } )
                this.run( clone )
                
                this.permutation.pop()
            }
        }
    }
    
    apply( permutation )
    {
        var root
        if ( this.previous !== undefined )
        {
            root = this.previous.apply( this.previous.final )
        }
        else
        {
            root = new Place
        }
        
        //place is created at first touch:
        var myPlaces = []
        function touch( path, name )
        {
            for ( var myPlaceIndex in myPlaces )
            {
                var myPlace = myPlaces[ myPlaceIndex ]
                if ( myPlace.path === path && myPlace.name === name )
                {
                    return myPlace.place
                }
            }
            
            var place = new Place( name )
            myPlaces.push( { path : path, name : name, place : place } )
            return place
        }
        
        for ( var i = 0; i < permutation.length; ++ i )
        {
            var action = permutation[ i ]
            switch ( action.type )
            {
                case Permutation.LISTEN:
                    var listener = this.layer.listens[ action.index ]
                    touch( listener.path, listener.name ).listen( listener.listener, listener.placePath )
                    break
                
                case Permutation.FORGET:
                    var forget = this.layer.forgets[ action.index ]
                    touch( forget.path, forget.name ).forget( forget.listener, forget.placePath )
                    break
                
                case Permutation.APPEND:
                    var append = this.layer.appends[ action.index ]
                    root.append( touch( append.path, append.name ), append.placePath )
                    break
                
                case Permutation.REMOVE:
                    var remove = this.layer.removes[ action.index ]
                    touch( remove.path, remove.name ).remove( remove.placePath )
                    break
                
                case Permutation.REPLICATE:
                    var replicate = this.layer.replicates[ action.index ]
                    root.replicate( replicate )
                    break
                
                default:
                    throw new Error( 'O: undefined action type' )
                    break
            }
        }
        
        for ( var ei = 0; ei < this.layer.expectations.length; ++ ei )
        {
            var expectation = this.layer.expectations[ ei ]
            expectation( root )
        }
        
        return root
    }
    
    permutation = []
}

/** Equivalence is only per-layer. For every order of current level all previous layers are fully fulfilled.*/
class Layer
{
    listens = []
    forgets = []
    appends = []
    removes = []
    replicates = []
    
    expectations = []
}

