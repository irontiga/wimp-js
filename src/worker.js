self.importScripts('wimp.js')
console.log(self)


self.onmessage = e => {
    Wimp._listener(e)
}


parentWimp = new Wimp(self)

parentWimp.on("hi", (req, res) => {
    console.log(req)
    console.log("Received a request")
    res("HELLLOOO FROM THE WORKER")
})
console.log(parentWimp)


parentWimp.listen("time", data => {
    console.log(`Received time ${data}`)
})


Wimp.init()
