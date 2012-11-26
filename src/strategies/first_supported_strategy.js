;(function() {

  function FirstSupportedStrategy(substrategies, options) {
    Pusher.FirstConnectedStrategy.call(this, substrategies, options);
  };
  var prototype = FirstSupportedStrategy.prototype;

  Pusher.Util.extend(prototype, Pusher.FirstConnectedStrategy.prototype);

  // interface

  prototype.name = "first_supported";

  // private

  prototype.getSupported = function(substrategies) {
    for (var i = 0; i < substrategies.length; i++) {
      if (substrategies[i].isSupported()) {
        return [substrategies[i]];
      }
    }
    return [];
  }

  Pusher.FirstSupportedStrategy = FirstSupportedStrategy;
}).call(this);
