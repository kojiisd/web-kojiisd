// CloudFront Function (cloudfront-js-2.0), viewer request:
// 1. Redirect any non-canonical host to the canonical host with 301.
// 2. Resolve directory-style URLs to index.html objects in S3.
// Kept ASCII-only because the code is inlined into the CloudFront function.
var CANONICAL_HOST = "__CANONICAL_HOST__";

function buildQueryString(querystring) {
  var parts = [];
  for (var key in querystring) {
    var entry = querystring[key];
    var values = entry.multiValue ? entry.multiValue : [entry];
    for (var i = 0; i < values.length; i++) {
      parts.push(values[i].value === "" ? key : key + "=" + values[i].value);
    }
  }
  return parts.length > 0 ? "?" + parts.join("&") : "";
}

function redirect(location) {
  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: { location: { value: location } },
  };
}

function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : "";
  var uri = request.uri;

  if (host !== CANONICAL_HOST) {
    return redirect("https://" + CANONICAL_HOST + uri + buildQueryString(request.querystring));
  }

  if (uri.endsWith("/")) {
    request.uri = uri + "index.html";
  } else if (!uri.split("/").pop().includes(".")) {
    // /works/example -> /works/example/
    return redirect(uri + "/" + buildQueryString(request.querystring));
  }

  return request;
}
