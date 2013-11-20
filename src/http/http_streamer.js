;(function() {
  var CONNECTING = 0;
  var OPEN = 1;
  var CLOSING = 2;
  var CLOSED = 3;

  var autoIncrement = 1;

  function HTTPStreamer(url) {
    this.session = randomNumber(1000) + "/" + randomString(8);
    this.location = getLocation(url);
    this.readyState = CONNECTING;
    this.openStream();
  }
  var prototype = HTTPStreamer.prototype;

  prototype.send = function(payload) {
    return this.sendRaw(JSON.stringify([payload]));
  };

  prototype.close = function(code, reason) {
    this.onClose(code, reason, true);
  };

  /** @private */
  prototype.sendRaw = function(payload) {
    if (this.readyState === OPEN) {
      try {
        var HTTPRequest = Pusher.HTTPCORSRequest || Pusher.HTTPXDomainRequest;
        new HTTPRequest(
          "POST", getUniqueURL(getSendURL(this.location, this.session))
        ).start(payload);
        return true;
      } catch(e) {
        return false;
      }
    } else {
      return false;
    }
  };

  /** @private */
  prototype.onFinished = function(status) {
    this.onClose(1006, "Connection interrupted", false);
  };

  /** @private */
  prototype.onChunk = function(chunk) {
    if (chunk.status !== 200) {
      return;
    }
    if (this.readyState === OPEN) {
      this.resetActivityCheck();
    }

    var payload;
    var type = chunk.data.slice(0, 1);
    switch(type) {
      case 'o':
        payload = JSON.parse(chunk.data.slice(1) || '{}');
        this.onOpen(payload);
        break;
      case 'a':
        payload = JSON.parse(chunk.data.slice(1) || '[]');
        for (var i = 0; i < payload.length; i++){
          this.onEvent(payload[i]);
        }
        break;
      case 'm':
        payload = JSON.parse(chunk.data.slice(1) || 'null');
        this.onEvent(payload);
        break;
      case 'h':
        this.onHeartbeatRequest('send');
        break;
      case 'c':
        payload = JSON.parse(chunk.data.slice(1) || '[]');
        this.onClose(payload[0], payload[1], true);
        break;
    }
  };

  /** @private */
  prototype.onOpen = function(options) {
    if (this.readyState === CONNECTING) {
      if (options && options.hostname) {
        this.location.base = replaceHost(this.location.base, options.hostname);
      }
      this.resetActivityCheck();
      this.readyState = OPEN;

      if (this.onopen) {
        this.onopen();
      }
    } else {
      this.onClose(1006, "Server lost session", true);
    }
  };

  /** @private */
  prototype.onEvent = function(event) {
    if (this.readyState === OPEN && this.onmessage) {
      this.onmessage({ data: event });
    }
  };

  /** @private */
  prototype.onHeartbeatRequest = function() {
    if (this.readyState === OPEN) {
      this.sendRaw("[]");
    }
  };

  /** @private */
  prototype.onError = function(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  };

  /** @private */
  prototype.onClose = function(code, reason, wasClean) {
    this.stopActivityCheck();
    this.closeStream();
    this.readyState = CLOSED;
    if (this.onclose) {
      this.onclose({
        code: code,
        reason: reason,
        wasClean: wasClean
      });
    }
  };

  /** @private */
  prototype.onBufferTooLong = function() {
    this.closeStream();
    this.openStream();
  };

  prototype.openStream = function() {
    var self = this;
    var HTTPRequest = Pusher.HTTPCORSRequest || Pusher.HTTPXDomainRequest;

    self.stream = new HTTPRequest(
      "POST", getUniqueURL(getStreamingURL(self.location, self.session))
    );

    self.stream.bind("chunk", function(chunk) {
      self.onChunk(chunk);
    });
    self.stream.bind("finished", function(status) {
      self.onFinished(status);
    });
    self.stream.bind("buffer_too_long", function(status) {
      self.onBufferTooLong(status);
    });

    try {
      self.stream.start();
    } catch (error) {
      setTimeout(function() {
        self.onError(error);
        self.onClose(1006, "Could not start streaming", false);
      }, 0);
      return;
    }
  };

  prototype.closeStream = function() {
    if (this.stream) {
      this.stream.unbind_all();
      this.stream.close();
      this.stream = null;
    }
  };

  /** @private */
  prototype.resetActivityCheck = function() {
    var self = this;

    self.stopActivityCheck();
    self.activityTimer = new Pusher.Timer(30000, function() {
      self.sendRaw('h');
      self.activityTimer = new Pusher.Timer(15000, function() {
        self.onClose(1006, "Did not receive a heartbeat response", false);
      });
    });
  };

  /** @private */
  prototype.stopActivityCheck = function() {
    if (this.activityTimer) {
      this.activityTimer.ensureAborted();
      this.activityTimer = null;
    }
  };

  function getLocation(url) {
    var parts = /([^\?]*)\/*(\??.*)/.exec(url);
    return {
      base: parts[1],
      queryString: parts[2]
    };
  }

  function getStreamingURL(url, session) {
    return url.base + "/" + session + "/xhr_streaming" + url.queryString;
  }

  function getSendURL(url, session) {
    return url.base + "/" + session + "/xhr_send";
  }

  function getUniqueURL(url) {
    var separator = (url.indexOf('?') === -1) ? "?" : "&";
    return url + separator + "t=" + (+new Date()) + "&n=" + autoIncrement++;
  }

  function replaceHost(url, hostname) {
    var urlParts = /(https?:\/\/)([^\/:]+)((\/|:)?.*)/.exec(url);
    return urlParts[1] + hostname + urlParts[3];
  }

  function randomNumber(max) {
    return Math.floor(Math.random() * max);
  }

  function randomString(length) {
    var result = [];
    for (var i = 0; i < length; i++) {
      result.push(Math.floor(Math.random() * 32).toString(32));
    }
    return result.join('');
  }

  Pusher.HTTPStreamer = HTTPStreamer;
}).call(this);
