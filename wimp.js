// Copyright 2018 @ Johan Esterhuizen

(function(){
    const registeredTargets = {};
    // "name" : element
    const registeredListeners = [];
    
    let DOMSelector = document.querySelectorAll;
    /*  {
            source: source,
            listener: listener
        }
    */
    class Wimp {
        // Use newSelector = document.querySelector("my-polymer-app").shadowRoot.querySelectorAll for accessing iframes in the shadowRoot
        static start(newSelector){
            
            DOMSelector = newSelector || DOMSelector;
            
            window.addEventListener("message", Wimp.listener);
        
        }
        
        static listener(event){
            const data = JSON.parse(event.data);
        }
        
        static registerTarget(name, element){
            this.registeredTargets[name] = element;
        }
        
        static createStream(){
            // return new Stream()
        }
        
        static relay(){
            // Proxy requests and streams etc.
        }
        
        static postMessage(target, data){
            target.window.postMessage(JSON.stringify(data), target.origin);
        }
        
        // frame could be an array, proxy can only be a string or an object
        constructor(targets, proxy){
            // Outgoing
            this._pendingRequests = {};
            // Incoming
            this.routes = {};
            // Store targets
            this.targets = [];
            
            if(typeof targets != "array"){
                targets = [targets];
            }
            
            if(proxy && typeof proxy != "object"){
                proxy = {
                    selector: proxy,
                    origin: "*"
                }
            }
            
            this.proxy = (proxy ? this._getTargetWindows(proxy)[0] : false);
            
            targets.forEach((target, i, targets) => {
                if(typeof target != "object"){
                    target = {
                        selector: target,
                        origin: "*"
                    }
                }
                
                this.targets.push(...this._getTargetWindows(target));
                
            })
        }
        
        // Takes a string or element and returns a dom object or throws an error
        _getTargetWindows(target){
            if(typeof target.selector == "string"){
                
                if(target.selector == "*"){
                    // Avoid testing every element in the page
                    return this._getTargetWindows("iframe");
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
                    const nodes = DOMSelector(target.selector);
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
        
        // The listener for the instance...called by Wimp.listener
        listener(event){
            
        }
        
        postMessage(target, options){
            Wimp.postMessage(target, options)
        }
        
        // Like a HTTP request, it's once off - fetches/does something
        // data stored in options.data
        request(request, options, cb){
            // Request can be omitted and included in options
            if(typeof request != "string"){
                options = request;
                cb = options;
            }
            
            options.request = options.request || request;
            if(!options.request) { throw "Request must be specified" }
            
            // If no callback
            const promiseArray = [];
            // Send the request to each of the targets with different IDs...if promise return array of promises (which can be wrapped in a Promise.all())
            this.targets.forEach(target => {
                // New ID for each target
                options.requestID = Math.random().toString(36).substr(2, 10);
                
                if(this.proxy){
                    options.target = target;
                    target = this.proxy;
                }
                
                if(!cb) {
                    promiseArray.push(new Promise(resolve => {
                        this._pendingRequests[options.requestID] = resolve;
                        this.postMessage(target, options);
                    }))
                }
                else {
                    this._pendingRequests[options.requestID] = cb;
                    this.postMessage(target, options);
                }
                
            })
            
            if(!cb){
                return promiseArray;
            }
            
            
        }
        // Like HTTP, but from the server's perspective - returns something - not to be confused with Stream.on("...")
        // fn(data)
        on(request, fn){
            
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
    
    
    class Stream(){
        constructor(){

        }
    }
    

    window.Wimp = function(target, proxy){
        return new Wimp(target, proxy);
    }
    
    window.Wimp.start = Wimp.start;
    
    window.Wimp.createStream = Wimp.createStream;
    
}())




// ==================

let target
target = Wimp("parent/child")
target = Wimp("*")
target = Wimp("parent/child", "proxy")