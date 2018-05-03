# Wimp-js
## The super easy window.postMessage wrapper.
(Wi)ndow.(p)ost(M)essage => wipm => wimp

See website for docs


Planned features:
 - Plugin system, allowing Wimp to be split up into the following modules:
   - **wimp-core** - Duh. Doesn't do much on it's own. Has the basic request features built in...or should that be a seperate plugin
   - **wimp-iframes** - Allows wimp to communicate with iframes with popup windows
   - **wimp-broadcast-channel** - Allows wimp to communicate through broadcast channels
   - **wimp-workers** - Allows wimp to communicate to/from web workers
   - **wimp-streams** - Adds streams...i.e. websocket connections to Wimp
   - _**wimp-requests**_ - Maybe...makes simple requests and routes possible...i.e. HTTP GET