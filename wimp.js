// Copyright 2018 @ Johan Esterhuizen

// [ON] = TEST THE SELECTOR/TARGETS EVERY SINGLE CALL. If myWimp has a listener (on("blah")) and a target is added...IT SHOULD BE CARRIED ACCROSS. SYKE DON"T REQUERY

(function(){
    
    const registeredTargets = {}; // "name" : elements. Quite handy for proxied requests...
    
    // Not registered listeners....rather..
    // Outgoing HTTP requests
    const pendingRequests = {}; // "hgad683gfy8q" : function(data, event) <-- event.data already parsed
    
    const routes = []; // [ { "window": "window", "routes": { "hello": fn(req, res) } } ]
    
    // Streams ~ websockets .. do we need websockets? Nope we dont't :D Wimp("balancePage").on("balance-update", data => { ... })
    // Listening to streams
    // const connectedStreams = { "name": ... }
    // Window's own streams
    // const registeredStreams = { "" : { "private": ..., "fn" : function } }
    
    let proxyingEnabled = false;
    
    let DOMSelector = document.querySelectorAll.bind(document);
    
    const wimps = []; // Instances of Wimp within the window. Loop through it for all requests
    

    class Wimp {
        
        static get routes(){
            return routes;
        }
        static get pendingRequests(){
            return pendingRequests;
        }
        static get registeredTargets(){
            return registeredTargets;
        }
        static set proxy(enabled){
            proxyingEnabled = enabled;
        }
        static get proxy(){
            return proxyingEnabled;
        }
        
        // Use newSelector = document.querySelector("my-polymer-app").shadowRoot.querySelectorAll for accessing iframes in the shadowRoot
        // If you don't call Wimp.listen you can't make requests or receive messages
        static listen(newSelector){
            // Maybe should be instance.listen which also sends the ready event to the targets. Notifying them that we are ready for requests.
            
            DOMSelector = newSelector || DOMSelector;
            
            window.addEventListener("message", Wimp.listener);
            
        }
        
        static listener(event){
            const data = JSON.parse(event.data);
            const parsedEvent = {
                data,
                source: event.source,
                origin: event.origin
            };
            
            
            switch(data.type){
                case "response":
                    // Response to a request
                    // Try avoid errors please
                    if(pendingRequests[data.requestID]){
                        pendingRequests[data.requestID](data) // , parsedEvent);
                        delete pendingRequests[data.requestID];
                    } else {
                        //Wimp.error(event.source, `Unrecognized requestID '${data.requestID}' from '${data.request}' request.`, data.requestID)
                        console.error(`Unrecognized requestID '${data.requestID}' from '${data.request}' request.`)
                    }
                    break;
                case "request":
                    // All the "on" things
                    
                    const index = Wimp.windowRouteIndex(event.source);
                    
                    if(index > -1 && routes[index].routes[data.request]){
                        return routes[index].routes[data.request](data, Wimp._responseFactory(event, data.requestID));
                    }
                    // Else... :/
                    return Wimp.error(event.source, `Unrecognized request '${data.request}'`, data.requestID);
                    
                    break;
                case "proxy":
                    // Relay a proxied request/response
                    Wimp.relay(parsedEvent);
                    break;
                case "ready":
                    // When the target(s) are all ready for requests
                    break;
            }
            
            
        }
        
        static registerTarget(name, element){
            this.registeredTargets[name] = element;
        }
        
        static createStream(){
            // return new Stream()
        }
        
        static relay(event){
            // Proxy requests and streams etc.
            const targets = Wimp._getTargetWindows({selector: event.data.target, origin: "*"});
            const requestIDs = [];
            
            const options = Object.assign({},event.data);
            options.type = "request";
            delete options.target;
            
            targets.forEach(target => {
                const requestID = Math.random().toString(36).substr(2, 10);
                requestIDs.push(requestID);
            });
            
            // Send the IDs BEFORE
            Wimp._postMessage({window: event.source, origin: event.origin}, {
                type: "response",
                requestID: event.data.requestID,
                requestIDs: requestIDs
            })
            
            targets.forEach((target, i) => {
                options.requestID = requestIDs[i];
                // Make a pending request and then pass it on to the client
                pendingRequests[requestIDs[i]] = (response) => {
                    Wimp._postMessage({window: event.source, origin: event.origin}, response);
                }
                // Send the clients request to the target
                Wimp._postMessage({
                    window: target.window,
                    origin: target.origin
                }, options)
            })
        }
        
        static _postMessage(target, data){
            target.window.postMessage(JSON.stringify(data), target.origin);
        }
        
        static error(target, message, requestID){
            const data = {
                success: "false",
                error: {
                    message: message
                },
                type: "response"
            }

            if(requestID){ data.requestID = requestID; }

            Wimp._postMessage({
                window: target.window,
                origin: target.origin
            }, data)
        }
        
        static _responseFactory(event, requestID){
            const res = data => {
                const options = {
                    data,
                    requestID,
                    success: true,
                    type: "response"
                }
                Wimp._postMessage({window: event.source, origin: event.origin}, options);
            }
            res.error = message => {
                Wimp.error({window: event.source, origin: event.origin}, message, requestID)
            }
            return res;
        }
        
        static windowRouteIndex(targetWindow){
            // Returns index of a window object in routes
            let index = -1;
            // Slice and revrse so that newest route is prioritized
            routes.slice().reverse().forEach((target, i) => {
                if(target.window == targetWindow){
                    // Adjust the index for the reversing
                    index = routes.length - 1 - i;
                }
            })
            return index;
        }
        
        // frame could be an array, proxy can only be a string or an object
        constructor(targets, proxy){
            wimps.push(this);
            
            // Outgoing
            this._pendingRequests = {};
            // Incoming
            this.routes = {};
            // Store targets
            this.targets = [];
            // Store original selector(if it is one)
            this.selector = (typeof targets == "string") ? targets : false;
            
            // new Wimp("selector") or new Wimp(["selector", window.parent]) etc.
            if(typeof targets != "array"){
                targets = [targets];
            }
            
            // Make it a gorgeous object if it isn't already one
            if(proxy && !proxy.selector){
                proxy = {
                    selector: proxy,
                    origin: "*"
                }
            }
            
            // Store 
            this.proxy = proxy ? Wimp._getTargetWindows(proxy)[0] : false;
            
            targets.forEach((target, i, targets) => {
                if(!target.selector){
                    target = {
                        selector: target,
                        origin: "*"
                    }
                }
                
                this.targets.push(...Wimp._getTargetWindows(target));
                
            })
        }
        
        // Takes a string or element and returns an array of elements or throws an error
        static _getTargetWindows(target){
            if(typeof target.selector == "string"){
                
                if(target.selector == "*"){
                    // Avoid testing every element in the page
                    return Array.prototype.slice.call(window.frames).map(frame => {
                        return {
                            window: frame,
                            origin: target.origin
                        }
                    })
//                    return Wimp_getTargetWindows({
//                        selector: "iframe",
//                        origin: target.origin
//                    });
                }
                
                // id/name for a target
                else {
                    if(target.selector in registeredTargets){
                        // Return an array...
                        return [{
                            window: registeredTargets[target.selector],
                            origin: target.origin
                        }];
                    }
                    // Otherwise assume it's a css selector
                    const nodes = Array.prototype.slice.call(DOMSelector(target.selector));
                    return nodes.filter(node => {
                        // Check that it is an iframe...
                        return node.contentWindow;
                    }).map(node => {
                        return {
                            window: node.contentWindow,
                            origin: target.origin
                        }
                    });
                    // Registered iframe with name maybe if it's enclosed in curly braces ({}) or starts with +?
                    // OR a query selector...could encompass *
                    // Just go with it's a query selector if not in registeredTargets
                }
            }
            else{
                return [{
                    window: target.selector,
                    origin: target.origin
                }]
                // Dom element
            }
        }
        
        _listener(){
            
        }
        
        // Like a HTTP request, it's once off - fetches/does something
        // data stored in options.data
        request(request, options, cb){
            // Request can be omitted and included in options
            if ( typeof request != "string" ) { options = request; cb = options; }
            
            // Or you could have to deal with request("hello", fn...)
            if ( typeof options == "function" ) { cb = options; options = void 0; }
            
            // Make sure options does indeed exist
            options = options || {};
            
            options.request = options.request || request;
            
            if ( !options.request ) { throw "Request must be specified" };
            
            // If no callback
            const promiseArray = [];
            
            // Obviously handle proxied requests differently...
            if(!this.proxy){
                // Send the request to each of the targets with different request IDs...if promise return array of promises (which can be wrapped in a Promise.all()), otherwise call the callback with each response
                this.targets.forEach(target => {
                    
                    options.requestID = Math.random().toString(36).substr(2, 10);
                    options.type = "request";
                    
                    if(!cb) {
                        promiseArray.push(new Promise((resolve, reject) => {
                            pendingRequests[options.requestID] = resolve;
                            Wimp._postMessage(target, options);
                        }))
                    } else {
                        pendingRequests[options.requestID] = cb;
                        Wimp._postMessage(target, options);
                    }

                });
                
                if(!cb){
                    return promiseArray.length == 1 ? promiseArray[0] : promiseArray;
                }
                
            } else {
                // First request/response fetchs an array of request IDs, as sometimes a request can have multiple targets
                const initID = Math.random().toString(36).substr(2, 10);
                options.requestID = initID;
                options.type = "proxy";
                options.target = this.selector;
                
                const initFunction = response => {
                    
                    response.requestIDs.forEach(id => {
                        if(!cb) {
                            promiseArray.push(new Promise((resolve, reject) => {
                                pendingRequests[id] = resolve;
                            }))
                        } else {
                            pendingRequests[id] = cb;
                        }
                    })
                    
                    if(!cb){
                        return promiseArray.length == 1 ? promiseArray[0] : promiseArray;
                    }
                }
                
                Wimp._postMessage(this.proxy, options);
                
                if(!cb){
                    return new Promise((resolve, reject) => {
                        pendingRequests[initID] = resolve;
                    }).then(response => {
                        return initFunction(response);
                    });
                } else {
                    pendingRequests[initID] = initFunction;
                }
            }
            
        }
        // Like HTTP, but from the server's perspective - returns something - not to be confused with Stream.on("...")
        // fn(options)
        on(request, fn){
            this.targets.forEach(target => {
                const i = Wimp.windowRouteIndex(target.window);
                if(i < 0){
                    routes.push({
                        window: target.window,
                        routes: {
                            [request]: fn
                        }
                    })
                }
                else{
                    routes[i].routes[request] = fn
                }
            })
        }
        
        addTarget(target){
            // So that we can add window.open popups to "*" selector
            if(!target.selector){
                target = {
                    selector: target,
                    origin: "*"
                }
            }
            this.targets.push(...Wimp._getTargetWindows(target));
        }
        
        ready(cb){
            // Call cb when a handshake has occured (aka the target frame is loaded)...might be unnecessary....test window.parent.document.readyState or frame.contentWindow.document.readyState ...altho frame should = contentWindow
            if(!cb){
                return new Promise(resolve => {
                    //
                })
            }
        }
    }
    
//    window.Wimp = (target, proxy) => {
//        return new Wimp(target, proxy);
//    }
//    
//    window.Wimp.listen = Wimp.listen;
//    
//    window.Wimp.routes = Wimp.routes;
    window.Wimp = Wimp;
}());




// ==================

//let target
//target = Wimp("parent/child")
//target = Wimp("*")
//target = Wimp("parent/child", "proxy")