/* global app:true */

(function() {
  'use strict';
  app = app || {};
  $(document).ready(function() {
    var windowKeys=["top", "window", "location", "external", "chrome", "document", "app", "$", "jQuery", "_", "Backbone", "moment"];
    //console.log(Object.keys(document));
    //console.log(window.top);
    var url = (window.location != window.parent.location)
            ? document.referrer
            : document.location;
  console.log(url);
  });
}());
