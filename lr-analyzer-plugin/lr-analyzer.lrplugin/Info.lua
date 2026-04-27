return {
  -- Lightroom 5.7.1 compatibility
  LrSdkVersion = 5.0,
  LrSdkMinimumVersion = 5.0,

  LrToolkitIdentifier = "com.pricopi.lr-analyzer",

  LrPluginName = "LR Analyzer",
  LrPluginInfoUrl = "https://lightroom-analyzer.vercel.app",

  LrPluginVersion = {
    major = 1,
    minor = 0,
    revision = 0,
    build = 0,
  },

  LrDescription = "Analyze a photo with LR Analyzer and apply develop settings.",
  LrAuthor = "Stefan P",

  -- File -> Plug-in Extras (Lightroom Classic shows these under Plug-in Extras).
  LrLibraryMenuItems = {
    {
      title = "Analyze Selected Photo",
      file = "AnalyzePhoto.lua",
    },
    {
      title = "Batch Analyze Selected Photos",
      file = "AnalyzeBatch.lua",
    },
  },
}

