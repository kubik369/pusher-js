;(function() {
  var MAX_BUFFER_LENGTH = 256*1024;

  function HTTPXDomainRequest(method, url) {
    Pusher.EventsDispatcher.call(this);

    this.method = method;
    this.url = url;
    this.xdr = new window.XDomainRequest();
    this.position = 0;
  }
  var prototype = HTTPXDomainRequest.prototype;
  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  prototype.start = function(payload) {
    var self = this;

    self.xdr.ontimeout = function() {
      self.emit("error", new Pusher.Errors.RequestTimedOut());
      self.close();
    };
    self.xdr.onerror = function(e) {
      self.emit("error", e);
      self.close();
    };
    self.xdr.onprogress = function() {
      self.onChunk(200, self.xdr.responseText);
    };
    self.xdr.onload = function() {
      self.onChunk(200, self.xdr.responseText);
      self.emit("finished", 200);
      self.close();
    };

    self.unloader = function() {
      self.close();
    };
    Pusher.Util.addWindowListener("unload", self.unloader);

    self.xdr.open(self.method, self.url, true);
    self.xdr.send(payload);
  };

  prototype.close = function() {
    if (this.unloader) {
      Pusher.Util.removeWindowListener("unload", this.unloader);
      this.unloader = null;
    }
    if (this.xdr) {
      this.xdr.ontimeout = this.xdr.onerror = null;
      this.xdr.onprogress = this.xdr.onload = null;
      this.xdr.abort();
      this.xdr = null;
    }
  };

  prototype.onChunk = function(status, data) {
    while (true) {
      var chunk = this.advanceBuffer(data);
      if (chunk) {
        this.emit("chunk", { status: status, data: chunk });
      } else {
        break;
      }
    }
    if (this.isBufferTooLong(data)) {
      this.emit("buffer_too_long");
    }
  };

  prototype.advanceBuffer = function(buffer) {
    var unreadData = buffer.slice(this.position);
    var endOfLinePosition = unreadData.indexOf("\n");

    if (endOfLinePosition !== -1) {
      this.position += endOfLinePosition + 1;
      return unreadData.slice(0, endOfLinePosition);
    } else {
      // chunk is not finished yet, don't move the buffer pointer
      return null;
    }
  };

  prototype.isBufferTooLong = function(buffer) {
    return this.position === buffer.length && buffer.length > MAX_BUFFER_LENGTH;
  };

  Pusher.HTTPXDomainRequest = HTTPXDomainRequest;
}).call(this);
