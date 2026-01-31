const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 3000;
const DIR = __dirname;
const VIDEO_DIR = path.join(os.homedir(), "datasets", "jichi", "jichi2507");
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

http.createServer(function (req, res) {
  // POST /save-csv → jichi2507_rule.csv に上書き保存
  if (req.method === "POST" && req.url === "/save-csv") {
    let body = "";
    req.on("data", function (chunk) { body += chunk; });
    req.on("end", function () {
      fs.writeFile(path.join(DIR, "jichi2507_rule.csv"), body, "utf-8", function (err) {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error: " + err.message);
        } else {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("OK");
        }
      });
    });
    return;
  }

  // GET /video-list → 動画ファイル一覧を返す
  if (req.method === "GET" && req.url === "/video-list") {
    fs.readdir(VIDEO_DIR, function (err, files) {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      var videos = files.filter(function (f) {
        var ext = path.extname(f).toLowerCase();
        return VIDEO_EXTENSIONS.indexOf(ext) !== -1;
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(videos));
    });
    return;
  }

  // GET /videos/xxx.mp4 → 動画ファイルを配信（Range対応）
  if (req.url.startsWith("/videos/")) {
    var videoName = decodeURIComponent(req.url.substring("/videos/".length).split("?")[0]);
    var videoPath = path.join(VIDEO_DIR, videoName);

    fs.stat(videoPath, function (err, stat) {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      var ext = path.extname(videoPath).toLowerCase();
      var contentType = MIME[ext] || "application/octet-stream";

      // Range リクエスト対応（動画シーク用）
      var range = req.headers.range;
      if (range) {
        var parts = range.replace(/bytes=/, "").split("-");
        var start = parseInt(parts[0], 10);
        var end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        var chunkSize = end - start + 1;
        var stream = fs.createReadStream(videoPath, { start: start, end: end });
        res.writeHead(206, {
          "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
        });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": stat.size,
          "Content-Type": contentType,
        });
        fs.createReadStream(videoPath).pipe(res);
      }
    });
    return;
  }

  // 静的ファイル配信
  var filePath = path.join(DIR, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    var ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log("Server running at http://localhost:" + PORT);
  console.log("Video directory: " + VIDEO_DIR);
});
