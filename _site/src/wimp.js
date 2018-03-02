// Copyright 2018 @ Johan Esterhuizen

// [ON] = TEST THE SELECTOR/TARGETS EVERY SINGLE CALL. If myWimp has a listener (on("blah")) and a target is added...IT SHOULD BE CARRIED ACCROSS. SYKE DON"T REQUERY

(function(){
    
    const registeredTargets = {}; // "name" : elements. Quite handy for proxied requests...
    
    // Not registered listeners....rather..
    // Outgoing HTTP requests
    const pendingRequests = {}; // "hgad683gfy8q" : function(data, event) <-- event.data already parsed
    
    const proxiedStreams = {}; // { name: [window, window, window] // All the targets}
    
    // Streams ~ websockets .. do we need websockets? Nope we dont't :D Wimp("balancePage").on("balance-update", data => { ... })
    // Listening to streams
    // const connectedStreams = { "name": ... }
    // Window's own streams
    // const registeredStreams = { "" : { "private": ..., "fn" : function } }
    
    let proxyingEnabled = false;
    
    let DOMSelector = document.querySelectorAll.bind(document);
    
    const wimps = []; // Instances of Wimp within the window. Loop through it for all requests
    

    class Wimp {
        
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
        static init(newSelector){
            // Maybe should be instance.listen which also sends the ready event to the targets. Notifying them that we are ready for requests.
            
            DOMSelector = newSelector || DOMSelector;
            
            window.addEventListener("message", Wimp._listener);
            
        }
        
        static _listener(event){
            const data = JSON.parse(event.data);
            const parsedEvent = {
                data,
                source: event.source,
                origin: event.origin
            };
            
            switch(data.type){
                case "readyCheck":
                    // Obviously ready, so just change the message and send it back
                    data.type = "readyResponse";
                    Wimp._postMessage({window: event.source, origin: event.origin}, data);
                    break;
                case "readyResponse":
                    wimps.some(w => {
                        if(w.pendingReady[data.requestID]){
                            delete w.pendingReady[data.requestID];
                            return 1;
                        }
                    });
                    break;
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
                    
                    wimps.forEach(w => {
                        w.targets.some(target => {
                            if(target.window == event.source){
                                
                                const res = data.expectResponse ? Wimp._responseFactory(event, data.requestID) : () => {};
                                
                                if(w.routes[data.request]){ w.routes[data.request](data.data, res) }
                                return 1;
                            }
                        })
                    });
                    break;
                case "proxy":
                    // Relay a proxied request/response
                    Wimp._relay(parsedEvent);
                    break;
                case "joinStream":
                    wimps.forEach(w => {
                        if(w.streams[data.name]){
                            w.streams[data.name].fn(data.data, event);
                        } else {
                            // Do nothing. Stream doesn't exist so just ignore it
                        }
                    })
                    
                    break;
                case "streamMessage":
                    wimps.forEach(w => {
                        if(w.listeners[data.name]){
                            w.listeners[data.name](data.data);
                        } else {
                            // No one is listening to this stream...wonder who sent the message :joy:
                        }
                    })
                    if(proxiedStreams[data.name]){
                        proxiedStreams[data.name].forEach(target => {
                            Wimp._postMessage(target, data);
                        })
                    }
                    
                    break;
                case "joinProxyStream":
                    // There should only be one, altho I guess it's possible for there to be multiple...
                    //const targets = Wimp._getTargetWindows(data.target);
                    const targets = [];
                    
                    data.targets.forEach((target) => {
                        targets.push(...Wimp._getTargetWindows(target));
                    })
                    
                    data.type = "joinStream";
                    delete data.target;
                    
                    targets.forEach(target => {
                        console.log(data, target);
                        Wimp._postMessage(target, data);
                    })
                    if(proxiedStreams[name]){
                        if(proxiedStreams[data.name].indexOf(event.source) == -1){
                            proxiedStreams[data.name].push(event.source);
                        }
                    } else {
                        proxiedStreams[data.name] = [event.source];
                    }
                    break;
                case "ready":
                    // When the target(s) are all ready for requests
                    break;
            }
            
            
        }
        
        static registerTarget(name, element){
            registeredTargets[name] = Wimp._getTargetWindows(Wimp._targetsToArrayObject(element)[0]);
        }
        
        static _relay(event){
            // Proxy requests
            //const targets = Wimp._getTargetWindows({selector: event.data.target, origin: "*"});
            const targets = [];
            event.data.targets.forEach((target) => {
                targets.push(...Wimp._getTargetWindows(target));
            })
            const requestIDs = [];
            
            const options = Object.assign({},event.data);
            options.type = "request";
            delete options.target;
            
            targets.forEach(target => {
                const requestID = Math.random().toString(36).substr(2, 12);
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
        
        static _targetsToArrayObject(targets){
            if(typeof targets != "array"){
                targets = [targets];
            }
            // Correct formatting
            for(let i=0;i<targets.length;i++){
                if(!targets[i].selector){
                    targets[i] = {
                        selector: targets[i],
                        origin: "*"
                    }
                }
                if(!targets[i].origin){
                    targets[i].origin = "*"
                }
            }
            return targets
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
                        return registeredTargets[target.selector]
//                        return [{
//                            window: registeredTargets[target.selector],
//                            origin: target.origin
//                        }];
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
        
        // frame could be an array, proxy can only be a string or an object
        constructor(targets, proxy){
            if(proxy && !proxyingEnabled){
                throw "Proxying disabled. Enable it with `Wimp.proxy = true;`"
            }
            
            wimps.push(this);
            
            // Incoming
            this.routes = {};
            this.streams = {};
            this.listeners = {}; // Listeners for streams
            this.pendingReady = {};
            this.readyFunction = () => {}; // Default ready function. Does absolutely nothing :)
            // Store targets
            this.targets = [];
            
            // Make it a gorgeous object if it isn't already one
            if(proxy && !proxy.selector){
                proxy = {
                    selector: proxy,
                    origin: "*"
                }
            }
            
            targets = Wimp._targetsToArrayObject(targets);
            
            // Store original selector(if it is one)
            this.selectors = [];
            targets.forEach(target => {
                if(typeof target.selector == "string"){
                    this.selectors.push(target);
                }
            })
            
            // Store 
            this.proxy = proxy ? Wimp._getTargetWindows(proxy)[0] : false;
            
            targets.forEach((target) => {
                // Store the target
                this.targets.push(...Wimp._getTargetWindows(target));
            })
            
            this.targets.forEach(target => {
                // And wait for everyone to be ready
                const pendingID = Math.random().toString(36).substr(2, 12);
                this.pendingReady[pendingID] = target;
                // Now keep on checking for the ready...and because setInterval is dumb
                const readyCheck = () => {
                    if(Object.keys(this.pendingReady).length == 0){
                        this.readyFunction();
                        return;
                    }
                    Object.keys(this.pendingReady).forEach(pending => {
                        Wimp._postMessage(this.pendingReady[pending], {
                            type: "readyCheck",
                            requestID: pending
                        });
                    })
                    setTimeout(() => readyCheck(), 10);
                }

                readyCheck();
            })
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
            
            if(options.expectResponse != false){
                options.expectResponse = true;
            }
            
            // If no callback
            const promiseArray = [];
            

            
            // Obviously handle proxied requests differently...
            if(!this.proxy){
                // Send the request to each of the targets with different request IDs...if promise return array of promises (which can be wrapped in a Promise.all()), otherwise call the callback with each response
                this.targets.forEach(target => {
                    
                    options.requestID = Math.random().toString(36).substr(2, 12);
                    options.type = "request";
                    
                    if(!options.expectResponse){
                        Wimp._postMessage(target, options);
                        return;
                    }
                    
                    if(!cb) {
                        promiseArray.push(new Promise((resolve, reject) => {
                            pendingRequests[options.requestID] = resolve;
                        }))
                    } else {
                        pendingRequests[options.requestID] = cb;
                    }
                    
                    Wimp._postMessage(target, options);

                });
                
                if(!cb){
                    return promiseArray.length == 1 ? promiseArray[0] : promiseArray;
                }
                
            } else {
                // First request/response fetchs an array of request IDs, as sometimes a request can have multiple targets
                const initID = Math.random().toString(36).substr(2, 12);
                options.requestID = initID;
                options.type = "proxy";
                options.targets = this.selectors;
                
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
                
                if(!cb){
                    return new Promise((resolve, reject) => {
                        pendingRequests[initID] = resolve;
                        Wimp._postMessage(this.proxy, options);
                    }).then(response => {
                        return initFunction(response);
                    });
                } else {
                    pendingRequests[initID] = initFunction;
                    Wimp._postMessage(this.proxy, options);
                }
            }
            
        }
        
        // Like HTTP, but from the server's perspective - returns something - not to be confused with Stream.on("...")
        // fn(options)
        on(request, fn){
            this.routes[request] = fn;
        }
        
        // const myStream = new Wimp("*").createStream("balance", (req, res) => {})
        createStream(name, options, joinFn){
            // Name of the stream, it's options, and function to be called whenever a user joins. Options of name can be omitted
            if ( typeof name != "string" ) { options = name; joinFn = options; }
            if ( typeof options == "function" ) { joinFn = options; options = void 0; }
            options = options || {};
            options.name = options.name || name;
            if ( !options.name ) { throw "Name must be specified" };
            
            this.streams[name] = {
                fn: (data, event) => {
                    if(this.streams[name].targets.indexOf(event.source) < 0){
                        this.streams[name].targets.push(event.source);
                    }
                    joinFn(data, (response) => {
                        Wimp._postMessage({window: event.source, origin: event.origin}, {
                            type: "streamMessage",
                            name: name,
                            data: response
                        })
                    });
                },
                targets: []
            }
            
            return {
                emit: data => {
                    options = {
                        name: name,
                        type: "streamMessage",
                        data: data
                    }
                    this.streams[name].targets.forEach(target => {
                        Wimp._postMessage(target, options);
                    })
                }
            }
            
        }
        // const myDad = new Wimp(window.parent).listen("balance", update => { })
        listen(name, fn){
            if(this.proxy){
                Wimp._postMessage(this.proxy, {
                    type: "joinProxyStream",
                    name: name,
                    targets: this.selectors
                })
            } else {
                this.targets.forEach(target => {
                    Wimp._postMessage(target, {
                        type: "joinStream",
                        name: name
                    })
                })
            }
            this.listeners[name] = fn;
        }
        
        addTarget(targets){
            // So that we can add window.open popups to "*" selector
            targets = Wimp._targetsToArrayObject(targets);
            this.targets.push(...Wimp._getTargetWindows(targets));
        }
        
        ready(cb){
            // Call cb when a handshake has occured (aka the target frame is loaded)...might be unnecessary....test window.parent.document.readyState or frame.contentWindow.document.readyState ...altho frame should = contentWindow
            if(!cb){
                return new Promise(resolve => {
                    this.readyFunction = resolve;
                })
            }
            this.readyFunction = cb;
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