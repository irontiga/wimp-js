---
title: home
headings: 
  - Basic usage
  - API docs
---




<br>
## Wimp.js
##### Making window.postMessage practical
<br>

#### Introduction
Wimp's goal is to make window.postMessage easy and viable. It's inspired by both HTTP and websockets, making it familiar (hopefully) to web developers. 


#### Installation
Just include a script tag in your html

```html 
<script src="wimp.js"></script>
```

#### Basic usage
In this example we're going to have index.html fetch the height of an iframe via a request. Note that this is an example, and far from the best way to do it (you could do it better with or without Wimp).

**index.html**
```html
<body>
    <iframe src="iframe1.html" id="frame1"></iframe>
    
    <script src="wimp.js"></script>
    <script>
        const frame1 = new Wimp("#frame1"); // Initialze a new Wimp, which will be able to cumminicate with #frame1
        
        // A request sends a...request. This is much like making a HTTP GET request. The response we are expecting will be the height of the iframe.
        frame1.request("height").then(height => {
            document.getElementByID("#frame1").height = height; // Duh
        })
    </script>
</body>
```
**frame1.html**
```html
<body>
    ...
    <script src="wimp.js"></script>
    <script>
        const container = new Wimp(window.parent); // Can also take a window object
        
        // Listens for a "height" request. On that request it will pass both the data and a response function to your callback
        container.on("height", (data, res) => {
            res(document.body.scrollHeight);
        })
    </script>
</body>
```

#### API docs

> ##### `const myWimp = new Wimp(target [, proxy])`

Creates a new Wimp instance for cross frame communication.

###### `target` - The iframe/window we're communicating with. Can be any of

`target` | Type | Description |
---|---|---|
__Query selector__ | `String` | e.g. `"#frame1"` 
__Content window__ | `Object`  | e.g. `window.parent` or `document.getElementByID("#frame1").contentWindow`. Can not be used in conjuction with `proxy`
__`"*"`(Wildcard)__ | `String` |  Uses `window.frames`. Note that new iframes will not automatically be added.
__Registered target__ | `String` | A preregistered iframe's name. See **LINK ME UP BOIIIII**
 
`proxy` - If included, requests etc. will be sent through the proxy and to the target within it's DOM. It's the same as target, however when proxying is enabled, target can not be a content window.

<div class="card">
    <div class="card-content">
        <span class="card-title"><code>const myWimp = new Wimp(target [, proxy])</code></span>
        <div></div>
    </div>
</div>
    


##### `myWimp.request(request, [options, ] callback)`
Sends a request, much like a HTTP GET/POST request
> `request` - `String` The request string you're trying to make. Think of it as a URL.

> `options` - `Object` Specifies options for the request. Can be omitted.
 - __request__ - Request can also be omitted and defined within options
 - __*expectResponse*__ *NEED TO IMPLEMENT* - `Boolean`. Default: `true`. If false callback will not be required or called. Makes the request one way.
 - __data__ - Data to be sent with the request. Can be anything, but note that it will go through `JSON.stringify` and then `JSON.parse`

> `callback(data)` - `Function` Called when the request completes. `data` is the response which the request receives

##### `myWimp.on(request, fn)`
Much like a server route. Receives a request with data(passed to fn), and replies (again with a function passed to fn).
> `request` - `String` corresponds to the `request` coming from myWimp.request. 
> `fn(data, res)` - `Function`. Called whenever a new request comes in.
 - __data__ - Data that came with the request. Already parsed
 - __`res(response), res.error(message)`__ `Function` - Response function which sends `response` back to the client. Or `res.error` in case of an error.