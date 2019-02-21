import Debug from './Debug';
import currentBrowser from './BrowserDetect';
import VideoAlignment from '../../common/enums/video-alignment.enum';
import Stretch from '../../common/enums/stretch.enum';
import ExtensionMode from '../../common/enums/extension-mode.enum';

if(Debug.debug)
  console.log("Loading: ExtensionConf.js");

var ExtensionConf = {
  arDetect: {
    disabledReason: "",       // if automatic aspect ratio has been disabled, show reason
    allowedMisaligned: 0.05,  // top and bottom letterbox thickness can differ by this much. 
                              // Any more and we don't adjust ar.
    allowedArVariance: 0.075, // amount by which old ar can differ from the new (1 = 100%)
    timers: {                 // autodetection frequency
      playing: 666,           // while playing
      paused: 3000,           // while paused
      error: 3000,            // after error
      minimumTimeout: 5,
      tickrate: 100,          // 1 tick every this many milliseconds
    },
    autoDisable: {            // settings for automatically disabling the extension
      maxExecutionTime: 6000, // if execution time of main autodetect loop exceeds this many milliseconds,
                              // we disable it.
      consecutiveTimeoutCount: 5,  // we only do it if it happens this many consecutive times

      // FOR FUTURE USE
      consecutiveArResets: 5       // if aspect ratio reverts immediately after AR change is applied, we disable everything
    },
    canvasDimensions: {
      blackframeCanvas: {   // smaller than sample canvas, blackframe canvas is used to recon for black frames
                            // it's not used to detect aspect ratio by itself, so it can be tiny af
        width: 16,
        height: 9,
      },
      sampleCanvas: {   // size of image sample for detecting aspect ratio. Bigger size means more accurate results,
                            // at the expense of performance
        width: 640,
        height: 360,
      },
    },

    // samplingInterval: 10,     // we sample at columns at (width/this) * [ 1 .. this - 1] 
    blackframe: {
      cumulativeTreshold: 2560,  // if we add values of all pixels together and get more than this, the frame is bright enough.
                                 // (note: blackframe is 16x9 px -> 144px total. cumulative treshold can be reached fast)
      blackPixelsCondition: 0.6, // How much pixels must be black (1 all, 0 none) before we consider frame as black. Takes
                                 // precedence over cumulative treshold: if blackPixelsCondition is met, the frame is dark
                                 // regardless of whether cumulative treshold has been reached.
    },
    blackbar: {
      blackLevel: 10,         // everything darker than 10/255 across all RGB components is considered black by
                              // default. blackLevel can decrease if we detect darker black.
      treshold: 16,           // if pixel is darker than the sum of black level and this value, we count it as black
                              // on 0-255. Needs to be fairly high (8 might not cut it) due to compression
                              // artifacts in the video itself
      imageTreshold: 4,       // in order to detect pixel as "not black", the pixel must be brighter than
                              // the sum of black level, treshold and this value.
      gradientTreshold: 2,    // When trying to determine thickness of the black bars, we take 2 values: position of
                              // the last pixel that's darker than our treshold, and position of the first pixel that's
                              // brighter than our image treshold. If positions are more than this many pixels apart,
                              // we assume we aren't looking at letterbox and thus don't correct the aspect ratio.
    },
    variableBlackbarTresholdOptions: {    // In case of poor bitrate videos, jpeg artifacts may cause us issues
      // FOR FUTURE USE
      enabled: true,                      // allow increasing blackbar threshold
      disableArDetectOnMax: true,         // disable autodetection when treshold goes over max blackbar treshold
      maxBlackbarTreshold: 48,            // max threshold (don't increase past this)
      thresholdStep: 8,                   // when failing to set aspect ratio, increase treshold by this much
      increaseAfterConsecutiveResets: 2   // increase if AR resets this many times in a row
    },
    sampling: {
      staticCols: 9,      // we take a column at [0-n]/n-th parts along the width and sample it
      randomCols: 0,      // we add this many randomly selected columns to the static columns
      staticRows: 9,      // forms grid with staticSampleCols. Determined in the same way. For black frame checks
    },
    guardLine: {              // all pixels on the guardline need to be black, or else we trigger AR recalculation 
                              // (if AR fails to be recalculated, we reset AR)
      enabled: true,
      ignoreEdgeMargin: 0.20, // we ignore anything that pokes over the black line this close to the edge
                              // (relative to width of the sample)
      imageTestTreshold: 0.1, // when testing for image, this much pixels must be over blackbarTreshold
      edgeTolerancePx: 2,         // black edge violation is performed this far from reported 'last black pixel'
      edgeTolerancePercent: null  // unused. same as above, except use % of canvas height instead of pixels
    },
    fallbackMode: {
      enabled: true,
      safetyBorderPx: 5,        // determines the thickness of safety border in fallback mode
      noTriggerZonePx: 8        // if we detect edge less than this many pixels thick, we don't correct.
    },
    arSwitchLimiter: {          // to be implemented 
      switches: 2,              // we can switch this many times
        period: 2.0             // per this period
    },
    edgeDetection: {
      sampleWidth: 8,        // we take a sample this wide for edge detection
      detectionTreshold: 4,  // sample needs to have this many non-black pixels to be a valid edge
      confirmationTreshold: 0,  // 
      singleSideConfirmationTreshold: 0.3,   // we need this much edges (out of all samples, not just edges) in order
                                             // to confirm an edge in case there's no edges on top or bottom (other
                                            // than logo, of course)
      logoTreshold: 0.15,     // if edge candidate sits with count greater than this*all_samples, it can't be logo
                              // or watermark.
      edgeTolerancePx: 1,          // we check for black edge violation this far from detection point
      edgeTolerancePercent: null,  // we check for black edge detection this % of height from detection point. unused
      middleIgnoredArea: 0.2,      // we ignore this % of canvas height towards edges while detecting aspect ratios
      minColsForSearch: 0.5,       // if we hit the edge of blackbars for all but this many columns (%-wise), we don't
                                   // continue with search. It's pointless, because black edge is higher/lower than we
                                   // are now. (NOTE: keep this less than 1 in case we implement logo detection)
    },
    pillarTest: {
      ignoreThinPillarsPx: 5, // ignore pillars that are less than this many pixels thick. 
      allowMisaligned: 0.05   // left and right edge can vary this much (%)
    },
    textLineTest: {
      nonTextPulse: 0.10,     // if a single continuous pulse has this many non-black pixels, we aren't dealing 
                              // with text. This value is relative to canvas width (%)
      pulsesToConfirm: 10,    // this is a treshold to confirm we're seeing text.
      pulsesToConfirmIfHalfBlack: 5, // this is the treshold to confirm we're seeing text if longest black pulse
                                     // is over 50% of the canvas width
      testRowOffset: 0.02     // we test this % of height from detected edge
    }
  },
  zoom: {
    minLogZoom: -1,
    maxLogZoom: 3,
    announceDebounce: 200     // we wait this long before announcing new zoom
  },
  miscSettings: {
    mousePan: {
      enabled: false
    },
    mousePanReverseMouse: false,
  },
  stretch: {
    conditionalDifferencePercent: 0.05  // black bars less than this wide will trigger stretch
                                        // if mode is set to '1'. 1.0=100%
  },
  resizer: {
    setStyleString: {
      maxRetries: 3,
      retryTimeout: 200
    }
  },
  pageInfo: {
    timeouts: {
      urlCheck: 200,
      rescan: 1500
    }
  },
  // -----------------------------------------
  //             ::: ACTIONS :::
  // -----------------------------------------
  // Nastavitve za ukaze. Zamenja stare nastavitve za bližnične tipke.
  // 
  // Polje 'shortcut' je tabela, če se slučajno lotimo kdaj delati choordov. 
  actions: [{
    name: 'Trigger automatic detection',    // name displayed in settings
    label: 'Automatic',                     // name displayed in ui (can be overriden in scope/playerUi)
    cmd: [{
      action: 'set-ar',
      arg: 'auto',
      persistent: false, // optional, false by default. If true, change doesn't take effect immediately.
                         // Instead, this action saves stuff to settings
    }],
    scopes: {
      global: {          // if 'global' is undefined, 'show' is presumed to be 'false'
        show: false,
      },
      site: {
        show: false,
      },
      page: {
        show: true,
        label: 'Automatic',   // example override, takes precedence over default label
        shortcut: [{
          key: 'a',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }],
      }
    },
    playerUi: {
      show: true,
      path: 'crop',
    },
  },{
    name: 'Reset to default',
    label: 'Reset',
    cmd: [{
      action: 'set-ar',
      arg: 'reset',
    }],
    scopes: {
      page: {
        show: true,
        shortcut: [{
          key: 'r',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }],
      }
    },
    playerUi: {
      show: true,
      path: 'crop'
    },
  },{
    name: 'Fit to width',
    label: 'Fit width',
    cmd: [{
      action: 'set-ar',
      arg: 'fitw',
    }],
    scopes: {
      page: {
        show: true,
        shortcut: [{
          key: 'w',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }],
      }
    },
    playerUi: {
      show: true,
      path: 'crop'
    }
  },{
    name: 'Fit to height',
    label: 'Fit height',
    cmd: [{
      action: 'set-ar',
      arg: 'fith',
    }],
    scopes: {
      page: {
        show: true,
        shortcut: [{
          key: 'e',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }]
      }
    },
    playerUi: {
      show: true,
      path: 'crop'
    }
  },{
    name: 'Set aspect ratio to 16:9',
    label: '16:9',
    cmd: [{
      action: 'set-ar',
      arg: 1.78,
    }],
    scopes: {
      page: {
        show: true,
        shortcut:  [{
          key: 's',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: false,
          onKeyDown: true,
        }],
      }
    },
    playerUi: {
      show: true,
      path: 'crop'
    }
  },{
    name: 'Set aspect ratio to 21:9 (2.39:1)',
    label: '21:9',
    cmd: [{
      action: 'set-ar',
      arg: 2.39,
    }],
    scopes: {
      page: {
        show: true,
        shortcut: [{
          key: 'd',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: false,
          onKeyDown: true,
        }]
      }
    },
    playerUi: {
      show: true,
      path: 'crop'
    }
  },{
    name: 'Set aspect ratio to 18:9',
    label: '18:9',
    cmd: [{
      action: 'set-ar',
      arg: 2.0,
    }],
    scopes: {
      page: {
        show: true,
        shortcut: [{
          key: 'x',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }]
      }
    },
    playerUi: {
      show: true,
      path: 'crop',
    }
  },{
    name: 'Zoom in',
    label: 'Zoom',
    cmd: [{
      action: 'change-zoom',
      arg: 0.1
    }],
    scopes: {
      page: {
        show: false,
        shortcut: [{
          key: 'z',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }],
      }
    },
    playerUi: {
      show: false,
    }
  },{
    name: 'Zoom out',
    label: 'Unzoom',
    cmd: [{
      action: 'change-zoom',
      arg: -0.1
    }],
    scopes: {
      page: {
        show: false,
        shortcut: [{
          key: 'u',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }],
      }
    },
    playerUi: {
      show: false
    }
  },{
    name: 'Toggle panning mode',
    label: 'Toggle pan',
    cmd: [{
      action: 'toggle-pan',
      arg: 'toggle'
    }],
    scopes: {
      page: {
        show: true,
        shortcut: [{
          key: 'p',
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: false,
          onKeyUp: true,
          onKeyDown: false,
        }]
      }
    },
    playerUi: {
      show: true,
      path: 'zoom'
    }
  },{
    name: 'Hold to pan',
    cmd: [{
      action: 'pan',
      arg: 'toggle',
    }],
    scopes: {
      page: {
        show: false,
        shortcut: [{
          ctrlKey: false,
          metaKey: false,
          altKey: false, 
          shiftKey: true,
          onKeyDown: false,
          onKeyUp: false,
          onMouseMove: true,
        }],
      }
    }
  },
  //
  //   S T R E T C H I N G
  //
  {
    name: 'Set stretch to "none"',
    label: 'Don\'t stretch',
    cmd: [{
      action: 'set-stretch',
      arg: Stretch.NoStretch,
    }],
    scopes: {
      global: {
        show: true,
        label: 'Normal'
      },
      site: {
        show: true,
        label: 'Normal'
      },
      page: {
        show: true,
        label: 'Normal'
      }
    },
    playerUi: {
      show: true,
      path: 'stretch'
    }
  },{
    name: 'Set stretch to "basic"',
    label: 'Basic stretch',
    cmd: [{
      action: 'set-stretch',
      arg: Stretch.Basic,
    }],
    scopes: {
      global: {
        show: true,
        label: 'Basic'
      },
      site: {
        show: true,
        label: 'Basic'
      },
      page: {
        show: true,
        label: 'Basic'
      }
    },
    playerUi: {
      show: true,
      path: 'stretch'
    }
  },{
    name: 'Set stretch to "hybrid"',
    label: 'Hybrid stretch',
    cmd: [{
      action: 'set-stretch',
      arg: Stretch.Hybrid,
    }],
    scopes: {
      global: {
        show: true,
        label: 'Hybrid'
      },
      site: {
        show: true,
        label: 'Hybrid'
      },
      page: {
        show: true,
        label: 'Hybrid'
      }
    },
    playerUi: {
      show: true,
      path: 'stretch'
    }
  },{
    name: 'Stretch only to hide thin borders',
    label: 'Thin borders only',
    cmd: [{
      action: 'set-stretch',
      arg: Stretch.Conditional,
    }],
    scopes: {
      global: {
        show: true,
        label: 'Thin borders'
      },
      site: {
        show: true,
        label: 'Thin borders'
      },
      page: {
        show: true,
        label: 'Thin borders'
      }
    },
    playerUi: {
      show: true,
      path: 'stretch'
    }
  },{
    name: 'Set stretch to default value',
    label: 'Default',
    cmd: [{
      action: 'set-stretch',
      arg: Stretch.Default,
    }],
    scopes: {
      site: {
        show: true,
      }
    }
  },
  //
  //    A L I G N M E N T
  //
  {
    name: 'Align video to the left',
    label: 'Left',
    cmd: [{
      action: 'set-alignment',
      arg: VideoAlignment.Left,
    }],
    scopes: {
      global: {
        show: true,
      },
      site: {
        show: true,
      },
      page: {
        show: true,
      }
    },
    playerUi: {
      show: true,
      path: 'align'
    }
  },{
    name: 'Align video to center',
    label: 'Center',
    cmd: [{
      action: 'set-alignment',
      arg: VideoAlignment.Center,
    }],
    scopes: {
      global: {
        show: true,
      },
      site: {
        show: true,
      },
      page: {
        show: true,
      }
    },
    playerUi: {
      show: true,
      path: 'align'
    }
  },{
    name: 'Align video to the right',
    label: 'Right',
    cmd: [{
      action: 'set-alignment',
      arg: VideoAlignment.Right
    }],
    scopes: {
      global: {
        show: true,
      },
      site: {
        show: true,
      },
      page: {
        show: true,
      }
    },
    playerUi: {
      show: true,
      path: 'align'
    }
  },{
    name: 'Use default alignment',
    label: 'Default',
    cmd: [{
      action: 'set-alignment',
      arg: VideoAlignment.Default
    }],
    scopes: {
      site: {
        show: true,
      }
    }
  },
  //
  //    E N A B L E   E X T E N S I O N / A U T O A R
  //    (for sites/extension tab in the popup)
  //
  { 
    name: 'Enable extension',
    label: 'Enable',
    cmd: [{
      action: 'set-extension-mode',
      arg: ExtensionMode.Enabled,
      persistent: true,
    }],
    scopes: {
      global: {
        show: true,
      },
      site: {
        show: true,
      }
    }
  },{
    name: 'Enable extension on whitelisted sites only',
    label: 'On whitelist only',
    cmd: [{
      action: 'set-extension-mode',
      arg: ExtensionMode.Whitelist,
      persistent: true,
    }],
    scopes: {
      global: {
        show: true
      }
    }
  },{
    name: 'Extension mode: use default settings',
    label: 'Default',
    cmd: [{
      action: 'set-extension-mode',
      arg: ExtensionMode.Default,
      persistent: true,
    }],
    scopes: {
      site: {
        show: true
      }
    }
  },{
    name: 'Disable extension',
    label: 'Disable',
    cmd: [{
      action: 'set-extension-mode',
      arg: ExtensionMode.Disabled,
      persistent: true,
    }],
    scopes: {
      global: {
        show: true,
      },
      site: {
        show: true,
      }
    }
  },{
    name: 'Enable automatic aspect ratio detection',
    label: 'Enable',
    cmd: [{
      action: 'set-autoar-mode',
      arg: ExtensionMode.Enabled,
      persistent: true,
    }],
    scopes: {
      global: {
        show: true
      },
      site: {
        show: true
      }
    }
  },{
    name: 'Enable automatic aspect ratio detection on whitelisted sites only',
    label: 'On whitelist only',
    cmd: [{
      action: 'set-autoar-mode',
      arg: ExtensionMode.Whitelist,
      persistent: true,
    }],
    scopes: {
      global: {
        show: true,
      }
    }
  },{
    name: 'Use default settings for automatic aspect ratio detection',
    label: 'Default',
    cmd: [{
      action: 'set-autoar-mode',
      arg: ExtensionMode.Default,
      persistent: true,
    }],
    scopes: {
      site: {
        show: true,
      }
    }
  },{
    name: 'Disable automatic aspect ratio detection',
    label: 'Disable',
    cmd: [{
      action: 'set-autoar-mode',
      arg: ExtensionMode.Disabled,
      persistent: true,
    }],
    scopes: {
      global: {
        show: true,
      }, 
      site: {
        show: true,
      }
    }
  },],
  // -----------------------------------------
  //       ::: SITE CONFIGURATION :::
  // -----------------------------------------
  // Nastavitve za posamezno stran
  // Config for a given page:
  // 
  // <hostname> : {
  //    status: <option>              // should extension work on this site?
  //    arStatus: <option>            // should we do autodetection on this site?
  //    
  //    defaultAr?: <ratio>          // automatically apply this aspect ratio on this side. Use extension defaults if undefined.
  //    stretch? <stretch mode>       // automatically stretch video on this site in this manner
  //    videoAlignment? <left|center|right>
  //
  //    type: <official|community|user>  // 'official' — blessed by Tam. 
  //                                     // 'community' — blessed by reddit.
  //                                     // 'user' — user-defined (not here)
  //    override: <true|false>           // override user settings for this site on update
  // } 
  //  
  // Veljavne vrednosti za možnosti 
  // Valid values for options:
  //
  //     status, arStatus, statusEmbedded:
  //    
  //    * enabled     — always allow, full
  //    * basic       — allow, but only the basic version without playerData
  //    * default     — allow if default is to allow, block if default is to block
  //    * disabled    — never allow
  // 
  sites: {
    "@global": {                        // global defaults. Possible options will state site-only options in order
                                        // to avoid writing this multiple times. Tags:
                                        //      #g — only available in @global
                                        //      #s   — only available for specific site
      mode: ExtensionMode.Enabled,      //  How should extension work:
                                        //       'enabled'   - work everywhere except blacklist
                                        //       'whitelist' - only work on whitelisted sites (#g)
                                        //       'disabled'  - work nowhere
                                        //       'basic'     - (Possible future use)
                                        //       'default'   - follow global rules (#s)
      autoar: ExtensionMode.Enabled,    //  Should we try to automatically detect aspect ratio? 
                                        //  Options: 'enabled', 'whitelist' (#g), 'default' (#s), 'disabled'
      autoarFallback: currentBrowser.firefox ?     // if autoAr fails, try fallback mode?
                       ExtensionMode.Enabled :     // Options same as in autoar.
                       ExtensionMode.Disabled,     // if autoar is disabled, this setting is irrelevant
      stretch: Stretch.NoStretch,                  // Default stretch mode. 
      videoAlignment: VideoAlignment.Center,       // Video alignment

    },
    "www.youtube.com" : {
      mode: ExtensionMode.Enabled,
      autoar: ExtensionMode.Enabled,
      autoarFallback: ExtensionMode.Enabled,
      override: false,                  // ignore value localStorage in favour of this
      type: 'official',                 // is officially supported? (Alternatives are 'community' and 'user-defined')
      actions: null,                    // overrides global keyboard shortcuts and button configs. Is array, is optional.
      stretch: Stretch.Default,
      videoAlignment: VideoAlignment.Default,
    },
    "www.netflix.com" : {
      mode: ExtensionMode.Enabled,
      autoar: currentBrowser.firefox ? ExtensionMode.Enabled : ExtensionMode.Disabled,     
      override: false,
      type: 'official',
      stretch: Stretch.Default,
      videoAlignment: VideoAlignment.Default,
    },
  }
}

export default ExtensionConf;