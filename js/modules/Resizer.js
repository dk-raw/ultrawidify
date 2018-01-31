if(Debug.debug)
  console.log("Loading: Resizer.js");

// restore watchdog. While true, _res_applyCss() tries to re-apply new css until this value becomes false again
// value becomes false when width and height of <video> tag match with what we want to set. Only necessary when
// calling _res_restore() for some weird reason.
var _res_restore_wd = false;  

var _res_manual_autoar = function(siteProps){
  if(! siteProps.autoar_imdb.enabled)
    return;
  
  if(siteProps.autoar_imdb.isClass)
    var ntitle = document.querySelector("."+ siteProps.autoar_imdb.title); // NOTE: needs to be tested
    else
      var ntitle = document.querySelector("#"+ siteProps.autoar_imdb.title); // NOTE: needs to be tested
      
      //querySelector lahko vrne null, zato moramo preveriti, kaj smo dobili — drugače se .textContent pritožuje.
      //querySelector can return null, in which case .textContent will complain.
      if(!ntitle)
        return;
      
      var title = ntitle.textContent;
    
    char_got_ar = false;
    last_whatdo = {type: "autoar", what_do:"autoar"};
    
    var sending = browser.runtime.sendMessage({
      type: "gibAspectRatio",
      title: title
    });
    //     sending.then( function(){}, function(err1, err2){console.log("uw::periodic: there was an error while sending a message", err1, err2)} );
}


var _res_char = function(newAr, video, player){
  
  // Kot vhodni argument dobimo razmerje stranic. Problem je, ker pri nekaterih ločljivostih lahko razmerje stranic
  // videa/našega zaslona minimalno odstopa od idealnega razmerja — npr 2560x1080 ni natanko 21:9, 1920x1080 ni 
  // natanko 16:9. Zato ob podanem razmerju stranic izračunamo dejansko razmerje stranic.
  // 
  // The aspect ratio we get as an argument is an ideal aspect ratio. Some (most) resolutions' aspect ratios differ
  // from that ideal aspect ratio (by a minimal amount) — e.g. 2560x1080 isn't exactly 21:9, 1920x1080 isn't exactly
  // 16:9. What is more, both 3440x1440 and 2560x1080 are considered "21:9", but their aspect ratios are slightly 
  // different. This has the potential to result in annoying black bars, so we correct the aspect ratio we're given
  // to something that's slightly more correct.
  
  var ar;
  var res_219 = [ [2560,1080], [3440,1440] ];
  var res_169 = [ [1920,1080], [1280,720], [1366,768] ];
  
  if(newAr == (21/9)){
    for (var i = 0; i < res_219.length; i++){
      if( player.height == res_219[i][1]){
        ar = res_219[i][0]/res_219[i][1];
        set_video_ar( ar, video, player);
        return;
      }
    }
  }
  else if(new_ar == (16/9)){
    for (var i = 0; i < res_169.length; i++){
      if( player.height == res_169[i][1]){
        ar = res_169[i][0]/res_169[i][1];
        setVideoAr( ar, video, player);
        return;
      }
    }
  }
  
  _res_setVideoAr(new_ar, video, player);
}

// Skrbi za "stare" možnosti, kot na primer "na širino zaslona", "na višino zaslona" in "ponastavi". 
// Približevanje opuščeno.
// handles "legacy" options, such as 'fit to widht', 'fit to height' and 'reset'. No zoom tho
var _res_legacyAr = function(action){
  var vid = GlobalVars.video;
  var ar;
  
  if(GlobalVars.playerDimensions === null || GlobalVars.playerDimensions === undefined){
    ar = screen.width / screen.height;
  }
  else{
    ar = GlobalVars.playerDimensions.width / GlobalVars.playerDimensions.height;
  }
  
  var fileAr = vid.videoWidth / vid.videoHeight;
  GlobalVars.lastAr = {type: "legacy", action: action};
  
  
  if(action == "fitw"){
    _res_setAr( ar > fileAr ? ar : fileAr);
    return;
  }
  if(action == "fith"){
    _res_setAr( ar < fileAr ? ar : fileAr);
    return;
  }
  if(action == "reset"){
    GlobalVars.lastAr = {type: "original"};
    _res_setAr(fileAr);
    return;
  }
  if(action == "autoar" || action == "auto"){
    GlobalVars.lastAr = {type: "auto"};
    ArDetect.init();
  }
}

var _res_setAr = function(ar, playerDimensions){
  if(Debug.debug)
    console.log("[Resizer::_res_setAr] trying to set ar. args are: ar->",ar,"; playerDimensions->",playerDimensions);

  GlobalVars.lastAr = {type: "static", ar: ar};
    
  var vid = GlobalVars.video;
  
  
  // Dejansko razmerje stranic datoteke/<video> značke
  // Actual aspect ratio of the file/<video> tag
  var fileAr = vid.videoWidth / vid.videoHeight;
  
  if(ar == "default")
    ar = fileAr;
  
  
  if(Debug.debug)
    console.log("[Resizer::_res_setAr] ar is " ,ar, ", playerDimensions are ", playerDimensions);
  
  var videoDimensions = {
    width: 0,
    height: 0
  }
  
  
  if(playerDimensions === undefined){
    playerDimensions = PlayerDetect.getPlayerDimensions(vid);
    
    if(Debug.debug)
      console.log("[Resizer::_res_setAr] playerDimensions are undefined, trying to determine new ones ... new dimensions:",playerDimensions);
  }
  
  if(Debug.debug){
    console.log("[Resizer::_res_setAr] Player dimensions?",playerDimensions);
  }
  
  if( fileAr < ar ){
    // imamo letterbox zgoraj in spodaj -> spremenimo velikost videa (ampak nikoli na več, kot je širina zaslona)
    // letterbox -> change video size (but never to wider than monitor width)
    videoDimensions.width = Math.min(playerDimensions.height * ar, playerDimensions.width);
    videoDimensions.height = videoDimensions.width * (1/fileAr);
  }
  else{
    videoDimensions.height = Math.min(playerDimensions.width * (1/ar), playerDimensions.height);
    videoDimensions.width = videoDimensions.height * fileAr;
  }
  
  if(Debug.debug){
    console.log("[Resizer::_res_setArFs] Video dimensions: ",videoDimensions, "playerDimensions:",playerDimensions);
  }
  
  var cssValues = _res_computeOffsets(videoDimensions, playerDimensions);
  
  if(Debug.debug){
    console.log("[Resizer::_res_setArFs] Offsets for css are: ",cssValues);
  }
  
  _res_applyCss(cssValues);
}

var _res_computeOffsets = function(vidDim, playerDim){
  
  if(Debug.debug)
    console.log("[Resizer::_res_computeOffsets] video will be aligned to ", Settings.miscFullscreenSettings.videoFloat);
  
  var offsets = {
    width: vidDim.width,
    height: vidDim.height,
    left: 0,
    top: ((playerDim.height - vidDim.height) / 2)
  }
  
  if( Settings.miscFullscreenSettings.videoFloat == "center" ){
    offsets.left = (playerDim.width - vidDim.width ) / 2;
    
  }
  else if( Settings.miscFullscreenSettings.videoFloat == "right" ){
    offsets.left = (playerDim.width - vidDim.width);
  }
  
  return offsets;
}

var _res_align = function(float){
  if(! float)
    float = Settings.miscFullscreenSettings.videoFloat;
  
  var dimensions = {left: 0};
  
  if(float == "left"){
    _res_applyCss(dimensions);
    return;
  }
  if(float == "center"){
//     dimensions.left = 
//     _res_applyCss(
  }
}

var _res_setStyleString_maxRetries = 3;

var _res_setStyleString = function(vid, styleString, count){
  vid.setAttribute("style", styleString);
  
  if(_res_restore_wd){
    var vid2 = GlobalVars.video;
    
    if(
      styleString.indexOf("width: " + vid2.style.width) == -1 ||
      styleString.indexOf("height: " + vid2.style.height) == -1) {
      // css ni nastavljen?
      // css not set?
      if(Debug.debug)
        console.log("[Resizer::_res_setStyleString] Style string not set ???");
      
      if(count++ < _res_setStyleString_maxRetries){
        setTimeout( _res_setStyleString, 200, count);
      }
      else if(Debug.debug){
        console.log("[Resizer::_res_setStyleString] we give up. css string won't be set");
      }
    }
    else{
      _res_restore_wd = false;
    }
  }
  else{
    if(Debug.debug)
      console.log("[Resizer::_res_setStyleString] css applied. Style string:", styleString);
  }
}

function _res_applyCss(dimensions){
  
  if(Debug.debug)
    console.log("[Resizer::_res_applyCss] Starting to apply css. this is what we're getting in:", dimensions);
  
  if(dimensions.top !== undefined)
    dimensions.top = "top: " + Math.round(dimensions.top) + "px !important";
  
  if(dimensions.left !== undefined)
    dimensions.left = "left: " + Math.round(dimensions.left) + "px !important";
  
  if(dimensions.width !== undefined)
    dimensions.width = "width: " + Math.round(dimensions.width) + "px !important";
  
  if(dimensions.height !== undefined)
    dimensions.height = "height: " + Math.round(dimensions.height) + "px !important";
 
  // misc.
  dimensions.position = "position: absolute !important";
  dimensions.margin = "margin: 0px !important";
  
  var vid = GlobalVars.video;
  
  if(Debug.debug)
    console.log("[Resizer::_res_applyCss] trying to apply css. Css strings: ", dimensions, "video tag: ", vid);
  
  
  var styleArrayStr = vid.getAttribute('style');
  
  if (styleArrayStr !== null && styleArrayStr !== undefined){
    
    var styleArray = styleArrayStr.split(";");
    for(var i in styleArray){
      
      styleArray[i] = styleArray[i].trim();
      
      if (styleArray[i].startsWith("top:")){
        styleArray[i] = dimensions.top;
        delete dimensions.top;
      }
      else if(styleArray[i].startsWith("left:")){
        styleArray[i] = dimensions.left;
        delete dimensions.left;
      }
      else if(styleArray[i].startsWith("width:")){
        styleArray[i] = dimensions.width;
        delete dimensions.width;
      }
      else if(styleArray[i].startsWith("height:")){
        styleArray[i] = dimensions.height;
        delete dimensions.height;
      }
      else if(styleArray[i].startsWith("position:")){
        styleArray[i] = dimensions.position;
        delete dimensions.position;
      }
      else if(styleArray[i].startsWith("margin:")){
        styleArray[i] = dimensions.margin;
        delete dimensions.margin;
      }
    }
  }
  else{
    var styleArray = [];
  }
  
  // add remaining elements
  for(var key in dimensions)
    styleArray.push( dimensions[key] );
  
  // build style string back
  var styleString = "";
  for(var i in styleArray)
    if(styleArray[i] !== undefined && styleArray[i] !== "")
      styleString += styleArray[i] + "; ";
  
  _res_setStyleString(vid, styleString);
}


var _res_restore = function(){
  if(Debug.debug){
    console.log("[Resizer::_res_restore] attempting to restore aspect ratio. this & settings:", {'this': this, "settings": Settings} );
  }
  
  // this is true until we verify that css has actually been applied
  _res_restore_wd = true;
  
  if(GlobalVars.lastAr.type == "legacy"){
    _res_legacyAr(GlobalVars.lastAr.action);
  }
  else if(GlobalVars.lastAr.type == "static"){
    _res_setAr(GlobalVars.lastAr.ar);
  }
  else if(GlobalVars.lastAr.type == "original"){
    _res_legacyAr("reset");
  }
}

var _res_reset = function(){
  _res_legacyAr("reset");
}

var Resizer = {
  _currentAr: -1,
  align: _res_align,
  setAr: _res_setAr,
  legacyAr: _res_legacyAr,
  reset: _res_reset,
  restore: _res_restore
}