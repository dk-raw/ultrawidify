import Debug from '../../conf/Debug';
import BrowserDetect from '../../conf/BrowserDetect';

class CommsServer {
  constructor(server) {
    this.server = server;
    this.settings = server.settings;
    this.ports = [];

    var ths = this;

    // console.log("[CommsServer::ctor] INIT! are we in ff?", BrowserDetect.firefox, "BrowserDetect says ...", BrowserDetect)

    if (BrowserDetect.firefox) {
      browser.runtime.onConnect.addListener(p => ths.onConnect(p));
      browser.runtime.onMessage.addListener(m => ths.processReceivedMessage_nonpersistent_ff(m));
    } else {
      chrome.runtime.onConnect.addListener(p => ths.onConnect(p));
      chrome.runtime.onMessage.addListener((m, sender, callback) => ths.processReceivedMessage_nonpersistent_chrome(m, sender, callback));
    }
  }

  async toObject(obj) {
    // console.log("(not actually) CLONING OBJECT", obj);
    // try {
      // const r = JSON.parse(JSON.stringify(obj));
      // return r;
    // } catch (e) {
      // console.log("ERROR WHILE CLONING", obj);
      return obj;
    // }
  }

  async getCurrentTabHostname() {
    const activeTab = await this._getActiveTab();

    const url = activeTab[0].url;

    var hostname;

    if (url.indexOf("://") > -1) {    //find & remove protocol (http, ftp, etc.) and get hostname
      hostname = url.split('/')[2];
    }
    else {
      hostname = url.split('/')[0];
    }
    
    hostname = hostname.split(':')[0];   //find & remove port number
    hostname = hostname.split('?')[0];   //find & remove "?"

    return hostname;
  }

  sendToAll(message){
    message = JSON.parse(JSON.stringify(message)); // vue quirk. We should really use vue store instead
    for(var p of this.ports){
      for(var frame in p){
        p[frame].postMessage(message);
      }
    }
  }

  async _getActiveTab() {
    if (BrowserDetect.firefox) {
      return await browser.tabs.query({currentWindow: true, active: true});
    } else {
      return await new Promise( (resolve, reject) => {
        chrome.tabs.query({lastFocusedWindow: true, active: true}, function (res) {
          resolve(res);
        });
      });
    }
  }

  async sendToFrame(message, tab, frame) {
    // message = JSON.parse(JSON.stringify(message)); // vue quirk. We should really use vue store instead
    if(Debug.debug && Debug.comms){
      console.log(`%c[CommsServer::sendToFrame] attempting to send message to tab ${tab}, frame ${frame}`, "background: #dda; color: #11D", message);
    }

    if (isNaN(tab)) {
      if (tab === '__playing') {
        message['playing'] = true;
        this.sendToAll(message);
        return;
      } else if (tab === '__all') {
        this.sendToAll(message);
        return;
      }
      [tab, frame] = tab.split('-')
    }

    if(Debug.debug && Debug.comms){
      console.log(`%c[CommsServer::sendToFrame] attempting to send message to tab ${tab}, frame ${frame}`, "background: #dda; color: #11D", message);
    }

    try {
      this.ports[tab][frame].postMessage(message);
    } catch (e) {
      if(Debug.debug && Debug.comms){
        console.log(`%c[CommsServer::sendToFrame] Sending message failed. Reason:`, "background: #dda; color: #11D", e);
      }
    }
  }

  async sendToActive(message) {
    message = JSON.parse(JSON.stringify(message)); // vue quirk. We should really use vue store instead

    if(Debug.debug && Debug.comms){
      console.log("%c[CommsServer::sendToActive] trying to send a message to active tab. Message:", "background: #dda; color: #11D", message);
    }

    var tabs = await this._getActiveTab();

    if(Debug.debug && Debug.comms){
      console.log("[CommsServer::_sendToActive_ff] currently active tab(s)?", tabs);
      for (var key in this.ports[tabs[0].id]) {
        console.log("key?", key, this.ports[tabs[0].id]);
        // this.ports[tabs[0].id][key].postMessage(message);
      }
    }

    for (var key in this.ports[tabs[0].id]) {
      this.ports[tabs[0].id][key].postMessage(message);
    }
  }

  onConnect(port){
    var ths = this;
    
    // poseben primer | special case
    if (port.name === 'popup-port') {
      this.popupPort = port;
      this.popupPort.onMessage.addListener( (m,p) => ths.processReceivedMessage(m,p));
      return;
    }

    var tabId = port.sender.tab.id;
    var frameId = port.sender.frameId;
    if(! this.ports[tabId]){
      this.ports[tabId] = {}; 
    }
    this.ports[tabId][frameId] = port;
    this.ports[tabId][frameId].onMessage.addListener( (m,p) => ths.processReceivedMessage(m, p));
    this.ports[tabId][frameId].onDisconnect.addListener( (p) => { 
      delete ths.ports[p.sender.tab.id][p.sender.frameId]; 
      if(Object.keys(ths.ports[p.sender.tab.id]).length === 0){
        ths.ports[tabId] = undefined;
      }
    });
  }

  async processReceivedMessage(message, port){
    if (Debug.debug && Debug.comms) {
      console.log("[CommsServer.js::processReceivedMessage] Received message from popup/content script!", message, "port", port, "\nsettings and server:", this.settings,this.server);
    }

    if (message.forwardToContentScript) {
      if (Debug.debug && Debug.comms) {
        console.log("[CommsServer.js::processReceivedMessage] Message has 'forward to content script' flag set. Forwarding message as is. Message:", message);
      }

      this.sendToFrame(message, message.targetFrame);
    }

    if (message.cmd === 'announce-zoom') {
      // forward off to the popup, no use for this here
      try {
        this.popupPort.postMessage({cmd: 'set-current-zoom', zoom: message.zoom});
      } catch (e) {
        // can't forward stuff to popup if it isn't open
      }
    } else if (message.cmd === 'get-current-zoom') {
      this.sendToActive(message);
    }

    if (message.cmd === 'get-current-site') {
      console.log("CCCCC - ss");
      console.log("[find server] set-current-site — getting site", this.server.getVideoTab(), this.toObject(this.server.getVideoTab()))
      port.postMessage({
        cmd: 'set-current-site',
        site: this.server.getVideoTab(),
        tabHostname: await this.getCurrentTabHostname()
      });
      console.log("CCCCC -s as")
    }
    if (message.cmd === 'popup-set-selected-tab') {
      console.log("CCCCaa")
      this.server.setSelectedTab(message.selectedMenu, message.selectedSubitem);
      console.log("CCCCbb")
    }

    if (message.cmd === 'get-config') {
      if(Debug.debug) {
        console.log("CommsServer: received get-config. Active settings?", this.settings.active, "\n(settings:", this.settings, ")")
      }
      port.postMessage(
        {cmd: "set-config", conf: this.settings.active, site: this.server.currentSite}
      );
    } else if (message.cmd === 'has-video') {
      this.server.registerVideo(port.sender);
    } else if (message.cmd === 'noVideo') {
      this.server.unregisterVideo(port.sender);
    } 
  }

  processReceivedMessage_nonpersistent_ff(message, sender){
    if (Debug.debug && Debug.comms) {
      console.log("%c[CommsServer.js::processMessage_nonpersistent_ff] Received message from background script!", "background-color: #11D; color: #aad", message, sender);
    }

    if (message.forwardToContentScript) {
      if (Debug.debug && Debug.comms) {
        console.log("[CommsServer.js::processMessage_nonpersistent_ff] Message has 'forward to content script' flag set. Forwarding message as is. Message:", message);
        console.log("[CommsServer.js::processMessage_nonpersistent_ff] (btw we probably shouldn't be seeing this. This should prolly happen in persistent connection?");
      }

      this.sendToFrame(message, message.targetFrame);
    }

    if (message.cmd === 'get-config') {
      var ret = {extensionConf: JSON.stringify(this.settings.active)};
      if (Debug.debug && Debug.comms) {
        console.log("%c[CommsServer.js::processMessage_nonpersistent_ff] Returning this:", "background-color: #11D; color: #aad", ret);
      }
      Promise.resolve(ret);
    } else if (message.cmd === "autoar-enable") {
      this.settings.active.sites['@global'].autoar = "blacklist";
      this.settings.save();
      this.sendToAll({cmd: "reload-settings", sender: "uwbg"})
      if(Debug.debug){
        console.log("[uw-bg] autoar set to enabled (blacklist). evidenz:", this.settings.active);
      }
    } else if (message.cmd === "autoar-disable") {
      this.settings.active.sites['@global'].autoar = "disabled";
      if(message.reason){
        this.settings.active.arDetect.disabledReason = message.reason;
      } else {
        this.settings.active.arDetect.disabledReason = 'User disabled';
      }
      this.settings.save();
      this.sendToAll({cmd: 'reload-settings', newConf: this.settings.active});
      if(Debug.debug){
        console.log("[uw-bg] autoar set to disabled. evidenz:", this.settings.active);
      }
    } else if (message.cmd === "autoar-set-interval") {
      if(Debug.debug)
        console.log("[uw-bg] trying to set new interval for autoAr. New interval is",message.timeout,"ms");

      // set fairly liberal limit
      var timeout = message.timeout < 4 ? 4 : message.timeout;
      this.settings.active.arDetect.timer_playing = timeout;
      this.settings.save();
      this.sendToAll({cmd: 'reload-settings', newConf: this.settings.active});
    }
  }

  processReceivedMessage_nonpersistent_chrome(message, sender, sendResponse){
    if (Debug.debug && Debug.comms) {
      console.log("[CommsServer.js::processMessage_nonpersistent_chrome] Received message from background script!", message);
      
      if (BrowserDetect.firefox) {
        throw "WHAT THE FUCK WHY IS THIS RUNNING, THIS ISNT SUPPOSED TO BE RUNNING RN"
      }
    }

    if(message.cmd === 'get-config') {
      sendResponse({extensionConf: JSON.stringify(this.settings.active), site: this.getCurrentTabHostname()});
      // return true;
    } else if (message.cmd === "autoar-enable") {
      this.settings.active.sites['@global'].autoar = "blacklist";
      this.settings.save();
      this.sendToAll({cmd: "reload-settings", sender: "uwbg"})
      if(Debug.debug){
        console.log("[uw-bg] autoar set to enabled (blacklist). evidenz:", this.settings.active);
      }
    } else if (message.cmd === "autoar-disable") {
      this.settings.active.sites['@global'].autoar = "disabled";
      if(message.reason){
        this.settings.active.arDetect.disabledReason = message.reason;
      } else {
        this.settings.active.arDetect.disabledReason = 'User disabled';
      }
      this.settings.save();
      this.sendToAll({cmd: 'reload-settings', newConf: this.settings.active});
      if(Debug.debug){
        console.log("[uw-bg] autoar set to disabled. evidenz:", this.settings.active);
      }
    } else if (message.cmd === "autoar-set-interval") {
      if(Debug.debug)
        console.log("[uw-bg] trying to set new interval for autoAr. New interval is",message.timeout,"ms");

      // set fairly liberal limit
      var timeout = message.timeout < 4 ? 4 : message.timeout;
      this.settings.active.arDetect.timer_playing = timeout;
      this.settings.save();
      this.sendToAll({cmd: 'reload-settings', newConf: this.settings.active});
    }
  }
}

export default CommsServer;