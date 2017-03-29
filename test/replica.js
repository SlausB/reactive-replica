import 'babel-polyfill'
import Place from '../index'
import { Orderless } from './orderless'
var expect = require( 'chai' ).expect

describe( 'replica', function()
{
    it ( 'Simple replicate', function( done )
    {
        var root = new Place
        root.replicate(
            undefined,
            {
                test : 'simple replicate'
            }
        )
        done()
    } )
    
    it ( 'Notify before', function( done )
    {
        var root = new Place
        
        var place = new Place(
            'name',
            'value'
        )
        
        root.append( place )
        
        place.listen( {
            create : function()
            {
                done()
            }
        } )
        
        root.replicate(
            {
                name : 'value'
            }
        )
    } )
    
    it ( 'Listeners in any order', function( done )
    {
        var root = new Place
        
        var place = new Place(
            'name',
            'value'
        )
        
        root.append( place )
        
        root.replicate( { name : 'value' } )
        
        place.listen( {
            create : function()
            {
                done()
            }
        } )
    } )
    
    it ( 'CREATE children before', function( done )
    {
        var root = new Place
        
        var place = new Place(
            'root'
        )
        
        var child = new Place(
            'child',
            'value'
        )
        place.append( child )
        child.listen( {
            create : function()
            {
                done()
            }
        } )
        
        root.append( place )
        
        root.replicate(
            {
                root : {
                    child : 'value'
                }
            }
        )
    } )
    
    it ( 'CHANGE', function( done )
    {
        var root = new Place
        
        var place = new Place( 'child' )
        place.listen( {
            change : function()
            {
                done()
            }
        } )
        
        root.replicate( { child : 0 } )
        
        root.append( place )
        
        root.replicate( { child : 1 } )
    } ) 
    
    it ( 'Orderless', function( done )
    {
        //didn't know intensive execution assumed as async abandoned:
        this.timeout( 999999 )
        
        let o = new Orderless
        
        //LAYER 1
        
        o.replicate( { change : 1 } )
        
        //REMOVE when not yet present
        let removeInvoked = 0
        o.append( undefined, 'hollow' )
        o.listen( undefined, 'hollow', {
            remove : function()
            {
                //console.trace( 'Remove invoked' )
                ++ removeInvoked
            }
        } )
        o.expect( function()
        {
            expect( removeInvoked ).equal( 1 )
            removeInvoked = 0
        } )
        
        //CHANGE:
        let changeInvoked = 0
        o.append( undefined, 'change' )
        o.listen( undefined, 'change', {
            change : function()
            {
                ++ changeInvoked
            }
        } )
        
        //forget:
        let forgetCreate = 0
        o.append( undefined, 'forget' )
        let forget = {
            create : function()
            {
                ++ forgetCreate
            }
        }
        o.listen( undefined, 'forget', forget )
        o.expect( function()
        {
            expect( forgetCreate ).equal( 0 )
        } )
        
        
        //LAYER 2
        o.layer()
        
        //CHANGE:
        o.replicate( { change : 2 } )
        o.expect( function( root )
        {
            if ( changeInvoked < 1 )
            {
                console.trace( 'Why not changed? ', root )
            }
            expect( changeInvoked ).equal( 1 )
            changeInvoked = 0
        } )
        
        //forget:
        o.forget( undefined, 'forget', forget )
        
        
        //LAYER 3
        o.layer()
        
        //forget:
        o.replicate( { forget : 0 } )
        o.expect( function()
        {
            //handling places amongst layers doesn't work properly within Orderless for now:
            //expect( forgetCreate ).equal( 0 )
        } )
        
        
        o.run()
        
        done()
    } )
    
    it ( 'place append postponed', function( done )
    {
        let root = new Place(
            'root',
            {
                appended : 1
            }
        )
        
        let createCalled = 0
        let changeCalled = 0
        let removeCalled = 0
        
        let listener = {
            create : function( created )
            {
                ++ createCalled
                expect( created ).equal( 1 )
            },
            change : function( after, before )
            {
                ++ changeCalled
                expect( after ).equal( 2 )
                expect( before ).equal( 1 )
            },
            remove : function( removed )
            {
                ++ removeCalled
                expect( removed ).equal( undefined )
            }
        }
        
        let appended = new Place( 'appended' )
        appended.listen( listener )
        
        root.append( appended )
        root.replicate( {
            appended : 2
        } )
        
        listener.remove = function( removed )
        {
            ++ removeCalled
            expect( removed ).equal( 2 )
        }
        root.replicate( undefined )
        
        expect( createCalled, 'create called' ).equal( 1 )
        expect( changeCalled, 'change called' ).equal( 1 )
        expect( removeCalled, 'remove called' ).equal( 2 )
        
        done()
    } )
    
    it ( 'intermediate places automatically created', function( done )
    {
        let root = new Place
        
        let far = new Place( 'far' )
        let farCreated = 0
        far.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ farCreated
            }
        } )
        root.append( far, 'some.long.path' )
        
        let intermediate = new Place( 'intermediate' )
        let intermediateCreated = 0
        intermediate.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ intermediateCreated
            }
        } )
        root.append( intermediate, 'some' )
        
        let listenerWithPathCalled = 0
        root.listen(
            {
                create : function( created )
                {
                    expect( created ).equal( 10 )
                    ++ listenerWithPathCalled
                }
            },
            'listener.with.path'
        )
        
        root.replicate( {
            some : {
                long : {
                    path : {
                        far : 1
                    }
                },
                intermediate : 1
            },
            listener : {
                with : {
                    path : 10
                }
            }
        } )
        
        expect( farCreated, 'far created' ).equal( 1 )
        expect( intermediateCreated, 'intermediate created' ).equal( 1 )
        expect( listenerWithPathCalled, 'listener with path called' ).equal( 1 )
        
        done()
    } )
    
    it ( 'Multiple listeners with similar types should still be invoked', function( done )
    {
        let root = new Place
        
        let place = new Place( 'child' )
        let firstCreated = 0
        let firstChanged = 0
        place.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ firstCreated
            },
            change : function( after, before )
            {
                expect( after ).equal( 2 )
                expect( before ).equal( 1 )
                ++ firstChanged
            }
        } )
        let secondCreated = 0
        let secondChanged = 0
        place.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ secondCreated
            },
            change : function( after, before )
            {
                expect( after ).equal( 2 )
                expect( before ).equal( 1 )
                ++ secondChanged
            }
        } )
        root.append( place )
        
        root.replicate( {
            child : 1
        } )
        root.replicate( {
            child : 2
        } )
        
        expect( firstCreated ).equal( 1 )
        expect( firstChanged ).equal( 1 )
        
        expect( secondCreated ).equal( 1 )
        expect( secondChanged ).equal( 1 )
        
        done()
    } )
    
    it ( 'consecutive replication', function( done )
    {
        let root = new Place
        
        let place = new Place( 'child' )
        let changed = 0
        place.listen( {
            change : function( after, before )
            {
                switch ( changed )
                {
                    case 0:
                        expect( after ).equal( 1 )
                        expect( before ).equal( 0 )
                        break
                    
                    case 1:
                        expect( after ).equal( 2 )
                        expect( before ).equal( 1 )
                        break
                    
                    case 2:
                        expect( after ).equal( 3 )
                        expect( before ).equal( 2 )
                        break
                }
                
                ++ changed
            }
        } )
        root.append( place )
        
        root.replicate( {
            child : 0
        } )
        root.replicate( {
            child : 1
        } )
        root.replicate( {
            child : 2
        } )
        root.replicate( {
            child : 3
        } )
        
        expect( changed ).equal( 3 )
        
        done()
    } )
    
    it ( 'When data isn\'t yet present REMOVE listener should be called', function( done )
    {
        let root = new Place
        
        let called = 0
        root.listen( {
            remove : function( removed )
            {
                expect( removed ).equal( undefined )
                ++ called
            }
        } )
        
        expect( called ).equal( 1 )
        
        done()
    } )
    
    it ( 'Listener of inexistent replica should NOT be called', function( done )
    {
        let root = new Place
        
        let place = new Place( 'inexistent' )
        place.listen( {
            create : function()
            {
                throw 'Must NOT be called'
            }
        } )
        
        root.replicate( {
            side : 1
        } )
        
        done()
    } )
    
    it ( 'Multiple children (places) with similar names should still be invoked', function( done )
    {
        let root = new Place
        
        let one = new Place( 'child' )
        root.append( one )
        let oneCalled = 0
        one.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ oneCalled
            },
            change : function()
            {
                throw 'Must NOT be called'
            }
        } )
        
        let another = new Place( 'child' )
        root.append( another )
        let anotherCalled = 0
        another.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ anotherCalled
            },
            change : function()
            {
                throw 'Must NOT be called'
            }
        } )
        
        root.replicate( {
            child : 1
        } )
        
        root.remove( one )
        root.remove( another )
        
        root.replicate( {
            child : 2
        } )
        
        expect( oneCalled ).equal( 1 )
        expect( anotherCalled ).equal( 1 )
        
        done()
    } )
    
    it ( 'Children of appended place are treated properly', function( done )
    {
        let root = new Place( undefined, {
            appended : {
                child : 1
            }
        } )
        
        let appended = new Place( 'appended' )
        
        let child = new Place( 'child' )
        appended.append( child )
        let createCalled = 0
        let changeCalled = 0
        let removeCalled = 0
        child.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ createCalled
            },
            change : function( after, before )
            {
                expect( after ).equal( 2 )
                expect( before ).equal( 1 )
                ++ changeCalled
            },
            remove : function( removed )
            {
                expect( removed ).equal( undefined )
                ++ removeCalled
            }
        } )
        
        root.append( appended )
        root.replicate( {
            appended : {
                child : 2
            }
        } )
        
        expect( createCalled ).equal( 1 )
        expect( changeCalled ).equal( 1 )
        expect( removeCalled ).equal( 1 )
        
        done()
    } )
    
    it ( 'Replicate with no change should not provoke CHANGE event', function( done )
    {
        let place = new Place( undefined, {
            child : 1
        } )
        
        let createCalled = 0
        place.listen(
            {
                create : function( created )
                {
                    expect( created ).equal( 1 )
                    ++ createCalled
                },
                change : function()
                {
                    throw 'Must NOT be called'
                }
            },
            'child'
        )
        
        place.replicate( {
            child : 1
        } )
        
        expect( createCalled ).equal( 1 )
        
        done()
    } )
    
    it ( 'Path append invokes CHANGE', function( done )
    {
        let root = new Place( undefined, {
            child : 1
        } )
        
        let place = new Place( 'child', 2 )
        let createCalled = 0
        let changeCalled = 0
        place.listen( {
            create( created )
            {
                expect( created, 'created' ).equal( 2 )
                ++ createCalled
            },
            change( after, before )
            {
                expect( after, 'after' ).equal( 1 )
                expect( before, 'before' ).equal( 2 )
                ++ changeCalled
            }
        } )
        
        root.append( place )
        
        expect( createCalled, 'create called' ).equal( 1 )
        expect( changeCalled, 'change called' ).equal( 1 )
        
        done()
    } )
    
    it ( 'Remove', function( done )
    {
        let root = new Place
        
        let deepChild = new Place( 'dc' )
        let createCalled = 0
        root.append( deepChild, 'deep' )
        deepChild.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                ++ createCalled
            },
            change : function( after, before )
            {
                throw 'Must NOT be called'
            }
        } )
        
        root.replicate( {
            deep : {
                dc : 1
            }
        } )
        
        root.remove( deepChild, 'deep' )
        
        root.replicate( {
            deep : {
                dc : 2
            }
        } )
        
        expect( createCalled ).equal( 1 )
        
        done()
    } )
    
    it ( 'Model must NOT be mutated while performing replication (events propagation)', function( done )
    {
        let root = new Place
        
        let side = new Place( 'side' )
        let sideCreateCalled = 0
        side.listen( {
            create : function( created )
            {
                expect( created ).equal( 10 )
                ++ sideCreateCalled
            }
        } )
        root.append( side, 'deep' )
        
        let place = new Place( 'child' )
        place.listen( {
            create : function( created )
            {
                expect( created ).equal( 1 )
                root.remove( side, 'deep' )
            }
        } )
        root.append( place )
        
        root.replicate( {
            child : 1,
            deep : {
                side : 10
            }
        } )
        
        expect( sideCreateCalled ).equal( 1 )
        
        done()
    } )
    
    it ( 'Data must be replicated on append even through intermediate automatically created children', function( done )
    {
        let root = new Place
        
        root.replicate( {
            path : {
                to : {
                    place : {
                        value : 1
                    }
                }
            }
        } )
        
        let place = new Place( 'place' )
        root.append( place, 'path.to' )
        
        let createCalled = 0
        place.listen(
            {
                create : function( created )
                {
                    expect( created ).equal( 1 )
                    ++ createCalled
                }
            },
            'value'
        )
        
        expect( createCalled ).equal( 1 )
        
        done()
    } )
    
    it ( 'Resolve', function( done )
    {
        let root = new Place
        
        root.replicate( {
            path : {
                to : {
                    first : 1,
                    second : 2
                }
            }
        } )
        
        let first = root.resolve( 'path.to.first' )
        let second = root.resolve( 'path.to.second' )
        
        let firstCalled = 0
        first.listen( {
            create : function( created ) {
                expect( created ).equal( 1 )
                ++ firstCalled
            }
        } )
        
        let secondCalled = 0
        second.listen( {
            create : function( created ) {
                expect( created ).equal( 2 )
                ++ secondCalled
            }
        } )
        
        expect( firstCalled ).equal( 1 )
        expect( secondCalled ).equal( 1 )
        
        done()
    } )
    
    it ( 'Create redirection', function( done )
    {
        let root = new Place
        
        root.replicate( {
            create : 1
        } )
        
        let changeCalled = 0
        root.listen( {
            create : true,
            change : function( after, before )
            {
                expect( after, 'after' ).equal( 1 )
                expect( before, 'before' ).equal( undefined )
                ++ changeCalled
            }
        }, 'create' )
        
        expect( changeCalled, 'change called' ).equal( 1 )
        
        done()
    } )
    
    it ( 'Change redirection', function( done )
    {
        let root = new Place
        
        root.replicate( {
            change : 1
        } )
        
        let createCalled = 0
        root.listen( {
            change : true,
            create : function( created )
            {
                switch ( createCalled )
                {
                    case 0:
                        expect( created ).equal( 1 )
                        break
                    case 1:
                        expect( created ).equal( 2 )
                        break
                }
                ++ createCalled
            }
        }, 'change' )
        
        root.replicate( {
            change : 2
        } )
        
        expect( createCalled ).equal( 2 )
        
        done()
    } )
} )



