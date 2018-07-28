var _bd_usebrowser = "firefox";

if(typeof browser === "undefined"){ // This means we're probably not on Firefox.
  if(chrome){
    browser = chrome;
    _bd_usebrowser = "chrome";
  }
}

if(Debug.debug)
  console.log("[BrowserDetect::init] using browser", _bd_usebrowser, "| browser object: ", browser)

var BrowserDetect = {
  usebrowser: _bd_usebrowser
}
