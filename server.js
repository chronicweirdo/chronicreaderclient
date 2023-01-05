// https://stackabuse.com/node-http-servers-for-static-file-serving/

"use strict";

var fs = require('fs')
var path = require('path')
var http = require('http');
const { runInNewContext } = require('vm');

var staticBasePath = './static'

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
function getFileMimeType(filename) {
    let extension = filename.toLowerCase().substring(filename.lastIndexOf('.') + 1)
    if (extension == "png" || extension == "jpeg"
        || extension == "avif" || extension == "bmp" || extension == "gif"
        || extension == "tiff" || extension == "webp") {
        return "image/" + extension
    } else if (extension == "jpg") {
        return "image/jpeg"
    } else if (extension == "tif") {
        return "image/tiff"
    } else if (extension == "svg") {
        return "image/svg+xml"
    } else if (extension == "ico") {
        return "image/vnd.microsoft.icon"
    } else if (extension == "js") {
        return "text/javascript"
    } else if (extension == "html") {
        return "text/html"
    } else if (extension == "css") {
        return "text/css"
    } else {
        return "text/plain"
    }
}

var applicationRoot = "/chronicreaderclient"

var staticServe = function(req, res) {
    var resolvedBase = path.resolve(staticBasePath)
    var safeSuffix = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '')
    console.log("safe suffix: " + safeSuffix)
    if (safeSuffix.startsWith(applicationRoot)) {
        safeSuffix = safeSuffix.substring(applicationRoot.length)
        console.log("updated safe suffix: " + safeSuffix)
        let queryStringStart = safeSuffix.indexOf('?')
        if (queryStringStart >= 0) {
            safeSuffix = safeSuffix.substring(0, queryStringStart)
        }
        if (safeSuffix == "" || safeSuffix == "/") safeSuffix = "/index.html"
        var fileLoc = path.join(resolvedBase, safeSuffix)
        console.log(fileLoc)

        if (fileLoc.endsWith("manifest.json")) {
            let manifestContents = JSON.parse(fs.readFileSync(fileLoc))
            manifestContents.start_url = applicationRoot
            let body = JSON.stringify(manifestContents)
            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.setHeader("Content-Length", body.length)
            res.write(body)
            return res.end()
        } else {
            fs.readFile(fileLoc, function(err, data) {
                if (err) {
                    res.writeHead(404, 'Not Found')
                    res.write('404: File Not Found!')
                    return res.end()
                }
                var stats = fs.statSync(fileLoc)
                res.statusCode = 200
                res.setHeader("Content-Type", getFileMimeType(fileLoc))
                res.setHeader("Content-Length", stats["size"])
                res.write(data)
                return res.end()
            })
        }
    } else {
        res.writeHead(404, 'Not Found')
        res.write('404: File Not Found!')
        return res.end()
    }
}

var httpServer = http.createServer(staticServe)

httpServer.listen(10001, "0.0.0.0")