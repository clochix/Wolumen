/*jshint node: true */
var fs = require('fs'),
    xpath = require('xpath'),
    dom = require('xmldom').DOMParser,
    sourceDir = 'data',
    sourceFile,
    res = [];

function doRead(file, cb) {
  "use strict";
  fs.readFile(file, function (err, xml) {
    if (err) {
      console.log(err);
      cb({});
    } else {
      var res = {},
          doc   = new dom().parseFromString(xml.toString()),
          nodes, format,
          select = xpath.useNamespaces({
        "pgterms": "http://www.gutenberg.org/2009/pgterms/",
        "cc": "http://web.resource.org/cc/",
        "dcam": "http://purl.org/dc/dcam/",
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "marcrel": "http://id.loc.gov/vocabulary/relators/",
        "dcterms": "http://purl.org/dc/terms/",
      });
      res.formats = [];
      nodes = select("//dcterms:hasFormat/*[contains(@rdf:about,'htm')]/dcterms:format//rdf:value/ancestor-or-self::*", doc);

      nodes.forEach(function (node) {
        var tag = node.tagName.toString().toLowerCase();
        if (tag === 'pgterms:file') {
          format = {};
          format.url = node.getAttributeNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'about');
        }
        if (tag === 'rdf:value') {
          format.type = node.firstChild.nodeValue;
          res.formats.push(format);
        }
      });
      //console.log(require("util").inspect(nodes[0].nodeValue));
      res.author      = select("//dcterms:creator//pgterms:name/text()", doc).toString();
      res.description = select("//dcterms:description/text()", doc).toString();
      res.lang        = select("//dcterms:language//rdf:value/text()", doc).toString();
      res.rights      = select("//dcterms:rights/text()", doc).toString();
      res.title       = select("//dcterms:title/text()", doc).toString();
      res.type        = select("//dcterms:type//rdf:value/text()", doc).toString();
      res.subject = [];
      select("//dcterms:subject//rdf:value/text()", doc).forEach(function (subject) {
        subject = subject.toString();
        if (res.subject.indexOf(subject) === -1) {
          res.subject.push(subject);
        }
      });

      cb(res);
    }
  });
}
process.argv.forEach(function (arg) {
  "use strict";
  var tmp = arg.split('=');
  if (tmp.length === 2) {
    tmp[0] = tmp[0].replace(/-/g, '');
    switch (tmp[0]) {
    case 'dir':
      sourceDir = tmp[1];
      break;
    case 'file':
      sourceFile = tmp[1];
      break;
    }
  }
});
if (typeof sourceFile !== 'undefined') {
  doRead(sourceFile, function (infos) {
    "use strict";
    res.push(infos);
    fs.writeFile('res.json', JSON.stringify(res));
  });
} else {
  fs.readdir(sourceDir, function (err, files) {
    "use strict";
    var tmp, n, end = files.length,
        batchSize = 200; // adapt to max open file limit
    function next() {
      n = 0;
      tmp = files.splice(0, batchSize);
      tmp.forEach(function (file) {
        doRead(sourceDir + '/' + file, function (infos) {
          res.push(infos);
          n++;
          if (res.length === end) {
            fs.writeFile('res.json', JSON.stringify(res));
          }
          if (n === 200) {
            next();
          }
        });
      });
    }
    if (!err) {
      files = files.filter(function (name) { return (/\.rdf$/).test(name); });
      next();
    }
  });
}
